import {
  bomFromDocument,
  bomToCsv,
  ledgerFromDocument,
  summarize,
  type BudgetSummary,
} from "@spacetech/budgets";
import { runCdsScorecard, type CdsCheckResult } from "@spacetech/rules-cds";
import {
  createReference3USystemsPack,
  scorecardSummaryLine,
  type SystemsPack,
} from "@spacetech/systems";
import { getParam, type SfdDocument } from "@spacetech/sfd-lang";

export interface WorkbookState {
  budgetSummary: BudgetSummary;
  scorecard: CdsCheckResult[];
  scorecardLine: string;
  systems: SystemsPack;
  envelope: { w: number; d: number; h: number };
  solarAreaM2: number;
  panelHeightMm: number;
}

export function analyzeWorkbook(
  doc: SfdDocument,
  systems: SystemsPack = createReference3USystemsPack(),
): WorkbookState {
  const chassis = doc.parts.find((p) => p.id === "chassis");
  const w = chassis ? getParam(chassis, "widthMm", 100) : 100;
  const d = chassis ? getParam(chassis, "depthMm", 100) : 100;
  const h = chassis ? getParam(chassis, "heightMm", 340.5) : 340.5;
  const panel = doc.parts.find((p) => p.id === "solar-xp");
  const panelHeightMm = panel ? getParam(panel, "heightMm", 280) : 280;

  const ledger = ledgerFromDocument(doc);
  const budgetSummary = summarize(ledger);
  const scorecard = runCdsScorecard({
    units: 3,
    envelopeMm: { x: w, y: d, z: h },
    totalMassKg: budgetSummary.totalMassKg,
    cgMm: budgetSummary.cgMm,
    solarGenerationW: budgetSummary.solarGenerationW,
    nominalLoadW: budgetSummary.powerByMode.nominal,
    railProtrusionMm: 5,
  });

  const pass = scorecard.filter((c) => c.status === "pass").length;
  const warn = scorecard.filter((c) => c.status === "warn").length;
  const fail = scorecard.filter((c) => c.status === "fail").length;
  const info = scorecard.filter((c) => c.status === "info").length;

  return {
    budgetSummary,
    scorecard,
    scorecardLine: scorecardSummaryLine(pass, warn, fail, info),
    systems,
    envelope: { w, d, h },
    solarAreaM2: ledger.solar?.areaM2 ?? 0,
    panelHeightMm,
  };
}

export function exportBomCsv(doc: SfdDocument): string {
  return bomToCsv(bomFromDocument(doc));
}

export function exportCdrMarkdown(
  doc: SfdDocument,
  workbook: WorkbookState,
): string {
  const { budgetSummary, scorecard, scorecardLine, systems } = workbook;
  const lines = [
    `# ${doc.name} — Phase A CDR one-pager`,
    ``,
    `_Not flight-qualified. Educational L0 fidelity._`,
    ``,
    `## Envelope`,
    `${workbook.envelope.w} × ${workbook.envelope.d} × ${workbook.envelope.h} mm (3U)`,
    ``,
    `## Budgets`,
    `- Mass: **${budgetSummary.totalMassKg.toFixed(3)} kg**`,
    `- PV generation (L0): **${budgetSummary.solarGenerationW.toFixed(2)} W** (${workbook.solarAreaM2.toFixed(4)} m²)`,
    `- Loads — safe / nominal / peak / eclipse: ${budgetSummary.powerByMode.safe.toFixed(2)} / ${budgetSummary.powerByMode.nominal.toFixed(2)} / ${budgetSummary.powerByMode.peak.toFixed(2)} / ${budgetSummary.powerByMode.eclipse.toFixed(2)} W`,
    `- Eclipse fraction: ${budgetSummary.eclipseFraction.toFixed(2)}`,
    ``,
    `## Margins`,
    ...budgetSummary.margins.map(
      (m) => `- **${m.title}** [${m.status}]: ${m.value} — ${m.message}`,
    ),
    ``,
    `## CDS scorecard (${scorecardLine})`,
    ...scorecard.map(
      (c) => `- **${c.title}** [${c.status}]: ${c.message} _(${c.citation})_`,
    ),
    ``,
    `## Assumptions`,
    ...systems.assumptions.map((a) => `- [${a.fidelity}] ${a.text}`),
    ``,
    `## VCRM-lite`,
    ...systems.vcrm.map(
      (r) =>
        `- ${r.id}: ${r.requirement} — method: ${r.method}; evidence: ${r.evidence} (${r.status})`,
    ),
    ``,
    `## ICD stubs`,
    ...systems.icds.map(
      (i) => `- **${i.title}** (${i.domain}) → ${i.interfaceTo}: ${i.notes}`,
    ),
    ``,
  ];
  return lines.join("\n");
}

/** Printable one-pager for advisor review (browser Print → PDF). */
export function exportCdrHtml(
  doc: SfdDocument,
  workbook: WorkbookState,
): string {
  const { budgetSummary, scorecard, scorecardLine, systems } = workbook;
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const marginRows = budgetSummary.margins
    .map(
      (m) =>
        `<tr><td>${esc(m.title)}</td><td>${esc(m.status)}</td><td>${esc(m.value)}</td><td>${esc(m.message)}</td></tr>`,
    )
    .join("");
  const checkRows = scorecard
    .map(
      (c) =>
        `<tr><td>${esc(c.status)}</td><td>${esc(c.title)}</td><td>${esc(c.message)}</td></tr>`,
    )
    .join("");
  const vcrmRows = systems.vcrm
    .map(
      (r) =>
        `<tr><td>${esc(r.id)}</td><td>${esc(r.status)}</td><td>${esc(r.requirement)}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${esc(doc.name)} — Phase A CDR</title>
<style>
  body { font-family: "IBM Plex Sans", Segoe UI, sans-serif; color: #141820; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-family: "IBM Plex Serif", Georgia, serif; color: #0b3d5c; }
  .meta { color: #5c6570; margin-bottom: 1.5rem; }
  table { width: 100%; border-collapse: collapse; margin: 0.75rem 0 1.25rem; font-size: 0.92rem; }
  th, td { border-bottom: 1px solid #d5d0c6; text-align: left; padding: 0.4rem 0.35rem; vertical-align: top; }
  th { color: #5c6570; font-size: 0.75rem; letter-spacing: 0.05em; text-transform: uppercase; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>${esc(doc.name)} — Phase A CDR</h1>
  <p class="meta">Not flight-qualified · L0 educational fidelity · ${esc(scorecardLine)}</p>
  <h2>Envelope</h2>
  <p>${workbook.envelope.w} × ${workbook.envelope.d} × ${workbook.envelope.h} mm (3U)</p>
  <h2>Budgets</h2>
  <p>Mass <strong>${budgetSummary.totalMassKg.toFixed(3)} kg</strong> ·
     PV <strong>${budgetSummary.solarGenerationW.toFixed(2)} W</strong> ·
     Nominal load <strong>${budgetSummary.powerByMode.nominal.toFixed(2)} W</strong></p>
  <h2>Margins</h2>
  <table><thead><tr><th>Item</th><th>Status</th><th>Value</th><th>Notes</th></tr></thead><tbody>${marginRows}</tbody></table>
  <h2>CDS scorecard</h2>
  <table><thead><tr><th>Status</th><th>Check</th><th>Message</th></tr></thead><tbody>${checkRows}</tbody></table>
  <h2>VCRM-lite</h2>
  <table><thead><tr><th>ID</th><th>Status</th><th>Requirement</th></tr></thead><tbody>${vcrmRows}</tbody></table>
  <p class="meta">Generated by Space Tech 3D / SpaceForge</p>
</body>
</html>`;
}
