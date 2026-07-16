import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRectSketchEntity, type SketchFeature } from "./features.js";
import { applyDrivingDimension, solveSketch } from "./sketchSolve.js";

describe("sketch constraint solver", () => {
  const baseLineSketch = (overrides: Partial<SketchFeature> = {}): SketchFeature => ({
    id: "f-line",
    name: "Line sketch",
    kind: "sketch",
    plane: "front",
    profile: "rect",
    widthMm: 10,
    heightMm: 10,
    entities: [
      {
        id: "se-line",
        kind: "line",
        x1: 0,
        y1: 0,
        x2: 5,
        y2: 3,
      },
    ],
    ...overrides,
  });

  it("horizontal forces line y2=y1", () => {
    const solved = solveSketch(
      baseLineSketch({ constraints: [{ kind: "horizontal" }] }),
    );
    const line = solved.entities?.[0];
    assert.ok(line && line.kind === "line");
    assert.equal(line.y2, line.y1);
    assert.equal(line.x2, 5);
  });

  it("vertical forces x2=x1", () => {
    const solved = solveSketch(
      baseLineSketch({ constraints: [{ kind: "vertical" }] }),
    );
    const line = solved.entities?.[0];
    assert.ok(line && line.kind === "line");
    assert.equal(line.x2, line.x1);
    assert.equal(line.y2, 3);
  });

  it("dimension width resizes rect keeping center", () => {
    const entity = createRectSketchEntity(40, 20, 10, 5);
    const sketch: SketchFeature = {
      id: "f-rect",
      name: "Rect sketch",
      kind: "sketch",
      plane: "front",
      profile: "rect",
      widthMm: 40,
      heightMm: 20,
      offsetUMm: 10,
      offsetVMm: 5,
      entities: [entity],
      constraints: [{ kind: "dimension", label: "width", valueMm: 60 }],
    };

    const solved = solveSketch(sketch);
    const rect = solved.entities?.[0];
    assert.ok(rect && rect.kind === "rect");
    assert.equal(rect.widthMm, 60);
    assert.equal(rect.heightMm, 20);
    assert.equal(rect.x + rect.widthMm / 2, 10);
    assert.equal(rect.y + rect.heightMm / 2, 5);
    assert.equal(solved.widthMm, 60);
    assert.equal(solved.offsetUMm, 10);
  });

  it("dimension dia resizes circle", () => {
    const sketch: SketchFeature = {
      id: "f-circle",
      name: "Circle sketch",
      kind: "sketch",
      plane: "top",
      profile: "circle",
      widthMm: 12,
      heightMm: 12,
      offsetUMm: 3,
      offsetVMm: -2,
      entities: [
        {
          id: "se-circle",
          kind: "circle",
          cx: 3,
          cy: -2,
          diameterMm: 12,
        },
      ],
      constraints: [{ kind: "dimension", label: "dia", valueMm: 20 }],
    };

    const solved = solveSketch(sketch);
    const circle = solved.entities?.[0];
    assert.ok(circle && circle.kind === "circle");
    assert.equal(circle.diameterMm, 20);
    assert.equal(circle.cx, 3);
    assert.equal(circle.cy, -2);
    assert.equal(solved.widthMm, 20);
    assert.equal(solved.profile, "circle");
  });

  it("applyDrivingDimension updates constraint + geometry", () => {
    const entity = createRectSketchEntity(40, 20, 10, 5);
    const sketch: SketchFeature = {
      id: "f-drive",
      name: "Driven rect",
      kind: "sketch",
      plane: "front",
      profile: "rect",
      widthMm: 40,
      heightMm: 20,
      offsetUMm: 10,
      offsetVMm: 5,
      entities: [entity],
    };

    const solved = applyDrivingDimension(sketch, "width", 50);
    const dim = solved.constraints?.find(
      (c) => c.kind === "dimension" && c.label === "width",
    );
    assert.ok(dim && dim.kind === "dimension");
    assert.equal(dim.valueMm, 50);

    const rect = solved.entities?.[0];
    assert.ok(rect && rect.kind === "rect");
    assert.equal(rect.widthMm, 50);
    assert.equal(rect.x + rect.widthMm / 2, 10);
    assert.equal(solved.widthMm, 50);
  });
});
