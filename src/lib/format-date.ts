// Always format in Romania time, regardless of where it runs (Vercel servers
// are UTC). Without an explicit timeZone, server-rendered dates show UTC.
const TZ = "Europe/Bucharest";

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    timeZone: TZ,
  });
}

// Time of day only — chat bubbles carry the hour; the day lives in the divider
// above the group (WhatsApp-style).
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

// Calendar day in Romania time as YYYY-MM-DD — the grouping key for chat
// dividers ("en-CA" renders exactly that shape).
export function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

// "Azi" / "Ieri" / "14 iulie 2026" — the chat day divider label.
export function formatDayLabel(iso: string): string {
  const key = dayKey(iso);
  const today = dayKey(new Date().toISOString());
  if (key === today) return "Azi";

  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === yesterday) return "Ieri";

  const d = new Date(iso);
  const sameYear =
    d.toLocaleDateString("en-CA", { timeZone: TZ, year: "numeric" }) ===
    new Date().toLocaleDateString("en-CA", { timeZone: TZ, year: "numeric" });
  return d.toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: TZ,
  });
}
