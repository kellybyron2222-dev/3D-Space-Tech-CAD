import type { SfdDocument } from "@spacetech/sfd-lang";
import type { TessellationResult } from "@spacetech/kernel-bridge";

export type CadWorkerApi = {
  ready(): Promise<boolean>;
  createMesh(doc: SfdDocument): Promise<TessellationResult>;
  createStep(doc: SfdDocument): Promise<Blob>;
  createStl(doc: SfdDocument): Promise<Blob>;
  importModel(file: File): Promise<TessellationResult>;
};
