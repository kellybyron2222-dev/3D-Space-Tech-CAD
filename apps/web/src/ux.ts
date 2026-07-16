import {
  DEFAULT_SOLAR_EFFICIENCY,
  SOLAR_IRRADIANCE_W_M2,
  type BudgetSummary,
} from "@spacetech/budgets";
import type { CdsCheckResult } from "@spacetech/rules-cds";
import type { SystemsPack } from "@spacetech/systems";
import { getParam, type SfdDocument } from "@spacetech/sfd-lang";

export type TabId = "design" | "budgets" | "scorecard" | "systems" | "export";

export interface NextStep {
  id: string;
  title: string;
  detail: string;
  tab: TabId;
}

export function worstCdsStatus(
  scorecard: CdsCheckResult[],
): "pass" | "warn" | "fail" | "info" {
  if (scorecard.some((c) => c.status === "fail")) return "fail";
  if (scorecard.some((c) => c.status === "warn")) return "warn";
  if (scorecard.every((c) => c.status === "pass" || c.status === "info")) {
    return scorecard.some((c) => c.status === "pass") ? "pass" : "info";
  }
  return "info";
}

export function primaryPowerMargin(summary: BudgetSummary) {
  return (
    summary.margins.find((m) => m.id === "margin.power.nominal") ??
    summary.margins[0]
  );
}

/** University first-session coach — ordered, actionable. */
export function buildNextSteps(input: {
  scorecard: CdsCheckResult[];
  budgetSummary: BudgetSummary;
  systems: SystemsPack;
  mode: "parametric" | "imported";
}): NextStep[] {
  const steps: NextStep[] = [];
  const fails = input.scorecard.filter((c) => c.status === "fail");
  const warns = input.scorecard.filter((c) => c.status === "warn");
  const power = primaryPowerMargin(input.budgetSummary);

  if (fails.length) {
    steps.push({
      id: "fix-fail",
      title: `Resolve ${fails.length} failing check${fails.length > 1 ? "s" : ""}`,
      detail: fails.map((f) => f.title).join(", "),
      tab: fails.some((f) => f.id.startsWith("cds.power"))
        ? "budgets"
        : "design",
    });
  } else if (warns.length) {
    steps.push({
      id: "review-warn",
      title: `Review ${warns.length} warning${warns.length > 1 ? "s" : ""}`,
      detail: warns.map((w) => w.title).join(", "),
      tab: "scorecard",
    });
  }

  if (power && (power.status === "red" || power.status === "yellow")) {
    steps.push({
      id: "power-margin",
      title: "Improve nominal power margin",
      detail: `${power.value} — raise Panel H on Design or cut board watts on Budgets`,
      tab: power.status === "red" ? "design" : "budgets",
    });
  }

  const openVcrm = input.systems.vcrm.filter(
    (v) => v.status === "planned" || v.status === "in_progress",
  ).length;
  if (openVcrm > 0) {
    steps.push({
      id: "vcrm",
      title: `Update ${openVcrm} VCRM row${openVcrm > 1 ? "s" : ""}`,
      detail: "Mark evidence status as you close analyses",
      tab: "systems",
    });
  }

  const openIcd = countOpenIcdItems(input.systems);
  if (openIcd > 0) {
    steps.push({
      id: "icd",
      title: "Fill ICD open items",
      detail: `${openIcd} open interface notes for your dispenser / bus choices`,
      tab: "systems",
    });
  }

  steps.push({
    id: "export",
    title: "Export Phase A package",
    detail:
      input.mode === "imported"
        ? "BOM + CDR Markdown ready; parametric STEP needs Show parametric frame"
        : "BOM, CDR, and parametric STEP available",
    tab: "export",
  });

  return steps.slice(0, 4);
}

export function tabForCheck(checkId: string): TabId {
  if (
    checkId.includes("power") ||
    checkId.includes("mass") ||
    checkId.includes("cg")
  ) {
    return "budgets";
  }
  if (checkId.includes("envelope") || checkId.includes("deployer")) return "design";
  return "scorecard";
}

/**
 * Panel height (mm) on both ±X faces to clear nominal load by ≥1 W (L0).
 * Returns null if already green or geometry missing.
 */
export function suggestPanelHeightMm(doc: SfdDocument, nominalLoadW: number): number | null {
  const panel = doc.parts.find((p) => p.id === "solar-xp");
  if (!panel) return null;
  const widthMm = getParam(panel, "widthMm", 82);
  const currentH = getParam(panel, "heightMm", 280);
  if (widthMm <= 0) return null;

  const targetGenW = nominalLoadW + 1;
  const neededAreaM2 = targetGenW / (SOLAR_IRRADIANCE_W_M2 * DEFAULT_SOLAR_EFFICIENCY);
  // Two body panels of equal size
  const heightMm = Math.ceil((neededAreaM2 * 1e6) / (2 * widthMm));
  const clamped = Math.min(320, Math.max(80, heightMm));
  if (clamped <= currentH) return null;
  return clamped;
}

export function countOpenIcdItems(systems: SystemsPack): number {
  return systems.icds.reduce((n, icd) => {
    const resolved = new Set(icd.resolvedOpenItems ?? []);
    return n + icd.openItems.filter((item) => !resolved.has(item)).length;
  }, 0);
}
