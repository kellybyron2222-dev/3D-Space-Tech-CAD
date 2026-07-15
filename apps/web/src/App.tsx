import { useCallback, useEffect, useMemo, useState } from "react";
import { saveAs } from "file-saver";
import {
  createReference3UDocument,
  getParam,
  type SfdDocument,
} from "@spacetech/sfd-lang";
import { createEmptyLedger, summarize } from "@spacetech/budgets";
import { runCdsScorecard, type CdsCheckResult } from "@spacetech/rules-cds";
import type { TessellationResult } from "@spacetech/kernel-bridge";
import { getCadApi } from "./cad/client";
import { Viewport } from "./components/Viewport";

type DemoPayload = {
  budgetSummary: ReturnType<typeof summarize>;
  scorecard: CdsCheckResult[];
  disclaimer: string;
};

function budgetsFromDoc(doc: SfdDocument): DemoPayload {
  const chassis = doc.parts.find((p) => p.id === "chassis");
  const w = chassis ? getParam(chassis, "widthMm", 100) : 100;
  const d = chassis ? getParam(chassis, "depthMm", 100) : 100;
  const h = chassis ? getParam(chassis, "heightMm", 340.5) : 340.5;
  // Crude L0 mass estimate: aluminum-ish density * volume of thin shell proxy
  const volumeM3 = (w * d * h * 1e-9) * 0.12;
  const massKg = Math.max(0.8, volumeM3 * 2700);

  const ledger = createEmptyLedger();
  ledger.massItems.push({
    id: "structure",
    name: "Structure (L0 estimate)",
    massKg,
    cgMm: { x: 0, y: 0, z: h / 2 },
  });
  ledger.powerItems.push({
    id: "bus",
    name: "Bus loads (placeholder)",
    wattsByMode: { safe: 1, nominal: 3, peak: 5, eclipse: 2 },
  });
  ledger.assumptions.push(
    "Mass is an L0 placeholder from envelope volume fraction — not a flight mass budget",
  );

  const budgetSummary = summarize(ledger);
  return {
    budgetSummary,
    scorecard: runCdsScorecard({
      units: 3,
      envelopeMm: { x: w, y: d, z: h },
      totalMassKg: budgetSummary.totalMassKg,
    }),
    disclaimer: "Not flight-qualified. Educational placeholder data.",
  };
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

export function App() {
  const [doc, setDoc] = useState<SfdDocument>(() => createReference3UDocument());
  const demo = useMemo(() => budgetsFromDoc(doc), [doc]);
  const [mesh, setMesh] = useState<TessellationResult | null>(null);
  const [status, setStatus] = useState("Loading OpenCascade worker…");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setMesh(result);
      setStatus("Ready");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kernel error";
      setError(message);
      setStatus("Kernel failed");
      setMesh(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void regenerate(doc);
  }, [doc, regenerate]);

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

  const { budgetSummary, scorecard } = demo;

  return (
    <main>
      <header>
        <h1>Space Tech 3D</h1>
        <p>
          CubeSat Phase A systems workbook — OCCT B-rep in a Web Worker, live
          budgets, CDS-aware checks. Working name: SpaceForge.
        </p>
      </header>

      <div className="banner" role="note">
        <strong>Not flight-qualified.</strong> {demo.disclaimer} Project:{" "}
        <code>{doc.name}</code>
        {error ? ` · ${error}` : null}
      </div>

      <div className="actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => setDoc(createReference3UDocument())}
        >
          Reset Reference-3U
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => void downloadStep()}
        >
          Export STEP
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => void downloadStl()}
        >
          Export STL
        </button>
      </div>

      <div className="grid">
        <section className="panel viewport-panel">
          <h2>3D viewport (B-rep → mesh)</h2>
          <Viewport mesh={mesh} status={status} />
        </section>

        <section className="panel">
          <h2>Chassis params (mm)</h2>
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

          <h2 style={{ marginTop: "1.25rem" }}>Budgets (L0)</h2>
          <div className="stat">
            <span>Total mass</span>
            <span>{budgetSummary.totalMassKg.toFixed(3)} kg</span>
          </div>
          <div className="stat">
            <span>Power · nominal</span>
            <span>{budgetSummary.powerByMode.nominal.toFixed(2)} W</span>
          </div>
          <div className="stat">
            <span>Fidelity</span>
            <span>{budgetSummary.fidelity}</span>
          </div>
        </section>

        <section className="panel" style={{ gridColumn: "1 / -1" }}>
          <h2>CDS scorecard</h2>
          {scorecard.map((check) => (
            <div className="check" key={check.id}>
              <div className={`status ${check.status}`}>{check.status}</div>
              <div>
                <strong>{check.title}</strong> — {check.message}
              </div>
              <div className="citation">{check.citation}</div>
            </div>
          ))}
        </section>
      </div>

      <footer>
        Apache-2.0 · OpenCascade via Replicad (see NOTICE) · EXPORT_CONTROL.md
      </footer>
    </main>
  );
}
