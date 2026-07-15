"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Loader2, Save, Check } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { ModalShell } from "./anim";
import { forceSaveOfficeAction } from "@/app/drive-actions";
import { useOnlyOffice } from "./useOnlyOffice";
import { revalidateDrive } from "./useDriveData";

const HOST_ID = "onlyoffice-editor-host";

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
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  // Kept in a ref so a new inline `onClose` from the parent can't be read
  // stale by the callbacks below.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  const { ready, keyRef } = useOnlyOffice({
    fileId,
    mode: "edit",
    hostId: HOST_ID,
    onFail: (message) => {
      toast.error(message);
      closeRef.current();
    },
    // Tracks whether there's anything worth saving.
    onStateChange: setDirty,
    onError: () => toast.error("Eroare în editorul de documente."),
  });

  useEffect(() => {
    // The save lands via the callback moments later; refresh on the way out so
    // the drive picks up the new size / modified date.
    return () => {
      void revalidateDrive();
    };
  }, []);

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
  }, [keyRef]);

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
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Se deschide editorul…
          </div>
        )}
        <div id={HOST_ID} className="h-full w-full" />
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
