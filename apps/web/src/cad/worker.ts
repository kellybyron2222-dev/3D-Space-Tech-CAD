import { expose } from "comlink";
import {
  importSTEP,
  importSTL,
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

function toPlainMesh(shape: Shape3D): TessellationResult {
  const faces = shape.mesh({ tolerance: 0.15, angularTolerance: 0.6 });
  const edges = shape.meshEdges({ tolerance: 0.15, angularTolerance: 0.6 });
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

  async rebuildFeatures(doc: FeatureDocument): Promise<TessellationResult> {
    await started;
    return toPlainMesh(buildShapeFromFeatures(doc));
  },

  async exportFeaturesStep(doc: FeatureDocument): Promise<Blob> {
    await started;
    return buildShapeFromFeatures(doc).blobSTEP();
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
