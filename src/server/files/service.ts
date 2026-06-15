import "server-only";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import * as repo from "./repository";
import {
  presignUpload,
  presignDownload,
  deleteObject,
  statObject,
} from "@/server/storage/b2";

// Per-file and per-user limits (tune later / make per-role).
export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
export const USER_QUOTA = 5 * 1024 * 1024 * 1024; // 5 GB

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub as string | undefined;
  if (!id) throw new Error("Neautentificat.");
  return id;
}

export async function listMyFiles() {
  await requireUserId();
  return repo.listFiles();
}

export async function usage() {
  const userId = await requireUserId();
  return { used: await repo.totalUsage(userId), quota: USER_QUOTA };
}

// Step 1 of upload: validate + return a presigned PUT URL.
export async function createUpload(input: {
  name: string;
  size: number;
  contentType: string;
}) {
  const userId = await requireUserId();
  if (input.size <= 0) throw new Error("Fișier gol.");
  if (input.size > MAX_FILE_SIZE) throw new Error("Fișier prea mare.");

  const used = await repo.totalUsage(userId);
  if (used + input.size > USER_QUOTA) throw new Error("Spațiu insuficient.");

  const key = `${userId}/${randomUUID()}`;
  const url = await presignUpload(key, input.contentType);
  return { url, key };
}

// Step 2 of upload: after the browser PUTs to R2, persist metadata.
export async function confirmUpload(input: {
  name: string;
  size: number; // client-reported; NOT trusted — we read the real size from B2
  contentType: string;
  key: string;
}) {
  const userId = await requireUserId();
  if (!input.key.startsWith(`${userId}/`)) throw new Error("Cheie invalidă.");

  // Trust B2, not the client. Reading the object's real size closes a quota
  // bypass (presign small, upload large, confirm small) and confirms it exists.
  const stat = await statObject(input.key);
  if (!stat) throw new Error("Fișierul nu a fost încărcat.");
  if (stat.size <= 0) {
    await deleteObject(input.key);
    throw new Error("Fișier gol.");
  }
  if (stat.size > MAX_FILE_SIZE) {
    await deleteObject(input.key); // roll back the orphaned object
    throw new Error("Fișier prea mare.");
  }

  // Re-check quota against the real uploaded size (this key isn't stored yet).
  const used = await repo.totalUsage(userId);
  if (used + stat.size > USER_QUOTA) {
    await deleteObject(input.key);
    throw new Error("Spațiu insuficient.");
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
  await requireUserId();
  const file = await repo.getFileById(id); // RLS → only owner's rows
  if (!file) throw new Error("Fișier inexistent.");
  return presignDownload(file.storage_key, file.name);
}

export async function deleteFile(id: string) {
  await requireUserId();
  const file = await repo.getFileById(id);
  if (!file) throw new Error("Fișier inexistent.");
  await deleteObject(file.storage_key);
  await repo.deleteFileRow(id);
}
