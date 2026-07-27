import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

// Share-link passwords are hashed with scrypt (memory-hard KDF, built into
// Node — no extra dependency). Format: `scrypt$<saltHex>$<hashHex>`. The salt is
// per-link so identical passwords hash differently; verification is
// constant-time. This is independent of account passwords (handled by Supabase
// auth) — a share password only ever gates that one public link.

const KEYLEN = 64;

export async function hashSharePassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(
    password.normalize("NFKC"),
    salt,
    KEYLEN,
  )) as Buffer;
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifySharePassword(
  password: string,
  stored: string,
): Promise<boolean> {
  try {
    const [scheme, saltHex, hashHex] = stored.split("$");
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const derived = (await scryptAsync(
      password.normalize("NFKC"),
      salt,
      expected.length,
    )) as Buffer;
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

// Bounds enforced when a link is created.
export const SHARE_PASSWORD_MIN = 4;
export const SHARE_PASSWORD_MAX = 128;
