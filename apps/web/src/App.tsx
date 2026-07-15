import { useMemo, useState } from "react";
import { createEmptyDocument } from "@spacetech/sfd-lang";
import { createEmptyLedger, summarize } from "@spacetech/budgets";
import { runCdsScorecard, type CdsCheckResult } from "@spacetech/rules-cds";

type DemoPayload = {
  budgetSummary: ReturnType<typeof summarize>;
  scorecard: CdsCheckResult[];
  disclaimer: string;
};

function localDemo(): DemoPayload {
  const ledger = createEmptyLedger();
  ledger.massItems.push({
    id: "structure",
    name: "Structure (placeholder)",
    massKg: 1.5,
    cgMm: { x: 0, y: 0, z: 170 },
  });
  ledger.powerItems.push({
    id: "bus",
    name: "Bus loads (placeholder)",
    wattsByMode: { safe: 1, nominal: 3, peak: 5, eclipse: 2 },
  });
  ledger.assumptions.push("MVP-1 placeholder — not a flight design");
  const budgetSummary = summarize(ledger);
  return {
    budgetSummary,
    scorecard: runCdsScorecard({
      units: 3,
      envelopeMm: { x: 100, y: 100, z: 340.5 },
      totalMassKg: budgetSummary.totalMassKg,
    }),
    disclaimer: "Not flight-qualified. Educational placeholder data.",
  };
}

export function App() {
  const doc = useMemo(() => createEmptyDocument("Reference-3U"), []);
  const [demo, setDemo] = useState<DemoPayload>(() => localDemo());
  const [source, setSource] = useState<"local" | "api">("local");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadFromApi() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/v1/demo/reference-3u");
      if (!res.ok) {
        throw new Error(`API ${res.status}`);
      }
      const body = (await res.json()) as DemoPayload;
      setDemo(body);
      setSource("api");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach API");
      setDemo(localDemo());
      setSource("local");
    } finally {
      setLoading(false);
    }
  }

  const { budgetSummary, scorecard } = demo;

  return (
    <main>
      <header>
        <h1>Space Tech 3D</h1>
        <p>
          CubeSat Phase A systems workbook — parametric geometry, budgets, and
          CDS-aware checks. Working name: SpaceForge.
        </p>
      </header>

      <div className="banner" role="note">
        <strong>Not flight-qualified.</strong> {demo.disclaimer} Project:{" "}
        <code>{doc.name}</code> · data source: {source}
        {error ? ` · API fallback (${error})` : null}
      </div>

      <div className="actions">
        <button type="button" onClick={() => setDemo(localDemo())}>
          Reset local demo
        </button>
        <button
          type="button"
          className="secondary"
          disabled={loading}
          onClick={() => void loadFromApi()}
        >
          {loading ? "Loading…" : "Load from API"}
        </button>
      </div>

      <div className="grid">
        <section className="panel">
          <h2>Viewport</h2>
          <div className="viewport">
            3D / OCCT worker lands in MVP-2.
            <br />
            B-rep will be truth; mesh is display only.
          </div>
        </section>

        <section className="panel">
          <h2>Budgets (L0)</h2>
          <div className="stat">
            <span>Total mass</span>
            <span>{budgetSummary.totalMassKg.toFixed(3)} kg</span>
          </div>
          <div className="stat">
            <span>Power · nominal</span>
            <span>{budgetSummary.powerByMode.nominal.toFixed(2)} W</span>
          </div>
          <div className="stat">
            <span>Power · eclipse</span>
            <span>{budgetSummary.powerByMode.eclipse.toFixed(2)} W</span>
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
        Apache-2.0 · See EXPORT_CONTROL.md · University-first MVP scaffolding
      </footer>
    </main>
  );
}
