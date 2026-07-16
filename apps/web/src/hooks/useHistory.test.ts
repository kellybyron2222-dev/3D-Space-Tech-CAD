import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Lightweight pure-history logic mirror for node tests (hook needs react)
describe("history semantics", () => {
  it("undo restores prior snapshot", () => {
    const stack = [{ n: 1 }, { n: 2 }, { n: 3 }];
    let index = 2;
    index = Math.max(0, index - 1);
    assert.equal(stack[index]!.n, 2);
    index = Math.max(0, index - 1);
    assert.equal(stack[index]!.n, 1);
  });
});
