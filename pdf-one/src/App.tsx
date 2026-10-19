import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { ContextMenu } from "./components/ContextMenu";
import { DetailsPanel } from "./components/DetailsPanel";
import { PasswordDialog, SaveChoiceDialog, SplitDialog } from "./components/Dialogs";
import { PromptDialog } from "./host/web/prompt";
import { PrintDialog } from "./components/PrintDialog";
import { checkDrafts, RecoverDialog } from "./components/RecoverDialog";
import { DropOverlay, useFileDrop } from "./components/DropZone";
import { HelpDialog } from "./components/HelpDialog";
import { Organizer } from "./components/Organizer";
import { Ribbon } from "./components/Ribbon";
import { Root, textStep, type ColorScheme } from "./components/Root";
import { SealDialog } from "./components/SealDialog";
import { SearchBar } from "./components/SearchBar";
import { SettingsDialog } from "./components/SettingsDialog";
import { ShortcutHelp } from "./components/ShortcutHelp";
import { Sidebar } from "./components/Sidebar";
import { SignatureDialog } from "./components/SignatureDialog";
import { StampDialog } from "./components/StampDialog";
import { StartScreen } from "./components/StartScreen";
import { StatusBar } from "./components/StatusBar";
import { TabBar } from "./components/TabBar";
import { Tips } from "./components/Tips";
import { Toasts } from "./components/Toasts";
import { Viewer } from "./components/Viewer";
import { openRequested, settleAll } from "./lib/actions";
import { host } from "./host";
import { api } from "./lib/api";
import { onCopy, onPaste } from "./lib/clipboard";
import { runKey } from "./lib/commands";
import { startDrafts } from "./lib/drafts";
import { warn } from "./lib/log";
import { installMenuBar } from "./lib/menuBar";
import { setTextFont } from "./lib/text";
import { loadAppVersion, scheduleUpdateCheck } from "./lib/update";
import { activeDoc, useStore } from "./store";

/** The settings' author name, else the OS user name. */
async function loadAuthor() {
  try {
    const [s, os] = await Promise.all([api.getAppSettings(), api.osUserName()]);
    useStore.getState().setAuthor(s.author.trim() || os);
  } catch (e) {
    warn("author", e);
  }
}

export interface AppProps {
  colorScheme?: ColorScheme;
  className?: string;
  /**
   * Inside somebody else's page (the npm package): the app leaves the page's
   * title and root font size alone, and sizes itself by its parent.
   */
  embedded?: boolean;
}

export default function App({ colorScheme, className, embedded = false }: AppProps = {}) {
  const dialog = useStore((s) => s.dialog);
  const d = useStore(activeDoc);
  const panel = useStore((s) => s.panel);
  const details = useStore((s) => s.details);
  const organizer = useStore((s) => s.organizer);
  const textSize = useStore((s) => s.textSize);
  const dropping = useFileDrop();

  useEffect(() => {
    void loadAppVersion();
    void loadAuthor();
    api.textFontFamily().then(setTextFont, () => setTextFont(null));
    const stopMenu = installMenuBar();
    const stopUpdate = scheduleUpdateCheck();
    const stopDrafts = startDrafts();
    void checkDrafts();
    const onKey = (e: KeyboardEvent) => void runKey(e);
    window.addEventListener("keydown", onKey);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);

    // Files from the OS: at launch, and later (a double-click while open).
    void openRequested();
    let unlisten: (() => void) | undefined;
    let gone = false;
    if (isTauri()) {
      listen("open-requested", () => void openRequested())
        .then((u) => (gone ? u() : (unlisten = u)))
        .catch((e) => warn("open-requested", e));
    }

    // Leaving the page with unsaved changes: the browser asks first (the
    // desktop window does the same below, with its own dialog).
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!useStore.getState().docs.some((x) => x.dirty && !x.readOnly)) return;
      e.preventDefault();
      e.returnValue = "";
    };
    if (host().kind === "web") window.addEventListener("beforeunload", onUnload);

    // Closing the window with unsaved changes asks about each tab first.
    let unclose: (() => void) | undefined;
    if (isTauri()) {
      const win = getCurrentWindow();
      win
        .onCloseRequested(async (e) => {
          if (!useStore.getState().docs.some((x) => x.dirty && !x.readOnly)) return;
          e.preventDefault();
          if (await settleAll()) await win.destroy();
        })
        .then((u) => (gone ? u() : (unclose = u)))
        .catch((e) => warn("close", e));
    }
    return () => {
      gone = true;
      stopMenu();
      stopUpdate();
      stopDrafts();
      unlisten?.();
      unclose?.();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
    };
  }, []);

  // 文字を大きく (desktop.css): the root font size scales the whole UI. In
  // the package the page's is not ours to change: the app's own rem is
  // scaled instead (web.css, `data-text` on Root).
  useEffect(() => {
    if (embedded) return;
    const root = document.documentElement;
    const step = textStep(textSize);
    if (step) root.dataset.text = step;
    else delete root.dataset.text;
  }, [textSize, embedded]);

  // The window's title: the file, with a dot when unsaved (Windows shows it).
  useEffect(() => {
    if (embedded) return;
    const title = d ? `${d.dirty ? "● " : ""}${d.name} — PDF One` : "PDF One";
    document.title = title;
    if (isTauri()) void getCurrentWindow().setTitle(title).catch(() => {});
  }, [d?.name, d?.dirty, d, embedded]);

  return (
    <Root colorScheme={colorScheme} className={className}>
      <TabBar />
      {d ? (
        <>
          <Ribbon />
          <div className="flex min-h-0 flex-1">
            {panel && !organizer && <Sidebar d={d} />}
            <div className="relative flex min-w-0 flex-1">
              {organizer ? <Organizer d={d} /> : <Viewer key={d.key} d={d} />}
              {!organizer && <SearchBar />}
              {!organizer && <Tips />}
            </div>
            {details && !organizer && <DetailsPanel d={d} />}
          </div>
          <StatusBar d={d} />
        </>
      ) : (
        <StartScreen />
      )}

      {dialog === "settings" && <SettingsDialog />}
      {dialog === "shortcuts" && <ShortcutHelp />}
      {dialog === "stamps" && <StampDialog />}
      {dialog === "split" && <SplitDialog />}
      {dialog === "signature" && <SignatureDialog />}
      {dialog === "seal" && <SealDialog />}
      {dialog === "recover" && <RecoverDialog />}
      {dialog === "print" && <PrintDialog />}
      {dialog === "help" && <HelpDialog />}
      <SaveChoiceDialog />
      <PasswordDialog />
      <PromptDialog />
      <ContextMenu />
      {dropping && <DropOverlay />}
      <Toasts />
    </Root>
  );
}
