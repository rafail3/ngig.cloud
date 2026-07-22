// Client-safe model for the "allowed upload types" platform setting. Shared by
// the server gate (files/service createUpload), the dashboard settings UI and
// the client-side picker feedback, so all three agree on the same rules.

import { extOf, fileCategory, type FileCategory } from "@/lib/file-type";

// null = no restriction (the default): everything is allowed.
// When set: a file passes if its extension is explicitly allowed OR its
// category is enabled — unless its extension is explicitly blocked (block wins).
export type UploadTypesConfig = {
  categories: FileCategory[];
  allowExt: string[]; // normalized: lowercase, no leading dot
  blockExt: string[];
} | null;

export const UPLOAD_CATEGORIES: { key: FileCategory; label: string }[] = [
  { key: "image", label: "Imagini" },
  { key: "video", label: "Video" },
  { key: "audio", label: "Audio" },
  { key: "document", label: "Documente" },
  { key: "spreadsheet", label: "Foi de calcul" },
  { key: "presentation", label: "Prezentări" },
  { key: "code", label: "Cod și date" },
  { key: "archive", label: "Arhive" },
  { key: "other", label: "Alte tipuri" },
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

// Parse the stored jsonb into a valid config; anything malformed = unrestricted.
export function parseUploadTypes(value: unknown): UploadTypesConfig {
  if (value == null || typeof value !== "object") return null;
  const v = value as { categories?: unknown; allowExt?: unknown; blockExt?: unknown };
  const validKeys = UPLOAD_CATEGORIES.map((c) => c.key);
  const categories = Array.isArray(v.categories)
    ? (v.categories.filter((c) => validKeys.includes(c as FileCategory)) as FileCategory[])
    : [];
  const exts = (raw: unknown): string[] =>
    Array.isArray(raw) ? normalizeExtList(raw.join(",")) : [];
  return { categories, allowExt: exts(v.allowExt), blockExt: exts(v.blockExt) };
}

// The authoritative check. Returns null when allowed, or a human (RO) reason.
export function fileTypeDenied(
  name: string,
  mime: string | null | undefined,
  cfg: UploadTypesConfig,
): string | null {
  if (cfg === null) return null;
  const ext = extOf(name);
  if (ext && cfg.blockExt.includes(ext)) {
    return `Fișierele .${ext} sunt blocate pe platformă.`;
  }
  if (ext && cfg.allowExt.includes(ext)) return null;
  const cat = fileCategory(name, mime ?? null);
  if (cfg.categories.includes(cat)) return null;
  return ext
    ? `Fișierele .${ext} nu sunt permise pe platformă.`
    : "Acest tip de fișier nu este permis pe platformă.";
}
