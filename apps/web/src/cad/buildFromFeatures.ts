import { makeBaseBox, type Shape3D } from "replicad";
import {
  activeFeatures,
  type CadFeature,
  type FeatureDocument,
  type PlaneId,
} from "@spacetech/sfd-lang";

/**
 * Build a rectangular solid oriented by sketch plane.
 * Front (XY): extrude +Z; Top (XZ): extrude +Y; Right (YZ): extrude +X.
 */
function rectPrism(
  plane: PlaneId,
  widthMm: number,
  heightMm: number,
  depthMm: number,
  offsetUMm: number,
  offsetVMm: number,
): Shape3D {
  if (plane === "front") {
    // Sketch in XY, extrude +Z
    return makeBaseBox(widthMm, heightMm, depthMm).translate(
      offsetUMm,
      offsetVMm,
      depthMm / 2,
    );
  }
  if (plane === "top") {
    // Sketch in XZ, extrude +Y
    return makeBaseBox(widthMm, depthMm, heightMm).translate(
      offsetUMm,
      depthMm / 2,
      offsetVMm,
    );
  }
  // Right: sketch in YZ, extrude +X
  return makeBaseBox(depthMm, widthMm, heightMm).translate(
    depthMm / 2,
    offsetUMm,
    offsetVMm,
  );
}

function applyFeature(current: Shape3D | null, feature: CadFeature): Shape3D {
  if (feature.kind === "box") {
    const { widthMm, depthMm, heightMm } = feature;
    const box = makeBaseBox(widthMm, depthMm, heightMm).translate(
      feature.xMm ?? 0,
      feature.yMm ?? 0,
      (feature.zMm ?? 0) + heightMm / 2,
    );
    return current ? current.fuse(box) : box;
  }

  if (feature.kind === "extrude") {
    const solid = rectPrism(
      feature.plane,
      feature.widthMm,
      feature.heightMm,
      feature.depthMm,
      feature.offsetUMm ?? 0,
      feature.offsetVMm ?? 0,
    );
    return current ? current.fuse(solid) : solid;
  }

  if (feature.kind === "cut") {
    const tool = rectPrism(
      feature.plane,
      feature.widthMm,
      feature.heightMm,
      feature.depthMm,
      feature.offsetUMm ?? 0,
      feature.offsetVMm ?? 0,
    );
    if (!current) {
      return makeBaseBox(1, 1, 1);
    }
    try {
      return current.cut(tool);
    } catch {
      return current;
    }
  }

  return current ?? makeBaseBox(1, 1, 1);
}

/** Compile active (non-rolled-back, non-suppressed) features to a solid. */
export function buildShapeFromFeatures(doc: FeatureDocument): Shape3D {
  const features = activeFeatures(doc);
  if (features.length === 0) {
    return makeBaseBox(40, 40, 40).translate(0, 0, 20);
  }

  let shape: Shape3D | null = null;
  for (const feature of features) {
    if (feature.kind === "importBody") continue;
    shape = applyFeature(shape, feature);
  }

  return shape ?? makeBaseBox(40, 40, 40).translate(0, 0, 20);
}
