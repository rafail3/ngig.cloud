"use server";

import { listDirectoryUsers, getPublicProfile } from "@/server/users/service";
import type { Revoked } from "@/app/drive-actions";
import type { DirectoryUser, PublicProfile } from "@/lib/users";
import { SESSION_REVOKED } from "@/server/auth/active-user";

// Thin server-action wrappers over the user-directory service, matching
// drive-actions.ts's isRevoked/errMsg pattern (the session guard lives in
// requireActiveUser inside the service).

function isRevoked(e: unknown): boolean {
  return e instanceof Error && e.message === SESSION_REVOKED;
}

export async function listDirectoryUsersAction(input: {
  query?: string;
  page?: number;
}): Promise<{ users: DirectoryUser[]; hasMore: boolean } | Revoked> {
  try {
    return await listDirectoryUsers(input);
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    throw e;
  }
}

export async function getPublicProfileAction(
  userId: string,
): Promise<{ profile: PublicProfile | null } | Revoked> {
  try {
    return { profile: await getPublicProfile(userId) };
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    throw e;
  }
}
