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
