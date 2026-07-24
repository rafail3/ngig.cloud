// Client-safe vocabulary for public share links (Faza A). No server imports —
// this module is pulled into client components (the share modal, the public
// page, "Linkurile mele"). All token minting, DB access and presigning live in
// `server/share/service.ts`.

// An individual target the user can pick to share.
export type ShareTargetType = "file" | "folder";

// What a link actually points to — a single file/folder, or a bundle of several
// items selected together.
export type ShareLinkKind = "file" | "folder" | "bundle";

// One member of a bundle, as rendered on the public page. Client-safe so the
// bundle list component can type it. Previewable files carry a short-lived
// inline URL so a visitor can preview each one in place.
export type ShareBundleItemView = {
  kind: "file" | "folder";
  name: string;
  size: number | null;
  previewKind: SharePreviewKind;
  previewUrl: string | null;
};

// A browsable folder tree for a shared folder — subfolders (recursive) + files,
// each previewable file carrying its inline URL. Client-safe.
export type ShareFileNode = {
  name: string;
  size: number | null;
  previewKind: SharePreviewKind;
  previewUrl: string | null;
  downloadUrl: string; // presigned attachment URL for this single file
};
export type ShareFolderNode = {
  id: string;
  name: string;
  folders: ShareFolderNode[];
  files: ShareFileNode[];
};

// Client-safe shape of one of the user's own links, as shown in "Linkurile
// mele". Defined here so client components can type the data without importing
// the server-only service.
export type MyShareLinkView = {
  id: string;
  token: string;
  url: string;
  kind: ShareLinkKind;
  name: string; // file/folder name, or "N elemente" for a bundle
  itemCount: number; // 1 for a single target, N for a bundle
  expiresAt: string | null;
  accessCount: number;
  createdAt: string;
};

// Fixed expiry choices offered in the share modal, plus "never".
export type ExpiryPreset = "1h" | "24h" | "7d" | "30d" | "never";

export const EXPIRY_PRESETS: {
  value: ExpiryPreset;
  label: string;
  ms: number | null; // null = never
}[] = [
  { value: "1h", label: "1 oră", ms: 60 * 60 * 1000 },
  { value: "24h", label: "24 de ore", ms: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "7 zile", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "30 de zile", ms: 30 * 24 * 60 * 60 * 1000 },
  { value: "never", label: "Niciodată", ms: null },
];

export const DEFAULT_EXPIRY: ExpiryPreset = "7d";

// Resolve a preset to an absolute expiry timestamp (ISO) relative to `nowMs`.
// The server always recomputes this against its own clock before persisting —
// never trust a client-supplied timestamp for security-sensitive expiry.
export function presetToExpiry(preset: ExpiryPreset, nowMs: number): string | null {
  const p = EXPIRY_PRESETS.find((e) => e.value === preset);
  if (!p || p.ms === null) return null;
  return new Date(nowMs + p.ms).toISOString();
}

// A link is dead once its expiry has passed. null expiry = never expires.
export function isExpired(expiresAt: string | null, nowMs: number): boolean {
  return expiresAt !== null && new Date(expiresAt).getTime() <= nowMs;
}

// The public, no-login path a token resolves to.
export function sharePath(token: string): string {
  return `/s/${token}`;
}

// What the public page can render inline (everything else = download-only card).
// Derived from the file extension: browser MIME sniffing is unreliable, and the
// same call must work on both server and client.
export type SharePreviewKind = "image" | "video" | "audio" | "pdf" | "text" | null;

const PREVIEW_EXT: Record<string, Exclude<SharePreviewKind, null>> = {
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image",
  avif: "image", bmp: "image", svg: "image", ico: "image",
  mp4: "video", webm: "video", mov: "video", m4v: "video", ogv: "video",
  mp3: "audio", wav: "audio", ogg: "audio", m4a: "audio", flac: "audio",
  pdf: "pdf",
  txt: "text", md: "text", csv: "text", log: "text", json: "text",
};

export function sharePreviewKind(name: string): SharePreviewKind {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return null;
  return PREVIEW_EXT[name.slice(dot + 1).toLowerCase()] ?? null;
}

// Human label for a link's remaining life, e.g. "expiră în 6 zile" / "expiră azi"
// / "niciodată". Kept here so the modal, the list and the public page all speak
// the same way. `nowMs` is passed in so callers control the clock.
export function expiryLabel(expiresAt: string | null, nowMs: number): string {
  if (expiresAt === null) return "Nu expiră";
  const diff = new Date(expiresAt).getTime() - nowMs;
  if (diff <= 0) return "Expirat";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `Expiră în ${mins} ${mins === 1 ? "minut" : "minute"}`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Expiră în ${hours} ${hours === 1 ? "oră" : "ore"}`;
  const days = Math.round(hours / 24);
  return `Expiră în ${days} ${days === 1 ? "zi" : "zile"}`;
}
