import type { CadFeature } from "@spacetech/sfd-lang";

/** Feature kinds that can be selected from the viewport for edit / drag handles. */
export const VIEWPORT_EDITABLE_KINDS = ["box", "hole", "extrude"] as const;
export type ViewportEditableKind = (typeof VIEWPORT_EDITABLE_KINDS)[number];

export function isViewportEditableKind(
  kind: CadFeature["kind"],
): kind is ViewportEditableKind {
  return (VIEWPORT_EDITABLE_KINDS as readonly string[]).includes(kind);
}

/** Editable solid features in tree order. */
export function getViewportEditableFeatures(
  features: CadFeature[],
): CadFeature[] {
  return features.filter((f) => isViewportEditableKind(f.kind));
}

/** Last box or hole in the tree (legacy default pick). */
export function findLastBoxOrHole(features: CadFeature[]): CadFeature | null {
  for (let i = features.length - 1; i >= 0; i--) {
    const f = features[i]!;
    if (f.kind === "box" || f.kind === "hole") return f;
  }
  return null;
}

/** Advance within viewport-editable features; wraps to first. */
export function cycleViewportEditableFeature(
  features: CadFeature[],
  currentId: string | null,
): CadFeature | null {
  const editable = getViewportEditableFeatures(features);
  if (editable.length === 0) return null;
  if (!currentId) return editable[0]!;
  const idx = editable.findIndex((f) => f.id === currentId);
  if (idx < 0) return editable[0]!;
  return editable[(idx + 1) % editable.length]!;
}

/**
 * Heuristic: map face group index to a feature in the tree.
 * - face 0 → first box/extrude
 * - last face(s) → hole, then fillet/chamfer
 */
export function mapFaceIndexToFeature(
  faceIndex: number,
  faceCount: number,
  features: CadFeature[],
): CadFeature | null {
  if (faceCount <= 0 || faceIndex < 0) return null;

  const firstSolid =
    features.find((f) => f.kind === "box" || f.kind === "extrude") ?? null;
  const holes = features.filter((f) => f.kind === "hole");
  const lastHole = holes.length > 0 ? holes[holes.length - 1]! : null;
  const finish = features.filter(
    (f) => f.kind === "fillet" || f.kind === "chamfer",
  );
  const lastFinish = finish.length > 0 ? finish[finish.length - 1]! : null;

  if (faceIndex === 0) return firstSolid;
  if (faceIndex >= faceCount - 1) return lastHole ?? lastFinish ?? firstSolid;
  if (faceIndex >= faceCount - 2 && lastFinish) return lastFinish;

  return firstSolid;
}

export type ViewportBodySelectInput = {
  features: CadFeature[];
  selectedFeatureId: string | null;
  bodyWasSelected: boolean;
  faceIndex: number | null;
  faceCount: number;
  altKey: boolean;
  /** Shift+click edge — keep current feature, skip cycling / face heuristic. */
  edgeSelect?: boolean;
};

export type ViewportBodySelectResult = {
  featureId: string | null;
  uxNote: string | null;
};

/**
 * Resolve which feature to select after a viewport body / face click.
 */
export function resolveViewportBodySelect(
  input: ViewportBodySelectInput,
): ViewportBodySelectResult {
  const {
    features,
    selectedFeatureId,
    bodyWasSelected,
    faceIndex,
    faceCount,
    altKey,
    edgeSelect = false,
  } = input;

  if (edgeSelect) {
    return { featureId: selectedFeatureId, uxNote: null };
  }

  const editable = getViewportEditableFeatures(features);
  const selected =
    features.find((f) => f.id === selectedFeatureId) ?? null;

  if (altKey && editable.length > 0) {
    const next = cycleViewportEditableFeature(features, selectedFeatureId);
    if (next) {
      return {
        featureId: next.id,
        uxNote: dragHandlesNote(next),
      };
    }
  }

  if (
    bodyWasSelected &&
    selected &&
    isViewportEditableKind(selected.kind) &&
    editable.length > 0
  ) {
    const next = cycleViewportEditableFeature(features, selected.id);
    if (next) {
      return {
        featureId: next.id,
        uxNote: dragHandlesNote(next),
      };
    }
  }

  if (faceIndex != null && faceCount > 0) {
    const fromFace = mapFaceIndexToFeature(faceIndex, faceCount, features);
    if (fromFace) {
      return {
        featureId: fromFace.id,
        uxNote: dragHandlesNote(fromFace),
      };
    }
  }

  const fallback = findLastBoxOrHole(features) ?? editable[editable.length - 1];
  if (fallback) {
    return {
      featureId: fallback.id,
      uxNote: dragHandlesNote(fallback),
    };
  }

  return { featureId: selectedFeatureId, uxNote: null };
}

function dragHandlesNote(feature: CadFeature): string {
  if (isViewportEditableKind(feature.kind)) {
    return `Drag handles active: ${feature.name}`;
  }
  return `Selected ${feature.name}`;
}

/** Live dimension readout for viewport-editable features (Properties chip / HUD). */
export function formatFeatureDimensionReadout(
  feature: CadFeature,
): string | null {
  if (feature.kind === "box") {
    return `W ${feature.widthMm.toFixed(1)} · D ${feature.depthMm.toFixed(1)} · H ${feature.heightMm.toFixed(1)}`;
  }
  if (feature.kind === "hole") {
    const x = feature.xMm ?? 0;
    const y = feature.yMm ?? 0;
    return `Ø${feature.diameterMm.toFixed(1)} @ (${x.toFixed(1)}, ${y.toFixed(1)})`;
  }
  if (feature.kind === "extrude") {
    return `depth ${feature.depthMm.toFixed(1)}`;
  }
  if (feature.kind === "revolve") {
    const angle = feature.angleDeg ?? 360;
    return `Ø${feature.widthMm.toFixed(1)} · ${angle.toFixed(0)}°`;
  }
  if (feature.kind === "cut") {
    const u = feature.offsetUMm ?? 0;
    const v = feature.offsetVMm ?? 0;
    return `cut ${feature.widthMm.toFixed(1)}×${feature.heightMm.toFixed(1)} · depth ${feature.depthMm.toFixed(1)} @ (${u.toFixed(1)}, ${v.toFixed(1)})`;
  }
  return null;
}

/** Map a tessellated triangle index to a face-group index (replicad faceGroups). */
export function faceGroupFromTriangleIndex(
  triangleIndex: number | undefined | null,
  faceGroups: ReadonlyArray<{ start?: number; count?: number }> | undefined,
): number | null {
  if (triangleIndex == null || triangleIndex < 0 || !faceGroups?.length) {
    return null;
  }
  for (let i = 0; i < faceGroups.length; i++) {
    const g = faceGroups[i]!;
    const start = g.start ?? 0;
    const count = g.count ?? 0;
    if (triangleIndex >= start && triangleIndex < start + count) return i;
  }
  return null;
}

/** Nearest mesh edge index to a world point (lines = [x1,y1,z1,x2,y2,z2,…]). */
export function nearestEdgeIndexToPoint(
  point: { x: number; y: number; z: number },
  lines: ArrayLike<number> | undefined,
): number | null {
  if (!lines || lines.length < 6) return null;
  let best = -1;
  let bestD = Infinity;
  const px = point.x;
  const py = point.y;
  const pz = point.z;
  for (let i = 0, ei = 0; i + 5 < lines.length; i += 6, ei++) {
    const ax = lines[i]!;
    const ay = lines[i + 1]!;
    const az = lines[i + 2]!;
    const bx = lines[i + 3]!;
    const by = lines[i + 4]!;
    const bz = lines[i + 5]!;
    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const apx = px - ax;
    const apy = py - ay;
    const apz = pz - az;
    const ab2 = abx * abx + aby * aby + abz * abz;
    const t =
      ab2 > 1e-12
        ? Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / ab2))
        : 0;
    const dx = ax + abx * t - px;
    const dy = ay + aby * t - py;
    const dz = az + abz * t - pz;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = ei;
    }
  }
  return best >= 0 ? best : null;
}

export function snapMm(v: number): number {
  return Math.round(v * 2) / 2;
}
