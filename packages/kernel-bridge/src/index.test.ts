import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createStubKernelBridge } from "./index.js";

describe("kernel-bridge", () => {
  it("exposes a stub backend", () => {
    const bridge = createStubKernelBridge();
    assert.equal(bridge.backend, "stub");
    assert.equal(bridge.tessellateStub().positions.length, 0);
  });
});
