import type { ReactElement } from "react";

export interface PdfOneAppProps {
  /**
   * Where the package's `assets/` directory is served from, ending with a
   * slash, e.g. `"/static/pdf-one/0.3.0/"`. Read when the app first mounts.
   */
  assetsBase: string;
  /** Light or dark; `"system"` (the default) follows the OS. */
  colorScheme?: "light" | "dark" | "system";
  /** Added to the root element (`.pdf-one`). */
  className?: string;
}

/**
 * PDF One's screens (open, arrange, write on and fill in PDF files, all in
 * the browser), filling the element they are in: give it a height.
 * One per page.
 */
export function PdfOneApp(props: PdfOneAppProps): ReactElement;
