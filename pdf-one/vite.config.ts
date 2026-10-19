import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pdfjsDirs, pdfjsFiles, pdfjsRoot } from "./build/pdfjs-assets";
const host = process.env.TAURI_DEV_HOST;

/**
 * What pdf.js reads at run time (build/pdfjs-assets.ts, src/lib/pdfjs.ts).
 * Served from node_modules in development and copied into dist/pdfjs/ for the app.
 */
function pdfjsAssets(): Plugin {
  return {
    name: "pdfjs-assets",
    configureServer(server) {
      server.middlewares.use("/pdfjs", (req, res, next) => {
        const [dir, name] = decodeURIComponent((req.url ?? "").split("?")[0]).replace(/^\//, "").split("/");
        if (!(dir in pdfjsDirs) || !name || name.includes("..") || !pdfjsDirs[dir](name)) return next();
        const file = path.join(pdfjsRoot, dir, name);
        if (!fs.existsSync(file)) return next();
        res.setHeader("Content-Type", name.endsWith(".js") ? "text/javascript" : "application/octet-stream");
        fs.createReadStream(file).pipe(res);
      });
    },
    generateBundle() {
      for (const { dir, name } of pdfjsFiles()) {
        this.emitFile({ type: "asset", fileName: `pdfjs/${dir}/${name}`, source: fs.readFileSync(path.join(pdfjsRoot, dir, name)) });
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), pdfjsAssets()],

  // pdf.js's legacy build: the same API with polyfills for what the newest
  // browsers only just have (Map.getOrInsertComputed…). The WebView is the
  // OS's own: Safari's on macOS, which lags behind on older macOS versions.
  resolve: {
    alias: [{ find: /^pdfjs-dist$/, replacement: "pdfjs-dist/legacy/build/pdf.mjs" }],
  },

  // pdf.js uses top-level await and private class members.
  build: { target: "es2022" },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
