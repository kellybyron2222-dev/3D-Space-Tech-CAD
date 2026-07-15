/**
 * Systems pack — VCRM-lite, ICD stubs, assumption registry (MVP-5).
 * Educational Phase A scaffolding; not a flight verification system.
 */

export type EvidenceStatus = "planned" | "in_progress" | "complete" | "waived";

export type IcdDomain = "mechanical" | "power" | "data" | "thermal";

export interface Assumption {
  id: string;
  text: string;
  fidelity: "L0" | "L1" | "L2";
  source?: string;
}

export interface VcrmRow {
  id: string;
  requirement: string;
  method: string;
  evidence: string;
  status: EvidenceStatus;
  citation?: string;
}

export interface IcdStub {
  id: string;
  domain: IcdDomain;
  title: string;
  interfaceTo: string;
  notes: string;
  openItems: string[];
}

export interface SystemsPack {
  assumptions: Assumption[];
  vcrm: VcrmRow[];
  icds: IcdStub[];
}

export function createReference3USystemsPack(): SystemsPack {
  return {
    assumptions: [
      {
        id: "a.pv.am0",
        text: "Body-mounted PV uses AM0 irradiance with constant efficiency; no cosine, degradation, or temperature derate",
        fidelity: "L0",
        source: "BudgetLedger solar estimate",
      },
      {
        id: "a.eclipse.manual",
        text: "Eclipse fraction is a manual mission parameter until Orekit integration",
        fidelity: "L0",
        source: "SFD mission part",
      },
      {
        id: "a.thermal.l0",
        text: "Thermal uses coarse body-area rejectable heat — not a nodal model",
        fidelity: "L0",
        source: "BudgetLedger thermal L0",
      },
      {
        id: "a.cds.edu",
        text: "CDS scorecard uses educational guidelines; launch provider ICD supersedes",
        fidelity: "L0",
        source: "rules-cds",
      },
    ],
    vcrm: [
      {
        id: "req.envelope",
        requirement: "Stowed envelope shall fit 3U dispenser guideline",
        method: "Analysis — parametric envelope vs CDS table",
        evidence: "CDS scorecard cds.envelope",
        status: "in_progress",
        citation: "CDS Rev 14+ dimensional guidelines (educational)",
      },
      {
        id: "req.mass",
        requirement: "Wet mass shall remain under educational 3U mass guideline",
        method: "Analysis — mass budget rollup",
        evidence: "CDS scorecard cds.mass + BOM",
        status: "in_progress",
        citation: "CDS / dispenser mass guidelines (educational)",
      },
      {
        id: "req.power.pos",
        requirement: "Orbit-average power positive in nominal sunlit mode (L0)",
        method: "Analysis — PV generation vs mode loads",
        evidence: "Power margin row margin.power.nominal",
        status: "planned",
      },
      {
        id: "req.comms.link",
        requirement: "TT&C link closes at max slant range (placeholder)",
        method: "Analysis — link budget (not yet modeled)",
        evidence: "TBD university radio ICD",
        status: "planned",
      },
      {
        id: "req.thermal.surv",
        requirement: "Components survive expected temperature range",
        method: "Analysis — L0 flag then nodal later",
        evidence: "Thermal L0 margin",
        status: "planned",
      },
    ],
    icds: [
      {
        id: "icd.mech.dispenser",
        domain: "mechanical",
        title: "Dispenser / deployer mechanical ICD",
        interfaceTo: "Launch provider dispenser",
        notes: "Rails, inhibit switches, CG, keep-outs — fill with provider drawing numbers",
        openItems: [
          "Confirm rail tip / tab dimensions against chosen dispenser",
          "Document inhibit switch actuation sequence",
        ],
      },
      {
        id: "icd.power.eps",
        domain: "power",
        title: "EPS ↔ subsystem power ICD",
        interfaceTo: "OBC, radio, ADCS, payload",
        notes: "Voltage rails, peak current, umbilical charging — spreadsheet-backed for MVP",
        openItems: [
          "List bus voltages and protections",
          "Define battery heater policy in eclipse",
        ],
      },
      {
        id: "icd.data.can",
        domain: "data",
        title: "OBC data bus ICD (stub)",
        interfaceTo: "Payload / ADCS / radio",
        notes: "Protocol TBD (CSP, CAN, I2C) — university team fills stack choice",
        openItems: ["Select bus standard", "Define telemetry packet map"],
      },
      {
        id: "icd.thermal.stack",
        domain: "thermal",
        title: "Board stack thermal ICD (stub)",
        interfaceTo: "Structure / radiators",
        notes: "Mounting conductance and MLI TBD; L0 body-area only today",
        openItems: ["Identify hottest board", "Decide radiator faces"],
      },
    ],
  };
}

export function scorecardSummaryLine(
  pass: number,
  warn: number,
  fail: number,
  info: number,
): string {
  return `${pass} pass · ${warn} warn · ${fail} fail · ${info} info`;
}
