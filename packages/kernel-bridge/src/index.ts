/**
 * Geometry kernel bridge placeholder.
 * MVP-2 will run OpenCascade / Replicad inside a Web Worker.
 * B-rep is truth; mesh is display only. No custom kernel.
 */

export interface DisplayMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export interface KernelBridge {
  readonly backend: "stub" | "replicad-worker";
  /** Compile parametric input → display mesh (stub returns empty) */
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
