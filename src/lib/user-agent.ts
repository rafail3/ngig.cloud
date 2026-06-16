// Best-effort, pure user-agent parsing. Not exhaustive.

export function deviceBrowser(ua: string | null): string {
  if (!ua) return "Browser necunoscut";
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return "Opera";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Browser necunoscut";
}

export function deviceOS(ua: string | null): string {
  if (!ua) return "OS necunoscut";
  if (/Windows/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "OS necunoscut";
}

export type DeviceType = "Desktop" | "Mobil" | "Tabletă";

export function deviceType(ua: string | null): DeviceType {
  if (!ua) return "Desktop";
  if (/iPad|Tablet/i.test(ua)) return "Tabletă";
  if (/Mobile|Android|iPhone|iPod/i.test(ua)) return "Mobil";
  return "Desktop";
}

// "Chrome · Windows"
export function deviceLabel(ua: string | null): string {
  return `${deviceBrowser(ua)} · ${deviceOS(ua)}`;
}
