import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

// After a visitor enters the correct password for a protected link, we set a
// short-lived, path-scoped, HMAC-signed cookie. The download route (a plain GET
// that can't carry the password) checks it, so a password link's zip/file
// download stays gated by the password without ever putting the password in a
// URL. The signing key is the server-only Supabase secret (stable, never
// exposed to the client); the cookie itself is opaque and path-scoped to the
// single link, so it proves nothing about any other link.

const SECRET = process.env.SUPABASE_SECRET_KEY ?? "ngig-share-unlock-fallback";

export function unlockCookieName(token: string): string {
  return `su_${token}`;
}

export function unlockCookiePath(token: string): string {
  return `/s/${token}`;
}

export function unlockCookieValue(token: string): string {
  return createHmac("sha256", SECRET).update(`share-unlock:${token}`).digest("hex");
}

export function verifyUnlockValue(token: string, value: string | undefined): boolean {
  if (!value) return false;
  const expected = unlockCookieValue(token);
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
