import type { Shape3D } from "replicad";

/** Mesh edge hint → replicad EdgeFinder plane/direction slot (index mod 6). */
export type EdgeFilterSlot =
  | "XY"
  | "XZ"
  | "YZ"
  | "dirX"
  | "dirY"
  | "dirZ";

/**
 * Maps viewport mesh edge selection hints to best-effort filter slots.
 * These are NOT OCCT B-rep edge ids — see buildFromFeatures KERNEL notes.
 */
export function meshEdgeIndexFilterSlot(idx: number): EdgeFilterSlot {
  switch (idx % 6) {
    case 0:
      return "XY";
    case 1:
      return "XZ";
    case 2:
      return "YZ";
    case 3:
      return "dirX";
    case 4:
      return "dirY";
    default:
      return "dirZ";
  }
}

export function clampEdgeModificationRadius(radiusMm: number): number {
  return Math.max(0.05, Math.min(radiusMm, 50));
}

export function isNoEdgeSelectedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /no edge was selected/i.test(msg);
}

/**
 * Replicad transform/modify ops consume the receiver (`this.delete()`).
 * Always clone before mirror/translate when the original must survive.
 */
export function cloneShape3D(shape: Shape3D): Shape3D {
  if (typeof shape.clone !== "function") {
    throw new Error("Shape3D.clone is required (replicad kernel)");
  }
  return shape.clone() as Shape3D;
}
