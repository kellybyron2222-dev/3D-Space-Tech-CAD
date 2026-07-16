import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activeFeatures,
  createReference3UFeatures,
  createEmptyFeatureDocument,
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
});
