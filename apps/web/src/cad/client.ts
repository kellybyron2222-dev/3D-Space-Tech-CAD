import { wrap, type Remote } from "comlink";
import type { CadWorkerApi } from "./worker";

let api: Remote<CadWorkerApi> | null = null;

export function getCadApi(): Remote<CadWorkerApi> {
  if (!api) {
    const WorkerCtor = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    api = wrap<CadWorkerApi>(WorkerCtor);
  }
  return api;
}
