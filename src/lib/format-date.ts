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
