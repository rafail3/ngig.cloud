// Shared ticket vocabulary — used by both the server (service, emails) and the
// client (forms, badges). No "server-only" here so client components can import
// the labels.

export type TicketStatus = "open" | "closed";
export type TicketPriority = "low" | "medium" | "high";

// One attachment already uploaded to B2 (via a presigned PUT), passed from the
// client into the create/reply actions. Lives here (not in the server-only
// service) so client upload helpers can import the type.
export type IncomingAttachment = {
  key: string;
  name: string;
  size: number;
  mimeType: string | null;
};

// A broad set of support categories so tickets triage themselves.
export const TICKET_CATEGORIES = [
  { key: "account", label: "Cont și autentificare" },
  { key: "storage", label: "Stocare și fișiere" },
  { key: "sharing", label: "Partajare și linkuri" },
  { key: "billing", label: "Facturare și abonament" },
  { key: "performance", label: "Performanță și erori" },
  { key: "security", label: "Securitate și confidențialitate" },
  { key: "feature", label: "Cerere funcționalitate" },
  { key: "bug", label: "Raportare bug" },
  { key: "feedback", label: "Feedback și sugestii" },
  { key: "other", label: "Altele" },
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number]["key"];

export const TICKET_PRIORITIES: { key: TicketPriority; label: string }[] = [
  { key: "low", label: "Scăzută" },
  { key: "medium", label: "Medie" },
  { key: "high", label: "Mare" },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  TICKET_CATEGORIES.map((c) => [c.key, c.label]),
);
const PRIORITY_LABEL: Record<string, string> = Object.fromEntries(
  TICKET_PRIORITIES.map((p) => [p.key, p.label]),
);

export function categoryLabel(key: string): string {
  return CATEGORY_LABEL[key] ?? key;
}

export function priorityLabel(key: string): string {
  return PRIORITY_LABEL[key] ?? key;
}

export function statusLabel(status: string): string {
  return status === "closed" ? "Închis" : "Deschis";
}

export function isTicketCategory(v: string): v is TicketCategory {
  return v in CATEGORY_LABEL;
}

export function isTicketPriority(v: string): v is TicketPriority {
  return v === "low" || v === "medium" || v === "high";
}

// Attachments are images and videos only — a screenshot or a short screen
// recording of the problem. Caps are per kind: a support screenshot is a few MB,
// a 1-minute 1080p recording is ~20–60 MB, so 100 MB leaves room without letting
// anyone park a movie in the support bucket.
export const TICKET_MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB
export const TICKET_MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
export const TICKET_MAX_ATTACHMENTS = 5;
export const TICKET_MAX_BODY = 5000;
export const TICKET_MAX_SUBJECT = 150;

// What the file picker offers and the server enforces.
export const TICKET_ACCEPT = "image/*,video/*";

export type AttachmentKind = "image" | "video";

export function attachmentKind(mime: string | null): AttachmentKind | null {
  if (!mime) return null;
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return null;
}

// Validate one picked file. Returns an error message, or null when it's fine.
export function checkAttachment(file: { name: string; size: number; type: string }): string | null {
  const kind = attachmentKind(file.type);
  if (!kind) return `„${file.name}” nu e imagine sau video.`;
  const max = kind === "image" ? TICKET_MAX_IMAGE_BYTES : TICKET_MAX_VIDEO_BYTES;
  if (file.size > max) {
    const mb = Math.round(max / (1024 * 1024));
    return `„${file.name}” depășește ${mb} MB.`;
  }
  return null;
}
