/**
 * SpaceForge Design (SFD) language — parametric source of truth.
 * Geometry compilation (Replicad / OCCT) lives in the web worker.
 */

export type SfdUnits = "si";

export type SfdPartKind =
  | "box"
  | "panel"
  | "rail"
  | "board"
  | "antenna"
  | "generic";

export type LibreCubeTag =
  | "structure"
  | "power"
  | "comms"
  | "thermal"
  | "processing"
  | "payload"
  | "navigation";

export interface SfdParam {
  name: string;
  value: number;
  unit: string;
  description?: string;
}

export interface SfdPart {
  id: string;
  name: string;
  kind?: SfdPartKind;
  subsystem?: LibreCubeTag;
  massKg?: number;
  /** Watts by mode when present */
  wattsNominal?: number;
  wattsPeak?: number;
  wattsSafe?: number;
  wattsEclipse?: number;
  params: SfdParam[];
}

export interface SfdDocument {
  version: 0;
  name: string;
  units: SfdUnits;
  parts: SfdPart[];
  /** Content hash placeholder for analysis versioning */
  revision?: string;
}

/** Persistable workbook project (SFD + optional UI notes). */
export interface SfdProjectFile {
  format: "spacetech-project";
  formatVersion: 1;
  savedAt: string;
  document: SfdDocument;
}

export function createEmptyDocument(name: string): SfdDocument {
  return {
    version: 0,
    name,
    units: "si",
    parts: [],
  };
}

export function getParam(part: SfdPart, name: string, fallback = 0): number {
  return part.params.find((p) => p.name === name)?.value ?? fallback;
}

export function setPartParam(
  doc: SfdDocument,
  partId: string,
  name: string,
  value: number,
): SfdDocument {
  return {
    ...doc,
    parts: doc.parts.map((part) => {
      if (part.id !== partId) return part;
      const has = part.params.some((p) => p.name === name);
      return {
        ...part,
        params: has
          ? part.params.map((p) => (p.name === name ? { ...p, value } : p))
          : [...part.params, { name, value, unit: "1" }],
      };
    }),
  };
}

export function setPartMass(
  doc: SfdDocument,
  partId: string,
  massKg: number,
): SfdDocument {
  return {
    ...doc,
    parts: doc.parts.map((part) =>
      part.id === partId ? { ...part, massKg } : part,
    ),
  };
}

export function setPartWatts(
  doc: SfdDocument,
  partId: string,
  patch: Partial<
    Pick<SfdPart, "wattsNominal" | "wattsPeak" | "wattsSafe" | "wattsEclipse">
  >,
): SfdDocument {
  return {
    ...doc,
    parts: doc.parts.map((part) =>
      part.id === partId ? { ...part, ...patch } : part,
    ),
  };
}

export function toProjectFile(doc: SfdDocument): SfdProjectFile {
  return {
    format: "spacetech-project",
    formatVersion: 1,
    savedAt: new Date().toISOString(),
    document: doc,
  };
}

export function parseProjectFile(raw: string): SfdDocument {
  const parsed = JSON.parse(raw) as SfdProjectFile | SfdDocument;
  if ("format" in parsed && parsed.format === "spacetech-project") {
    return parseDocument(JSON.stringify(parsed.document));
  }
  return parseDocument(raw);
}

/** Educational Reference-3U with LibreCube-tagged subsystems (mm). */
export function createReference3UDocument(): SfdDocument {
  return {
    version: 0,
    name: "Reference-3U",
    units: "si",
    parts: [
      {
        id: "mission",
        name: "Mission parameters",
        kind: "generic",
        subsystem: "navigation",
        params: [
          {
            name: "eclipseFraction",
            value: 0.35,
            unit: "1",
            description: "Manual LEO eclipse fraction (Orekit later)",
          },
          {
            name: "units",
            value: 3,
            unit: "U",
            description: "CubeSat form factor",
          },
        ],
      },
      {
        id: "chassis",
        name: "Primary structure envelope",
        kind: "box",
        subsystem: "structure",
        massKg: 0.85,
        params: [
          { name: "widthMm", value: 100, unit: "mm", description: "X" },
          { name: "depthMm", value: 100, unit: "mm", description: "Y" },
          {
            name: "heightMm",
            value: 340.5,
            unit: "mm",
            description: "Z (3U guideline)",
          },
          {
            name: "wallMm",
            value: 1.5,
            unit: "mm",
            description: "Shell thickness for hollow body",
          },
        ],
      },
      {
        id: "rail-xp",
        name: "Rail +X",
        kind: "rail",
        subsystem: "structure",
        massKg: 0.08,
        params: [
          { name: "heightMm", value: 340.5, unit: "mm" },
          { name: "sectionMm", value: 8, unit: "mm" },
          { name: "xMm", value: 46, unit: "mm" },
          { name: "yMm", value: 46, unit: "mm" },
        ],
      },
      {
        id: "rail-xn",
        name: "Rail -X",
        kind: "rail",
        subsystem: "structure",
        massKg: 0.08,
        params: [
          { name: "heightMm", value: 340.5, unit: "mm" },
          { name: "sectionMm", value: 8, unit: "mm" },
          { name: "xMm", value: -46, unit: "mm" },
          { name: "yMm", value: 46, unit: "mm" },
        ],
      },
      {
        id: "rail-yp",
        name: "Rail +Y",
        kind: "rail",
        subsystem: "structure",
        massKg: 0.08,
        params: [
          { name: "heightMm", value: 340.5, unit: "mm" },
          { name: "sectionMm", value: 8, unit: "mm" },
          { name: "xMm", value: 46, unit: "mm" },
          { name: "yMm", value: -46, unit: "mm" },
        ],
      },
      {
        id: "rail-yn",
        name: "Rail -Y",
        kind: "rail",
        subsystem: "structure",
        massKg: 0.08,
        params: [
          { name: "heightMm", value: 340.5, unit: "mm" },
          { name: "sectionMm", value: 8, unit: "mm" },
          { name: "xMm", value: -46, unit: "mm" },
          { name: "yMm", value: -46, unit: "mm" },
        ],
      },
      {
        id: "board-eps",
        name: "EPS board",
        kind: "board",
        subsystem: "power",
        massKg: 0.22,
        wattsNominal: 0.4,
        wattsPeak: 1.2,
        wattsSafe: 0.1,
        wattsEclipse: 0.3,
        params: [
          { name: "zMm", value: 40, unit: "mm" },
          { name: "thicknessMm", value: 1.6, unit: "mm" },
        ],
      },
      {
        id: "board-obc",
        name: "OBC board",
        kind: "board",
        subsystem: "processing",
        massKg: 0.18,
        wattsNominal: 1.2,
        wattsPeak: 2.5,
        wattsSafe: 0.3,
        wattsEclipse: 0.8,
        params: [
          { name: "zMm", value: 70, unit: "mm" },
          { name: "thicknessMm", value: 1.6, unit: "mm" },
        ],
      },
      {
        id: "board-radio",
        name: "TT&C radio board",
        kind: "board",
        subsystem: "comms",
        massKg: 0.15,
        wattsNominal: 1.0,
        wattsPeak: 3.5,
        wattsSafe: 0.2,
        wattsEclipse: 0.5,
        params: [
          { name: "zMm", value: 100, unit: "mm" },
          { name: "thicknessMm", value: 1.6, unit: "mm" },
        ],
      },
      {
        id: "board-adcs",
        name: "ADCS board",
        kind: "board",
        subsystem: "navigation",
        massKg: 0.2,
        wattsNominal: 0.8,
        wattsPeak: 2.0,
        wattsSafe: 0.2,
        wattsEclipse: 0.6,
        params: [
          { name: "zMm", value: 130, unit: "mm" },
          { name: "thicknessMm", value: 1.6, unit: "mm" },
        ],
      },
      {
        id: "payload",
        name: "Imaging payload",
        kind: "board",
        subsystem: "payload",
        massKg: 0.45,
        wattsNominal: 2.0,
        wattsPeak: 4.0,
        wattsSafe: 0,
        wattsEclipse: 0,
        params: [
          { name: "zMm", value: 200, unit: "mm" },
          { name: "thicknessMm", value: 12, unit: "mm" },
        ],
      },
      {
        id: "solar-xp",
        name: "Solar panel +X",
        kind: "panel",
        subsystem: "power",
        massKg: 0.12,
        params: [
          { name: "widthMm", value: 82, unit: "mm" },
          { name: "heightMm", value: 280, unit: "mm" },
          { name: "thicknessMm", value: 2.2, unit: "mm" },
          { name: "offsetXMm", value: 52, unit: "mm" },
          { name: "offsetYMm", value: 0, unit: "mm" },
          { name: "z0Mm", value: 30, unit: "mm" },
        ],
      },
      {
        id: "solar-xn",
        name: "Solar panel -X",
        kind: "panel",
        subsystem: "power",
        massKg: 0.12,
        params: [
          { name: "widthMm", value: 82, unit: "mm" },
          { name: "heightMm", value: 280, unit: "mm" },
          { name: "thicknessMm", value: 2.2, unit: "mm" },
          { name: "offsetXMm", value: -52, unit: "mm" },
          { name: "offsetYMm", value: 0, unit: "mm" },
          { name: "z0Mm", value: 30, unit: "mm" },
        ],
      },
      {
        id: "antenna",
        name: "UHF antenna",
        kind: "antenna",
        subsystem: "comms",
        massKg: 0.04,
        params: [
          { name: "lengthMm", value: 170, unit: "mm" },
          { name: "diameterMm", value: 4, unit: "mm" },
          { name: "zMm", value: 340.5, unit: "mm" },
        ],
      },
    ],
  };
}

export function serializeDocument(doc: SfdDocument): string {
  return JSON.stringify(doc, null, 2);
}

export function parseDocument(raw: string): SfdDocument {
  const parsed = JSON.parse(raw) as SfdDocument;
  if (parsed.version !== 0) {
    throw new Error(`Unsupported SFD version: ${String(parsed.version)}`);
  }
  if (!parsed.name || !Array.isArray(parsed.parts)) {
    throw new Error("Invalid SFD document shape");
  }
  return parsed;
}

export {
  activeFeatures,
  applyAssemblyMates,
  applyParameters,
  createBracketDemo,
  createDemoAssembly,
  createEmptyAssembly,
  createEmptyFeatureDocument,
  createReference3UFeatures,
  newFeatureId,
  parseAssemblyDocument,
  parseFeatureDocument,
  resolveSketch,
  serializeAssemblyDocument,
  serializeFeatureDocument,
  type AssemblyDocument,
  type AssemblyInstance,
  type BoxFeature,
  type CadFeature,
  type ChamferFeature,
  type CutFeature,
  type ExtrudeFeature,
  type FeatureDocument,
  type FeatureKind,
  type FilletFeature,
  type HoleFeature,
  type ImportBodyFeature,
  type LinearPatternFeature,
  type MirrorFeature,
  type MateSpec,
  type PlaneId,
  type ProfileKind,
  type RevolveFeature,
  type SketchConstraint,
  type SketchFeature,
} from "./features.js";
