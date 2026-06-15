// Byte ↔ MB/GB helpers shared by the per-user and global limit forms.
export const MB = 1024 * 1024;
export const GB = 1024 * MB;

// Pick a readable unit for prefilling a form: GB for ≥1GB, else MB.
export function splitUnit(bytes: number | null): { value: string; unit: "MB" | "GB" } {
  if (bytes == null) return { value: "", unit: "GB" };
  if (bytes >= GB) return { value: String(Math.round((bytes / GB) * 100) / 100), unit: "GB" };
  return { value: String(Math.round((bytes / MB) * 100) / 100), unit: "MB" };
}

// Parse a form value + unit into bytes. "" → null (unlimited). Throws on junk.
export function toBytes(value: string, unit: string): number | null {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error("invalid");
  return Math.round(n * (unit === "MB" ? MB : GB));
}
