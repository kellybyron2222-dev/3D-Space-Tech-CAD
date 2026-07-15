/// <reference types="vite/client" />

declare module "*?url" {
  const url: string;
  export default url;
}

declare module "*?worker" {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

declare module "replicad-opencascadejs/src/replicad_single.js" {
  type OpenCascadeFactory = (options: {
    locateFile: (path: string) => string;
  }) => Promise<object>;
  const opencascade: OpenCascadeFactory;
  export default opencascade;
}
