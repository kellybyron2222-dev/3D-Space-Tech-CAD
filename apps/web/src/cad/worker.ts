import { expose } from "comlink";
import { setOC } from "replicad";
import opencascade from "replicad-opencascadejs/src/replicad_single.js";
import opencascadeWasm from "replicad-opencascadejs/src/replicad_single.wasm?url";
import type { SfdDocument } from "@spacetech/sfd-lang";
import type { TessellationResult } from "@spacetech/kernel-bridge";
import { buildShapeFromSfd } from "./buildFromSfd";

let loaded = false;

async function initOc(): Promise<void> {
  if (loaded) return;
  const OC = await opencascade({
    locateFile: () => opencascadeWasm,
  });
  // WASM factory typing is loose across replicad-opencascadejs builds
  setOC(OC as Parameters<typeof setOC>[0]);
  loaded = true;
}

const started = initOc();

const api = {
  async ready(): Promise<boolean> {
    await started;
    return true;
  },

  async createMesh(doc: SfdDocument): Promise<TessellationResult> {
    await started;
    const shape = buildShapeFromSfd(doc);
    const faces = shape.mesh({ tolerance: 0.1, angularTolerance: 0.5 });
    const edges = shape.meshEdges({ tolerance: 0.1, angularTolerance: 0.5 });
    return {
      faces: faces as TessellationResult["faces"],
      edges: edges as TessellationResult["edges"],
    };
  },

  async createStep(doc: SfdDocument): Promise<Blob> {
    await started;
    return buildShapeFromSfd(doc).blobSTEP();
  },

  async createStl(doc: SfdDocument): Promise<Blob> {
    await started;
    return buildShapeFromSfd(doc).blobSTL({
      tolerance: 0.1,
      angularTolerance: 0.5,
    });
  },
};

export type CadWorkerApi = typeof api;

expose(api);
