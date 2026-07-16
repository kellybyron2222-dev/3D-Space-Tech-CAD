import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBracketDemo } from "@spacetech/sfd-lang";
import {
  decodeShareHash,
  encodeShareHash,
} from "../cad/shareLink.js";

/** Pure mirror of useHistory stack logic for node tests. */
function pushSnapshot<T>(stack: T[], index: number, value: T, limit: number) {
  const cur = stack[index]!;
  if (Object.is(value, cur)) return { stack, index };
  const trimmed = stack.slice(0, index + 1);
  const merged = [...trimmed, value].slice(-limit);
  return { stack: merged, index: merged.length - 1 };
}

function replacePresent<T>(stack: T[], index: number, value: T) {
  const cur = stack[index]!;
  if (Object.is(value, cur)) return { stack, index };
  const next = stack.slice();
  next[index] = value;
  return { stack: next, index };
}

describe("useHistory semantics", () => {
  it("undo restores prior snapshot", () => {
    const stack = [{ n: 1 }, { n: 2 }, { n: 3 }];
    let index = 2;
    index = Math.max(0, index - 1);
    assert.equal(stack[index]!.n, 2);
    index = Math.max(0, index - 1);
    assert.equal(stack[index]!.n, 1);
  });

  it("set after undo drops redo branch", () => {
    let stack = [{ n: 1 }, { n: 2 }, { n: 3 }];
    let index = 2;
    index = 1;
    ({ stack, index } = pushSnapshot(stack, index, { n: 99 }, 50));
    assert.deepEqual(stack, [{ n: 1 }, { n: 2 }, { n: 99 }]);
    assert.equal(index, 2);
  });

  it("replacePresent updates current frame without growing stack", () => {
    let stack = [
      { doc: "a", selectedFeatureId: "f1" },
      { doc: "b", selectedFeatureId: "f2" },
    ];
    let index = 1;
    ({ stack, index } = replacePresent(stack, index, {
      doc: "b",
      selectedFeatureId: "f9",
    }));
    assert.equal(stack.length, 2);
    assert.equal(stack[index]!.selectedFeatureId, "f9");
  });

  it("undo restores selection stored in snapshot", () => {
    type Snap = { doc: string; selectedFeatureId: string | null };
    const stack: Snap[] = [
      { doc: "v1", selectedFeatureId: "hole" },
      { doc: "v2", selectedFeatureId: "wall" },
    ];
    let index = 1;
    index = 0;
    assert.equal(stack[index]!.selectedFeatureId, "hole");
  });

  it("setDoc keeps selection when feature id still exists", () => {
    type Snap = { doc: { features: string[] }; selectedFeatureId: string | null };
    const snap: Snap = {
      doc: { features: ["a", "b"] },
      selectedFeatureId: "b",
    };
    const nextDoc = { features: ["a", "b", "c"] };
    const selectedFeatureId =
      snap.selectedFeatureId &&
      nextDoc.features.includes(snap.selectedFeatureId)
        ? snap.selectedFeatureId
        : (nextDoc.features[0] ?? null);
    assert.equal(selectedFeatureId, "b");
  });

  it("setDoc falls back when selected feature was removed", () => {
    type Snap = { doc: { features: string[] }; selectedFeatureId: string | null };
    const snap: Snap = {
      doc: { features: ["a", "b"] },
      selectedFeatureId: "b",
    };
    const nextDoc = { features: ["a"] };
    const selectedFeatureId =
      snap.selectedFeatureId &&
      nextDoc.features.includes(snap.selectedFeatureId)
        ? snap.selectedFeatureId
        : (nextDoc.features[0] ?? null);
    assert.equal(selectedFeatureId, "a");
  });
});

describe("shareLink edge cases", () => {
  it("decodes hash without leading #", () => {
    const doc = createBracketDemo();
    const hash = encodeShareHash(doc);
    const again = decodeShareHash(hash.slice(1));
    assert.ok(again);
    assert.equal(again!.name, doc.name);
  });

  it("decodes URL-encoded base64 payload", () => {
    const doc = createBracketDemo();
    const raw = encodeShareHash(doc).replace(/^#sfd=/, "");
    const encoded = encodeURIComponent(raw);
    const again = decodeShareHash(`#sfd=${encoded}`);
    assert.ok(again);
    assert.equal(again!.features.length, doc.features.length);
  });

  it("round-trips unicode part names", () => {
    const doc = { ...createBracketDemo(), name: "支架 π demo" };
    const again = decodeShareHash(encodeShareHash(doc));
    assert.ok(again);
    assert.equal(again!.name, doc.name);
  });

  it("returns null for truncated hash payload", () => {
    const doc = createBracketDemo();
    const b64 = encodeShareHash(doc).replace(/^#sfd=/, "");
    assert.equal(decodeShareHash(`#sfd=${b64.slice(0, 8)}`), null);
  });

  it("returns null for invalid document JSON", () => {
    const junk = Buffer.from('{"version":1,"name":"x","features":[]}').toString(
      "base64",
    );
    assert.equal(decodeShareHash(`#sfd=${junk}`), null);
  });

  it("returns null for unknown hash fragments", () => {
    assert.equal(decodeShareHash("#other=abc"), null);
    assert.equal(decodeShareHash(""), null);
  });
});
