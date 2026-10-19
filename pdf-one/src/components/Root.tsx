import { useStore } from "../store";

export type ColorScheme = "light" | "dark" | "system";

/** 文字を大きく (docs/UX.md §10): the step of the text size, as `data-text` names it. */
export const textStep = (textSize: number) => (textSize >= 1.3 ? "larger" : textSize >= 1.15 ? "large" : undefined);

/**
 * The element the whole app sits in. Its class `.pdf-one` is what the styles
 * hang on (index.css), and the npm package's CSS is scoped to it (docs/WASM.md):
 * the colours are its variables, `data-color-scheme` picks light or dark
 * (without it, the OS's), `data-text` is the text size.
 */
export function Root({ colorScheme = "system", className, children }: { colorScheme?: ColorScheme; className?: string; children: React.ReactNode }) {
  const textSize = useStore((s) => s.textSize);
  return (
    <div
      className={className ? `pdf-one ${className}` : "pdf-one"}
      data-color-scheme={colorScheme === "system" ? undefined : colorScheme}
      data-text={textStep(textSize)}
    >
      {children}
    </div>
  );
}
