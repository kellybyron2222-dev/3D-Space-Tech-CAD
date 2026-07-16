import type { TessellationResult } from "@spacetech/kernel-bridge";

export interface Bounds {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
}

export function meshBounds(mesh: TessellationResult | null): Bounds | null {
  const v = mesh?.faces.vertices;
  if (!v?.length) return null;
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < v.length; i += 3) {
    minX = Math.min(minX, v[i]!);
    minY = Math.min(minY, v[i + 1]!);
    minZ = Math.min(minZ, v[i + 2]!);
    maxX = Math.max(maxX, v[i]!);
    maxY = Math.max(maxY, v[i + 1]!);
    maxZ = Math.max(maxZ, v[i + 2]!);
  }
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2,
    },
  };
}
