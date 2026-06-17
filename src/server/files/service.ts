import "server-only";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { requireActiveUser } from "@/server/auth/active-user";
import { getSettings } from "@/server/admin/settings";
import { platformUsage } from "@/server/admin/stats";
import * as repo from "./repository";
import {
  presignUpload,
  presignDownload,
  deleteObject,
  statObject,
  listKeys,
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

function minNonNull(a: number | null, b: number | null): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

// Enforce the effective limits for an upload of `size` bytes:
//  - per file:  smallest of the per-user override and the global cap
//  - per user:  per-user override, else the global default quota
//  - platform:  total bytes across everyone must stay under the global cap
async function enforceQuota(
  userId: string,
  size: number,
  userMaxFile: number | null,
  userMaxTotal: number | null,
): Promise<void> {
  const s = await getSettings();

  const perFile = minNonNull(userMaxFile, s.globalMaxFileSize);
  if (perFile != null && size > perFile) throw new Error("Fișier prea mare.");

  const quota = userMaxTotal ?? s.defaultUserQuota ?? null;
  if (quota != null) {
    const used = await repo.totalUsage(userId);
    if (used + size > quota) throw new Error("Spațiu insuficient.");
  }

  if (s.globalMaxTotal != null) {
    const platform = await platformUsage();
    if (platform + size > s.globalMaxTotal) {
      throw new Error("Spațiu insuficient pe platformă.");
    }
  }
}

export async function listMyFiles() {
  const userId = await requireUserId();
  const rows = await repo.listFiles();

  // Reconcile against B2: a file removed straight from the bucket leaves a
  // dangling DB row that would otherwise show as a phantom file. One ListObjects
  // call per user prunes those rows so the drive reflects what's actually stored.
  try {
    const existing = await listKeys(`${userId}/`);
    const missing = rows.filter((r) => !existing.has(r.storage_key));
    if (missing.length > 0) {
      await repo.deleteFileRowsByKeys(missing.map((r) => r.storage_key));
      return rows.filter((r) => existing.has(r.storage_key));
    }
  } catch {
    // B2 listing failed (transient) — fall back to the DB rows as-is.
  }

  return rows;
}

// Used by the drive page for the usage bar. quota null = unlimited.
export async function myUsage(): Promise<{ used: number; quota: number | null }> {
  const userId = await requireUserId();
  const used = await repo.totalUsage(userId);
  const { maxTotal } = await effectiveLimits(userId);
  const { defaultUserQuota } = await getSettings();
  return { used, quota: maxTotal ?? defaultUserQuota ?? null };
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

  await enforceQuota(userId, input.size, maxFile, maxTotal);

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

  try {
    await enforceQuota(userId, stat.size, maxFile, maxTotal);
  } catch (e) {
    await deleteObject(input.key); // roll back the orphaned object
    throw e;
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
  try {
    await deleteObject(file.storage_key);
  } catch {
    // Object may already be gone from B2 (e.g. deleted straight from the bucket)
    // or a transient B2 error — either way, remove the DB row so the drive stays
    // consistent and the user never sees a delete error.
  }
  await repo.deleteFileRow(id);
}
