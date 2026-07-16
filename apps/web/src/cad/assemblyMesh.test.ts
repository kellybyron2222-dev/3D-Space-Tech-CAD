import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeMeshes, translateMesh } from "./assemblyMesh.js";

function boxMesh(min: number, max: number): {
  faces: { vertices: number[]; normals: number[]; triangles: number[] };
  edges: { lines: number[] };
} {
  return {
    faces: {
      vertices: [min, min, min, max, max, max],
      normals: [0, 0, 1, 0, 0, 1],
      triangles: [0, 1, 0],
    },
    edges: { lines: [min, min, min, max, max, max] },
  };
}

describe("assemblyMesh", () => {
  it("translateMesh shifts vertices and edge lines", () => {
    const moved = translateMesh(boxMesh(0, 10), 5, -2, 3);
    assert.deepEqual(moved.faces.vertices.slice(0, 3), [5, -2, 3]);
    assert.deepEqual(moved.edges.lines.slice(0, 3), [5, -2, 3]);
  });

  it("mergeMeshes concatenates instance meshes", () => {
    const merged = mergeMeshes([boxMesh(0, 1), boxMesh(2, 3)]);
    assert.equal(merged.faces.vertices.length, 12);
    assert.equal(merged.faces.triangles[0], 0);
    assert.equal(merged.faces.triangles[1], 1);
    assert.equal(merged.faces.triangles[3], 2);
  });
});
