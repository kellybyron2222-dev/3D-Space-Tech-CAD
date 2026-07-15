/**
 * SpaceForge Design (SFD) language — parametric source of truth.
 * Geometry compilation (Replicad / OCCT) lives in the web worker.
 */

export type SfdUnits = "si";

export type SfdPartKind = "box" | "panel" | "generic";

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

/** Educational Reference-3U chassis envelope (mm), CDS guideline-sized. */
export function createReference3UDocument(): SfdDocument {
  return {
    version: 0,
    name: "Reference-3U",
    units: "si",
    parts: [
      {
        id: "chassis",
        name: "Chassis",
        kind: "box",
        params: [
          {
            name: "widthMm",
            value: 100,
            unit: "mm",
            description: "X envelope",
          },
          {
            name: "depthMm",
            value: 100,
            unit: "mm",
            description: "Y envelope",
          },
          {
            name: "heightMm",
            value: 340.5,
            unit: "mm",
            description: "Z envelope (3U guideline)",
          },
        ],
      },
      {
        id: "solar-panel",
        name: "Body solar panel",
        kind: "panel",
        params: [
          { name: "widthMm", value: 90, unit: "mm" },
          { name: "heightMm", value: 300, unit: "mm" },
          { name: "thicknessMm", value: 2, unit: "mm" },
          {
            name: "offsetXMm",
            value: 51,
            unit: "mm",
            description: "Offset from chassis center along +X",
          },
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
