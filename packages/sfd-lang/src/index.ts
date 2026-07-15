/**
 * SpaceForge Design (SFD) language — parametric source of truth.
 * MVP-1: minimal document model. Geometry compilation lands in MVP-2.
 */

export type SfdUnits = "si";

export interface SfdParam {
  name: string;
  value: number;
  unit: string;
  description?: string;
}

export interface SfdPart {
  id: string;
  name: string;
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
