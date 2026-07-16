import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBracketDemo } from "@spacetech/sfd-lang";
import {
  buildDrawingSvg,
  buildPrintHtml,
  escapeXml,
} from "./drawingSheet.js";

describe("drawingSheet", () => {
  it("escapeXml encodes markup characters", () => {
    assert.equal(escapeXml(`A & B < "C"`), "A &amp; B &lt; &quot;C&quot;");
  });

  it("buildDrawingSvg includes escaped title block fields", () => {
    const svg = buildDrawingSvg({
      size: { x: 10, y: 20, z: 30 },
      sheetPartName: `Bracket <demo>`,
      sheetMaterial: "Al & Ti",
      sheetScale: "1:1",
      sheetDate: "2026-07-16",
      holeNote: null,
    });
    assert.match(svg, /Bracket &lt;demo&gt;/);
    assert.match(svg, /Al &amp; Ti/);
    assert.match(svg, /encoding="UTF-8"/);
  });

  it("buildPrintHtml strips xml prolog and keeps svg body", () => {
    const html = buildPrintHtml(
      "Part",
      buildDrawingSvg({
        size: { x: 1, y: 2, z: 3 },
        sheetPartName: "Part",
        sheetMaterial: "Al",
        sheetScale: "1:1",
        sheetDate: "2026-07-16",
        holeNote: null,
      }),
    );
    assert.doesNotMatch(html, /<\?xml/);
    assert.match(html, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(html, /window\.print/);
  });
});
