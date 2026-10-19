// Small preferences (panel sizes, tool styles…) in localStorage. In the npm
// package the page is somebody else's and shares its origin, so the keys get
// a prefix there (vite.web.config.ts defines PDF_ONE_WEB); the apps keep
// theirs as they were.
const PREFIX = import.meta.env.PDF_ONE_WEB ? "pdf-one:" : "";

export function loadPref(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function savePref(key: string, value: string) {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    /* only a preference */
  }
}
