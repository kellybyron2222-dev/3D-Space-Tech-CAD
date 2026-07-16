import { expose } from "comlink";
import {
  importSTEP,
  importSTL,
  makeBaseBox,
  setOC,
  type AnyShape,
  type Shape3D,
} from "replicad";
import opencascade from "replicad-opencascadejs/src/replicad_single.js";
import opencascadeWasm from "replicad-opencascadejs/src/replicad_single.wasm?url";
import type { FeatureDocument, SfdDocument } from "@spacetech/sfd-lang";
import type { TessellationResult } from "@spacetech/kernel-bridge";
import { buildShapeFromSfd } from "./buildFromSfd";
import { buildShapeFromFeatures } from "./buildFromFeatures";
import type { MassPropsResult, RebuildResult } from "./types";

let loaded = false;

async function initOc(): Promise<void> {
  if (loaded) return;
  const OC = await opencascade({
    locateFile: () => opencascadeWasm,
  });
  setOC(OC as Parameters<typeof setOC>[0]);
  loaded = true;
}

const started = initOc();

const AL_DENSITY = 2.7e-6; // kg/mm³

function toPlainMesh(shape: Shape3D): TessellationResult {
  const fallback = (): TessellationResult => {
    const box = makeBaseBox(40, 40, 40).translate(0, 0, 20);
    const faces = box.mesh({ tolerance: 0.15, angularTolerance: 0.6 });
    const edges = box.meshEdges({ tolerance: 0.15, angularTolerance: 0.6 });
    return {
      faces: {
        vertices: Array.from(faces.vertices),
        normals: Array.from(faces.normals),
        triangles: Array.from(faces.triangles),
        faceGroups: faces.faceGroups?.map((g) => ({ ...g })),
      },
      edges: {
        lines: Array.from(edges.lines ?? []),
      },
    };
  };

  try {
    const faces = shape.mesh({ tolerance: 0.15, angularTolerance: 0.6 });
    const edges = shape.meshEdges({ tolerance: 0.15, angularTolerance: 0.6 });
    const triangles = Array.from(faces.triangles);
    if (triangles.length === 0) return fallback();
    return {
      faces: {
        vertices: Array.from(faces.vertices),
        normals: Array.from(faces.normals),
        triangles,
        faceGroups: faces.faceGroups?.map((g) => ({ ...g })),
      },
      edges: {
        lines: Array.from(edges.lines ?? []),
      },
    };
  } catch {
    return fallback();
  }
}

function massFromShape(shape: Shape3D): MassPropsResult {
  let volumeMm3 = 1;
  let cg = { x: 0, y: 0, z: 0 };
  try {
    const vol = (shape as Shape3D & { volume: number | (() => number) }).volume;
    volumeMm3 = typeof vol === "function" ? vol.call(shape) : Number(vol);
  } catch {
    volumeMm3 = 1;
  }
  try {
    const c = (
      shape as Shape3D & { centerOfMass: [number, number, number] }
    ).centerOfMass;
    cg = { x: c[0], y: c[1], z: c[2] };
  } catch {
    /* keep zero */
  }
  if (!Number.isFinite(volumeMm3) || volumeMm3 <= 0) volumeMm3 = 1;
  return {
    volumeMm3,
    massKg: volumeMm3 * AL_DENSITY,
    cgMm: cg,
    densityKgPerMm3: AL_DENSITY,
  };
}

const api = {
  async ready(): Promise<boolean> {
    await started;
    return true;
  },

  async createMesh(doc: SfdDocument): Promise<TessellationResult> {
    await started;
    return toPlainMesh(buildShapeFromSfd(doc));
  },

  async createStep(doc: SfdDocument): Promise<Blob> {
    await started;
    return buildShapeFromSfd(doc).blobSTEP();
  },

  async createStl(doc: SfdDocument): Promise<Blob> {
    await started;
    return buildShapeFromSfd(doc).blobSTL({
      tolerance: 0.15,
      angularTolerance: 0.6,
    });
  },

  async rebuildFeatures(doc: FeatureDocument): Promise<RebuildResult> {
    await started;
    let shape: Shape3D;
    try {
      shape = buildShapeFromFeatures(doc);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`Feature rebuild failed: ${detail}`);
    }

    let mesh: TessellationResult;
    try {
      mesh = toPlainMesh(shape);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`Tessellation failed after feature rebuild: ${detail}`);
    }

    return {
      mesh,
      mass: massFromShape(shape),
    };
  },

  async exportFeaturesStep(doc: FeatureDocument): Promise<Blob> {
    await started;
    return buildShapeFromFeatures(doc).blobSTEP();
  },

  async exportFeaturesStl(doc: FeatureDocument): Promise<Blob> {
    await started;
    return buildShapeFromFeatures(doc).blobSTL({
      tolerance: 0.15,
      angularTolerance: 0.6,
    });
  },

  async importModel(file: File): Promise<TessellationResult> {
    await started;
    const name = file.name.toLowerCase();
    let shape: AnyShape;
    if (name.endsWith(".stl")) {
      shape = await importSTL(file);
    } else if (name.endsWith(".step") || name.endsWith(".stp")) {
      shape = await importSTEP(file);
    } else {
      throw new Error("Unsupported file type. Use .step/.stp or .stl");
    }
    if (!("mesh" in shape) || typeof shape.mesh !== "function") {
      throw new Error("Imported geometry cannot be meshed");
    }
    return toPlainMesh(shape as Shape3D);
  },
};

export type CadWorkerApi = typeof api;

expose(api);
