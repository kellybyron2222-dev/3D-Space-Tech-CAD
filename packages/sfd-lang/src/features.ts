/**
 * Feature-history model for Part Studio (CAD table-stakes).
 * Worker compiles features → B-rep; mesh is display only.
 */

export type PlaneId = "front" | "top" | "right";

export type ProfileKind = "rect" | "circle";

export type FeatureKind =
  | "box"
  | "sketch"
  | "extrude"
  | "cut"
  | "revolve"
  | "fillet"
  | "chamfer"
  | "hole"
  | "mirror"
  | "linearPattern"
  | "importBody";

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

/** Lightweight constraint tags (solver v0 — declarative dims only). */
export type SketchConstraint =
  | { kind: "horizontal"; note?: string }
  | { kind: "vertical"; note?: string }
  | { kind: "equal"; note?: string }
  | { kind: "dimension"; valueMm: number; label?: string };

export type SketchEntity =
  | { id: string; kind: "line"; x1: number; y1: number; x2: number; y2: number }
  | { id: string; kind: "rect"; x: number; y: number; widthMm: number; heightMm: number }
  | { id: string; kind: "circle"; cx: number; cy: number; diameterMm: number };

/** Sketch profile on a datum plane (consumed by extrude/cut/revolve). */
export interface SketchFeature extends FeatureBase {
  kind: "sketch";
  plane: PlaneId;
  profile: ProfileKind;
  /** Rect width or circle diameter */
  widthMm: number;
  /** Rect height (ignored for circle) */
  heightMm: number;
  offsetUMm?: number;
  offsetVMm?: number;
  /** Multi-entity sketch geometry (optional; derived from profile when absent). */
  entities?: SketchEntity[];
  /** Constraint tags for UI / future solver */
  constraints?: SketchConstraint[];
}

export interface ExtrudeFeature extends FeatureBase {
  kind: "extrude";
  /** If set, uses sketch feature params; else inline profile */
  sketchId?: string;
  plane: PlaneId;
  profile: ProfileKind;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  offsetUMm?: number;
  offsetVMm?: number;
}

export interface CutFeature extends FeatureBase {
  kind: "cut";
  sketchId?: string;
  plane: PlaneId;
  profile: ProfileKind;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  offsetUMm?: number;
  offsetVMm?: number;
}

export interface RevolveFeature extends FeatureBase {
  kind: "revolve";
  plane: PlaneId;
  profile: ProfileKind;
  widthMm: number;
  heightMm: number;
  /** Revolution angle degrees (default 360) */
  angleDeg?: number;
  offsetUMm?: number;
  offsetVMm?: number;
}

export interface FilletFeature extends FeatureBase {
  kind: "fillet";
  radiusMm: number;
  /** Mesh edge indices when user Shift+clicked edges (kernel may fall back to global). */
  edgeIndices?: number[];
}

export interface ChamferFeature extends FeatureBase {
  kind: "chamfer";
  distanceMm: number;
  edgeIndices?: number[];
}

/** Cylindrical hole cut along +Z from z0 */
export interface HoleFeature extends FeatureBase {
  kind: "hole";
  diameterMm: number;
  depthMm: number;
  xMm?: number;
  yMm?: number;
  zMm?: number;
}

export interface ImportBodyFeature extends FeatureBase {
  kind: "importBody";
  sourceLabel: string;
}

/** Mirror last solid across a plane through origin. */
export interface MirrorFeature extends FeatureBase {
  kind: "mirror";
  plane: PlaneId;
}

/** Translate+fuse copies of the current solid. */
export interface LinearPatternFeature extends FeatureBase {
  kind: "linearPattern";
  count: number;
  dxMm: number;
  dyMm: number;
  dzMm: number;
}

export type CadFeature =
  | BoxFeature
  | SketchFeature
  | ExtrudeFeature
  | CutFeature
  | RevolveFeature
  | FilletFeature
  | ChamferFeature
  | HoleFeature
  | MirrorFeature
  | LinearPatternFeature
  | ImportBodyFeature;

export interface FeatureDocument {
  version: 1;
  name: string;
  features: CadFeature[];
  rollbackIndex: number | null;
  /** Named parameters (mm or dimensionless) */
  parameters?: Record<string, number>;
}

export interface MateSpec {
  id: string;
  kind: "coincident" | "distance";
  partA: string;
  partB: string;
  /** Offset for distance mate (mm) */
  distanceMm?: number;
}

export interface AssemblyInstance {
  id: string;
  name: string;
  /** Embedded part document */
  part: FeatureDocument;
  /** Placement */
  xMm: number;
  yMm: number;
  zMm: number;
}

export interface AssemblyDocument {
  version: 1;
  name: string;
  instances: AssemblyInstance[];
  mates: MateSpec[];
}

export function createEmptyFeatureDocument(name = "Part Studio"): FeatureDocument {
  return {
    version: 1,
    name,
    features: [],
    rollbackIndex: null,
    parameters: {},
  };
}

export function createBracketDemo(options?: { includeDepth?: boolean }): FeatureDocument {
  return {
    version: 1,
    name: "Bracket-Demo",
    rollbackIndex: null,
    parameters: {
      wall: 4,
      holeDia: 6,
      ...(options?.includeDepth ? { depth: 15 } : {}),
    },
    features: [
      {
        id: "f-base",
        name: "Base plate",
        kind: "box",
        widthMm: 80,
        depthMm: 50,
        heightMm: 8,
      },
      {
        id: "f-sketch-hole",
        name: "Hole sketch",
        kind: "sketch",
        plane: "front",
        profile: "circle",
        widthMm: 6,
        heightMm: 6,
        offsetUMm: 0,
        offsetVMm: 0,
        entities: [
          {
            id: "se-hole",
            kind: "circle",
            cx: 0,
            cy: 0,
            diameterMm: 6,
          },
        ],
      },
      {
        id: "f-hole",
        name: "Mount hole",
        kind: "hole",
        diameterMm: 6,
        depthMm: 10,
        xMm: 0,
        yMm: 0,
        zMm: 0,
      },
      {
        id: "f-fillet",
        name: "Edge fillet",
        kind: "fillet",
        radiusMm: 2,
      },
    ],
  };
}

/** Minimal 3U chassis as feature history (space template). */
export function createReference3UFeatures(): FeatureDocument {
  return {
    version: 1,
    name: "Reference-3U",
    rollbackIndex: null,
    parameters: { u: 100, height: 340.5 },
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
        profile: "rect",
        widthMm: 84,
        heightMm: 84,
        depthMm: 320,
        offsetUMm: 0,
        offsetVMm: 0,
      },
      {
        id: "f-fillet",
        name: "Rail tip fillet",
        kind: "fillet",
        radiusMm: 1.5,
      },
    ],
  };
}

export function createEmptyAssembly(name = "Assembly"): AssemblyDocument {
  return { version: 1, name, instances: [], mates: [] };
}

export function createDemoAssembly(): AssemblyDocument {
  const base = createBracketDemo();
  const post: FeatureDocument = {
    version: 1,
    name: "Post",
    rollbackIndex: null,
    features: [
      {
        id: "p1",
        name: "Post",
        kind: "box",
        widthMm: 12,
        depthMm: 12,
        heightMm: 40,
      },
    ],
  };
  return {
    version: 1,
    name: "Bracket Assembly",
    instances: [
      {
        id: "i-base",
        name: "Base",
        part: base,
        xMm: 0,
        yMm: 0,
        zMm: 0,
      },
      {
        id: "i-post",
        name: "Post",
        part: post,
        xMm: 25,
        yMm: 0,
        zMm: 8,
      },
    ],
    mates: [
      {
        id: "m1",
        kind: "distance",
        partA: "i-base",
        partB: "i-post",
        distanceMm: 8,
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

export function newSketchEntityId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createRectSketchEntity(
  widthMm: number,
  heightMm: number,
  offsetU = 0,
  offsetV = 0,
): SketchEntity {
  return {
    id: newSketchEntityId("se"),
    kind: "rect",
    x: offsetU - widthMm / 2,
    y: offsetV - heightMm / 2,
    widthMm,
    heightMm,
  };
}

export function createCircleSketchEntity(
  diameterMm: number,
  cx = 0,
  cy = 0,
): SketchEntity {
  return {
    id: newSketchEntityId("se"),
    kind: "circle",
    cx,
    cy,
    diameterMm,
  };
}

export function sketchEntitiesFromProfile(
  sketch: Pick<
    SketchFeature,
    "profile" | "widthMm" | "heightMm" | "offsetUMm" | "offsetVMm"
  >,
): SketchEntity[] {
  const offsetU = sketch.offsetUMm ?? 0;
  const offsetV = sketch.offsetVMm ?? 0;
  if (sketch.profile === "circle") {
    return [
      {
        id: newSketchEntityId("se"),
        kind: "circle",
        cx: offsetU,
        cy: offsetV,
        diameterMm: sketch.widthMm,
      },
    ];
  }
  return [
    {
      id: newSketchEntityId("se"),
      kind: "rect",
      x: offsetU - sketch.widthMm / 2,
      y: offsetV - sketch.heightMm / 2,
      widthMm: sketch.widthMm,
      heightMm: sketch.heightMm,
    },
  ];
}

function sketchEntityBBox(entities: SketchEntity[]): {
  widthMm: number;
  heightMm: number;
  offsetUMm: number;
  offsetVMm: number;
} {
  let minU = Infinity;
  let minV = Infinity;
  let maxU = -Infinity;
  let maxV = -Infinity;
  for (const e of entities) {
    if (e.kind === "line") {
      minU = Math.min(minU, e.x1, e.x2);
      maxU = Math.max(maxU, e.x1, e.x2);
      minV = Math.min(minV, e.y1, e.y2);
      maxV = Math.max(maxV, e.y1, e.y2);
    } else if (e.kind === "rect") {
      minU = Math.min(minU, e.x);
      maxU = Math.max(maxU, e.x + e.widthMm);
      minV = Math.min(minV, e.y);
      maxV = Math.max(maxV, e.y + e.heightMm);
    } else {
      const r = e.diameterMm / 2;
      minU = Math.min(minU, e.cx - r);
      maxU = Math.max(maxU, e.cx + r);
      minV = Math.min(minV, e.cy - r);
      maxV = Math.max(maxV, e.cy + r);
    }
  }
  return {
    widthMm: maxU - minU,
    heightMm: maxV - minV,
    offsetUMm: (minU + maxU) / 2,
    offsetVMm: (minV + maxV) / 2,
  };
}

export function ensureSketchEntities(sketch: SketchFeature): SketchFeature {
  if (sketch.entities?.length) return sketch;
  return {
    ...sketch,
    entities: sketchEntitiesFromProfile(sketch),
  };
}

export function syncSketchProfileFromEntities(
  sketch: SketchFeature,
): SketchFeature {
  const entities = sketch.entities;
  if (!entities?.length) return sketch;

  const preferKind = sketch.profile === "circle" ? "circle" : "rect";
  const primary =
    entities.find((e) => e.kind === preferKind) ??
    entities.find((e) => e.kind === "rect" || e.kind === "circle");

  const bbox = sketchEntityBBox(entities);

  if (primary?.kind === "rect") {
    return {
      ...sketch,
      profile: "rect",
      widthMm: bbox.widthMm,
      heightMm: bbox.heightMm,
      offsetUMm: primary.x + primary.widthMm / 2,
      offsetVMm: primary.y + primary.heightMm / 2,
      entities,
    };
  }
  if (primary?.kind === "circle") {
    return {
      ...sketch,
      profile: "circle",
      widthMm: bbox.widthMm,
      heightMm: bbox.heightMm,
      offsetUMm: primary.cx,
      offsetVMm: primary.cy,
      entities,
    };
  }

  return {
    ...sketch,
    widthMm: bbox.widthMm,
    heightMm: bbox.heightMm,
    offsetUMm: bbox.offsetUMm,
    offsetVMm: bbox.offsetVMm,
    entities,
  };
}

export function resolveSketch(
  doc: FeatureDocument,
  sketchId: string | undefined,
  fallback: {
    plane: PlaneId;
    profile: ProfileKind;
    widthMm: number;
    heightMm: number;
    offsetUMm?: number;
    offsetVMm?: number;
    entities?: SketchEntity[];
  },
) {
  if (!sketchId) return fallback;
  const sk = doc.features.find(
    (f): f is SketchFeature => f.id === sketchId && f.kind === "sketch",
  );
  if (!sk) return fallback;
  const synced = syncSketchProfileFromEntities(ensureSketchEntities(sk));
  return {
    plane: synced.plane,
    profile: synced.profile,
    widthMm: synced.widthMm,
    heightMm: synced.heightMm,
    offsetUMm: synced.offsetUMm,
    offsetVMm: synced.offsetVMm,
    entities: synced.entities,
  };
}

export function serializeFeatureDocument(doc: FeatureDocument): string {
  return JSON.stringify(doc, null, 2);
}

export function parseFeatureDocument(raw: string): FeatureDocument {
  const parsed = JSON.parse(raw) as FeatureDocument;
  if (parsed.version !== 1 || !Array.isArray(parsed.features)) {
    throw new Error("Invalid feature document");
  }
  return parsed;
}

export function serializeAssemblyDocument(doc: AssemblyDocument): string {
  return JSON.stringify(doc, null, 2);
}

export function parseAssemblyDocument(raw: string): AssemblyDocument {
  const parsed = JSON.parse(raw) as AssemblyDocument;
  if (parsed.version !== 1 || !Array.isArray(parsed.instances)) {
    throw new Error("Invalid assembly document");
  }
  return parsed;
}

/**
 * Apply named parameters onto known feature bindings.
 * Bracket-Demo: wall → base height, holeDia → hole diameter.
 * Reference-3U: u → chassis/cavity XY, height → chassis Z.
 * depth / extrude → all extrude depthMm; cutDepth → all cut depthMm.
 */
export function applyParameters(doc: FeatureDocument): FeatureDocument {
  const p = doc.parameters ?? {};
  const extrudeDepthMm = p.depth ?? p.extrude;
  return {
    ...doc,
    features: doc.features.map((f) => {
      let next = f;
      if (extrudeDepthMm != null && next.kind === "extrude") {
        next = { ...next, depthMm: extrudeDepthMm };
      }
      if (p.cutDepth != null && next.kind === "cut") {
        next = { ...next, depthMm: p.cutDepth };
      }
      if (p.holeDia != null && next.kind === "hole") {
        next = { ...next, diameterMm: p.holeDia };
      }
      if (p.wall != null && next.kind === "box" && next.id === "f-base") {
        next = { ...next, heightMm: p.wall };
      }
      if (next.kind === "box" && next.id === "f-chassis") {
        next = {
          ...next,
          ...(p.u != null ? { widthMm: p.u, depthMm: p.u } : {}),
          ...(p.height != null ? { heightMm: p.height } : {}),
        };
      }
      if (next.kind === "cut" && next.id === "f-cut-cavity") {
        next = {
          ...next,
          ...(p.u != null
            ? {
                widthMm: Math.max(10, p.u - 16),
                heightMm: Math.max(10, p.u - 16),
              }
            : {}),
          ...(p.height != null
            ? { depthMm: Math.max(10, p.height - 20) }
            : {}),
        };
      }
      if (
        p.holeDia != null &&
        next.kind === "sketch" &&
        next.id === "f-sketch-hole"
      ) {
        next = { ...next, widthMm: p.holeDia, heightMm: p.holeDia };
      }
      return next;
    }),
  };
}

export function setParameter(
  doc: FeatureDocument,
  key: string,
  value: number,
): FeatureDocument {
  return applyParameters({
    ...doc,
    parameters: { ...doc.parameters, [key]: value },
  });
}

export function renameFeature(
  doc: FeatureDocument,
  id: string,
  name: string,
): FeatureDocument {
  return {
    ...doc,
    features: doc.features.map((f) => (f.id === id ? { ...f, name } : f)),
  };
}

/** Apply distance mates as placement offsets on partB relative to partA. */
export function applyAssemblyMates(doc: AssemblyDocument): AssemblyDocument {
  const instances = doc.instances.map((i) => ({ ...i }));
  const byId = new Map(instances.map((i) => [i.id, i]));
  for (const mate of doc.mates) {
    const a = byId.get(mate.partA);
    const b = byId.get(mate.partB);
    if (!a || !b) continue;
    if (mate.kind === "distance" && mate.distanceMm != null) {
      b.zMm = a.zMm + mate.distanceMm;
    }
    if (mate.kind === "coincident") {
      b.xMm = a.xMm;
      b.yMm = a.yMm;
      b.zMm = a.zMm;
    }
  }
  return { ...doc, instances };
}
