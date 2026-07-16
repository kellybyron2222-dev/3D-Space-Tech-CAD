/**
 * Feature-history model for Part Studio (CAD-first).
 * Worker compiles features → B-rep; mesh is display only.
 */

export type PlaneId = "front" | "top" | "right";

export type FeatureKind = "box" | "extrude" | "cut" | "importBody";

export interface FeatureBase {
  id: string;
  name: string;
  kind: FeatureKind;
  suppressed?: boolean;
}

export interface BoxFeature extends FeatureBase {
  kind: "box";
  widthMm: number;
  depthMm: number;
  heightMm: number;
  xMm?: number;
  yMm?: number;
  zMm?: number;
}

/** Parametric rectangle sketch on a plane, then extrude (sketch editor later). */
export interface ExtrudeFeature extends FeatureBase {
  kind: "extrude";
  plane: PlaneId;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  /** Offset of sketch center on plane (mm) */
  offsetUMm?: number;
  offsetVMm?: number;
}

export interface CutFeature extends FeatureBase {
  kind: "cut";
  plane: PlaneId;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  offsetUMm?: number;
  offsetVMm?: number;
}

export interface ImportBodyFeature extends FeatureBase {
  kind: "importBody";
  /** Display-only label; geometry loaded separately in session */
  sourceLabel: string;
}

export type CadFeature =
  | BoxFeature
  | ExtrudeFeature
  | CutFeature
  | ImportBodyFeature;

export interface FeatureDocument {
  version: 1;
  name: string;
  features: CadFeature[];
  /** Index in features — features after this are rolled back (not rebuilt) */
  rollbackIndex: number | null;
}

export function createEmptyFeatureDocument(name = "Part Studio"): FeatureDocument {
  return {
    version: 1,
    name,
    features: [],
    rollbackIndex: null,
  };
}

/** Minimal 3U chassis as feature history (space template). */
export function createReference3UFeatures(): FeatureDocument {
  return {
    version: 1,
    name: "Reference-3U",
    rollbackIndex: null,
    features: [
      {
        id: "f-chassis",
        name: "Chassis envelope",
        kind: "box",
        widthMm: 100,
        depthMm: 100,
        heightMm: 340.5,
      },
      {
        id: "f-cut-cavity",
        name: "Internal cavity",
        kind: "cut",
        plane: "front",
        widthMm: 84,
        heightMm: 84,
        depthMm: 320,
        offsetUMm: 0,
        offsetVMm: 0,
      },
    ],
  };
}

export function activeFeatures(doc: FeatureDocument): CadFeature[] {
  const end =
    doc.rollbackIndex == null
      ? doc.features.length
      : Math.min(doc.rollbackIndex + 1, doc.features.length);
  return doc.features.slice(0, end).filter((f) => !f.suppressed);
}

export function newFeatureId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
