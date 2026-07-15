"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Loader2, Save, Check } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { ModalShell } from "./anim";
import { getOfficeEditorConfigAction, forceSaveOfficeAction } from "@/app/drive-actions";
import { revalidateDrive } from "./useDriveData";

// The Document Server's JS API, injected by its own script. The teardown method
// is `destroyEditor()` — there is no `destroy()`.
type DocsApi = {
  DocEditor: new (
    id: string,
    config: Record<string, unknown>,
  ) => { destroyEditor: () => void };
};
declare global {
  interface Window {
    DocsAPI?: DocsApi;
  }
}

const DS_URL = process.env.NEXT_PUBLIC_ONLYOFFICE_URL ?? "";

// Load the Document Server's api.js once per page, not once per open. It's a
// big script, so this is also what makes the SECOND open feel instant — and why
// we start it in parallel with (not after) fetching the config.
let apiScript: Promise<void> | null = null;
export function loadDocsApi(dsUrl = DS_URL): Promise<void> {
  if (typeof window === "undefined" || !dsUrl) return Promise.resolve();
  if (window.DocsAPI) return Promise.resolve();
  if (apiScript) return apiScript;

  apiScript = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = `${dsUrl.replace(/\/$/, "")}/web-apps/apps/api/documents/api.js`;
    el.onload = () => resolve();
    el.onerror = () => {
      // Let a later attempt retry instead of caching the failure forever.
      apiScript = null;
      reject(new Error("Serverul de documente nu răspunde."));
    };
    document.head.appendChild(el);
  });
  return apiScript;
}

// Full-screen Office editor. The document never passes through the browser: the
// Document Server fetches it from us and posts the edited copy back to our
// callback.
export function OfficeEditor({
  fileId,
  name,
  onClose,
}: {
  fileId: string;
  name: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  // The document version key, needed to command a save on this session.
  const keyRef = useRef<string | null>(null);
  // Kept in a ref so a new inline `onClose` from the parent can't retrigger the
  // effect below — that tore the editor down and rebuilt it mid-session (which
  // is what made closing the print dialog look like a reload).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    let editor: { destroyEditor: () => void } | null = null;

    void (async () => {
      // Both halves of the wait, at the same time: the script is ~1 MB and the
      // config is a round-trip — running them in series made the first open
      // needlessly slow.
      const [res] = await Promise.all([
        getOfficeEditorConfigAction(fileId),
        loadDocsApi().catch(() => undefined),
      ]);
      if (cancelled) return;

      if ("revoked" in res) {
        window.location.assign("/login");
        return;
      }
      if ("error" in res) {
        toast.error(res.error);
        closeRef.current();
        return;
      }

      try {
        await loadDocsApi(res.dsUrl);
      } catch (e) {
        if (cancelled) return;
        toast.error(e instanceof Error ? e.message : "Editorul nu s-a putut încărca.");
        closeRef.current();
        return;
      }
      if (cancelled || !window.DocsAPI) return;

      keyRef.current = res.key;
      editor = new window.DocsAPI.DocEditor("onlyoffice-host", {
        ...res.config,
        width: "100%",
        height: "100%",
        events: {
          onAppReady: () => setLoading(false),
          // Tracks whether there's anything worth saving.
          onDocumentStateChange: (e: { data?: boolean }) => setDirty(Boolean(e?.data)),
          onError: () => toast.error("Eroare în editorul de documente."),
        },
      });
    })();

    return () => {
      cancelled = true;
      editor?.destroyEditor();
      // The save lands via the callback moments later; refresh so the drive
      // picks up the new size / modified date.
      revalidateDrive();
    };
    // Deliberately only fileId: see closeRef above.
  }, [fileId]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!keyRef.current) return true;
    setSaving(true);
    const res = await forceSaveOfficeAction(keyRef.current);
    setSaving(false);
    if ("error" in res) {
      toast.error(res.error);
      return false;
    }
    setDirty(false);
    return true;
  }, []);

  async function saveOnly() {
    if (await save()) toast.success("Document salvat.");
  }

  async function saveAndClose() {
    if (await save()) closeRef.current();
  }

  function requestClose() {
    if (dirty) {
      setConfirmExit(true);
      return;
    }
    closeRef.current();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-zinc-900 px-3 sm:px-4">
        <p className="min-w-0 truncate text-sm font-medium text-zinc-200">{name}</p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={saveOnly}
            disabled={saving || !dirty}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : dirty ? (
              <Save className="h-4 w-4" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {saving ? "Se salvează…" : dirty ? "Salvează" : "Salvat"}
          </button>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Închide editorul"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
          >
            <X className="h-4 w-4" /> Închide
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Se deschide editorul…
          </div>
        )}
        <div id="onlyoffice-host" className="h-full w-full" />
      </div>

      <AnimatePresence>
        {confirmExit && (
          <ModalShell key="exit" onClose={() => setConfirmExit(false)}>
            <h3 className="text-base font-semibold text-zinc-100">Ai modificări nesalvate</h3>
            <p className="mt-1.5 text-sm text-zinc-400">
              Salvează-le înainte să închizi documentul.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmExit(false)}
                disabled={saving}
                className="rounded-lg border border-zinc-800 px-3.5 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50 disabled:opacity-60"
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={saveAndClose}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Se salvează…" : "Salvează și închide"}
              </button>
            </div>
          </ModalShell>
        )}
      </AnimatePresence>
    </div>
  );
}
