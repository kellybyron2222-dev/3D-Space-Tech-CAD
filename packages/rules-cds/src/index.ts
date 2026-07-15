/**
 * CDS-style checkers (educational soft constraints).
 * Based on CubeSat Design Specification guidelines — not a substitute
 * for launch provider requirements.
 */

export type CheckStatus = "pass" | "fail" | "warn" | "info";

export interface CdsCheckResult {
  id: string;
  title: string;
  status: CheckStatus;
  message: string;
  citation: string;
}

export interface CdsGeometryInput {
  /** Form factor units (1, 3, 6, …) */
  units: number;
  /** Stowed envelope in mm */
  envelopeMm: { x: number; y: number; z: number };
  totalMassKg: number;
}

/** Approximate CDS guideline envelopes (mm) for common sizes */
const ENVELOPE_MM: Record<number, { x: number; y: number; z: number }> = {
  1: { x: 100, y: 100, z: 113.5 },
  3: { x: 100, y: 100, z: 340.5 },
};

/** Conservative educational mass guidelines (kg) — launch provider rules supersede */
const MASS_GUIDELINE_KG: Record<number, number> = {
  1: 2.0,
  3: 6.0,
};

export function checkCdsEnvelope(input: CdsGeometryInput): CdsCheckResult {
  const limit = ENVELOPE_MM[input.units];
  if (!limit) {
    return {
      id: "cds.envelope",
      title: "Stowed envelope",
      status: "info",
      message: `No built-in envelope table for ${input.units}U; verify against CDS / dispenser ICD.`,
      citation: "CubeSat Design Specification (Cal Poly) — form factor guidelines",
    };
  }

  const fits =
    input.envelopeMm.x <= limit.x + 1e-6 &&
    input.envelopeMm.y <= limit.y + 1e-6 &&
    input.envelopeMm.z <= limit.z + 1e-6;

  return {
    id: "cds.envelope",
    title: "Stowed envelope",
    status: fits ? "pass" : "fail",
    message: fits
      ? `${input.units}U envelope within educational guideline ${limit.x}×${limit.y}×${limit.z} mm`
      : `${input.units}U envelope ${input.envelopeMm.x}×${input.envelopeMm.y}×${input.envelopeMm.z} mm exceeds guideline ${limit.x}×${limit.y}×${limit.z} mm`,
    citation: "CubeSat Design Specification (Cal Poly) — dimensional guidelines",
  };
}

export function checkCdsMass(input: CdsGeometryInput): CdsCheckResult {
  const limit = MASS_GUIDELINE_KG[input.units];
  if (!limit) {
    return {
      id: "cds.mass",
      title: "Mass guideline",
      status: "info",
      message: `No built-in mass guideline for ${input.units}U; verify against dispenser / LV ICD.`,
      citation: "CubeSat Design Specification / launch provider ICD",
    };
  }

  const ok = input.totalMassKg <= limit;
  return {
    id: "cds.mass",
    title: "Mass guideline",
    status: ok ? "pass" : "fail",
    message: ok
      ? `Mass ${input.totalMassKg.toFixed(3)} kg ≤ ${limit} kg educational guideline`
      : `Mass ${input.totalMassKg.toFixed(3)} kg exceeds ${limit} kg educational guideline`,
    citation: "CubeSat Design Specification / typical dispenser mass guidelines (educational)",
  };
}

export function runCdsScorecard(input: CdsGeometryInput): CdsCheckResult[] {
  return [checkCdsEnvelope(input), checkCdsMass(input)];
}
