// Human-friendly file-type labels (RO). Extension-first (most reliable), with a
// MIME fallback. Shared by the preview Info panel and (later) the file list —
// TASK 44 expands this to recognise every type.

const BY_EXT: Record<string, string> = {
  // Documents
  pdf: "Document PDF",
  doc: "Document Word",
  docx: "Document Word",
  odt: "Document text",
  rtf: "Document RTF",
  // Spreadsheets
  xls: "Foaie de calcul Excel",
  xlsx: "Foaie de calcul Excel",
  csv: "Tabel CSV",
  ods: "Foaie de calcul",
  // Presentations
  ppt: "Prezentare PowerPoint",
  pptx: "Prezentare PowerPoint",
  odp: "Prezentare",
  // Text / data
  txt: "Text simplu",
  md: "Markdown",
  markdown: "Markdown",
  json: "JSON",
  jsonc: "JSON",
  xml: "XML",
  yml: "YAML",
  yaml: "YAML",
  ini: "Configurare",
  env: "Configurare",
  log: "Jurnal (log)",
  toml: "TOML",
  // Code
  js: "Cod JavaScript",
  mjs: "Cod JavaScript",
  cjs: "Cod JavaScript",
  jsx: "Cod JavaScript (React)",
  ts: "Cod TypeScript",
  tsx: "Cod TypeScript (React)",
  css: "Cod CSS",
  scss: "Cod SCSS",
  html: "Cod HTML",
  py: "Cod Python",
  rb: "Cod Ruby",
  go: "Cod Go",
  rs: "Cod Rust",
  java: "Cod Java",
  c: "Cod C",
  h: "Cod C",
  cpp: "Cod C++",
  sql: "Cod SQL",
  sh: "Script shell",
  // Images
  png: "Imagine PNG",
  jpg: "Imagine JPEG",
  jpeg: "Imagine JPEG",
  gif: "Imagine GIF",
  webp: "Imagine WebP",
  svg: "Imagine SVG",
  bmp: "Imagine BMP",
  ico: "Pictogramă",
  avif: "Imagine AVIF",
  heic: "Imagine HEIC",
  // Audio / video
  mp3: "Audio MP3",
  wav: "Audio WAV",
  ogg: "Audio OGG",
  flac: "Audio FLAC",
  m4a: "Audio M4A",
  mp4: "Video MP4",
  webm: "Video WebM",
  mov: "Video QuickTime",
  mkv: "Video MKV",
  avi: "Video AVI",
  // Archives
  zip: "Arhivă ZIP",
  rar: "Arhivă RAR",
  "7z": "Arhivă 7z",
  tar: "Arhivă TAR",
  gz: "Arhivă GZIP",
};

function extOf(name: string): string | null {
  return name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? null;
}

/**
 * The file extension *including* the leading dot, in its original case
 * ("report.PDF" → ".PDF"), or "" if the name has none. A leading-dot name like
 * ".env" counts as having no extension (the dot is at position 0).
 */
export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i) : "";
}

// The bare category label, no extension suffix: "Document Word", "Cod Python".
function categoryLabel(name: string, mime?: string | null): string {
  const ext = extOf(name);
  if (ext && BY_EXT[ext]) return BY_EXT[ext];

  const m = mime ?? "";
  if (m.startsWith("image/")) return "Imagine";
  if (m.startsWith("video/")) return "Video";
  if (m.startsWith("audio/")) return "Audio";
  if (m.startsWith("text/")) return "Text";

  return ext ? `Fișier .${ext}` : m || "Fișier necunoscut";
}

/** Short type label for compact UI (file rows): e.g. "Document Word". */
export function fileTypeShort(name: string, mime?: string | null): string {
  return categoryLabel(name, mime);
}

/** Full type label for detail panels: e.g. "Document Word (.docx)". */
export function fileTypeLabel(name: string, mime?: string | null): string {
  const ext = extOf(name);
  const base = categoryLabel(name, mime);
  // Don't duplicate the extension when the fallback label already shows it.
  return ext && !base.includes(`.${ext}`) ? `${base} (.${ext})` : base;
}
