import type { TessellationResult } from "@spacetech/kernel-bridge";
import type { MassPropsResult } from "./types";

/** Translate tessellated mesh vertices by an instance offset (mm). */
export function translateMesh(
  mesh: TessellationResult,
  dx: number,
  dy: number,
  dz: number,
): TessellationResult {
  if (dx === 0 && dy === 0 && dz === 0) return mesh;
  const vertices = mesh.faces.vertices.slice();
  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i]! += dx;
    vertices[i + 1]! += dy;
    vertices[i + 2]! += dz;
  }
  const lines = mesh.edges.lines.slice();
  for (let i = 0; i < lines.length; i += 3) {
    lines[i]! += dx;
    lines[i + 1]! += dy;
    lines[i + 2]! += dz;
  }
  return {
    faces: { ...mesh.faces, vertices },
    edges: { ...mesh.edges, lines },
  };
}

/** Fuse display meshes from multiple assembly instances. */
export function mergeMeshes(meshes: TessellationResult[]): TessellationResult {
  const vertices: number[] = [];
  const normals: number[] = [];
  const triangles: number[] = [];
  const lines: number[] = [];
  for (const mesh of meshes) {
    const base = vertices.length / 3;
    vertices.push(...mesh.faces.vertices);
    normals.push(...mesh.faces.normals);
    for (const idx of mesh.faces.triangles) {
      triangles.push(idx + base);
    }
    lines.push(...mesh.edges.lines);
  }
  return {
    faces: { vertices, normals, triangles },
    edges: { lines },
  };
}

/** Sum mass props from per-instance rebuilds (CG is mass-weighted). */
export function mergeMassProps(parts: MassPropsResult[]): MassPropsResult {
  let volumeMm3 = 0;
  let massKg = 0;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const m of parts) {
    volumeMm3 += m.volumeMm3;
    massKg += m.massKg;
    cx += m.cgMm.x * m.massKg;
    cy += m.cgMm.y * m.massKg;
    cz += m.cgMm.z * m.massKg;
  }
  const densityKgPerMm3 =
    parts[0]?.densityKgPerMm3 ?? 2.7e-6;
  if (massKg <= 0) {
    return {
      volumeMm3: Math.max(volumeMm3, 1),
      massKg: Math.max(massKg, 0.001),
      cgMm: { x: 0, y: 0, z: 0 },
      densityKgPerMm3,
    };
  }
  return {
    volumeMm3,
    massKg,
    cgMm: { x: cx / massKg, y: cy / massKg, z: cz / massKg },
    densityKgPerMm3,
  };
}
