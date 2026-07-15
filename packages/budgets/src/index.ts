/**
 * Budget ledger — mass / CG, mode power, solar generation, L0 thermal.
 * Geometry-bound helpers keep panels ↔ power live for Phase A workbooks.
 */

import type { SfdDocument, SfdPart } from "@spacetech/sfd-lang";
import { getParam } from "@spacetech/sfd-lang";

export type PowerMode = "safe" | "nominal" | "peak" | "eclipse";

export type Fidelity = "L0" | "L1" | "L2";

export type MarginStatus = "green" | "yellow" | "red" | "info";

export interface MassBudgetItem {
  id: string;
  name: string;
  massKg: number;
  cgMm?: { x: number; y: number; z: number };
  subsystem?: string;
}

export interface PowerBudgetItem {
  id: string;
  name: string;
  /** Watts drawn in each mode */
  wattsByMode: Record<PowerMode, number>;
  subsystem?: string;
}

export interface SolarGeneration {
  /** One-sun body panel generation estimate (W) */
  generationW: number;
  areaM2: number;
  efficiency: number;
  /** Manual eclipse fraction 0–1 */
  eclipseFraction: number;
  assumptions: string[];
}

export interface ThermalL0 {
  /** Rough dissipation = nominal bus load (W) */
  dissipationW: number;
  /** Very coarse rejectable heat from body area (W) */
  rejectableW: number;
  status: MarginStatus;
  message: string;
  fidelity: Fidelity;
}

export interface BudgetLedger {
  fidelity: Fidelity;
  massItems: MassBudgetItem[];
  powerItems: PowerBudgetItem[];
  solar?: SolarGeneration;
  thermal?: ThermalL0;
  /** Optional L0 heat dissipation estimate (W) in nominal mode */
  thermalDissipationW?: number;
  assumptions: string[];
  eclipseFraction?: number;
}

export interface MarginRow {
  id: string;
  title: string;
  status: MarginStatus;
  value: string;
  message: string;
}

export interface BudgetSummary {
  totalMassKg: number;
  cgMm: { x: number; y: number; z: number } | null;
  powerByMode: Record<PowerMode, number>;
  solarGenerationW: number;
  powerMargins: Record<PowerMode, number>;
  thermal?: ThermalL0;
  margins: MarginRow[];
  fidelity: Fidelity;
  assumptions: string[];
  eclipseFraction: number;
}

export interface BomRow {
  id: string;
  name: string;
  subsystem: string;
  massKg: number;
  wattsNominal: number;
}

const MODES: PowerMode[] = ["safe", "nominal", "peak", "eclipse"];

/** AM0-ish educational irradiance (W/m²) */
export const SOLAR_IRRADIANCE_W_M2 = 1361;

/** Default body-mounted cell packing efficiency (dimensionless) */
export const DEFAULT_SOLAR_EFFICIENCY = 0.22;

/** L0 thermal: W rejectable per m² of body area (educational) */
export const L0_THERMAL_REJECT_W_M2 = 25;

export function createEmptyLedger(): BudgetLedger {
  return {
    fidelity: "L0",
    massItems: [],
    powerItems: [],
    assumptions: [],
  };
}

function panelAreaM2(part: SfdPart): number {
  const widthMm = getParam(part, "widthMm", 0);
  const heightMm = getParam(part, "heightMm", 0);
  return (widthMm * heightMm) / 1e6;
}

export function estimateSolarGeneration(
  doc: SfdDocument,
  options?: { eclipseFraction?: number; efficiency?: number },
): SolarGeneration {
  const efficiency = options?.efficiency ?? DEFAULT_SOLAR_EFFICIENCY;
  const eclipseFraction = clamp01(
    options?.eclipseFraction ?? getDocEclipseFraction(doc),
  );

  let areaM2 = 0;
  for (const part of doc.parts) {
    if (part.kind !== "panel" || part.subsystem !== "power") continue;
    areaM2 += panelAreaM2(part);
  }

  const generationW = areaM2 * SOLAR_IRRADIANCE_W_M2 * efficiency;

  return {
    generationW,
    areaM2,
    efficiency,
    eclipseFraction,
    assumptions: [
      `L0 PV: AM0 ${SOLAR_IRRADIANCE_W_M2} W/m² × η=${efficiency} × body panel area (no cosine / degradation)`,
      `Eclipse fraction ${eclipseFraction.toFixed(2)} is manual (Orekit later)`,
    ],
  };
}

function getDocEclipseFraction(doc: SfdDocument): number {
  const meta = doc.parts.find((p) => p.id === "mission");
  if (!meta) return 0.35;
  return getParam(meta, "eclipseFraction", 0.35);
}

export function estimateThermalL0(
  doc: SfdDocument,
  nominalLoadW: number,
): ThermalL0 {
  const chassis = doc.parts.find((p) => p.id === "chassis");
  const w = chassis ? getParam(chassis, "widthMm", 100) / 1000 : 0.1;
  const d = chassis ? getParam(chassis, "depthMm", 100) / 1000 : 0.1;
  const h = chassis ? getParam(chassis, "heightMm", 340.5) / 1000 : 0.3405;
  const bodyAreaM2 = 2 * (w * d + w * h + d * h);
  const rejectableW = bodyAreaM2 * L0_THERMAL_REJECT_W_M2;
  const ratio = rejectableW > 0 ? nominalLoadW / rejectableW : Infinity;

  let status: MarginStatus = "green";
  if (ratio > 1.15) status = "red";
  else if (ratio > 0.85) status = "yellow";

  return {
    dissipationW: nominalLoadW,
    rejectableW,
    status,
    message:
      status === "green"
        ? `L0 thermal: load ${nominalLoadW.toFixed(1)} W within coarse rejectable ${rejectableW.toFixed(1)} W`
        : `L0 thermal: load ${nominalLoadW.toFixed(1)} W vs rejectable ${rejectableW.toFixed(1)} W — refine with nodal/FEM later`,
    fidelity: "L0",
  };
}

export function ledgerFromDocument(
  doc: SfdDocument,
  options?: { eclipseFraction?: number },
): BudgetLedger {
  const chassis = doc.parts.find((p) => p.id === "chassis");
  const h = chassis ? getParam(chassis, "heightMm", 340.5) : 340.5;
  const ledger = createEmptyLedger();
  const eclipseFraction =
    options?.eclipseFraction ?? getDocEclipseFraction(doc);

  for (const part of doc.parts) {
    if (part.id === "mission") continue;
    if (part.massKg && part.massKg > 0) {
      ledger.massItems.push({
        id: part.id,
        name: part.name,
        massKg: part.massKg,
        cgMm: {
          x: getParam(part, "xMm", getParam(part, "offsetXMm", 0)),
          y: getParam(part, "yMm", getParam(part, "offsetYMm", 0)),
          z: getParam(part, "zMm", getParam(part, "z0Mm", h / 2)),
        },
        subsystem: part.subsystem,
      });
    }
    if (
      part.wattsNominal != null ||
      part.wattsPeak != null ||
      part.wattsSafe != null ||
      part.wattsEclipse != null
    ) {
      ledger.powerItems.push({
        id: part.id,
        name: part.name,
        wattsByMode: {
          safe: part.wattsSafe ?? 0,
          nominal: part.wattsNominal ?? 0,
          peak: part.wattsPeak ?? 0,
          eclipse: part.wattsEclipse ?? 0,
        },
        subsystem: part.subsystem,
      });
    }
  }

  const solar = estimateSolarGeneration(doc, { eclipseFraction });
  const powerNominal = ledger.powerItems.reduce(
    (s, i) => s + i.wattsByMode.nominal,
    0,
  );
  const thermal = estimateThermalL0(doc, powerNominal);

  ledger.solar = solar;
  ledger.thermal = thermal;
  ledger.thermalDissipationW = thermal.dissipationW;
  ledger.eclipseFraction = eclipseFraction;
  ledger.assumptions.push(
    "Budgets derived from SFD parts (LibreCube tags) — L0 educational fidelity",
  );
  ledger.assumptions.push(...solar.assumptions);
  ledger.assumptions.push(thermal.message);

  return ledger;
}

export function summarize(ledger: BudgetLedger): BudgetSummary {
  const totalMassKg = ledger.massItems.reduce((s, i) => s + i.massKg, 0);

  let massMoment = { x: 0, y: 0, z: 0 };
  let massWithCg = 0;
  for (const item of ledger.massItems) {
    if (!item.cgMm) continue;
    massMoment.x += item.massKg * item.cgMm.x;
    massMoment.y += item.massKg * item.cgMm.y;
    massMoment.z += item.massKg * item.cgMm.z;
    massWithCg += item.massKg;
  }

  const cgMm =
    massWithCg > 0
      ? {
          x: massMoment.x / massWithCg,
          y: massMoment.y / massWithCg,
          z: massMoment.z / massWithCg,
        }
      : null;

  const powerByMode = Object.fromEntries(
    MODES.map((mode) => [
      mode,
      ledger.powerItems.reduce((s, i) => s + (i.wattsByMode[mode] ?? 0), 0),
    ]),
  ) as Record<PowerMode, number>;

  const solarGenerationW = ledger.solar?.generationW ?? 0;
  const eclipseFraction = ledger.eclipseFraction ?? ledger.solar?.eclipseFraction ?? 0.35;

  const powerMargins = {
    safe: solarGenerationW - powerByMode.safe,
    nominal: solarGenerationW - powerByMode.nominal,
    peak: solarGenerationW - powerByMode.peak,
    /** Eclipse: generation ≈ 0; negative margin expected unless batteries sized */
    eclipse: 0 - powerByMode.eclipse,
  } as Record<PowerMode, number>;

  const margins = buildMargins({
    totalMassKg,
    powerByMode,
    solarGenerationW,
    powerMargins,
    thermal: ledger.thermal,
    eclipseFraction,
  });

  return {
    totalMassKg,
    cgMm,
    powerByMode,
    solarGenerationW,
    powerMargins,
    thermal: ledger.thermal,
    margins,
    fidelity: ledger.fidelity,
    assumptions: [...ledger.assumptions],
    eclipseFraction,
  };
}

function buildMargins(input: {
  totalMassKg: number;
  powerByMode: Record<PowerMode, number>;
  solarGenerationW: number;
  powerMargins: Record<PowerMode, number>;
  thermal?: ThermalL0;
  eclipseFraction: number;
}): MarginRow[] {
  const nomMargin = input.powerMargins.nominal;
  const nomStatus: MarginStatus =
    nomMargin >= 1 ? "green" : nomMargin >= 0 ? "yellow" : "red";

  const rows: MarginRow[] = [
    {
      id: "margin.mass",
      title: "Mass (workbook)",
      status: "info",
      value: `${input.totalMassKg.toFixed(3)} kg`,
      message: "Compared to CDS guideline in scorecard",
    },
    {
      id: "margin.power.nominal",
      title: "Power margin (nominal vs PV)",
      status: nomStatus,
      value: `${nomMargin >= 0 ? "+" : ""}${nomMargin.toFixed(2)} W`,
      message: `Generation ${input.solarGenerationW.toFixed(2)} W − load ${input.powerByMode.nominal.toFixed(2)} W`,
    },
    {
      id: "margin.power.peak",
      title: "Power margin (peak vs PV)",
      status:
        input.powerMargins.peak >= 0
          ? "green"
          : input.powerMargins.peak >= -2
            ? "yellow"
            : "red",
      value: `${input.powerMargins.peak >= 0 ? "+" : ""}${input.powerMargins.peak.toFixed(2)} W`,
      message: "Peak often draws from battery — flag only",
    },
    {
      id: "margin.eclipse",
      title: "Eclipse load (battery needed)",
      status: "info",
      value: `${input.powerByMode.eclipse.toFixed(2)} W`,
      message: `Manual eclipse fraction ${input.eclipseFraction.toFixed(2)}; battery sizing not modeled in L0`,
    },
  ];

  if (input.thermal) {
    rows.push({
      id: "margin.thermal",
      title: "Thermal L0",
      status: input.thermal.status,
      value: `${input.thermal.dissipationW.toFixed(1)} / ${input.thermal.rejectableW.toFixed(1)} W`,
      message: input.thermal.message,
    });
  }

  return rows;
}

export function bomFromDocument(doc: SfdDocument): BomRow[] {
  return doc.parts
    .filter((p) => p.id !== "mission")
    .map((p) => ({
      id: p.id,
      name: p.name,
      subsystem: p.subsystem ?? "other",
      massKg: p.massKg ?? 0,
      wattsNominal: p.wattsNominal ?? 0,
    }));
}

export function bomToCsv(rows: BomRow[]): string {
  const header = "id,name,subsystem,mass_kg,watts_nominal";
  const lines = rows.map(
    (r) =>
      `${csvEscape(r.id)},${csvEscape(r.name)},${csvEscape(r.subsystem)},${r.massKg.toFixed(4)},${r.wattsNominal.toFixed(3)}`,
  );
  return [header, ...lines].join("\n") + "\n";
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
