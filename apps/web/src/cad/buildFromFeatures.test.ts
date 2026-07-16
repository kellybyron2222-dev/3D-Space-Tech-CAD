import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampEdgeModificationRadius,
  isNoEdgeSelectedError,
  meshEdgeIndexFilterSlot,
} from "./featureResilience.js";

describe("featureResilience (no OCCT)", () => {
  it("maps mesh edge hint indices mod 6 to filter slots", () => {
    assert.equal(meshEdgeIndexFilterSlot(0), "XY");
    assert.equal(meshEdgeIndexFilterSlot(6), "XY");
    assert.equal(meshEdgeIndexFilterSlot(1), "XZ");
    assert.equal(meshEdgeIndexFilterSlot(7), "XZ");
    assert.equal(meshEdgeIndexFilterSlot(2), "YZ");
    assert.equal(meshEdgeIndexFilterSlot(3), "dirX");
    assert.equal(meshEdgeIndexFilterSlot(4), "dirY");
    assert.equal(meshEdgeIndexFilterSlot(5), "dirZ");
    assert.equal(meshEdgeIndexFilterSlot(11), "dirZ");
  });

  it("clamps fillet/chamfer radius to kernel-safe bounds", () => {
    assert.equal(clampEdgeModificationRadius(0), 0.05);
    assert.equal(clampEdgeModificationRadius(-10), 0.05);
    assert.equal(clampEdgeModificationRadius(100), 50);
    assert.equal(clampEdgeModificationRadius(12), 12);
  });

  it("detects replicad no-edge-selected errors", () => {
    assert.equal(
      isNoEdgeSelectedError(new Error("Could not fillet, no edge was selected")),
      true,
    );
    assert.equal(
      isNoEdgeSelectedError(new Error("Could not chamfer, no edge was selected")),
      true,
    );
    assert.equal(isNoEdgeSelectedError(new Error("radius too large")), false);
  });
});

describe("buildFromFeatures kernel assumptions", () => {
  it("documents that mesh edgeIndices are not B-rep ids", () => {
    // Regression guard: UI Shift+click indices must not be treated as OCCT ids.
    const uiHint = 42;
    const slot = meshEdgeIndexFilterSlot(uiHint);
    assert.equal(slot, meshEdgeIndexFilterSlot(uiHint % 6));
    assert.notEqual(slot, "edge-42");
  });
});
