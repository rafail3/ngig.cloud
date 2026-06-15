import "server-only";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { requireActiveUser } from "@/server/auth/active-user";
import * as repo from "./repository";
import {
  presignUpload,
  presignDownload,
  deleteObject,
  statObject,
} from "@/server/storage/b2";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub as string | undefined;
  if (!id) throw new Error("Neautentificat.");
  return id;
}

// Effective upload limits for a user. null = unlimited.
// Per-user overrides live on the profile; if unset there's no cap yet
// (global platform limits arrive in a later phase).
async function effectiveLimits(
  userId: string,
): Promise<{ maxFile: number | null; maxTotal: number | null }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("max_file_size, max_total_size")
    .eq("id", userId)
    .single();
  return {
    maxFile: data?.max_file_size ?? null,
    maxTotal: data?.max_total_size ?? null,
  };
}

export async function listMyFiles() {
  await requireUserId();
  return repo.listFiles();
}

// Used by the drive page for the usage bar. quota null = unlimited.
export async function myUsage(): Promise<{ used: number; quota: number | null }> {
  const userId = await requireUserId();
  const used = await repo.totalUsage(userId);
  const { maxTotal } = await effectiveLimits(userId);
  return { used, quota: maxTotal };
}

// Step 1 of upload: validate + return a presigned PUT URL.
export async function createUpload(input: {
  name: string;
  size: number;
  contentType: string;
}) {
  // requireActiveUser re-checks block / forced sign-out and returns fresh limits.
  const { id: userId, maxFile, maxTotal } = await requireActiveUser();
  if (input.size <= 0) throw new Error("Fișier gol.");

  if (maxFile != null && input.size > maxFile) throw new Error("Fișier prea mare.");
  if (maxTotal != null) {
    const used = await repo.totalUsage(userId);
    if (used + input.size > maxTotal) throw new Error("Spațiu insuficient.");
  }

  const key = `${userId}/${randomUUID()}`;
  const url = await presignUpload(key, input.contentType);
  return { url, key };
}

// Step 2 of upload: after the browser PUTs to B2, persist metadata.
export async function confirmUpload(input: {
  name: string;
  size: number; // client-reported; NOT trusted — we read the real size from B2
  contentType: string;
  key: string;
}) {
  const { id: userId, maxFile, maxTotal } = await requireActiveUser();
  if (!input.key.startsWith(`${userId}/`)) throw new Error("Cheie invalidă.");

  // Trust B2, not the client. Reading the object's real size closes a quota
  // bypass (presign small, upload large, confirm small) and confirms it exists.
  const stat = await statObject(input.key);
  if (!stat) throw new Error("Fișierul nu a fost încărcat.");
  if (stat.size <= 0) {
    await deleteObject(input.key);
    throw new Error("Fișier gol.");
  }

  if (maxFile != null && stat.size > maxFile) {
    await deleteObject(input.key); // roll back the orphaned object
    throw new Error("Fișier prea mare.");
  }
  if (maxTotal != null) {
    const used = await repo.totalUsage(userId);
    if (used + stat.size > maxTotal) {
      await deleteObject(input.key);
      throw new Error("Spațiu insuficient.");
    }
  }

  return repo.insertFile({
    owner_id: userId,
    name: input.name,
    size: stat.size,
    mime_type: stat.contentType ?? input.contentType ?? null,
    storage_key: input.key,
  });
}

export async function getDownloadUrl(id: string) {
  const { id: userId } = await requireActiveUser();
  const file = await repo.getFileById(id); // RLS → only owner's rows
  if (!file) throw new Error("Fișier inexistent.");

  // Track the last time the user pulled a file (best-effort).
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ last_download_at: new Date().toISOString() })
    .eq("id", userId);

  return presignDownload(file.storage_key, file.name);
}

export async function deleteFile(id: string) {
  await requireActiveUser();
  const file = await repo.getFileById(id);
  if (!file) throw new Error("Fișier inexistent.");
  await deleteObject(file.storage_key);
  await repo.deleteFileRow(id);
}
