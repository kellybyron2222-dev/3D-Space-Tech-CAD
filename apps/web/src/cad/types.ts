import type { SfdDocument, FeatureDocument } from "@spacetech/sfd-lang";
import type { TessellationResult } from "@spacetech/kernel-bridge";

export interface MassPropsResult {
  volumeMm3: number;
  massKg: number;
  cgMm: { x: number; y: number; z: number };
  densityKgPerMm3: number;
}

export interface RebuildResult {
  mesh: TessellationResult;
  mass: MassPropsResult;
}

export type CadWorkerApi = {
  ready(): Promise<boolean>;
  createMesh(doc: SfdDocument): Promise<TessellationResult>;
  createStep(doc: SfdDocument): Promise<Blob>;
  createStl(doc: SfdDocument): Promise<Blob>;
  importModel(file: File): Promise<TessellationResult>;
  rebuildFeatures(doc: FeatureDocument): Promise<RebuildResult>;
  exportFeaturesStep(doc: FeatureDocument): Promise<Blob>;
  exportFeaturesStl(doc: FeatureDocument): Promise<Blob>;
};
