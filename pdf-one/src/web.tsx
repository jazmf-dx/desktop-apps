// The npm package's entry (@jazmf-dx/pdf-one-web, ADR-0005, docs/WASM.md): the
// app as a component for somebody else's page. It makes the browser host
// from `assetsBase` and shows the app once that is ready.
import { useEffect, useState } from "react";
import * as engine from "pdf-one-engine";
import "pdfjs-dist/web/pdf_viewer.css";
import "./web.css";
import App from "./App";
import { Root, type ColorScheme } from "./components/Root";
import { setHost, type Host } from "./host";
import { createWebHost } from "./host/web";
import { setUpPdfjs } from "./lib/pdfjs";

export interface PdfOneAppProps {
  /**
   * Where the package's `assets/` directory is served from, ending with a
   * slash (`/static/pdf-one/0.3.0/`). Read when the app first mounts.
   */
  assetsBase: string;
  /** Light or dark; "system" (the default) follows the OS. */
  colorScheme?: ColorScheme;
  className?: string;
}

/** One host per `assetsBase`: it is made once, even when the app mounts twice (StrictMode, a remount). */
const hosts = new Map<string, Promise<Host>>();

function start(assetsBase: string): Promise<Host> {
  // Absolute, as pdf.js passes these on to its worker, which resolves them from its own address.
  const base = new URL(assetsBase.endsWith("/") ? assetsBase : `${assetsBase}/`, document.baseURI).href;
  setUpPdfjs({ workerSrc: `${base}pdf.worker.min.mjs`, assetsUrl: base });
  let host = hosts.get(base);
  if (!host) {
    host = createWebHost({ engine, wasmUrl: `${base}pdf_one_wasm_bg.wasm`, fontUrl: `${base}NotoSansJP-Regular.ttf` });
    hosts.set(base, host);
    // A failed one is not kept: mounting again tries again.
    host.catch(() => hosts.delete(base));
  }
  return host;
}

type State = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

/**
 * PDF One's screens, filling the element they are in (give it a height).
 * One per page: the open files and the settings are the page's, not the
 * component's. Unmounting stops what the app listens to and keeps the open
 * files, which come back if it mounts again.
 */
export function PdfOneApp({ assetsBase: assetsBaseProp, colorScheme, className }: PdfOneAppProps) {
  // The first one counts: the host is made once.
  const [assetsBase] = useState(assetsBaseProp);
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let gone = false;
    start(assetsBase).then(
      (host) => {
        setHost(host);
        if (!gone) setState({ status: "ready" });
      },
      (e) => {
        console.error("PDF One の準備に失敗しました:", e);
        if (!gone) setState({ status: "error", message: String(e instanceof Error ? e.message : e) });
      },
    );
    return () => {
      gone = true;
    };
  }, [assetsBase]);

  if (state.status === "ready") return <App colorScheme={colorScheme} className={className} embedded />;
  return (
    <Root colorScheme={colorScheme} className={className}>
      <div role={state.status === "error" ? "alert" : "status"} className="m-auto max-w-md p-6 text-center">
        {state.status === "loading" ? (
          <p className="text-dim">読み込んでいます…</p>
        ) : (
          <>
            <p className="font-semibold">PDF One を読み込めませんでした</p>
            <p className="mt-2 text-dim">assetsBase（{assetsBase}）のファイルを確かめてください。{state.message}</p>
          </>
        )}
      </div>
    </Root>
  );
}
