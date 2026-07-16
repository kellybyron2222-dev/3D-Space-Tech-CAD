import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyParameters,
  createBracketDemo,
  setParameter,
} from "@spacetech/sfd-lang";

/** Pure parameter-binding check — no OCCT / worker. */
function mountHoleForWall(wallMm: number) {
  const doc = setParameter(createBracketDemo(), "wall", wallMm);
  const base = doc.features.find((f) => f.id === "f-base");
  const hole = doc.features.find((f) => f.id === "f-hole");
  assert.ok(base && base.kind === "box");
  assert.ok(hole && hole.kind === "hole");
  return { baseHeightMm: base.heightMm, holeDepthMm: hole.depthMm, hole };
}

describe("bracket through-hole depth (smoke)", () => {
  it("mount hole depth exceeds wall for bracket wall sweep", () => {
    for (const wall of [4, 7, 12, 20]) {
      const { baseHeightMm, holeDepthMm } = mountHoleForWall(wall);
      assert.equal(baseHeightMm, wall, `wall=${wall}`);
      assert.ok(
        holeDepthMm > wall,
        `through hole depth ${holeDepthMm} must exceed wall ${wall}`,
      );
    }
  });

  it("applyParameters keeps f-hole through-thickness offset", () => {
    const doc = applyParameters({
      ...createBracketDemo(),
      parameters: { wall: 12, holeDia: 6 },
    });
    const hole = doc.features.find((f) => f.id === "f-hole");
    assert.ok(hole && hole.kind === "hole");
    assert.equal(hole.depthMm, 14);
    assert.equal(hole.zMm, -1);
  });
});
