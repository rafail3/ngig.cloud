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

/** A friendly label like "Document Word (.docx)" for a file. */
export function fileTypeLabel(name: string, mime?: string | null): string {
  const ext = extOf(name);
  if (ext && BY_EXT[ext]) return `${BY_EXT[ext]} (.${ext})`;

  const m = mime ?? "";
  const suffix = ext ? ` (.${ext})` : "";
  if (m.startsWith("image/")) return `Imagine${suffix}`;
  if (m.startsWith("video/")) return `Video${suffix}`;
  if (m.startsWith("audio/")) return `Audio${suffix}`;
  if (m.startsWith("text/")) return `Text${suffix}`;

  if (ext) return `Fișier .${ext}`;
  return m || "Fișier necunoscut";
}
