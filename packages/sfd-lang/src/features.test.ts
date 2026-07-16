import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeFeatures,
  applyAssemblyMates,
  applyParameters,
  renameFeature,
  setParameter,
  createBracketDemo,
  createCircleSketchEntity,
  createDemoAssembly,
  createRectSketchEntity,
  createReference3UFeatures,
  createEmptyFeatureDocument,
  ensureSketchEntities,
  filterValidSketchEntities,
  isValidSketchEntity,
  parseFeatureDocument,
  resolveSketch,
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

  it("applyParameters makes mount hole deeper than wall", () => {
    const doc = applyParameters({
      ...createBracketDemo(),
      parameters: { wall: 12, holeDia: 6 },
    });
    const hole = doc.features.find((f) => f.id === "f-hole");
    assert.ok(hole && hole.kind === "hole");
    assert.equal(hole.depthMm, 14);
    assert.ok(hole.depthMm > 12);
  });

  it("applyParameters keeps through-hole depth when wall is 7+", () => {
    for (const wall of [7, 10, 15]) {
      const doc = applyParameters({
        ...createBracketDemo(),
        parameters: { wall, holeDia: 6 },
      });
      const hole = doc.features.find((f) => f.id === "f-hole");
      assert.ok(hole && hole.kind === "hole");
      assert.ok(
        hole.depthMm > wall,
        `hole depth ${hole.depthMm} must exceed wall ${wall}`,
      );
      assert.equal(hole.zMm, -1);
    }
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

  it("applyParameters drives extrude depth and cut cutDepth", () => {
    const base = createEmptyFeatureDocument("Depth test");
    base.features = [
      {
        id: "f-extrude-a",
        name: "Boss A",
        kind: "extrude",
        plane: "front",
        profile: "rect",
        widthMm: 20,
        heightMm: 10,
        depthMm: 5,
      },
      {
        id: "f-extrude-b",
        name: "Boss B",
        kind: "extrude",
        plane: "top",
        profile: "circle",
        widthMm: 12,
        heightMm: 12,
        depthMm: 8,
      },
      {
        id: "f-cut-a",
        name: "Pocket",
        kind: "cut",
        plane: "front",
        profile: "rect",
        widthMm: 10,
        heightMm: 6,
        depthMm: 3,
      },
    ];

    const byDepth = applyParameters({ ...base, parameters: { depth: 25 } });
    for (const id of ["f-extrude-a", "f-extrude-b"]) {
      const extrude = byDepth.features.find((f) => f.id === id);
      assert.ok(extrude && extrude.kind === "extrude");
      assert.equal(extrude.depthMm, 25);
    }
    const cutUnchanged = byDepth.features.find((f) => f.id === "f-cut-a");
    assert.ok(cutUnchanged && cutUnchanged.kind === "cut");
    assert.equal(cutUnchanged.depthMm, 3);

    const byExtrude = applyParameters({ ...base, parameters: { extrude: 18 } });
    const extrudeB = byExtrude.features.find((f) => f.id === "f-extrude-b");
    assert.ok(extrudeB && extrudeB.kind === "extrude");
    assert.equal(extrudeB.depthMm, 18);

    const byCutDepth = applyParameters({ ...base, parameters: { cutDepth: 12 } });
    const cut = byCutDepth.features.find((f) => f.id === "f-cut-a");
    assert.ok(cut && cut.kind === "cut");
    assert.equal(cut.depthMm, 12);
    const extrudeStill = byCutDepth.features.find((f) => f.id === "f-extrude-a");
    assert.ok(extrudeStill && extrudeStill.kind === "extrude");
    assert.equal(extrudeStill.depthMm, 5);
  });

  it("createBracketDemo omits depth parameter by default", () => {
    assert.equal(createBracketDemo().parameters?.depth, undefined);
    assert.equal(createBracketDemo({ includeDepth: true }).parameters?.depth, 15);
  });

  it("setParameter stores key and applies bindings", () => {
    const base = createBracketDemo();
    const doc = setParameter(base, "wall", 7);
    assert.equal(doc.parameters?.wall, 7);
    const box = doc.features.find((f) => f.id === "f-base");
    assert.ok(box && box.kind === "box");
    assert.equal(box.heightMm, 7);
    const hole = doc.features.find((f) => f.id === "f-hole");
    assert.ok(hole && hole.kind === "hole");
    assert.ok(hole.depthMm > 7);
  });

  it("setParameter merges with existing parameters", () => {
    const doc = setParameter(createBracketDemo(), "custom", 10);
    assert.equal(doc.parameters?.wall, 4);
    assert.equal(doc.parameters?.holeDia, 6);
    assert.equal(doc.parameters?.custom, 10);
  });

  it("renameFeature updates feature name by id", () => {
    const base = createBracketDemo();
    const doc = renameFeature(base, "f-base", "Renamed base");
    const renamed = doc.features.find((f) => f.id === "f-base");
    assert.ok(renamed);
    assert.equal(renamed.name, "Renamed base");
    const original = base.features.find((f) => f.id === "f-base");
    assert.ok(original);
    assert.notEqual(original.name, "Renamed base");
  });

  it("renameFeature leaves doc unchanged when id is missing", () => {
    const base = createBracketDemo();
    const doc = renameFeature(base, "missing-id", "Nope");
    assert.deepEqual(doc.features, base.features);
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

  it("syncSketchProfileFromEntities uses bbox center for multi-rect", () => {
    const entities = [
      createRectSketchEntity(10, 10, 5, 5),
      createRectSketchEntity(10, 10, 25, 5),
    ];
    const sketch: SketchFeature = {
      ...baseRectSketch,
      entities,
      offsetUMm: 0,
      offsetVMm: 0,
    };
    const synced = syncSketchProfileFromEntities(sketch);
    assert.equal(synced.widthMm, 30);
    assert.equal(synced.heightMm, 10);
    assert.equal(synced.offsetUMm, 15);
    assert.equal(synced.offsetVMm, 5);
  });

  it("filterValidSketchEntities rejects zero-size rects", () => {
    const entities: SketchFeature["entities"] = [
      { id: "bad", kind: "rect", x: 0, y: 0, widthMm: 0, heightMm: 10 },
      createRectSketchEntity(20, 10, 0, 0),
    ];
    const valid = filterValidSketchEntities(entities!);
    assert.equal(valid.length, 1);
    assert.equal(valid[0]?.kind, "rect");
    if (valid[0]?.kind === "rect") assert.equal(valid[0].widthMm, 20);
  });

  it("isValidSketchEntity rejects degenerate geometry", () => {
    assert.equal(
      isValidSketchEntity({
        id: "r",
        kind: "rect",
        x: 0,
        y: 0,
        widthMm: 0,
        heightMm: 5,
      }),
      false,
    );
    assert.equal(
      isValidSketchEntity({
        id: "l",
        kind: "line",
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
      }),
      false,
    );
    assert.equal(isValidSketchEntity(createCircleSketchEntity(4)), true);
  });

  it("resolveSketch filters invalid entities and clamps profile dims", () => {
    const doc = createEmptyFeatureDocument("resolve");
    const sketch: SketchFeature = {
      id: "f-sk",
      name: "Sketch",
      kind: "sketch",
      plane: "front",
      profile: "rect",
      widthMm: 40,
      heightMm: 30,
      entities: [
        { id: "bad", kind: "rect", x: 0, y: 0, widthMm: 0, heightMm: 0 },
        createRectSketchEntity(20, 10, 0, 0),
      ],
    };
    doc.features = [sketch];

    const resolved = resolveSketch(doc, sketch.id, {
      plane: "front",
      profile: "rect",
      widthMm: 1,
      heightMm: 1,
    });
    assert.equal(resolved.entities?.length, 1);
    assert.equal(resolved.widthMm, 20);
    assert.equal(resolved.heightMm, 10);
  });

  it("resolveSketch falls back when sketch has only invalid solids", () => {
    const doc = createEmptyFeatureDocument("invalid");
    const sketch: SketchFeature = {
      id: "f-empty",
      name: "Empty sketch",
      kind: "sketch",
      plane: "front",
      profile: "rect",
      widthMm: 0,
      heightMm: 0,
      entities: [
        { id: "bad", kind: "rect", x: 0, y: 0, widthMm: 0, heightMm: 0 },
      ],
    };
    doc.features = [sketch];

    const resolved = resolveSketch(doc, sketch.id, {
      plane: "front",
      profile: "rect",
      widthMm: 25,
      heightMm: 15,
    });
    assert.equal(resolved.entities?.length, 0);
    assert.equal(resolved.widthMm, 25);
    assert.equal(resolved.heightMm, 15);
  });
});
