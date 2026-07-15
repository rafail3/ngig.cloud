"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getOfficeEditorConfigAction } from "@/app/drive-actions";
import { revalidateDrive } from "./useDriveData";

// The Document Server's JS API, injected by its own script.
type DocsApi = {
  DocEditor: new (id: string, config: Record<string, unknown>) => { destroy: () => void };
};
declare global {
  interface Window {
    DocsAPI?: DocsApi;
  }
}

// Load the Document Server's api.js once per page, not once per open.
let apiScript: Promise<void> | null = null;
function loadDocsApi(dsUrl: string): Promise<void> {
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

// Full-screen Office editor. The document never passes through us: the Document
// Server downloads it straight from B2 and posts the edited copy back to our
// callback, which is also what refreshes the drive when the editor closes.
export function OfficeEditor({
  fileId,
  name,
  onClose,
}: {
  fileId: string;
  name: string;
  onClose: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let editor: { destroy: () => void } | null = null;

    void (async () => {
      const res = await getOfficeEditorConfigAction(fileId);
      if (cancelled) return;

      if ("revoked" in res) {
        window.location.assign("/login");
        return;
      }
      if ("error" in res) {
        toast.error(res.error);
        onClose();
        return;
      }

      try {
        await loadDocsApi(res.dsUrl);
      } catch (e) {
        if (cancelled) return;
        toast.error(e instanceof Error ? e.message : "Editorul nu s-a putut încărca.");
        onClose();
        return;
      }
      if (cancelled || !window.DocsAPI) return;

      setLoading(false);
      editor = new window.DocsAPI.DocEditor("onlyoffice-host", {
        ...res.config,
        width: "100%",
        height: "100%",
        events: {
          // Fires once the editor is usable.
          onAppReady: () => setLoading(false),
          onError: () => toast.error("Eroare în editorul de documente."),
        },
      });
    })();

    return () => {
      cancelled = true;
      editor?.destroy();
      // The save lands via the callback moments after the editor closes, so
      // refresh the drive to pick up the new size / modified date.
      revalidateDrive();
    };
  }, [fileId, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-zinc-900 px-3 sm:px-4">
        <p className="min-w-0 truncate text-sm font-medium text-zinc-200">{name}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide editorul"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
        >
          <X className="h-4 w-4" /> Închide
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Se deschide editorul…
          </div>
        )}
        <div id="onlyoffice-host" ref={hostRef} className="h-full w-full" />
      </div>
    </div>
  );
}
