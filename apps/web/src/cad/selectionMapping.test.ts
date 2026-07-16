import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createBracketDemo,
  createReference3UFeatures,
  type CadFeature,
} from "@spacetech/sfd-lang";
import {
  cycleViewportEditableFeature,
  formatFeatureDimensionReadout,
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

  it("formats dimension readout for box, hole, and extrude", () => {
    assert.equal(
      formatFeatureDimensionReadout({
        id: "b",
        name: "Block",
        kind: "box",
        widthMm: 80,
        depthMm: 50,
        heightMm: 7,
      }),
      "W 80.0 · D 50.0 · H 7.0",
    );
    assert.equal(
      formatFeatureDimensionReadout({
        id: "h",
        name: "Hole",
        kind: "hole",
        diameterMm: 6,
        depthMm: 10,
        xMm: 12.5,
        yMm: -3.2,
      }),
      "Ø6.0 @ (12.5, -3.2)",
    );
    assert.equal(
      formatFeatureDimensionReadout({
        id: "e",
        name: "Boss",
        kind: "extrude",
        plane: "top",
        profile: "rect",
        widthMm: 5,
        heightMm: 5,
        depthMm: 12,
      }),
      "depth 12.0",
    );
    assert.equal(
      formatFeatureDimensionReadout({
        id: "s",
        name: "Sketch",
        kind: "sketch",
        plane: "front",
        profile: "rect",
        widthMm: 10,
        heightMm: 10,
      }),
      null,
    );
  });
});
