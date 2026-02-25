/// <reference types="vite/client" />

declare module '*.css?inline' {
  const css: string;
  export default css;
}

declare module '*?worker&inline' {
  /** Inline Worker constructor — worker code is base64-embedded by Vite at build time. */
  const WorkerFactory: new () => Worker;
  export default WorkerFactory;
}
