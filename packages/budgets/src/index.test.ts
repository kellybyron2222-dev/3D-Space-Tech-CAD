import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createReference3UDocument, setPartParam } from "@spacetech/sfd-lang";
import {
  bomFromDocument,
  bomToCsv,
  createEmptyLedger,
  ledgerFromDocument,
  summarize,
} from "./index.js";

describe("budgets", () => {
  it("sums mass and mode power", () => {
    const ledger = createEmptyLedger();
    ledger.massItems.push({
      id: "structure",
      name: "Structure",
      massKg: 1.2,
      cgMm: { x: 0, y: 0, z: 50 },
    });
    ledger.powerItems.push({
      id: "obc",
      name: "OBC",
      wattsByMode: { safe: 0.5, nominal: 1.5, peak: 2.0, eclipse: 1.0 },
    });
    ledger.assumptions.push("L0 spreadsheet estimate");

    const summary = summarize(ledger);
    assert.equal(summary.totalMassKg, 1.2);
    assert.equal(summary.powerByMode.nominal, 1.5);
    assert.ok(summary.cgMm);
    assert.equal(summary.cgMm?.z, 50);
  });

  it("binds solar area to generation and margins from Reference-3U", () => {
    let doc = createReference3UDocument();
    const base = summarize(ledgerFromDocument(doc));
    assert.ok(base.solarGenerationW > 10);
    assert.ok(base.margins.some((m) => m.id === "margin.power.nominal"));
    assert.ok(base.thermal);

    doc = setPartParam(doc, "solar-xp", "heightMm", 140);
    doc = setPartParam(doc, "solar-xn", "heightMm", 140);
    const cut = summarize(ledgerFromDocument(doc));
    assert.ok(cut.solarGenerationW < base.solarGenerationW);
  });

  it("exports BOM CSV", () => {
    const rows = bomFromDocument(createReference3UDocument());
    const csv = bomToCsv(rows);
    assert.match(csv, /mass_kg/);
    assert.match(csv, /EPS board/);
  });
});
