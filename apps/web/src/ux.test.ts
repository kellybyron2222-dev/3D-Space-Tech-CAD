import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createReference3UDocument } from "@spacetech/sfd-lang";
import { createReference3USystemsPack } from "@spacetech/systems";
import { analyzeWorkbook } from "./workbook.js";
import {
  buildNextSteps,
  suggestPanelHeightMm,
  worstCdsStatus,
} from "./ux.js";
import { setPartParam } from "@spacetech/sfd-lang";

describe("ux coach", () => {
  it("offers export and VCRM steps for a healthy Reference-3U", () => {
    const doc = createReference3UDocument();
    const systems = createReference3USystemsPack();
    const wb = analyzeWorkbook(doc, systems);
    const steps = buildNextSteps({
      scorecard: wb.scorecard,
      budgetSummary: wb.budgetSummary,
      systems,
      mode: "imported",
    });
    assert.ok(steps.some((s) => s.id === "export"));
    assert.ok(steps.some((s) => s.id === "vcrm" || s.id === "icd"));
    assert.notEqual(worstCdsStatus(wb.scorecard), "fail");
  });

  it("prioritizes failing checks", () => {
    const steps = buildNextSteps({
      scorecard: [
        {
          id: "cds.envelope",
          title: "Stowed envelope",
          status: "fail",
          message: "too big",
          citation: "test",
        },
      ],
      budgetSummary: analyzeWorkbook(createReference3UDocument()).budgetSummary,
      systems: createReference3USystemsPack(),
      mode: "imported",
    });
    assert.equal(steps[0]?.id, "fix-fail");
    assert.equal(steps[0]?.tab, "design");
  });

  it("suggests taller panels when load exceeds L0 PV", () => {
    let doc = createReference3UDocument();
    doc = setPartParam(doc, "solar-xp", "heightMm", 100);
    doc = setPartParam(doc, "solar-xn", "heightMm", 100);
    const suggestion = suggestPanelHeightMm(doc, 25);
    assert.ok(suggestion != null);
    assert.ok((suggestion as number) > 100);
  });
});
