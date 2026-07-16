import {
  drawCircle,
  drawRoundedRectangle,
  makeBaseBox,
  makeCylinder,
  type EdgeFinder,
  type Shape3D,
} from "replicad";
import {
  activeFeatures,
  applyParameters,
  filterValidSketchEntities,
  MIN_SKETCH_ENTITY_MM,
  resolveSketch,
  type CadFeature,
  type FeatureDocument,
  type PlaneId,
  type ProfileKind,
  type SketchEntity,
} from "@spacetech/sfd-lang";
import {
  clampEdgeModificationRadius,
  cloneShape3D,
  isNoEdgeSelectedError,
  meshEdgeIndexFilterSlot,
} from "./featureResilience";

/** Replicad fillet/chamfer edge filter: `(e) => e.inPlane(...)` etc. */
type EdgeFilterFn = (e: EdgeFinder) => EdgeFinder;

/**
 * KERNEL assumptions (replicad / OCCT):
 * - `translate`, `mirror`, etc. consume the receiver; clone before reuse.
 * - `fillet`/`chamfer` throw when a filtered op matches zero edges.
 * - Oversized fillet/chamfer radii throw; we halve and retry, then soft-fail.
 * - Mesh `edgeIndices` are tessellation hints, not B-rep ids (see featureResilience).
 */
function edgeFilterFromMeshIndices(edgeIndices: number[]): EdgeFilterFn {
  const filterForIndex = (idx: number): ((f: EdgeFinder) => EdgeFinder) => {
    switch (meshEdgeIndexFilterSlot(idx)) {
      case "XY":
        return (f) => f.inPlane("XY");
      case "XZ":
        return (f) => f.inPlane("XZ");
      case "YZ":
        return (f) => f.inPlane("YZ");
      case "dirX":
        return (f) => f.inDirection("X");
      case "dirY":
        return (f) => f.inDirection("Y");
      default:
        return (f) => f.inDirection("Z");
    }
  };

  if (edgeIndices.length === 1) {
    const pick = filterForIndex(edgeIndices[0]!);
    return (e) => pick(e);
  }

  const picks = edgeIndices.map(filterForIndex);
  return (e) => e.either(picks);
}

function runEdgeModification(
  shape: Shape3D,
  radius: number,
  op: "fillet" | "chamfer",
  filter?: EdgeFilterFn,
): Shape3D {
  if (op === "fillet") {
    return filter ? shape.fillet(radius, filter) : shape.fillet(radius);
  }
  return filter ? shape.chamfer(radius, filter) : shape.chamfer(radius);
}

/** Halve radius on OCCT failure; clone each attempt so the source solid survives. */
function tryEdgeModificationWithFallback(
  source: Shape3D,
  radius: number,
  op: "fillet" | "chamfer",
  filter?: EdgeFilterFn,
): Shape3D {
  let attemptRadius = radius;
  const minRadius = 0.05;

  while (attemptRadius >= minRadius) {
    try {
      const work = cloneShape3D(source);
      return runEdgeModification(work, attemptRadius, op, filter);
    } catch (err) {
      if (isNoEdgeSelectedError(err)) throw err;
      attemptRadius = Math.max(minRadius, attemptRadius * 0.5);
      if (attemptRadius <= minRadius) break;
    }
  }

  return source;
}

function applyEdgeModification(
  current: Shape3D,
  radius: number,
  edgeIndices: number[] | undefined,
  op: "fillet" | "chamfer",
): Shape3D {
  const clamped = clampEdgeModificationRadius(radius);

  if (!edgeIndices?.length) {
    try {
      return tryEdgeModificationWithFallback(current, clamped, op);
    } catch {
      return current;
    }
  }

  const filter = edgeFilterFromMeshIndices(edgeIndices);
  try {
    return tryEdgeModificationWithFallback(current, clamped, op, filter);
  } catch (err) {
    // Do not fall back to global fillet — that silently changes all edges.
    if (isNoEdgeSelectedError(err)) {
      console.warn(
        `${op}: mesh edge hints matched no B-rep edges; feature skipped`,
      );
    }
    return current;
  }
}

function clampProfileDim(value: number, fallback = 1): number {
  return Number.isFinite(value) && value >= MIN_SKETCH_ENTITY_MM
    ? value
    : fallback;
}

function profileSolid(
  plane: PlaneId,
  profile: ProfileKind,
  widthMm: number,
  heightMm: number,
  depthMm: number,
  offsetUMm: number,
  offsetVMm: number,
): Shape3D {
  if (profile === "circle") {
    const r = widthMm / 2;
    // Cylinder along +Z then orient
    let cyl = makeCylinder(r, depthMm) as Shape3D;
    if (plane === "front") {
      return cyl.translate(offsetUMm, offsetVMm, 0);
    }
    if (plane === "top") {
      // rotate so axis is +Y
      return cyl
        .rotate(90, [0, 0, 0], [1, 0, 0])
        .translate(offsetUMm, 0, offsetVMm);
    }
    return cyl
      .rotate(90, [0, 0, 0], [0, 1, 0])
      .translate(0, offsetUMm, offsetVMm);
  }

  // rect
  if (plane === "front") {
    return makeBaseBox(widthMm, heightMm, depthMm).translate(
      offsetUMm,
      offsetVMm,
      depthMm / 2,
    );
  }
  if (plane === "top") {
    return makeBaseBox(widthMm, depthMm, heightMm).translate(
      offsetUMm,
      depthMm / 2,
      offsetVMm,
    );
  }
  return makeBaseBox(depthMm, widthMm, heightMm).translate(
    depthMm / 2,
    offsetUMm,
    offsetVMm,
  );
}

function solidsFromSketchEntities(
  plane: PlaneId,
  entities: SketchEntity[],
  depthMm: number,
): Shape3D[] {
  const solids: Shape3D[] = [];
  const depth = Math.max(MIN_SKETCH_ENTITY_MM, depthMm);
  for (const entity of filterValidSketchEntities(entities)) {
    try {
      if (entity.kind === "rect") {
        const w = entity.widthMm;
        const h = entity.heightMm;
        solids.push(
          profileSolid(
            plane,
            "rect",
            w,
            h,
            depth,
            entity.x + w / 2,
            entity.y + h / 2,
          ),
        );
      } else if (entity.kind === "circle") {
        const d = entity.diameterMm;
        solids.push(
          profileSolid(plane, "circle", d, d, depth, entity.cx, entity.cy),
        );
      }
    } catch {
      /* skip invalid entity */
    }
  }
  return solids;
}

function fuseSolids(solids: Shape3D[]): Shape3D | null {
  if (solids.length === 0) return null;
  let combined = solids[0]!;
  for (let i = 1; i < solids.length; i++) {
    try {
      combined = combined.fuse(solids[i]!);
    } catch {
      /* skip bad solid */
    }
  }
  return combined;
}

function cutSolids(current: Shape3D, solids: Shape3D[]): Shape3D {
  let result = current;
  for (const solid of solids) {
    try {
      result = result.cut(solid);
    } catch {
      // keep previous result
    }
  }
  return result;
}

/** Through-hole cutter: start below the solid and overshoot past the top face. */
function holeCutExtents(
  feature: { depthMm: number; zMm?: number },
  current: Shape3D | null,
): { zStart: number; depthMm: number } {
  const zStart = Math.min(feature.zMm ?? 0, -1);
  let depthMm = Math.max(feature.depthMm + 2, 4);

  if (current) {
    try {
      const zMax = current.boundingBox.bounds[1][2];
      depthMm = Math.max(depthMm, zMax - zStart + 2);
    } catch {
      /* bbox unavailable — feature depth + margin */
    }
  }

  return { zStart, depthMm };
}

function makeHoleCutTool(
  feature: { diameterMm: number; depthMm: number; xMm?: number; yMm?: number; zMm?: number },
  zStart: number,
  depthMm: number,
): Shape3D {
  const r = Math.max(0.05, feature.diameterMm / 2);
  return (makeCylinder(r, depthMm) as Shape3D).translate(
    feature.xMm ?? 0,
    feature.yMm ?? 0,
    zStart,
  );
}

function cutHole(current: Shape3D, feature: CadFeature & { kind: "hole" }): Shape3D {
  let { zStart, depthMm } = holeCutExtents(feature, current);
  try {
    return current.cut(makeHoleCutTool(feature, zStart, depthMm));
  } catch (firstErr) {
    depthMm *= 2;
    try {
      return current.cut(makeHoleCutTool(feature, zStart, depthMm));
    } catch (retryErr) {
      console.warn(
        `Feature ${feature.id} (hole) cut failed after retry; solid unchanged:`,
        retryErr ?? firstErr,
      );
      return current;
    }
  }
}

function applyFeature(
  current: Shape3D | null,
  feature: CadFeature,
  doc: FeatureDocument,
): Shape3D {
  if (feature.kind === "sketch" || feature.kind === "importBody") {
    return current ?? makeBaseBox(1, 1, 1);
  }

  if (feature.kind === "box") {
    // makeBaseBox already extrudes z=0→height; do NOT add height/2
    // (that used to lift the plate so holes never broke through).
    const box = makeBaseBox(
      feature.widthMm,
      feature.depthMm,
      feature.heightMm,
    ).translate(feature.xMm ?? 0, feature.yMm ?? 0, feature.zMm ?? 0);
    return current ? current.fuse(box) : box;
  }

  if (feature.kind === "extrude" || feature.kind === "cut") {
    const profile = resolveSketch(doc, feature.sketchId, {
      plane: feature.plane,
      profile: feature.profile ?? "rect",
      widthMm: feature.widthMm,
      heightMm: feature.heightMm,
      offsetUMm: feature.offsetUMm,
      offsetVMm: feature.offsetVMm,
    });
    const profileWidth = clampProfileDim(profile.widthMm, feature.widthMm);
    const profileHeight = clampProfileDim(profile.heightMm, feature.heightMm);
    const entitySolids =
      profile.entities && profile.entities.length > 0
        ? solidsFromSketchEntities(
            profile.plane,
            profile.entities,
            feature.depthMm,
          )
        : [];
    const fused = entitySolids.length > 0 ? fuseSolids(entitySolids) : null;
    const solid =
      fused ??
      profileSolid(
        profile.plane,
        profile.profile,
        profileWidth,
        profileHeight,
        Math.max(MIN_SKETCH_ENTITY_MM, feature.depthMm),
        profile.offsetUMm ?? 0,
        profile.offsetVMm ?? 0,
      );
    if (feature.kind === "extrude") {
      try {
        return current ? current.fuse(solid) : solid;
      } catch {
        return current ?? solid;
      }
    }
    if (!current) return makeBaseBox(1, 1, 1);
    if (entitySolids.length > 0) {
      const cut = cutSolids(current, entitySolids);
      return cut;
    }
    try {
      return current.cut(solid);
    } catch {
      return current;
    }
  }

  if (feature.kind === "hole") {
    if (!current) return makeBaseBox(1, 1, 1);
    return cutHole(current, feature);
  }

  if (feature.kind === "revolve") {
    const angle = feature.angleDeg ?? 360;
    const u = feature.offsetUMm ?? 20;
    const v = feature.offsetVMm ?? 0;
    const planeName =
      feature.plane === "front"
        ? "XY"
        : feature.plane === "top"
          ? "XZ"
          : "YZ";
    try {
      const drawing =
        feature.profile === "circle"
          ? drawCircle(Math.max(feature.widthMm / 2, 0.5)).translate(u, v)
          : drawRoundedRectangle(
              Math.max(feature.widthMm, 1),
              Math.max(feature.heightMm, 1),
            ).translate(u, v);
      const sketch = drawing.sketchOnPlane(planeName);
      const axis: [number, number, number] =
        feature.plane === "top" ? [0, 1, 0] : [0, 0, 1];
      const solid = sketch.revolve(axis, { angle }) as Shape3D;
      if (!current) return solid;
      try {
        return current.fuse(solid);
      } catch {
        return current;
      }
    } catch (err) {
      console.warn(`Feature ${feature.id} (revolve) skipped:`, err);
      return current ?? makeBaseBox(1, 1, 1);
    }
  }

  if (feature.kind === "fillet") {
    if (!current) return makeBaseBox(1, 1, 1);
    return applyEdgeModification(
      current,
      feature.radiusMm,
      feature.edgeIndices,
      "fillet",
    );
  }

  if (feature.kind === "chamfer") {
    if (!current) return makeBaseBox(1, 1, 1);
    return applyEdgeModification(
      current,
      feature.distanceMm,
      feature.edgeIndices,
      "chamfer",
    );
  }

  if (feature.kind === "mirror") {
    if (!current) return makeBaseBox(1, 1, 1);
    const planeName =
      feature.plane === "front"
        ? "XY"
        : feature.plane === "top"
          ? "XZ"
          : "YZ";
    const original = cloneShape3D(current);
    try {
      const mirrored = cloneShape3D(original).mirror(planeName) as Shape3D;
      return original.fuse(mirrored);
    } catch (err) {
      console.warn(`Feature ${feature.id} (mirror) skipped:`, err);
      return original;
    }
  }

  if (feature.kind === "linearPattern") {
    if (!current) return makeBaseBox(1, 1, 1);
    const n = Math.max(1, Math.min(24, Math.floor(feature.count)));
    const template = cloneShape3D(current);
    let shape = cloneShape3D(template);
    for (let i = 1; i < n; i++) {
      try {
        const copy = cloneShape3D(template).translate(
          feature.dxMm * i,
          feature.dyMm * i,
          feature.dzMm * i,
        ) as Shape3D;
        shape = shape.fuse(copy);
      } catch (err) {
        console.warn(
          `Feature ${feature.id} (linearPattern) copy ${i} skipped:`,
          err,
        );
      }
    }
    return shape;
  }

  return current ?? makeBaseBox(1, 1, 1);
}

export function buildShapeFromFeatures(doc: FeatureDocument): Shape3D {
  const resolved = applyParameters(doc);
  const features = activeFeatures(resolved);
  if (features.length === 0) {
    return makeBaseBox(40, 40, 40).translate(0, 0, 20);
  }

  let shape: Shape3D | null = null;
  for (const feature of features) {
    try {
      shape = applyFeature(shape, feature, resolved);
    } catch (err) {
      // One bad fillet/pattern must not blank the whole Part Studio
      console.warn(`Feature ${feature.id} (${feature.kind}) skipped:`, err);
    }
  }

  return shape ?? makeBaseBox(40, 40, 40).translate(0, 0, 20);
}

export interface MassProps {
  volumeMm3: number;
  massKg: number;
  /** Assumed aluminum density if none set */
  densityKgPerMm3: number;
}

/** L0 mass from bounding volume * density (not true CAD volume yet). */
export function estimateMassFromMesh(vertexCount: number): MassProps {
  const densityKgPerMm3 = 2.7e-6; // aluminum approx kg/mm³
  // Placeholder until OCCT volume API wired; scale with complexity
  const volumeMm3 = Math.max(1000, vertexCount * 2);
  return {
    volumeMm3,
    massKg: volumeMm3 * densityKgPerMm3,
    densityKgPerMm3,
  };
}
