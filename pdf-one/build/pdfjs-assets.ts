/**
 * The files pdf.js reads at run time, by URL (src/lib/pdfjs.ts): the CMaps
 * that Japanese PDFs without embedded fonts need, the standard 14 fonts, and
 * the JavaScript image decoders (JPEG 2000, JBIG2) it uses instead of
 * WebAssembly, which the CSP doesn't allow. Shared by the desktop app's
 * build (vite.config.ts, into dist/pdfjs/) and the npm package's
 * (vite.web.config.ts, into assets/).
 */
import fs from "node:fs";
import path from "node:path";

export const pdfjsRoot = path.resolve("node_modules/pdfjs-dist");

export const pdfjsDirs: Record<string, (name: string) => boolean> = {
  cmaps: () => true,
  standard_fonts: () => true,
  wasm: (name) => name.endsWith("_nowasm_fallback.js") || name.startsWith("LICENSE"),
};

export function pdfjsFiles(): { dir: string; name: string }[] {
  return Object.entries(pdfjsDirs).flatMap(([dir, keep]) =>
    fs
      .readdirSync(path.join(pdfjsRoot, dir))
      .filter(keep)
      .map((name) => ({ dir, name })),
  );
}
