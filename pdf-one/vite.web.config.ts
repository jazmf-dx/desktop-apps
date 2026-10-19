// `npm run build:web`: the npm package @jazmf-dx/pdf-one-web (web/, ADR-0005,
// docs/WASM.md). The app's screens (src/web.tsx) as a library in web/dist/:
// index.js, style.css (scoped to `.pdf-one`), the types, and assets/ — the
// files the page that uses it serves as static files, by `assetsBase`.
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";
import scopeCss from "./build/postcss-scope";
import { pdfjsFiles, pdfjsRoot } from "./build/pdfjs-assets";

const engineDir = path.resolve("wasm/pkg");
const noto = path.resolve("node_modules/@expo-google-fonts/noto-sans-jp");

/**
 * wasm-bindgen's script starts the wasm from `new URL("….wasm", import.meta.url)`
 * when it is given no address; the bundler would copy the wasm next to the
 * script for that. It is always given one (`assetsBase`), so that is an error.
 */
function engineWithoutDefaultUrl(): Plugin {
  return {
    name: "engine-without-default-url",
    enforce: "pre",
    transform(code, id) {
      if (!id.startsWith(engineDir) || !id.endsWith("pdf_one_wasm.js")) return null;
      const from = "new URL('pdf_one_wasm_bg.wasm', import.meta.url)";
      if (!code.includes(from)) this.error("wasm-bindgen's output has changed: the default address of the wasm is not where build:web looks for it");
      return code.replace(from, '(() => { throw new Error("pdf_one_wasm_bg.wasm の場所（assetsBase）がありません"); })()');
    },
  };
}

/** What `assetsBase` points at: the files the package reads at run time, with their licences. */
function packageAssets(): Plugin {
  return {
    name: "package-assets",
    generateBundle() {
      const add = (fileName: string, file: string) =>
        this.emitFile({ type: "asset", fileName: `assets/${fileName}`, source: fs.readFileSync(file) });
      const wasm = path.join(engineDir, "pdf_one_wasm_bg.wasm");
      if (!fs.existsSync(wasm)) this.error("wasm/pkg/pdf_one_wasm_bg.wasm is missing: run `npm run build:wasm` first");
      add("pdf_one_wasm_bg.wasm", wasm);
      // Noto Sans JP (SIL OFL 1.1), the static Regular: the subsetter can't do variable fonts.
      add("NotoSansJP-Regular.ttf", path.join(noto, "400Regular/NotoSansJP_400Regular.ttf"));
      add("LICENSE-NotoSansJP-OFL.txt", path.join(noto, "LICENSE_FONT"));
      // pdf.js: the worker (the legacy build, as for the main thread), its CMaps, standard fonts and decoders.
      add("pdf.worker.min.mjs", path.join(pdfjsRoot, "legacy/build/pdf.worker.min.mjs"));
      add("LICENSE-pdfjs.txt", path.join(pdfjsRoot, "LICENSE"));
      for (const { dir, name } of pdfjsFiles()) add(`${dir}/${name}`, path.join(pdfjsRoot, dir, name));
    },
  };
}

/**
 * Closes style.css inside `.pdf-one` (build/postcss-scope.ts). It runs on the
 * finished file, after the CSS has been lowered and minified, so what it
 * checks is what is shipped.
 */
function scopedStyle(): Plugin {
  return {
    name: "scoped-style",
    enforce: "post",
    async generateBundle(_, bundle) {
      const asset = bundle["style.css"];
      if (asset?.type !== "asset") this.error("style.css was not built");
      const css = String(asset.source);
      const result = await postcss([scopeCss({ scope: ".pdf-one", keyframesPrefix: "pdf-one-", remVar: "--pdf-one-rem", flattenLayers: true })]).process(css, { from: undefined });
      asset.source = result.css;
    },
  };
}

/** The types are written by hand (web/index.d.ts): only the component's props. */
function typesFile(): Plugin {
  return {
    name: "types-file",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "index.d.ts", source: fs.readFileSync("web/index.d.ts") });
    },
  };
}

export default defineConfig({
  plugins: [engineWithoutDefaultUrl(), react(), tailwindcss(), packageAssets(), typesFile(), scopedStyle()],

  resolve: {
    alias: [
      // pdf.js's legacy build, as in vite.config.ts.
      { find: /^pdfjs-dist$/, replacement: "pdfjs-dist/legacy/build/pdf.mjs" },
      // wasm-bindgen's script is part of index.js.
      { find: /^pdf-one-engine$/, replacement: path.join(engineDir, "pdf_one_wasm.js") },
    ],
  },

  define: {
    "import.meta.env.PDF_ONE_WEB": "true",
    // Library builds leave it to the page's bundler; a page without one would throw on `process`.
    "process.env.NODE_ENV": '"production"',
  },

  build: {
    outDir: "web/dist",
    emptyOutDir: true,
    target: "es2022",
    // Pictures in the CSS (pdf.js's) go into style.css: assets/ is the page's to serve, and nothing else goes there.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    lib: { entry: "src/web.tsx", formats: ["es"], fileName: "index", cssFileName: "style" },
    rollupOptions: {
      // The page's React (peerDependencies); everything else is in index.js.
      external: [/^react(\/|$)/, /^react-dom(\/|$)/],
    },
  },
});
