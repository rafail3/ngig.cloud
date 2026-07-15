// Which files the Document Server (OnlyOffice) can open, what it should open
// them AS, and whether it may write them back. Client-safe: the file list, the
// preview modal and the server all read the same table.

export type OfficeDocType = "word" | "cell" | "slide";

/** How a Document Server session is opened: a read-only preview, or the editor. */
export type OfficeMode = "edit" | "view";

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
