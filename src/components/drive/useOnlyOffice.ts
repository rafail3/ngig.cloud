"use client";

import { useEffect, useRef, useState } from "react";
import { getOfficeEditorConfigAction } from "@/app/drive-actions";
import type { OfficeMode, OfficeTheme } from "@/lib/office";

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

// Where the Document Server lives is a runtime setting now (it can sit behind a
// tunnel whose URL changes), so the browser learns it from the server via
// OfficeStatus — there is no build-time env to read here.
//
// Load the Document Server's api.js once per page, not once per open. It's a big
// script, so this is also what makes the SECOND open feel instant — and why we
// start it in parallel with (not after) fetching the config.
let apiScript: Promise<void> | null = null;
let loadedFrom = "";

export function loadDocsApi(dsUrl: string): Promise<void> {
  if (typeof window === "undefined" || !dsUrl) return Promise.resolve();
  if (window.DocsAPI && loadedFrom === dsUrl) return Promise.resolve();
  // The server moved (new tunnel URL): the cached script is from the old origin
  // and its API would talk to a host that's gone. Start over.
  if (loadedFrom && loadedFrom !== dsUrl) {
    apiScript = null;
    delete window.DocsAPI;
  }
  if (apiScript) return apiScript;

  loadedFrom = dsUrl;
  apiScript = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = `${dsUrl.replace(/\/$/, "")}/web-apps/apps/api/documents/api.js`;
    el.onload = () => resolve();
    el.onerror = () => {
      // Let a later attempt retry instead of caching the failure forever.
      apiScript = null;
      loadedFrom = "";
      reject(new Error("Serverul de documente nu răspunde."));
    };
    document.head.appendChild(el);
  });
  return apiScript;
}

// Boots a Document Server session into `hostId` and tears it down on unmount.
// The preview and the editor differ only in `mode` and in what they do with the
// callbacks, so the mounting itself lives here once.
export function useOnlyOffice(opts: {
  fileId: string;
  mode: OfficeMode;
  hostId: string;
  /**
   * The Document Server reads its theme from the config and offers no way to
   * change it afterwards, so a session is tied to one theme for life. Remount
   * the component (key it by theme) to switch.
   */
  theme: OfficeTheme;
  /** The session could not be opened at all (not configured, script or config failed). */
  onFail: (message: string) => void;
  /** The document reports unsaved changes. Editing only. */
  onStateChange?: (dirty: boolean) => void;
  /** The Document Server hit an error once the document was already open. */
  onError?: () => void;
}): { ready: boolean; keyRef: React.RefObject<string | null> } {
  const [ready, setReady] = useState(false);
  // The document version key — what a force-save command is addressed to.
  const keyRef = useRef<string | null>(null);

  // Callbacks live in a ref so an inline arrow from the parent (a new identity
  // on every render) can't retrigger the effect: that would tear the session
  // down and rebuild it mid-document.
  const cb = useRef(opts);
  useEffect(() => {
    cb.current = opts;
  });

  const { fileId, mode, hostId, theme } = opts;

  useEffect(() => {
    let cancelled = false;
    let editor: { destroyEditor: () => void } | null = null;

    void (async () => {
      // The script can't be prefetched here any more — its address arrives with
      // the config. The provider warms it as soon as the status lands, which is
      // long before anyone clicks, so the first open still feels instant.
      const res = await getOfficeEditorConfigAction(fileId, mode, theme);
      if (cancelled) return;

      if ("revoked" in res) {
        window.location.assign("/login");
        return;
      }
      if ("error" in res) {
        cb.current.onFail(res.error);
        return;
      }

      try {
        await loadDocsApi(res.dsUrl);
      } catch (e) {
        if (cancelled) return;
        cb.current.onFail(
          e instanceof Error ? e.message : "Documentul nu s-a putut încărca.",
        );
        return;
      }
      if (cancelled || !window.DocsAPI) return;

      keyRef.current = res.key;
      editor = new window.DocsAPI.DocEditor(hostId, {
        ...res.config,
        width: "100%",
        height: "100%",
        events: {
          onAppReady: () => setReady(true),
          onDocumentStateChange: (e: { data?: boolean }) =>
            cb.current.onStateChange?.(Boolean(e?.data)),
          onError: () => cb.current.onError?.(),
        },
      });
    })();

    return () => {
      cancelled = true;
      editor?.destroyEditor();
    };
  }, [fileId, mode, hostId, theme]);

  return { ready, keyRef };
}
