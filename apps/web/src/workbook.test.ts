import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createReference3UDocument, setPartParam } from "@spacetech/sfd-lang";
import {
  analyzeWorkbook,
  exportBomCsv,
  exportCdrHtml,
  exportCdrMarkdown,
} from "./workbook.js";

describe("workbook", () => {
  it("updates PV when panel height changes", () => {
    let doc = createReference3UDocument();
    const a = analyzeWorkbook(doc);
    doc = setPartParam(doc, "solar-xp", "heightMm", 100);
    doc = setPartParam(doc, "solar-xn", "heightMm", 100);
    const b = analyzeWorkbook(doc);
    assert.ok(b.budgetSummary.solarGenerationW < a.budgetSummary.solarGenerationW);
    assert.match(exportBomCsv(doc), /EPS board/);
    assert.match(exportCdrMarkdown(doc, b), /Phase A CDR/);
    assert.match(exportCdrHtml(doc, b), /Phase A CDR/);
  });
});
