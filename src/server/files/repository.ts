import "server-only";
import { createClient } from "@/lib/supabase/server";

export type FileRow = {
  id: string;
  owner_id: string;
  name: string;
  size: number;
  mime_type: string | null;
  storage_key: string;
  created_at: string;
};

// All queries run through the user-scoped Supabase client, so RLS enforces
// owner-only access at the data layer.

export async function listFiles(): Promise<FileRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FileRow[];
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
}): Promise<FileRow> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("files").insert(row).select().single();
  if (error) throw error;
  return data as FileRow;
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

export async function totalUsage(ownerId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("files").select("size").eq("owner_id", ownerId);
  return (data ?? []).reduce((sum, r) => sum + Number(r.size), 0);
}
