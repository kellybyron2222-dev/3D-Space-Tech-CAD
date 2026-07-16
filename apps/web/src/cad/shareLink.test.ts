import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBracketDemo } from "@spacetech/sfd-lang";
import { decodeShareHash, encodeShareHash } from "./shareLink.js";

describe("share link", () => {
  it("round-trips a feature document through URL hash", () => {
    const doc = createBracketDemo();
    const hash = encodeShareHash(doc);
    const again = decodeShareHash(hash);
    assert.ok(again);
    assert.equal(again!.name, doc.name);
    assert.equal(again!.features.length, doc.features.length);
  });
});
