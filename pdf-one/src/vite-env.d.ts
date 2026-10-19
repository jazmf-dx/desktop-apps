/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set by vite.web.config.ts: this is the npm package's build. */
  readonly PDF_ONE_WEB?: boolean;
}

// wasm-bindgen's script (wasm/pkg/pdf_one_wasm.js, built by `npm run build:wasm`),
// which vite.web.config.ts aliases. Typed by `Engine` in src/host/web/engine.ts.
declare module "pdf-one-engine";
