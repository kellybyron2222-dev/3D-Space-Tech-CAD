import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyLedger, summarize } from "./index.js";

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
});
