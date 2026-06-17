import "server-only";
import { randomUUID } from "crypto";
import { after } from "next/server";
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
  createMultipart,
  presignUploadPart,
  completeMultipart,
  abortMultipart,
} from "@/server/storage/b2";

// Files at or below this size upload in one PUT; larger ones upload as parts in
// parallel. 16 MB parts are well above B2's 5 MB minimum and keep the part count
// reasonable even for multi-GB files.
const MULTIPART_THRESHOLD = 16 * 1024 * 1024;
const PART_SIZE = 16 * 1024 * 1024;

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
  const needPlatform = s.globalMaxTotal != null;

  // Run the two independent usage reads in parallel (only when actually needed).
  const [used, platform] = await Promise.all([
    quota != null ? repo.totalUsage(userId) : Promise.resolve(0),
    needPlatform ? platformUsage() : Promise.resolve(0),
  ]);

  if (quota != null && used + size > quota) {
    throw new Error("Spațiu insuficient.");
  }
  if (needPlatform && platform + size > s.globalMaxTotal!) {
    throw new Error("Spațiu insuficient pe platformă.");
  }
}

export async function listMyFiles() {
  const userId = await requireUserId();
  const rows = await repo.listFiles();

  // Reconcile against B2 AFTER the response is sent, so the drive renders
  // immediately instead of waiting on a ListObjects round-trip. A file removed
  // straight from the bucket leaves a dangling DB row; pruning it post-response
  // means it disappears on the next load (eventually consistent, but fast).
  after(async () => {
    try {
      const existing = await listKeys(`${userId}/`);
      const missing = rows.filter((r) => !existing.has(r.storage_key));
      if (missing.length > 0) {
        await repo.deleteFileRowsByKeys(missing.map((r) => r.storage_key));
      }
    } catch {
      // B2 listing failed (transient) — skip this round of reconciliation.
    }
  });

  return rows;
}

// Quota for the drive's usage bar (null = unlimited). `used` is summed from the
// already-fetched file rows on the page, so this avoids a second DB scan.
export async function myQuota(): Promise<number | null> {
  const userId = await requireUserId();
  const { maxTotal } = await effectiveLimits(userId);
  const { defaultUserQuota } = await getSettings();
  return maxTotal ?? defaultUserQuota ?? null;
}

// An upload plan: a small file gets one presigned PUT; a large file gets a
// multipart upload with one presigned URL per part (uploaded in parallel).
export type UploadPlan =
  | { mode: "single"; key: string; url: string }
  | {
      mode: "multipart";
      key: string;
      uploadId: string;
      partSize: number;
      partUrls: string[];
    };

// Step 1 of upload: validate quota, then hand the client a plan to upload with.
export async function createUpload(input: {
  name: string;
  size: number;
  contentType: string;
}): Promise<UploadPlan> {
  // requireActiveUser re-checks block / forced sign-out and returns fresh limits.
  const { id: userId, maxFile, maxTotal } = await requireActiveUser();
  if (input.size <= 0) throw new Error("Fișier gol.");

  await enforceQuota(userId, input.size, maxFile, maxTotal);

  const key = `${userId}/${randomUUID()}`;

  if (input.size <= MULTIPART_THRESHOLD) {
    const url = await presignUpload(key, input.contentType);
    return { mode: "single", key, url };
  }

  // Large file: open a multipart upload and presign every part up front so the
  // browser can fire them in parallel without further round-trips.
  const uploadId = await createMultipart(key, input.contentType);
  const partCount = Math.ceil(input.size / PART_SIZE);
  const partUrls = await Promise.all(
    Array.from({ length: partCount }, (_, i) =>
      presignUploadPart(key, uploadId, i + 1),
    ),
  );
  return { mode: "multipart", key, uploadId, partSize: PART_SIZE, partUrls };
}

// Finish a multipart upload (after all parts are PUT). Completed server-side.
export async function completeUpload(input: {
  key: string;
  uploadId: string;
}): Promise<void> {
  const { id: userId } = await requireActiveUser();
  if (!input.key.startsWith(`${userId}/`)) throw new Error("Cheie invalidă.");
  await completeMultipart(input.key, input.uploadId);
}

// Cancel a multipart upload that failed mid-way, so no orphan parts linger.
export async function abortUpload(input: {
  key: string;
  uploadId: string;
}): Promise<void> {
  const { id: userId } = await requireActiveUser();
  if (!input.key.startsWith(`${userId}/`)) throw new Error("Cheie invalidă.");
  await abortMultipart(input.key, input.uploadId);
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
