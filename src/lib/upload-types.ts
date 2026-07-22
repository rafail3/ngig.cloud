// Client-safe model for the "blocked upload extensions" platform setting.
// Default = everything allowed; the super admin flips individual extensions ON
// to block them. Shared by the server gate (files/service createUpload), the
// dashboard settings UI and the client-side picker feedback, so all three
// agree on the same rules.

import { extOf } from "@/lib/file-type";

// null (or empty) = no restriction: everything is allowed.
export type UploadTypesConfig = {
  blockExt: string[]; // normalized: lowercase, no leading dot
} | null;

// Every extension the platform knows, most popular first, each with its
// human type label — rendered as "mp3 · Audio" in the settings grid.
export const EXT_CATALOG: { ext: string; label: string }[] = [
  // ── Most popular ──
  { ext: "jpg", label: "Imagine" },
  { ext: "png", label: "Imagine" },
  { ext: "pdf", label: "Document" },
  { ext: "mp4", label: "Video" },
  { ext: "mp3", label: "Audio" },
  { ext: "docx", label: "Document" },
  { ext: "xlsx", label: "Foaie de calcul" },
  { ext: "pptx", label: "Prezentare" },
  { ext: "zip", label: "Arhivă" },
  { ext: "jpeg", label: "Imagine" },
  { ext: "gif", label: "Imagine" },
  { ext: "webp", label: "Imagine" },
  { ext: "svg", label: "Imagine" },
  { ext: "txt", label: "Text" },
  { ext: "csv", label: "Foaie de calcul" },
  { ext: "doc", label: "Document" },
  { ext: "xls", label: "Foaie de calcul" },
  { ext: "ppt", label: "Prezentare" },
  { ext: "mov", label: "Video" },
  { ext: "avi", label: "Video" },
  { ext: "wav", label: "Audio" },
  { ext: "rar", label: "Arhivă" },
  { ext: "7z", label: "Arhivă" },
  { ext: "exe", label: "Executabil" },
  { ext: "json", label: "Date" },
  { ext: "html", label: "Cod" },
  // ── Images ──
  { ext: "bmp", label: "Imagine" },
  { ext: "ico", label: "Imagine" },
  { ext: "avif", label: "Imagine" },
  { ext: "heic", label: "Imagine" },
  { ext: "tiff", label: "Imagine" },
  // ── Video ──
  { ext: "webm", label: "Video" },
  { ext: "mkv", label: "Video" },
  { ext: "wmv", label: "Video" },
  { ext: "flv", label: "Video" },
  { ext: "m4v", label: "Video" },
  // ── Audio ──
  { ext: "ogg", label: "Audio" },
  { ext: "flac", label: "Audio" },
  { ext: "m4a", label: "Audio" },
  { ext: "aac", label: "Audio" },
  { ext: "wma", label: "Audio" },
  { ext: "opus", label: "Audio" },
  { ext: "mid", label: "Audio" },
  // ── Documents ──
  { ext: "odt", label: "Document" },
  { ext: "rtf", label: "Document" },
  { ext: "md", label: "Text" },
  { ext: "epub", label: "Carte" },
  { ext: "ods", label: "Foaie de calcul" },
  { ext: "tsv", label: "Foaie de calcul" },
  { ext: "odp", label: "Prezentare" },
  { ext: "key", label: "Prezentare" },
  // ── Code ──
  { ext: "js", label: "Cod" },
  { ext: "mjs", label: "Cod" },
  { ext: "ts", label: "Cod" },
  { ext: "jsx", label: "Cod" },
  { ext: "tsx", label: "Cod" },
  { ext: "css", label: "Cod" },
  { ext: "scss", label: "Cod" },
  { ext: "py", label: "Cod" },
  { ext: "rb", label: "Cod" },
  { ext: "go", label: "Cod" },
  { ext: "rs", label: "Cod" },
  { ext: "java", label: "Cod" },
  { ext: "c", label: "Cod" },
  { ext: "h", label: "Cod" },
  { ext: "cpp", label: "Cod" },
  { ext: "cs", label: "Cod" },
  { ext: "php", label: "Cod" },
  { ext: "sql", label: "Cod" },
  { ext: "swift", label: "Cod" },
  { ext: "kt", label: "Cod" },
  // ── Data / config ──
  { ext: "xml", label: "Date" },
  { ext: "yml", label: "Date" },
  { ext: "yaml", label: "Date" },
  { ext: "toml", label: "Date" },
  { ext: "ini", label: "Config" },
  { ext: "env", label: "Config" },
  { ext: "log", label: "Jurnal" },
  { ext: "sqlite", label: "Bază de date" },
  { ext: "db", label: "Bază de date" },
  // ── Archives ──
  { ext: "tar", label: "Arhivă" },
  { ext: "gz", label: "Arhivă" },
  { ext: "bz2", label: "Arhivă" },
  { ext: "xz", label: "Arhivă" },
  // ── Executables / scripts ──
  { ext: "msi", label: "Executabil" },
  { ext: "bat", label: "Script" },
  { ext: "cmd", label: "Script" },
  { ext: "sh", label: "Script" },
  { ext: "ps1", label: "Script" },
  { ext: "vbs", label: "Script" },
  { ext: "apk", label: "Executabil" },
  { ext: "app", label: "Executabil" },
  { ext: "dmg", label: "Executabil" },
  { ext: "deb", label: "Executabil" },
  { ext: "rpm", label: "Executabil" },
  { ext: "jar", label: "Executabil" },
  { ext: "com", label: "Executabil" },
  { ext: "scr", label: "Executabil" },
  // ── Disc images ──
  { ext: "iso", label: "Imagine disc" },
  { ext: "img", label: "Imagine disc" },
  // ── Fonts ──
  { ext: "ttf", label: "Font" },
  { ext: "otf", label: "Font" },
  { ext: "woff", label: "Font" },
  { ext: "woff2", label: "Font" },
  // ── Design / 3D ──
  { ext: "psd", label: "Design" },
  { ext: "ai", label: "Design" },
  { ext: "xd", label: "Design" },
  { ext: "sketch", label: "Design" },
  { ext: "fig", label: "Design" },
  { ext: "indd", label: "Design" },
  { ext: "eps", label: "Design" },
  { ext: "dwg", label: "CAD" },
  { ext: "blend", label: "3D" },
  { ext: "obj", label: "3D" },
  { ext: "stl", label: "3D" },
];

// "psd, .PSD ,exe" → ["psd", "exe"] (deduped, lowercase, dot stripped).
export function normalizeExtList(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,\s]+/)
        .map((e) => e.trim().toLowerCase().replace(/^\.+/, ""))
        .filter((e) => /^[a-z0-9]{1,16}$/.test(e)),
    ),
  ];
}

// Parse the stored jsonb into a valid config; anything malformed / empty =
// unrestricted (null).
export function parseUploadTypes(value: unknown): UploadTypesConfig {
  if (value == null || typeof value !== "object") return null;
  const raw = (value as { blockExt?: unknown }).blockExt;
  const blockExt = Array.isArray(raw) ? normalizeExtList(raw.join(",")) : [];
  return blockExt.length > 0 ? { blockExt } : null;
}

// The authoritative check. Returns null when allowed, or a human (RO) reason.
export function fileTypeDenied(name: string, cfg: UploadTypesConfig): string | null {
  if (cfg === null) return null;
  const ext = extOf(name);
  if (ext && cfg.blockExt.includes(ext)) {
    return `Fișierele .${ext} nu sunt permise pe platformă.`;
  }
  return null;
}
