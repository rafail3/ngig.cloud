import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireActiveUser } from "@/server/auth/active-user";
import {
  DIRECTORY_PAGE_SIZE,
  type DirectoryUser,
  type PublicProfile,
} from "@/lib/users";

// ---------------------------------------------------------------------------
// User directory ("Utilizatori").
//
// SECURITY MODEL
//  - profiles RLS is self-or-admin-only, so a normal session cannot read
//    another user's row. Both reads here go through SECURITY DEFINER RPCs
//    (`directory_users` / `public_profile`, see
//    20260727150000_user_directory.sql) which expose exactly username +
//    created_at — never email, never `role`.
//  - The RPCs run on the caller's OWN session, so `auth.uid()` inside them is
//    the real caller: they exclude the caller from listings and scope the
//    shared-transfer count to the caller's own relationships. There is no
//    service-role client anywhere in this file, and there must not be — a
//    service-role read would drop that scoping.
//  - Paging bounds are clamped inside the RPC, not here, so a hostile client
//    calling the action directly still can't ask for the whole table.
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DirectoryRow = { id: string; username: string; created_at: string };

// One page of the directory. An empty query lists everyone alphabetically.
export async function listDirectoryUsers(input: {
  query?: string;
  page?: number;
}): Promise<{ users: DirectoryUser[]; hasMore: boolean }> {
  await requireActiveUser();
  const q = (input.query ?? "").trim();
  const page = Math.max(0, Math.floor(input.page ?? 0));

  const supabase = await createClient();
  // Ask for one extra row: its presence is what tells us another page exists,
  // without a second count query.
  const { data, error } = await supabase.rpc("directory_users", {
    q,
    lim: DIRECTORY_PAGE_SIZE + 1,
    off: page * DIRECTORY_PAGE_SIZE,
  });
  if (error) throw error;

  const rows = (data ?? []) as DirectoryRow[];
  const hasMore = rows.length > DIRECTORY_PAGE_SIZE;
  return {
    users: rows.slice(0, DIRECTORY_PAGE_SIZE).map((r) => ({
      id: r.id,
      username: r.username,
      createdAt: r.created_at,
    })),
    hasMore,
  };
}

// A single user's public profile. Returns null for an unknown id rather than
// throwing — a stale link should render an empty state, not an error.
export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  await requireActiveUser();
  if (typeof userId !== "string" || !UUID_RE.test(userId)) {
    throw new Error("Utilizator invalid.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_profile", { target_id: userId });
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as
    | (DirectoryRow & { shared_transfers: number })
    | undefined;
  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    createdAt: row.created_at,
    sharedTransfers: Number(row.shared_transfers ?? 0),
  };
}
