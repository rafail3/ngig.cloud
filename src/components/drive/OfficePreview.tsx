"use client";

import { useState } from "react";
import { CloudOff, Download, FileQuestion, Loader2 } from "lucide-react";
import type { OfficeTheme } from "@/lib/office";
import { DocxViewer } from "./DocxViewer";
import { XlsxViewer } from "./XlsxViewer";
import { useOnlyOffice } from "./useOnlyOffice";

/** How the parent has decided this Office file should be previewed. */
export type OfficePreviewKind = "onlyoffice" | "legacy" | "unavailable";

const HOST_ID = "onlyoffice-preview-host";

// A read-only Document Server session, rendered inside the preview modal. This
// is the same engine that edits the file, so what the user sees here is the
// document exactly as Word/Excel/PowerPoint lays it out — pagination, fonts,
// charts and all.
function OnlyOfficePreview({
  fileId,
  theme,
  onFail,
}: {
  fileId: string;
  theme: OfficeTheme;
  onFail: () => void;
}) {
  const { ready } = useOnlyOffice({
    fileId,
    mode: "view",
    hostId: HOST_ID,
    theme,
    onFail,
    // An error after the document opened means this session is no good either.
    onError: onFail,
  });

  return (
    <div className="relative h-full w-full">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Se încarcă documentul…
        </div>
      )}
      <div id={HOST_ID} className="h-full w-full" />
    </div>
  );
}

// The browser-side renderers we used before the Document Server existed. They
// approximate the layout (no page breaks, no styles on spreadsheets), so they
// are strictly the fallback for when the Document Server is missing or down —
// a rough preview beats none.
function LocalPreview({
  name,
  url,
  onDownload,
}: {
  name: string;
  url: string | null;
  onDownload: () => void;
}) {
  // Unlike the Document Server, these render in the browser — so they need the
  // presigned link, which may still be in flight.
  if (!url) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
      </div>
    );
  }
  if (/\.docx$/i.test(name)) return <DocxViewer url={url} onDownload={onDownload} />;
  if (/\.xlsx$/i.test(name)) return <XlsxViewer url={url} onDownload={onDownload} />;

  // Everything else (.pptx, and the legacy binaries) has no browser renderer.
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <FileQuestion className="h-10 w-10 text-zinc-600" />
      <p className="text-sm text-zinc-400">
        Previzualizarea nu e disponibilă momentan pentru acest document.
      </p>
      <button
        type="button"
        onClick={onDownload}
        className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
      >
        <Download className="h-4 w-4" /> Descarcă
      </button>
    </div>
  );
}

// Shown when the admin runs an "onlyoffice-only" cloud and the Document Server
// is down: no rough fallback, just an honest "back shortly" — never a raw error.
function Unavailable({ onDownload }: { onDownload: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <CloudOff className="h-10 w-10 text-zinc-600" />
      <div>
        <p className="text-sm font-medium text-zinc-200">
          Previzualizarea documentelor e temporar indisponibilă
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          Serviciul revine în cel mai scurt timp. Poți descărca documentul între timp.
        </p>
      </div>
      <button
        type="button"
        onClick={onDownload}
        className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
      >
        <Download className="h-4 w-4" /> Descarcă
      </button>
    </div>
  );
}

export function OfficePreview({
  fileId,
  name,
  url,
  theme,
  kind,
  onDownload,
}: {
  fileId: string;
  name: string;
  url: string | null;
  theme: OfficeTheme;
  kind: OfficePreviewKind;
  onDownload: () => void;
}) {
  // If a live OnlyOffice session fails to load, drop to the rough renderer
  // rather than a blank frame — a lesser preview beats none.
  const [failed, setFailed] = useState(false);

  if (kind === "unavailable") return <Unavailable onDownload={onDownload} />;

  if (kind === "onlyoffice" && !failed) {
    return (
      // Keyed by theme: a session can't be re-themed in place, so switching
      // themes builds a fresh one — and the loading state resets with it.
      <OnlyOfficePreview
        key={theme}
        fileId={fileId}
        theme={theme}
        onFail={() => setFailed(true)}
      />
    );
  }
  return <LocalPreview name={name} url={url} onDownload={onDownload} />;
}
