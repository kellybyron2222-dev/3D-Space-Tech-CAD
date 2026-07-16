import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { meshBounds } from "./meshBounds.js";

describe("meshBounds", () => {
  it("returns null for empty mesh", () => {
    assert.equal(meshBounds(null), null);
  });

  it("computes AABB size from vertices", () => {
    const bounds = meshBounds({
      faces: {
        vertices: [0, 0, 0, 10, 20, 30],
        normals: [],
        triangles: [],
      },
      edges: { lines: [] },
    });
    assert.ok(bounds);
    assert.equal(bounds!.size.x, 10);
    assert.equal(bounds!.size.y, 20);
    assert.equal(bounds!.size.z, 30);
  });
});
