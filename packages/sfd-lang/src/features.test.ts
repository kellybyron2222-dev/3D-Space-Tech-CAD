import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeFeatures,
  applyAssemblyMates,
  applyParameters,
  setParameter,
  createBracketDemo,
  createCircleSketchEntity,
  createDemoAssembly,
  createRectSketchEntity,
  createReference3UFeatures,
  createEmptyFeatureDocument,
  ensureSketchEntities,
  parseFeatureDocument,
  serializeFeatureDocument,
  sketchEntitiesFromProfile,
  syncSketchProfileFromEntities,
  type SketchFeature,
} from "./features.js";

describe("feature document", () => {
  it("creates Reference-3U feature history", () => {
    const doc = createReference3UFeatures();
    assert.equal(doc.version, 1);
    assert.ok(doc.features.length >= 2);
    assert.equal(activeFeatures(doc).length, doc.features.length);
  });

  it("honors rollback index", () => {
    const doc = createReference3UFeatures();
    doc.rollbackIndex = 0;
    assert.equal(activeFeatures(doc).length, 1);
  });

  it("starts empty Part Studio", () => {
    assert.equal(createEmptyFeatureDocument().features.length, 0);
  });

  it("bracket demo includes hole and fillet (table-stakes path)", () => {
    const doc = createBracketDemo();
    assert.ok(doc.features.some((f) => f.kind === "hole"));
    assert.ok(doc.features.some((f) => f.kind === "fillet"));
    const again = parseFeatureDocument(serializeFeatureDocument(doc));
    assert.equal(again.name, "Bracket-Demo");
  });

  it("demo assembly has two instances", () => {
    const asm = createDemoAssembly();
    assert.equal(asm.instances.length, 2);
    assert.ok(asm.mates.length >= 1);
  });

  it("applyParameters drives wall and holeDia", () => {
    const doc = applyParameters({
      ...createBracketDemo(),
      parameters: { wall: 5, holeDia: 8 },
    });
    const base = doc.features.find((f) => f.id === "f-base");
    const hole = doc.features.find((f) => f.kind === "hole");
    assert.ok(base && base.kind === "box");
    assert.equal(base.heightMm, 5);
    assert.ok(hole && hole.kind === "hole");
    assert.equal(hole.diameterMm, 8);
  });

  it("applyParameters drives 3U u/height", () => {
    const doc = applyParameters({
      ...createReference3UFeatures(),
      parameters: { u: 110, height: 350 },
    });
    const chassis = doc.features.find((f) => f.id === "f-chassis");
    assert.ok(chassis && chassis.kind === "box");
    assert.equal(chassis.widthMm, 110);
    assert.equal(chassis.heightMm, 350);
  });

  it("setParameter stores key and applies bindings", () => {
    const base = createBracketDemo();
    const doc = setParameter(base, "wall", 7);
    assert.equal(doc.parameters?.wall, 7);
    const box = doc.features.find((f) => f.id === "f-base");
    assert.ok(box && box.kind === "box");
    assert.equal(box.heightMm, 7);
  });

  it("setParameter merges with existing parameters", () => {
    const doc = setParameter(createBracketDemo(), "custom", 10);
    assert.equal(doc.parameters?.wall, 4);
    assert.equal(doc.parameters?.holeDia, 6);
    assert.equal(doc.parameters?.custom, 10);
  });

  it("applyAssemblyMates sets distance on partB Z", () => {
    const asm = applyAssemblyMates(createDemoAssembly());
    const post = asm.instances.find((i) => i.id === "i-post");
    assert.ok(post);
    assert.equal(post.zMm, 8);
  });
});

describe("sketch entities", () => {
  const baseRectSketch: SketchFeature = {
    id: "f1",
    name: "Rect sketch",
    kind: "sketch",
    plane: "front",
    profile: "rect",
    widthMm: 40,
    heightMm: 20,
    offsetUMm: 10,
    offsetVMm: 5,
  };

  const baseCircleSketch: SketchFeature = {
    id: "f2",
    name: "Circle sketch",
    kind: "sketch",
    plane: "top",
    profile: "circle",
    widthMm: 12,
    heightMm: 12,
    offsetUMm: 3,
    offsetVMm: -2,
  };

  it("ensureSketchEntities populates from rect profile", () => {
    const ensured = ensureSketchEntities(baseRectSketch);
    assert.equal(ensured.entities?.length, 1);
    const rect = ensured.entities![0];
    assert.equal(rect.kind, "rect");
    if (rect.kind !== "rect") return;
    assert.equal(rect.x, -10);
    assert.equal(rect.y, -5);
    assert.equal(rect.widthMm, 40);
    assert.equal(rect.heightMm, 20);
  });

  it("ensureSketchEntities populates from circle profile", () => {
    const ensured = ensureSketchEntities(baseCircleSketch);
    assert.equal(ensured.entities?.length, 1);
    const circle = ensured.entities![0];
    assert.equal(circle.kind, "circle");
    if (circle.kind !== "circle") return;
    assert.equal(circle.cx, 3);
    assert.equal(circle.cy, -2);
    assert.equal(circle.diameterMm, 12);
  });

  it("ensureSketchEntities preserves existing entities", () => {
    const existing = createCircleSketchEntity(8, 1, 2);
    const sketch: SketchFeature = { ...baseCircleSketch, entities: [existing] };
    const ensured = ensureSketchEntities(sketch);
    assert.equal(ensured.entities?.length, 1);
    assert.equal(ensured.entities![0].id, existing.id);
  });

  it("syncSketchProfileFromEntities derives rect profile", () => {
    const entity = createRectSketchEntity(30, 10, 5, 0);
    const sketch: SketchFeature = {
      ...baseRectSketch,
      entities: [entity],
      widthMm: 0,
      heightMm: 0,
      offsetUMm: 0,
      offsetVMm: 0,
    };
    const synced = syncSketchProfileFromEntities(sketch);
    assert.equal(synced.profile, "rect");
    assert.equal(synced.widthMm, 30);
    assert.equal(synced.heightMm, 10);
    assert.equal(synced.offsetUMm, 5);
    assert.equal(synced.offsetVMm, 0);
  });

  it("syncSketchProfileFromEntities derives circle profile", () => {
    const entity = createCircleSketchEntity(14, 4, -1);
    const sketch: SketchFeature = {
      ...baseCircleSketch,
      entities: [entity],
      widthMm: 0,
      heightMm: 0,
      offsetUMm: 0,
      offsetVMm: 0,
    };
    const synced = syncSketchProfileFromEntities(sketch);
    assert.equal(synced.profile, "circle");
    assert.equal(synced.widthMm, 14);
    assert.equal(synced.heightMm, 14);
    assert.equal(synced.offsetUMm, 4);
    assert.equal(synced.offsetVMm, -1);
  });

  it("sketchEntitiesFromProfile round-trips via sync", () => {
    for (const sketch of [baseRectSketch, baseCircleSketch]) {
      const ensured = ensureSketchEntities(sketch);
      const synced = syncSketchProfileFromEntities(ensured);
      assert.equal(synced.profile, sketch.profile);
      assert.equal(synced.widthMm, sketch.widthMm);
      assert.equal(synced.heightMm, sketch.heightMm);
      assert.equal(synced.offsetUMm, sketch.offsetUMm);
      assert.equal(synced.offsetVMm, sketch.offsetVMm);
    }
  });

  it("round-trip serialize preserves sketch entities", () => {
    const doc = createBracketDemo();
    const sketch = doc.features.find(
      (f): f is SketchFeature => f.id === "f-sketch-hole",
    );
    assert.ok(sketch);
    assert.ok(sketch.entities?.length);
    assert.equal(sketch.entities![0].kind, "circle");

    const raw = serializeFeatureDocument(doc);
    const parsed = parseFeatureDocument(raw);
    const again = parsed.features.find(
      (f): f is SketchFeature => f.id === "f-sketch-hole",
    );
    assert.ok(again);
    assert.deepEqual(again.entities, sketch.entities);
  });
});
