import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeFeatures,
  applyAssemblyMates,
  applyParameters,
  createBracketDemo,
  createDemoAssembly,
  createReference3UFeatures,
  createEmptyFeatureDocument,
  parseFeatureDocument,
  serializeFeatureDocument,
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

  it("applyAssemblyMates sets distance on partB Z", () => {
    const asm = applyAssemblyMates(createDemoAssembly());
    const post = asm.instances.find((i) => i.id === "i-post");
    assert.ok(post);
    assert.equal(post.zMm, 8);
  });
});
