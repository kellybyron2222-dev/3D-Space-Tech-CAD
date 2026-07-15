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
    "Educational L0 budgets from tagged Reference-3U parts — not a flight mass properties report",
  );
  ledger.assumptions.push(
    "CDS checks are soft educational guidelines; launch provider ICD supersedes",
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
  const [mode, setMode] = useState<SourceMode>("parametric");
  const [importName, setImportName] = useState<string | null>(null);

  const chassis = doc.parts.find((p) => p.id === "chassis");
  const widthMm = chassis ? getParam(chassis, "widthMm", 100) : 100;
  const depthMm = chassis ? getParam(chassis, "depthMm", 100) : 100;
  const heightMm = chassis ? getParam(chassis, "heightMm", 340.5) : 340.5;

  const regenerate = useCallback(async (next: SfdDocument) => {
    setBusy(true);
    setError(null);
    setStatus("Tessellating B-rep in worker…");
    try {
      const cad = getCadApi();
      await cad.ready();
      const result = await cad.createMesh(next);
      const tris = result.faces.triangles.length / 3;
      if (!Number.isFinite(tris) || tris <= 0) {
        throw new Error("Kernel returned an empty mesh");
      }
      setMesh(result);
      setMode("parametric");
      setImportName(null);
      setStatus(`Ready · ${Math.round(tris).toLocaleString()} triangles`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kernel error";
      setError(message);
      setStatus("Kernel failed — see banner");
      setMesh(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "imported") return;
    void regenerate(doc);
  }, [doc, regenerate, mode]);

  async function downloadStep() {
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

  async function downloadStl() {
    setBusy(true);
    try {
      const blob = await getCadApi().createStl(doc);
      saveAs(blob, `${doc.name.replace(/\s+/g, "_")}.stl`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "STL export failed");
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
      const tris = result.faces.triangles.length / 3;
      if (!tris) throw new Error("Imported file produced an empty mesh");
      setMesh(result);
      setMode("imported");
      setImportName(file.name);
      setStatus(
        `Imported ${file.name} · ${Math.round(tris).toLocaleString()} triangles`,
      );
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
          CubeSat Phase A systems workbook — parametric OCCT geometry, subsystem
          budgets, CDS checks, and STEP/STL import/export.
        </p>
      </header>

      <div className="banner" role="note">
        <strong>Not flight-qualified.</strong> Early MVP: richer than a blank
        box, still educational L0 fidelity.{" "}
        {mode === "imported" ? (
          <>
            Viewing imported model <code>{importName}</code>.
          </>
        ) : (
          <>
            Project <code>{doc.name}</code> · {doc.parts.length} parts.
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
          onClick={() => {
            setMode("parametric");
            setDoc(createReference3UDocument());
          }}
        >
          Load Reference-3U
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          Import STEP / STL
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
          disabled={busy || mode === "imported"}
          onClick={() => void downloadStep()}
        >
          Export STEP
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy || mode === "imported"}
          onClick={() => void downloadStl()}
        >
          Export STL
        </button>
      </div>

      <div className="grid">
        <section className="panel viewport-panel">
          <h2>3D viewport</h2>
          <Viewport mesh={mesh} status={status} />
        </section>

        <section className="panel">
          <h2>Chassis envelope (mm)</h2>
          <label className="field">
            <span>Width</span>
            <input
              type="number"
              min={80}
              max={120}
              step={0.5}
              value={widthMm}
              disabled={busy || mode === "imported"}
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
              disabled={busy || mode === "imported"}
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
              disabled={busy || mode === "imported"}
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
          <h2>Subsystems</h2>
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
        Import accepts STEP/STL for visualization. Parametric edits require the
        Reference-3U (or future SFD) model. Apache-2.0 · see EXPORT_CONTROL.md
      </footer>
    </main>
  );
}
