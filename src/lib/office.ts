// Which files the Document Server (OnlyOffice) can open, what it should open
// them AS, and whether it may write them back. Client-safe: the file list, the
// preview modal and the server all read the same table.

export type OfficeDocType = "word" | "cell" | "slide";

/** How a Document Server session is opened: a read-only preview, or the editor. */
export type OfficeMode = "edit" | "view";

/** Which of its two themes the Document Server paints its own chrome in. */
export type OfficeTheme = "light" | "dark";

// Modern OOXML + OpenDocument: the Document Server round-trips these losslessly,
// so we let it save over the original.
const EDITABLE: Record<string, OfficeDocType> = {
  docx: "word",
  odt: "word",
  rtf: "word",
  xlsx: "cell",
  ods: "cell",
  pptx: "slide",
  odp: "slide",
};

// Legacy binaries. The Document Server renders them faithfully, but it can only
// EDIT them by converting to OOXML first — which would silently rewrite the
// user's file into another format. Preview only.
const VIEW_ONLY: Record<string, OfficeDocType> = {
  doc: "word",
  xls: "cell",
  ppt: "slide",
};

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** What the Document Server should open this file as, or null if it can't. */
export function officeDocType(name: string): OfficeDocType | null {
  const e = ext(name);
  return EDITABLE[e] ?? VIEW_ONLY[e] ?? null;
}

/** Whether this file opens in the Office editor, with saving. */
export function isOfficeEditable(name: string): boolean {
  return EDITABLE[ext(name)] !== undefined;
}

/** Whether the Office preview can render this file (a superset of editable). */
export function isOfficeViewable(name: string): boolean {
  return officeDocType(name) !== null;
}

/** The extension OnlyOffice needs in its config (`fileType`). */
export function officeFileType(name: string): string {
  return ext(name);
}

// ── Service mode ─────────────────────────────────────────────────────────────
// How the whole platform treats Office documents, chosen by an admin. The
// Document Server may run on a machine that isn't always on (a friend's server,
// a laptop), so the app has to degrade gracefully when it's down — and the admin
// decides HOW.

export type OfficeServiceMode = "auto" | "legacy" | "onlyoffice";

export const OFFICE_SERVICE_MODES: {
  value: OfficeServiceMode;
  label: string;
  tagline: string;
  description: string;
}[] = [
  {
    value: "auto",
    label: "Automat",
    tagline: "Recomandat",
    description:
      "Când serverul OnlyOffice e pornit: previzualizare fidelă + editare. Când e oprit: previzualizarea simplă din browser, fără editare.",
  },
  {
    value: "legacy",
    label: "Doar previzualizare simplă",
    tagline: "Fără OnlyOffice",
    description:
      "Nu folosește niciodată serverul OnlyOffice. Doar previzualizarea din browser, fără editare.",
  },
  {
    value: "onlyoffice",
    label: "Doar server OnlyOffice",
    tagline: "Fără rezervă",
    description:
      "Mereu prin serverul OnlyOffice: previzualizare fidelă + editare. Când e oprit, un mesaj că serviciul e temporar indisponibil, fără eroare.",
  },
];

export function isOfficeServiceMode(v: unknown): v is OfficeServiceMode {
  return v === "auto" || v === "legacy" || v === "onlyoffice";
}

/**
 * A snapshot of the Office capability, resolved on the server and handed to the
 * client so every surface (preview, edit buttons) decides identically.
 *  - `mode`       — the admin's choice.
 *  - `up`         — whether the Document Server answered its health check.
 *  - `configured` — whether a Document Server address is set at all.
 */
export type OfficeStatus = {
  mode: OfficeServiceMode;
  up: boolean;
  configured: boolean;
  /** Where the Document Server lives right now — a runtime setting, not a build-time env. */
  dsUrl: string;
};

/** Whether the Document Server can actually serve a request right now. */
function officeUsable(s: OfficeStatus): boolean {
  return s.configured && s.up && s.mode !== "legacy";
}

/** How an Office file should be previewed under the current status. */
export function officePreviewKind(
  s: OfficeStatus,
): "onlyoffice" | "legacy" | "unavailable" {
  if (officeUsable(s)) return "onlyoffice";
  // Down (or off). In "onlyoffice" mode the admin asked for no silent fallback:
  // show a "temporarily unavailable" message instead of the rough renderer.
  if (s.mode === "onlyoffice" && s.configured) return "unavailable";
  return "legacy";
}

/** Whether the "Editează" action should be offered for this file. */
export function officeCanEdit(s: OfficeStatus, name: string): boolean {
  if (!isOfficeEditable(name)) return false;
  if (s.mode === "legacy" || !s.configured) return false;
  // "auto" only offers editing while the server is actually up. "onlyoffice"
  // keeps offering it — opening while down surfaces the same friendly message.
  if (s.mode === "auto") return s.up;
  return true;
}

/** In "onlyoffice" mode with the server down, edit is offered but can't run. */
export function officeEditUnavailable(s: OfficeStatus, name: string): boolean {
  return (
    isOfficeEditable(name) &&
    s.mode === "onlyoffice" &&
    s.configured &&
    !s.up
  );
}
