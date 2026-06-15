// Client-safe helpers for user status (no server-only imports).

// "Online" = active within the last 5 minutes (last_seen_at heartbeat).
export function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60_000;
}

// Blocked = a ban that hasn't elapsed yet.
export function isBlocked(bannedUntil: string | null): boolean {
  if (!bannedUntil) return false;
  return new Date(bannedUntil) > new Date();
}

// Permanent block = end date is far in the future (~100y sentinel).
export function isPermanentBlock(blockedUntil: string | null): boolean {
  if (!blockedUntil) return false;
  return new Date(blockedUntil).getFullYear() - new Date().getFullYear() > 50;
}

// Result state for user-management form actions.
export type UserActionState = { error?: string; ok?: string };
