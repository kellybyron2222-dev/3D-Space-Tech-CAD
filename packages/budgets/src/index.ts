/**
 * Budget ledger — mass / mode power / L0 thermal placeholders.
 * Full geometry binding lands with Reference-3U (MVP-3/4).
 */

export type PowerMode = "safe" | "nominal" | "peak" | "eclipse";

export type Fidelity = "L0" | "L1" | "L2";

export interface MassBudgetItem {
  id: string;
  name: string;
  massKg: number;
  cgMm?: { x: number; y: number; z: number };
}

export interface PowerBudgetItem {
  id: string;
  name: string;
  /** Watts drawn in each mode */
  wattsByMode: Record<PowerMode, number>;
}

export interface BudgetLedger {
  fidelity: Fidelity;
  massItems: MassBudgetItem[];
  powerItems: PowerBudgetItem[];
  /** Optional L0 heat dissipation estimate (W) in nominal mode */
  thermalDissipationW?: number;
  assumptions: string[];
}

export interface BudgetSummary {
  totalMassKg: number;
  cgMm: { x: number; y: number; z: number } | null;
  powerByMode: Record<PowerMode, number>;
  fidelity: Fidelity;
  assumptions: string[];
}

const MODES: PowerMode[] = ["safe", "nominal", "peak", "eclipse"];

export function createEmptyLedger(): BudgetLedger {
  return {
    fidelity: "L0",
    massItems: [],
    powerItems: [],
    assumptions: [],
  };
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

  return {
    totalMassKg,
    cgMm,
    powerByMode,
    fidelity: ledger.fidelity,
    assumptions: [...ledger.assumptions],
  };
}
