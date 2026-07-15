import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runCdsScorecard } from "./index.js";

describe("rules-cds", () => {
  it("passes a nominal 3U inside guideline envelope and mass", () => {
    const results = runCdsScorecard({
      units: 3,
      envelopeMm: { x: 100, y: 100, z: 340.5 },
      totalMassKg: 4.0,
      cgMm: { x: 0, y: 0, z: 170 },
      solarGenerationW: 20,
      nominalLoadW: 8,
      railProtrusionMm: 5,
    });
    const critical = results.filter((r) =>
      ["cds.envelope", "cds.mass", "cds.deployer.keepout"].includes(r.id),
    );
    assert.equal(
      critical.every((r) => r.status === "pass" || r.status === "warn"),
      true,
    );
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

  it("flags power shortfall", () => {
    const results = runCdsScorecard({
      units: 3,
      envelopeMm: { x: 100, y: 100, z: 340.5 },
      totalMassKg: 4.0,
      solarGenerationW: 2,
      nominalLoadW: 10,
    });
    const power = results.find((r) => r.id === "cds.power.soft");
    assert.equal(power?.status, "fail");
  });

  it("fails large deployer protrusion", () => {
    const results = runCdsScorecard({
      units: 3,
      envelopeMm: { x: 100, y: 100, z: 340.5 },
      totalMassKg: 4.0,
      railProtrusionMm: 12,
    });
    const keep = results.find((r) => r.id === "cds.deployer.keepout");
    assert.equal(keep?.status, "fail");
  });
});
