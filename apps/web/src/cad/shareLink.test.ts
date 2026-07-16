import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBracketDemo, type FeatureDocument } from "@spacetech/sfd-lang";
import {
  copyShareUrl,
  decodeShareHash,
  encodeShareHash,
  MAX_SHARE_HASH_LENGTH,
} from "./shareLink.js";

function docWithOversizedShareHash(base: FeatureDocument): FeatureDocument {
  let name = "x";
  while (encodeShareHash({ ...base, name }).length <= MAX_SHARE_HASH_LENGTH) {
    name += "x".repeat(1000);
  }
  return { ...base, name };
}

describe("share link", () => {
  it("round-trips a feature document through URL hash", () => {
    const doc = createBracketDemo();
    const hash = encodeShareHash(doc);
    const again = decodeShareHash(hash);
    assert.ok(again);
    assert.equal(again!.name, doc.name);
    assert.equal(again!.features.length, doc.features.length);
  });

  it("exports MAX_SHARE_HASH_LENGTH and keeps bracket demo under limit", () => {
    assert.equal(typeof MAX_SHARE_HASH_LENGTH, "number");
    assert.ok(MAX_SHARE_HASH_LENGTH > 0);
    const hash = encodeShareHash(createBracketDemo());
    assert.ok(
      hash.length <= MAX_SHARE_HASH_LENGTH,
      `bracket demo hash length ${hash.length} exceeds ${MAX_SHARE_HASH_LENGTH}`,
    );
  });

  it("copyShareUrl returns null when hash would exceed MAX_SHARE_HASH_LENGTH", () => {
    const doc = docWithOversizedShareHash(createBracketDemo());
    assert.ok(encodeShareHash(doc).length > MAX_SHARE_HASH_LENGTH);
    assert.equal(copyShareUrl(doc), null);
  });
});
