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

const DS_URL = process.env.NEXT_PUBLIC_ONLYOFFICE_URL ?? "";

/** Whether a Document Server is wired up at all. Previews fall back without it. */
export const officeServerConfigured = Boolean(DS_URL);

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
      // Both halves of the wait, at the same time: the script is ~1 MB and the
      // config is a round-trip — running them in series made the first open
      // needlessly slow.
      const [res] = await Promise.all([
        getOfficeEditorConfigAction(fileId, mode, theme),
        loadDocsApi().catch(() => undefined),
      ]);
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
