import { useMemo, useState } from "react";
import {
  createReference3UDocument,
  getParam,
  setPartParam,
  type SfdDocument,
} from "@spacetech/sfd-lang";
import { analyzeWorkbook } from "../workbook";

/** Secondary analysis overlay — not the CAD home screen. */
export function AnalysisPanel() {
  const [doc, setDoc] = useState<SfdDocument>(() => createReference3UDocument());
  const wb = useMemo(() => analyzeWorkbook(doc), [doc]);
  const chassis = doc.parts.find((p) => p.id === "chassis");
  const panelH = wb.panelHeightMm;

  return (
    <div className="analysis-panel">
      <div className="ux-banner" role="status">
        Analysis is an overlay — geometry authority is Part Studio.
      </div>

      <header className="analysis-head">
        <h2>Analysis overlay (L0)</h2>
        <p>Educational mass / power / CDS checks against current Part Studio geometry.</p>
      </header>

      <div className="analysis-grid">
        <section>
          <h3>Envelope &amp; solar</h3>
          <label className="field">
            <span>Width</span>
            <input
              type="number"
              value={chassis ? getParam(chassis, "widthMm", 100) : 100}
              onChange={(e) =>
                setDoc(
                  setPartParam(doc, "chassis", "widthMm", Number(e.target.value)),
                )
              }
            />
          </label>
          <label className="field">
            <span>Height</span>
            <input
              type="number"
              value={chassis ? getParam(chassis, "heightMm", 340.5) : 340.5}
              onChange={(e) =>
                setDoc(
                  setPartParam(doc, "chassis", "heightMm", Number(e.target.value)),
                )
              }
            />
          </label>
          <label className="field">
            <span>Panel H</span>
            <input
              type="number"
              value={panelH}
              onChange={(e) => {
                const v = Number(e.target.value);
                let next = setPartParam(doc, "solar-xp", "heightMm", v);
                next = setPartParam(next, "solar-xn", "heightMm", v);
                setDoc(next);
              }}
            />
          </label>
          <div className="stat">
            <span>Mass</span>
            <span>{wb.budgetSummary.totalMassKg.toFixed(3)} kg</span>
          </div>
          <div className="stat">
            <span>PV gen</span>
            <span>{wb.budgetSummary.solarGenerationW.toFixed(2)} W</span>
          </div>
          <div className="stat">
            <span>Nominal load</span>
            <span>{wb.budgetSummary.powerByMode.nominal.toFixed(2)} W</span>
          </div>
        </section>

        <section>
          <h3>CDS scorecard · {wb.scorecardLine}</h3>
          {wb.scorecard.map((c) => (
            <div className="check" key={c.id}>
              <div className={`status ${c.status}`}>{c.status}</div>
              <div>
                <strong>{c.title}</strong> — {c.message}
                <div className="citation">{c.citation}</div>
              </div>
            </div>
          ))}
        </section>

        <section className="span-2">
          <h3>Margins</h3>
          {wb.budgetSummary.margins.map((m) => (
            <div className="check" key={m.id}>
              <div className={`status margin-${m.status}`}>{m.status}</div>
              <div>
                <strong>{m.title}</strong> — {m.value}
                <div className="citation">{m.message}</div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
