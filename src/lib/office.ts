// Which files the Office editor (OnlyOffice Document Server) can open, and what
// it should open them AS. Client-safe: the file list, the preview modal and the
// server all read the same table.

export type OfficeDocType = "word" | "cell" | "slide";

// Only the modern OOXML + OpenDocument formats. The legacy binaries (.doc/.xls/
// .ppt) need a conversion round-trip before they can be edited, which would
// silently rewrite the user's file into another format — out of scope here.
const BY_EXT: Record<string, OfficeDocType> = {
  docx: "word",
  odt: "word",
  rtf: "word",
  xlsx: "cell",
  ods: "cell",
  pptx: "slide",
  odp: "slide",
};

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function officeDocType(name: string): OfficeDocType | null {
  return BY_EXT[ext(name)] ?? null;
}

/** Whether this file opens in the Office editor. */
export function isOfficeEditable(name: string): boolean {
  return officeDocType(name) !== null;
}

/** The extension OnlyOffice needs in its config (`fileType`). */
export function officeFileType(name: string): string {
  return ext(name);
}
