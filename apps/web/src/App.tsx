import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveAs } from "file-saver";
import {
  createReference3UDocument,
  getParam,
  type SfdDocument,
  type SfdPart,
} from "@spacetech/sfd-lang";
import { createEmptyLedger, summarize } from "@spacetech/budgets";
import { runCdsScorecard, type CdsCheckResult } from "@spacetech/rules-cds";
import type { TessellationResult } from "@spacetech/kernel-bridge";
import { getCadApi } from "./cad/client";
import { Viewport } from "./components/Viewport";

type SourceMode = "parametric" | "imported";

/** Bundled open LEO CubeSat structure (CERN-OHL-P). */
const REFERENCE_STEP_URL = "/reference/OSCubeSatStruct_Mk5_3U.step";
const REFERENCE_STEP_NAME = "OSCubeSatStruct Mk5 3U structure";

function budgetsFromDoc(doc: SfdDocument) {
  const chassis = doc.parts.find((p) => p.id === "chassis");
  const w = chassis ? getParam(chassis, "widthMm", 100) : 100;
  const d = chassis ? getParam(chassis, "depthMm", 100) : 100;
  const h = chassis ? getParam(chassis, "heightMm", 340.5) : 340.5;

  const ledger = createEmptyLedger();
  for (const part of doc.parts) {
    if (part.massKg && part.massKg > 0) {
      ledger.massItems.push({
        id: part.id,
        name: part.name,
        massKg: part.massKg,
        cgMm: { x: 0, y: 0, z: getParam(part, "zMm", h / 2) },
      });
    }
    if (
      part.wattsNominal != null ||
      part.wattsPeak != null ||
      part.wattsSafe != null ||
      part.wattsEclipse != null
    ) {
      ledger.powerItems.push({
        id: part.id,
        name: part.name,
        wattsByMode: {
          safe: part.wattsSafe ?? 0,
          nominal: part.wattsNominal ?? 0,
          peak: part.wattsPeak ?? 0,
          eclipse: part.wattsEclipse ?? 0,
        },
      });
    }
  }

  ledger.assumptions.push(
    "Budgets come from the educational SFD subsystem tags — independent of imported STEP visuals",
  );
  ledger.assumptions.push(
    "Default 3D model is OSCubeSatStruct Mk5 (open hardware). CDS checks use the parametric envelope.",
  );

  const budgetSummary = summarize(ledger);
  const scorecard = runCdsScorecard({
    units: 3,
    envelopeMm: { x: w, y: d, z: h },
    totalMassKg: budgetSummary.totalMassKg,
  });

  return { budgetSummary, scorecard, envelope: { w, d, h } };
}

function setChassisParam(
  doc: SfdDocument,
  name: string,
  value: number,
): SfdDocument {
  return {
    ...doc,
    parts: doc.parts.map((part) => {
      if (part.id !== "chassis") return part;
      return {
        ...part,
        params: part.params.map((p) =>
          p.name === name ? { ...p, value } : p,
        ),
      };
    }),
  };
}

function groupParts(parts: SfdPart[]) {
  const groups = new Map<string, SfdPart[]>();
  for (const part of parts) {
    const key = part.subsystem ?? "other";
    const list = groups.get(key) ?? [];
    list.push(part);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

export function App() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [doc, setDoc] = useState<SfdDocument>(() => createReference3UDocument());
  const demo = useMemo(() => budgetsFromDoc(doc), [doc]);
  const [mesh, setMesh] = useState<TessellationResult | null>(null);
  const [status, setStatus] = useState("Loading OpenCascade worker…");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<SourceMode>("imported");
  const [importName, setImportName] = useState<string | null>(null);
  const bootstrapped = useRef(false);

  const chassis = doc.parts.find((p) => p.id === "chassis");
  const widthMm = chassis ? getParam(chassis, "widthMm", 100) : 100;
  const depthMm = chassis ? getParam(chassis, "depthMm", 100) : 100;
  const heightMm = chassis ? getParam(chassis, "heightMm", 340.5) : 340.5;

  const showMesh = useCallback(async (result: TessellationResult, label: string) => {
    const tris = result.faces.triangles.length / 3;
    if (!Number.isFinite(tris) || tris <= 0) {
      throw new Error("Kernel returned an empty mesh");
    }
    setMesh(result);
    setStatus(`${label} · ${Math.round(tris).toLocaleString()} triangles`);
  }, []);

  const importFromUrl = useCallback(
    async (url: string, label: string) => {
      setBusy(true);
      setError(null);
      setStatus(`Loading ${label}…`);
      try {
        const cad = getCadApi();
        await cad.ready();
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Could not fetch ${url} (${res.status})`);
        const blob = await res.blob();
        const file = new File([blob], label.endsWith(".step") ? label : `${label}.step`, {
          type: "application/step",
        });
        const result = await cad.importModel(file);
        await showMesh(result, label);
        setMode("imported");
        setImportName(label);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Import failed";
        setError(message);
        setStatus("Import failed");
        setMesh(null);
      } finally {
        setBusy(false);
      }
    },
    [showMesh],
  );

  const regenerateParametric = useCallback(
    async (next: SfdDocument) => {
      setBusy(true);
      setError(null);
      setStatus("Tessellating simple parametric frame…");
      try {
        const cad = getCadApi();
        await cad.ready();
        const result = await cad.createMesh(next);
        await showMesh(result, "Simple parametric frame");
        setMode("parametric");
        setImportName(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Kernel error";
        setError(message);
        setStatus("Kernel failed — see banner");
        setMesh(null);
      } finally {
        setBusy(false);
      }
    },
    [showMesh],
  );

  // Default: load the open 3U structure STEP (real CubeSat geometry)
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void importFromUrl(REFERENCE_STEP_URL, REFERENCE_STEP_NAME);
  }, [importFromUrl]);

  useEffect(() => {
    if (mode !== "parametric") return;
    void regenerateParametric(doc);
  }, [doc, mode, regenerateParametric]);

  async function downloadStep() {
    if (mode !== "parametric") {
      setError("Export STEP from parametric mode, or re-download the open structure file from Import.");
      return;
    }
    setBusy(true);
    try {
      const blob = await getCadApi().createStep(doc);
      saveAs(blob, `${doc.name.replace(/\s+/g, "_")}.step`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "STEP export failed");
    } finally {
      setBusy(false);
    }
  }

  async function onImportFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setStatus(`Importing ${file.name}…`);
    try {
      const cad = getCadApi();
      await cad.ready();
      const result = await cad.importModel(file);
      await showMesh(result, file.name);
      setMode("imported");
      setImportName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStatus("Import failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const { budgetSummary, scorecard } = demo;
  const subsystems = groupParts(doc.parts);

  return (
    <main>
      <header>
        <h1>Space Tech 3D</h1>
        <p>
          CubeSat Phase A workbook. Default 3D model is an <strong>open 3U
          structure</strong> (OSCubeSatStruct Mk5). Budgets/scorecard stay on the
          educational subsystem tags beside it.
        </p>
      </header>

      <div className="banner" role="note">
        <strong>What you should see:</strong> a real CubeSat frame (rails +
        endplates), roughly <strong>10 × 10 × 34 cm</strong> — the long axis is
        the 3U height, not a bug. Orbit/drag to inspect.
        <br />
        <strong>Not flight-qualified.</strong>{" "}
        {mode === "imported" ? (
          <>
            Viewing <code>{importName}</code>.
          </>
        ) : (
          <>
            Viewing simple parametric placeholder · project <code>{doc.name}</code>.
          </>
        )}
        {error ? (
          <>
            <br />
            <span className="error-text">Error: {error}</span>
          </>
        ) : null}
      </div>

      <div className="actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => void importFromUrl(REFERENCE_STEP_URL, REFERENCE_STEP_NAME)}
        >
          Load open 3U structure
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => {
            setMode("parametric");
            setDoc(createReference3UDocument());
          }}
        >
          Simple parametric demo
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          Import your STEP / STL
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".step,.stp,.stl,model/step,model/stl"
          hidden
          onChange={(e) => void onImportFile(e.target.files?.[0])}
        />
        <button
          type="button"
          className="secondary"
          disabled={busy || mode !== "parametric"}
          onClick={() => void downloadStep()}
        >
          Export parametric STEP
        </button>
      </div>

      <div className="grid">
        <section className="panel viewport-panel">
          <h2>3D viewport</h2>
          <Viewport mesh={mesh} status={status} />
          <p className="hint">
            Source:{" "}
            <a
              href="https://github.com/elfenix7/OSCubeSatStruct"
              target="_blank"
              rel="noreferrer"
            >
              OSCubeSatStruct
            </a>{" "}
            (CERN-OHL-P). Bundled at <code>/reference/OSCubeSatStruct_Mk5_3U.step</code>.
          </p>
        </section>

        <section className="panel">
          <h2>Envelope for CDS checks (mm)</h2>
          <p className="hint">
            These numbers drive the scorecard/budgets. They do not reshape the
            imported open structure (yet).
          </p>
          <label className="field">
            <span>Width</span>
            <input
              type="number"
              min={80}
              max={120}
              step={0.5}
              value={widthMm}
              disabled={busy}
              onChange={(e) =>
                setDoc(setChassisParam(doc, "widthMm", Number(e.target.value)))
              }
            />
          </label>
          <label className="field">
            <span>Depth</span>
            <input
              type="number"
              min={80}
              max={120}
              step={0.5}
              value={depthMm}
              disabled={busy}
              onChange={(e) =>
                setDoc(setChassisParam(doc, "depthMm", Number(e.target.value)))
              }
            />
          </label>
          <label className="field">
            <span>Height</span>
            <input
              type="number"
              min={100}
              max={400}
              step={0.5}
              value={heightMm}
              disabled={busy}
              onChange={(e) =>
                setDoc(setChassisParam(doc, "heightMm", Number(e.target.value)))
              }
            />
          </label>

          <h2 style={{ marginTop: "1.25rem" }}>Mass &amp; power (L0)</h2>
          <div className="stat">
            <span>Total mass</span>
            <span>{budgetSummary.totalMassKg.toFixed(3)} kg</span>
          </div>
          <div className="stat">
            <span>Safe</span>
            <span>{budgetSummary.powerByMode.safe.toFixed(2)} W</span>
          </div>
          <div className="stat">
            <span>Nominal</span>
            <span>{budgetSummary.powerByMode.nominal.toFixed(2)} W</span>
          </div>
          <div className="stat">
            <span>Peak</span>
            <span>{budgetSummary.powerByMode.peak.toFixed(2)} W</span>
          </div>
          <div className="stat">
            <span>Eclipse</span>
            <span>{budgetSummary.powerByMode.eclipse.toFixed(2)} W</span>
          </div>
        </section>

        <section className="panel">
          <h2>Subsystems (workbook)</h2>
          {subsystems.map(([name, parts]) => (
            <div className="subsystem" key={name}>
              <div className="subsystem-title">{name}</div>
              <ul>
                {parts.map((p) => (
                  <li key={p.id}>
                    <strong>{p.name}</strong>
                    {p.massKg != null ? ` · ${p.massKg.toFixed(2)} kg` : ""}
                    {p.wattsNominal != null
                      ? ` · ${p.wattsNominal.toFixed(1)} W nom`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="panel">
          <h2>CDS scorecard</h2>
          {scorecard.map((check: CdsCheckResult) => (
            <div className="check" key={check.id}>
              <div className={`status ${check.status}`}>{check.status}</div>
              <div>
                <strong>{check.title}</strong> — {check.message}
              </div>
              <div className="citation">{check.citation}</div>
            </div>
          ))}
          <h2 style={{ marginTop: "1rem" }}>Assumptions</h2>
          <ul className="assumptions">
            {budgetSummary.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      </div>

      <footer>
        Build around the open 3U structure, or import another CubeSat STEP from
        LibreCube / university repos. Apache-2.0 app · see EXPORT_CONTROL.md
      </footer>
    </main>
  );
}
