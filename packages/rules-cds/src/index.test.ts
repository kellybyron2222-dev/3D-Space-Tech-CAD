import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runCdsScorecard } from "./index.js";

describe("rules-cds", () => {
  it("passes a nominal 3U inside guideline envelope and mass", () => {
    const results = runCdsScorecard({
      units: 3,
      envelopeMm: { x: 100, y: 100, z: 340.5 },
      totalMassKg: 4.0,
    });
    assert.equal(results.every((r) => r.status === "pass"), true);
  });

  it("fails oversized envelope", () => {
    const results = runCdsScorecard({
      units: 3,
      envelopeMm: { x: 120, y: 100, z: 340.5 },
      totalMassKg: 4.0,
    });
    const envelope = results.find((r) => r.id === "cds.envelope");
    assert.equal(envelope?.status, "fail");
  });
});
