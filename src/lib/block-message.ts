// Human-readable block message for the login screen. Permanent blocks (~100y)
// are shown as such instead of a far-future date.
export function blockMessage(blockedUntil: string): string {
  const d = new Date(blockedUntil);
  const permanent = d.getFullYear() - new Date().getFullYear() > 50;
  if (permanent) return "Cont blocat permanent. Contactează administratorul.";
  const when = d.toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Cont blocat până la ${when}.`;
}
