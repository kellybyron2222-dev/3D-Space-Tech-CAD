import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createEmptyDocument,
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
});
