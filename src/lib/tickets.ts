// Shared ticket vocabulary — used by both the server (service, emails) and the
// client (forms, badges). No "server-only" here so client components can import
// the labels.

export type TicketStatus = "open" | "closed";
export type TicketPriority = "low" | "medium" | "high";

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

// Attachment limits (support attachments are screenshots/docs, not huge files).
export const TICKET_MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB each
export const TICKET_MAX_ATTACHMENTS = 5;
export const TICKET_MAX_BODY = 5000;
export const TICKET_MAX_SUBJECT = 150;
