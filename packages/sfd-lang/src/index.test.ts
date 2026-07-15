import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createEmptyDocument,
  createReference3UDocument,
  getParam,
  parseDocument,
  serializeDocument,
} from "./index.js";

describe("sfd-lang", () => {
  it("round-trips an empty document", () => {
    const doc = createEmptyDocument("Reference-3U");
    const again = parseDocument(serializeDocument(doc));
    assert.equal(again.name, "Reference-3U");
    assert.equal(again.version, 0);
    assert.equal(again.parts.length, 0);
  });

  it("creates a Reference-3U with chassis and subsystems", () => {
    const doc = createReference3UDocument();
    const chassis = doc.parts.find((p) => p.id === "chassis");
    assert.ok(chassis);
    assert.equal(getParam(chassis, "widthMm"), 100);
    assert.equal(getParam(chassis, "heightMm"), 340.5);
    assert.ok(doc.parts.length >= 8);
    assert.ok(doc.parts.some((p) => p.subsystem === "power"));
    assert.ok(doc.parts.some((p) => p.kind === "board"));
  });
});
