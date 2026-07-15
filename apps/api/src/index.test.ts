import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildServer } from "./index.js";

describe("api", () => {
  it("serves health and demo reference payload", async () => {
    const app = buildServer();
    const health = await app.inject({ method: "GET", url: "/health" });
    assert.equal(health.statusCode, 200);
    assert.equal(health.json().ok, true);

    const demo = await app.inject({ method: "GET", url: "/v1/demo/reference-3u" });
    assert.equal(demo.statusCode, 200);
    const body = demo.json();
    assert.equal(body.document.name, "Reference-3U");
    assert.ok(Array.isArray(body.scorecard));
    await app.close();
  });
});
