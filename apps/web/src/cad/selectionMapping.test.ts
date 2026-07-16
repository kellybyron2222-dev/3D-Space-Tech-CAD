import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createBracketDemo,
  createReference3UFeatures,
  type CadFeature,
} from "@spacetech/sfd-lang";
import {
  cycleViewportEditableFeature,
  mapFaceIndexToFeature,
  resolveViewportBodySelect,
} from "./selectionMapping.js";

describe("selectionMapping", () => {
  it("cycles box → hole → box on bracket demo", () => {
    const features = createBracketDemo().features;
    const box = features.find((f) => f.kind === "box")!;
    const hole = features.find((f) => f.kind === "hole")!;

    const first = cycleViewportEditableFeature(features, box.id);
    assert.equal(first?.id, hole.id);

    const second = cycleViewportEditableFeature(features, hole.id);
    assert.equal(second?.id, box.id);
  });

  it("maps face 0 to first box and last face to hole", () => {
    const features = createBracketDemo().features;
    const box = features.find((f) => f.kind === "box")!;
    const hole = features.find((f) => f.kind === "hole")!;

    assert.equal(mapFaceIndexToFeature(0, 6, features)?.id, box.id);
    assert.equal(mapFaceIndexToFeature(5, 6, features)?.id, hole.id);
  });

  it("maps last face to fillet when no hole", () => {
    const features = createReference3UFeatures().features;
    const fillet = features.find((f) => f.kind === "fillet")!;
    assert.equal(mapFaceIndexToFeature(9, 10, features)?.id, fillet.id);
  });

  it("second body click cycles when already on box", () => {
    const features = createBracketDemo().features;
    const box = features.find((f) => f.kind === "box")!;
    const hole = features.find((f) => f.kind === "hole")!;

    const result = resolveViewportBodySelect({
      features,
      selectedFeatureId: box.id,
      bodyWasSelected: true,
      faceIndex: 1,
      faceCount: 6,
      altKey: false,
    });
    assert.equal(result.featureId, hole.id);
    assert.match(result.uxNote ?? "", /Drag handles active/);
  });

  it("first body click uses face heuristic", () => {
    const features = createBracketDemo().features;
    const box = features.find((f) => f.kind === "box")!;

    const result = resolveViewportBodySelect({
      features,
      selectedFeatureId: null,
      bodyWasSelected: false,
      faceIndex: 0,
      faceCount: 6,
      altKey: false,
    });
    assert.equal(result.featureId, box.id);
  });

  it("alt+click cycles editable features", () => {
    const features: CadFeature[] = [
      {
        id: "b",
        name: "Block",
        kind: "box",
        widthMm: 10,
        depthMm: 10,
        heightMm: 10,
      },
      {
        id: "e",
        name: "Boss",
        kind: "extrude",
        plane: "top",
        profile: "rect",
        widthMm: 5,
        heightMm: 5,
        depthMm: 3,
      },
    ];

    const result = resolveViewportBodySelect({
      features,
      selectedFeatureId: "b",
      bodyWasSelected: false,
      faceIndex: 0,
      faceCount: 4,
      altKey: true,
    });
    assert.equal(result.featureId, "e");
  });
});
