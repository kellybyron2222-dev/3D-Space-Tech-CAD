/**
 * Geometry kernel bridge types.
 * Browser implementation: Replicad / OCCT in a Web Worker (apps/web).
 * B-rep is truth; mesh is display only. No custom kernel.
 */

/** Replicad-compatible face mesh payload for three.js sync helpers */
export interface ReplicadFaces {
  vertices: number[];
  normals: number[];
  triangles: number[];
  faceGroups?: Array<{ start: number; count: number; faceId?: number }>;
}

export interface ReplicadEdges {
  lines: number[];
  edgeGroups?: Array<{ start: number; count: number; edgeId?: number }>;
}

export interface TessellationResult {
  faces: ReplicadFaces;
  edges: ReplicadEdges;
}

export interface DisplayMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export type KernelBackend = "stub" | "replicad-worker";

export interface KernelBridge {
  readonly backend: KernelBackend;
  tessellateStub(): DisplayMesh;
}

export function createStubKernelBridge(): KernelBridge {
  return {
    backend: "stub",
    tessellateStub() {
      return {
        positions: new Float32Array(),
        normals: new Float32Array(),
        indices: new Uint32Array(),
      };
    },
  };
}
