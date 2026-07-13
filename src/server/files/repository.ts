import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type FileRow = {
  id: string;
  owner_id: string;
  name: string;
  size: number;
  mime_type: string | null;
  storage_key: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  archived_at: string | null;
};

export type FolderRow = {
  id: string;
  owner_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
};

// All queries run through the user-scoped Supabase client, so RLS enforces
// owner-only access at the data layer.

// Files directly inside a folder (null = root). Trashed files (deleted_at set)
// are hidden from normal listings.
export async function listFilesIn(folderId: string | null): Promise<FileRow[]> {
  const supabase = await createClient();
  const base = supabase
    .from("files")
    .select("*")
    .is("deleted_at", null)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  const { data, error } = await (folderId === null
    ? base.is("folder_id", null)
    : base.eq("folder_id", folderId));
  if (error) throw error;
  return (data ?? []) as FileRow[];
}

// Trashed files (deleted_at set), newest-trashed first — for the Trash view.
export async function listTrashedFiles(): Promise<FileRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FileRow[];
}

// Subfolders directly inside a folder (null = root).
export async function listFoldersIn(
  parentId: string | null,
): Promise<FolderRow[]> {
  const supabase = await createClient();
  const base = supabase.from("folders").select("*").order("name");
  const { data, error } = await (parentId === null
    ? base.is("parent_id", null)
    : base.eq("parent_id", parentId));
  if (error) throw error;
  return (data ?? []) as FolderRow[];
}

// Name search across ALL of the caller's files (RLS-scoped to the owner).
// Every token must appear in the name (AND). Trashed files are excluded and the
// result is capped so a broad query can't pull the whole drive.
export async function searchFiles(
  tokens: string[],
  limit: number,
): Promise<FileRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("files")
    .select("*")
    .is("deleted_at", null)
    .is("archived_at", null);
  for (const t of tokens) q = q.ilike("name", `%${t}%`);
  const { data, error } = await q
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as FileRow[];
}

// All of the caller's (non-trashed) files, newest first, capped. Used by the
// global view when only type/date/size filters are active (no name query), so
// the filters have the whole drive to narrow.
export async function listAllFiles(limit: number): Promise<FileRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .is("deleted_at", null)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as FileRow[];
}

// Most recently active files (uploaded or edited), newest first — for the
// home "suggested files" section. Excludes trashed and archived.
export async function listRecentFiles(limit: number): Promise<FileRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .is("deleted_at", null)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as FileRow[];
}

// Archived files (archived_at set, not trashed), newest-archived first.
export async function listArchivedFiles(): Promise<FileRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .is("deleted_at", null)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FileRow[];
}

// Name search across ALL of the caller's folders (RLS-scoped).
export async function searchFolders(
  tokens: string[],
  limit: number,
): Promise<FolderRow[]> {
  const supabase = await createClient();
  let q = supabase.from("folders").select("*");
  for (const t of tokens) q = q.ilike("name", `%${t}%`);
  const { data, error } = await q.order("name").limit(limit);
  if (error) throw error;
  return (data ?? []) as FolderRow[];
}

export async function getFolder(id: string): Promise<FolderRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("folders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as FolderRow) ?? null;
}

export async function findFolderByName(
  name: string,
  parentId: string | null,
): Promise<FolderRow | null> {
  const supabase = await createClient();
  const base = supabase.from("folders").select("*").eq("name", name);
  const { data } = await (parentId === null
    ? base.is("parent_id", null)
    : base.eq("parent_id", parentId)
  ).maybeSingle();
  return (data as FolderRow) ?? null;
}

export async function insertFolder(row: {
  owner_id: string;
  name: string;
  parent_id: string | null;
}): Promise<FolderRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("folders")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data as FolderRow;
}

export async function deleteFolderRow(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("folders").delete().eq("id", id);
  if (error) throw error;
}

export async function updateFolder(
  id: string,
  patch: { name?: string; parent_id?: string | null },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("folders").update(patch).eq("id", id);
  if (error) throw error;
}

// All of the caller's folders (for the move picker + path building).
export async function listAllFolders(): Promise<FolderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("folders").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as FolderRow[];
}

export async function listFilesInFolders(ids: string[]): Promise<FileRow[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .is("deleted_at", null)
    .in("folder_id", ids);
  if (error) throw error;
  return (data ?? []) as FileRow[];
}

// Storage keys of every file in a folder's subtree (security-definer RPC).
export async function descendantFileKeys(id: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("descendant_file_keys", { fid: id });
  if (error) throw error;
  return ((data ?? []) as { storage_key: string }[]).map((r) => r.storage_key);
}

export async function getFileById(id: string): Promise<FileRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("files").select("*").eq("id", id).maybeSingle();
  return (data as FileRow) ?? null;
}

export async function insertFile(row: {
  owner_id: string;
  name: string;
  size: number;
  mime_type: string | null;
  storage_key: string;
  folder_id: string | null;
}): Promise<FileRow> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("files").insert(row).select().single();
  if (error) throw error;
  return data as FileRow;
}

export async function updateFile(
  id: string,
  patch: {
    name?: string;
    folder_id?: string | null;
    deleted_at?: string | null;
    archived_at?: string | null;
    size?: number;
    updated_at?: string;
  },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("files").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteFileRow(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("files").delete().eq("id", id);
  if (error) throw error;
}

// Prune rows by storage key (RLS keeps it to the caller's own files). Used to
// drop DB rows whose backing object no longer exists in B2.
export async function deleteFileRowsByKeys(keys: string[]) {
  if (keys.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("files").delete().in("storage_key", keys);
  if (error) throw error;
}

// --- Admin-client variants for reconciliation (used in `after()` where the
// cookie-based user client isn't reliable). Storage keys are owner-prefixed, so
// operating by key stays scoped to one user. ---

export async function adminListUserFileKeys(ownerId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("files")
    .select("storage_key")
    .eq("owner_id", ownerId);
  if (error) throw error;
  return (data ?? []).map((r) => r.storage_key as string);
}

// Scoped to the owner on purpose: the service-role client bypasses RLS, so we
// constrain the delete to the given owner's rows. A wrong key can never prune
// another user's file.
export async function adminDeleteFilesByKeys(ownerId: string, keys: string[]) {
  if (keys.length === 0) return;
  const admin = createAdminClient();
  const { error } = await admin
    .from("files")
    .delete()
    .eq("owner_id", ownerId)
    .in("storage_key", keys);
  if (error) throw error;
}

// Trashed files past the retention cutoff, across ALL users — for the cron
// purge, which has no user session (service-role client, RLS bypassed).
export async function adminListExpiredTrash(
  cutoffIso: string,
): Promise<{ id: string; storage_key: string }[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("files")
    .select("id, storage_key")
    .not("deleted_at", "is", null)
    .lt("deleted_at", cutoffIso);
  if (error) throw error;
  return (data ?? []) as { id: string; storage_key: string }[];
}

// Delete file rows by id with the service-role client (used by the cron purge,
// after their B2 objects are removed).
export async function adminDeleteFileRowsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const admin = createAdminClient();
  const { error } = await admin.from("files").delete().in("id", ids);
  if (error) throw error;
}

export async function totalUsage(ownerId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("files").select("size").eq("owner_id", ownerId);
  return (data ?? []).reduce((sum, r) => sum + Number(r.size), 0);
}
