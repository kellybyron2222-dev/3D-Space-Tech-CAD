import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createReference3USystemsPack,
  scorecardSummaryLine,
} from "./index.js";

describe("systems", () => {
  it("seeds Reference-3U VCRM, ICDs, and assumptions", () => {
    const pack = createReference3USystemsPack();
    assert.ok(pack.vcrm.length >= 4);
    assert.ok(pack.icds.some((i) => i.domain === "mechanical"));
    assert.ok(pack.assumptions.every((a) => a.fidelity === "L0"));
  });

  it("formats scorecard summary", () => {
    assert.equal(scorecardSummaryLine(2, 1, 0, 1), "2 pass · 1 warn · 0 fail · 1 info");
  });
});
