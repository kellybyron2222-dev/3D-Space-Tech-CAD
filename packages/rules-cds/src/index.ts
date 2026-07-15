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
  /** Optional CG in mm (chassis frame, origin at geometric center XY, Z from −Z rail end) */
  cgMm?: { x: number; y: number; z: number } | null;
  /** Optional solar generation (W) for soft power flag */
  solarGenerationW?: number;
  /** Optional nominal load (W) */
  nominalLoadW?: number;
  /** Optional rail tip protrusion beyond envelope faces (mm) — deployer keep-out */
  railProtrusionMm?: number;
}

/** Approximate CDS guideline envelopes (mm) for common sizes */
const ENVELOPE_MM: Record<number, { x: number; y: number; z: number }> = {
  1: { x: 100, y: 100, z: 113.5 },
  3: { x: 100, y: 100, z: 340.5 },
  6: { x: 100, y: 226.3, z: 340.5 },
};

/** Conservative educational mass guidelines (kg) — launch provider rules supersede */
const MASS_GUIDELINE_KG: Record<number, number> = {
  1: 2.0,
  3: 6.0,
  6: 12.0,
};

/** Educational CG box: stay within ~15% of half-envelope from centerline */
const CG_FRACTION = 0.15;

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
  const near = input.totalMassKg > limit * 0.9;
  return {
    id: "cds.mass",
    title: "Mass guideline",
    status: ok ? (near ? "warn" : "pass") : "fail",
    message: ok
      ? `Mass ${input.totalMassKg.toFixed(3)} kg ≤ ${limit} kg educational guideline${near ? " (within 10%)" : ""}`
      : `Mass ${input.totalMassKg.toFixed(3)} kg exceeds ${limit} kg educational guideline`,
    citation: "CubeSat Design Specification / typical dispenser mass guidelines (educational)",
  };
}

export function checkCdsCg(input: CdsGeometryInput): CdsCheckResult {
  if (!input.cgMm) {
    return {
      id: "cds.cg",
      title: "Center of gravity",
      status: "info",
      message: "No CG estimate available — assign part CG offsets in SFD",
      citation: "Dispenser ICD / CDS — CG envelope (provider-specific)",
    };
  }

  const halfX = input.envelopeMm.x / 2;
  const halfY = input.envelopeMm.y / 2;
  const midZ = input.envelopeMm.z / 2;
  const tolX = halfX * CG_FRACTION;
  const tolY = halfY * CG_FRACTION;
  const tolZ = midZ * CG_FRACTION;

  const dx = Math.abs(input.cgMm.x);
  const dy = Math.abs(input.cgMm.y);
  const dz = Math.abs(input.cgMm.z - midZ);

  const ok = dx <= tolX && dy <= tolY && dz <= tolZ;
  return {
    id: "cds.cg",
    title: "Center of gravity",
    status: ok ? "pass" : "warn",
    message: ok
      ? `CG (${input.cgMm.x.toFixed(1)}, ${input.cgMm.y.toFixed(1)}, ${input.cgMm.z.toFixed(1)}) mm within educational ${CG_FRACTION * 100}% box`
      : `CG (${input.cgMm.x.toFixed(1)}, ${input.cgMm.y.toFixed(1)}, ${input.cgMm.z.toFixed(1)}) mm outside educational ${CG_FRACTION * 100}% box — verify dispenser ICD`,
    citation: "Educational CG box — replace with dispenser ICD limits before PDR",
  };
}

export function checkDeployerKeepOut(input: CdsGeometryInput): CdsCheckResult {
  const protrusion = input.railProtrusionMm ?? 0;
  /** CDS-style educational: rails may extend a few mm; large protrusions fail */
  if (protrusion > 6.5) {
    return {
      id: "cds.deployer.keepout",
      title: "Deployer keep-out",
      status: "fail",
      message: `Rail / appendage protrusion ${protrusion.toFixed(1)} mm exceeds educational 6.5 mm tip allowance`,
      citation: "CubeSat Design Specification — rail ends / deployer interface (educational)",
    };
  }
  if (protrusion > 0) {
    return {
      id: "cds.deployer.keepout",
      title: "Deployer keep-out",
      status: "pass",
      message: `Stowed protrusion ${protrusion.toFixed(1)} mm within educational rail tip allowance`,
      citation: "CubeSat Design Specification — rail ends / deployer interface (educational)",
    };
  }
  return {
    id: "cds.deployer.keepout",
    title: "Deployer keep-out",
    status: "info",
    message:
      "No explicit protrusion modeled — confirm stowed antennas/panels against dispenser ICD",
    citation: "CubeSat Design Specification / dispenser ICD — keep-out volumes",
  };
}

export function checkPowerSoft(input: CdsGeometryInput): CdsCheckResult {
  if (
    input.solarGenerationW == null ||
    input.nominalLoadW == null ||
    !Number.isFinite(input.solarGenerationW)
  ) {
    return {
      id: "cds.power.soft",
      title: "Power (soft)",
      status: "info",
      message: "Solar generation not provided — skipped",
      citation: "Internal L0 energy balance (not a CDS clause)",
    };
  }

  const margin = input.solarGenerationW - input.nominalLoadW;
  if (margin >= 1) {
    return {
      id: "cds.power.soft",
      title: "Power (soft)",
      status: "pass",
      message: `L0 PV margin +${margin.toFixed(2)} W (gen ${input.solarGenerationW.toFixed(2)} W)`,
      citation: "Internal L0 energy balance (not a CDS clause)",
    };
  }
  if (margin >= 0) {
    return {
      id: "cds.power.soft",
      title: "Power (soft)",
      status: "warn",
      message: `L0 PV margin thin (+${margin.toFixed(2)} W) — increase panel area or cut load`,
      citation: "Internal L0 energy balance (not a CDS clause)",
    };
  }
  return {
    id: "cds.power.soft",
    title: "Power (soft)",
    status: "fail",
    message: `L0 PV shortfall ${margin.toFixed(2)} W — design will need more area or lower duty cycle`,
    citation: "Internal L0 energy balance (not a CDS clause)",
  };
}

export function runCdsScorecard(input: CdsGeometryInput): CdsCheckResult[] {
  return [
    checkCdsEnvelope(input),
    checkCdsMass(input),
    checkCdsCg(input),
    checkDeployerKeepOut(input),
    checkPowerSoft(input),
  ];
}
