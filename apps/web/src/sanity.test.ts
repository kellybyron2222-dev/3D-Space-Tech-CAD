import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createEmptyDocument,
  createReference3UFeatures,
} from "@spacetech/sfd-lang";

describe("web sanity", () => {
  it("can import workspace packages", () => {
    assert.equal(createEmptyDocument("x").name, "x");
    assert.ok(createReference3UFeatures().features.length >= 1);
  });
});
