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
  resolveSketch,
  type CadFeature,
  type FeatureDocument,
  type PlaneId,
  type ProfileKind,
  type SketchEntity,
} from "@spacetech/sfd-lang";

/** Replicad fillet/chamfer edge filter: `(e) => e.inPlane(...)` etc. */
type EdgeFilterFn = (e: EdgeFinder) => EdgeFinder;

/**
 * Mesh `edgeIndices` are viewport tessellation selection hints (Shift+click),
 * NOT OCCT B-rep edge ids — true index mapping is not available here.
 *
 * Best-effort strategy: map each hint index mod 6 to plane/direction filters
 * (XY / XZ / YZ / X / Y / Z). Multiple hints are combined with `either`.
 */
function edgeFilterFromMeshIndices(edgeIndices: number[]): EdgeFilterFn {
  const filterForIndex = (idx: number): ((f: EdgeFinder) => EdgeFinder) => {
    switch (idx % 6) {
      case 0:
        return (f) => f.inPlane("XY");
      case 1:
        return (f) => f.inPlane("XZ");
      case 2:
        return (f) => f.inPlane("YZ");
      case 3:
        return (f) => f.inDirection("X");
      case 4:
        return (f) => f.inDirection("Y");
      default:
        return (f) => f.inDirection("Z");
    }
  };

  if (edgeIndices.length === 1) {
    const pick = filterForIndex(edgeIndices[0]);
    return (e) => pick(e);
  }

  const picks = edgeIndices.map(filterForIndex);
  return (e) => e.either(picks);
}

function applyEdgeModification(
  current: Shape3D,
  radius: number,
  edgeIndices: number[] | undefined,
  op: "fillet" | "chamfer",
): Shape3D {
  const run = (filter?: EdgeFilterFn) =>
    op === "fillet"
      ? filter
        ? current.fillet(radius, filter)
        : current.fillet(radius)
      : filter
        ? current.chamfer(radius, filter)
        : current.chamfer(radius);

  if (!edgeIndices?.length) {
    try {
      return run();
    } catch {
      return current;
    }
  }

  try {
    return run(edgeFilterFromMeshIndices(edgeIndices));
  } catch {
    try {
      return run();
    } catch {
      return current;
    }
  }
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
  for (const entity of entities) {
    if (entity.kind === "rect") {
      solids.push(
        profileSolid(
          plane,
          "rect",
          entity.widthMm,
          entity.heightMm,
          depthMm,
          entity.x + entity.widthMm / 2,
          entity.y + entity.heightMm / 2,
        ),
      );
    } else if (entity.kind === "circle") {
      solids.push(
        profileSolid(
          plane,
          "circle",
          entity.diameterMm,
          entity.diameterMm,
          depthMm,
          entity.cx,
          entity.cy,
        ),
      );
    }
  }
  return solids;
}

function fuseSolids(solids: Shape3D[]): Shape3D {
  let combined = solids[0];
  for (let i = 1; i < solids.length; i++) {
    combined = combined.fuse(solids[i]);
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

function applyFeature(
  current: Shape3D | null,
  feature: CadFeature,
  doc: FeatureDocument,
): Shape3D {
  if (feature.kind === "sketch" || feature.kind === "importBody") {
    return current ?? makeBaseBox(1, 1, 1);
  }

  if (feature.kind === "box") {
    const box = makeBaseBox(
      feature.widthMm,
      feature.depthMm,
      feature.heightMm,
    ).translate(
      feature.xMm ?? 0,
      feature.yMm ?? 0,
      (feature.zMm ?? 0) + feature.heightMm / 2,
    );
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
    const entitySolids =
      profile.entities && profile.entities.length > 0
        ? solidsFromSketchEntities(
            profile.plane,
            profile.entities,
            feature.depthMm,
          )
        : [];
    const solid =
      entitySolids.length > 0
        ? fuseSolids(entitySolids)
        : profileSolid(
            profile.plane,
            profile.profile,
            profile.widthMm,
            profile.heightMm,
            feature.depthMm,
            profile.offsetUMm ?? 0,
            profile.offsetVMm ?? 0,
          );
    if (feature.kind === "extrude") {
      return current ? current.fuse(solid) : solid;
    }
    if (!current) return makeBaseBox(1, 1, 1);
    if (entitySolids.length > 0) {
      return cutSolids(current, entitySolids);
    }
    try {
      return current.cut(solid);
    } catch {
      return current;
    }
  }

  if (feature.kind === "hole") {
    const r = feature.diameterMm / 2;
    const tool = (makeCylinder(r, feature.depthMm) as Shape3D).translate(
      feature.xMm ?? 0,
      feature.yMm ?? 0,
      feature.zMm ?? 0,
    );
    if (!current) return makeBaseBox(1, 1, 1);
    try {
      return current.cut(tool);
    } catch {
      return current;
    }
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
      return current ? current.fuse(solid) : solid;
    } catch {
      const r = Math.max(feature.widthMm / 2, 0.5);
      const h = Math.max(feature.heightMm, feature.widthMm, 4);
      const solid = (makeCylinder(r, h) as Shape3D).translate(u, v, 0);
      return current ? current.fuse(solid) : solid;
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
    try {
      const planeName =
        feature.plane === "front"
          ? "XY"
          : feature.plane === "top"
            ? "XZ"
            : "YZ";
      const copy = current.mirror(planeName) as Shape3D;
      return current.fuse(copy);
    } catch {
      return current;
    }
  }

  if (feature.kind === "linearPattern") {
    if (!current) return makeBaseBox(1, 1, 1);
    const n = Math.max(1, Math.min(24, Math.floor(feature.count)));
    let shape = current;
    try {
      for (let i = 1; i < n; i++) {
        const base =
          typeof current.clone === "function"
            ? (current.clone() as Shape3D)
            : current;
        const copy = base.translate(
          feature.dxMm * i,
          feature.dyMm * i,
          feature.dzMm * i,
        ) as Shape3D;
        shape = shape.fuse(copy);
      }
      return shape;
    } catch {
      return current;
    }
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
    shape = applyFeature(shape, feature, resolved);
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
