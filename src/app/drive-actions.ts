"use server";

import * as files from "@/server/files/service";
import type { UploadPlan } from "@/server/files/service";
import { SESSION_REVOKED } from "@/server/auth/active-user";

// Thin server-action wrappers over the files service (the actual logic lives
// in src/server). Called imperatively from client components.
//
// If the user's session was revoked (blocked / signed out) the guard throws
// SESSION_REVOKED. We translate that into a { revoked: true } result so the
// client can navigate to /login — an imperative action can't redirect() cleanly.
// Any other error is re-thrown so the UI shows it (e.g. "Fișier prea mare").

export type Revoked = { revoked: true };

function isRevoked(e: unknown): boolean {
  return e instanceof Error && e.message === SESSION_REVOKED;
}

// Best-effort human message for an error of any shape (Supabase errors are plain
// objects with a `message`, not Error instances, so `e.message` alone misses them).
function errMsg(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string" &&
    (e as { message: string }).message
  ) {
    return (e as { message: string }).message;
  }
  return "Eroare.";
}

export async function createUploadAction(input: {
  name: string;
  size: number;
  contentType: string;
}): Promise<UploadPlan | Revoked> {
  try {
    return await files.createUpload(input);
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    throw e;
  }
}

export async function completeUploadAction(input: {
  key: string;
  uploadId: string;
}): Promise<Revoked | void> {
  try {
    await files.completeUpload(input);
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    throw e;
  }
}

export async function resumeUploadAction(input: {
  key: string;
  uploadId: string;
  size: number;
}): Promise<
  { partSize: number; partUrls: string[]; doneParts: number[] } | Revoked
> {
  try {
    return await files.resumeUpload(input);
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    throw e;
  }
}

export async function abortUploadAction(input: {
  key: string;
  uploadId: string;
}): Promise<void> {
  // Best-effort cleanup; ignore errors (the upload already failed).
  try {
    await files.abortUpload(input);
  } catch {
    // swallow
  }
}

export async function confirmUploadAction(input: {
  name: string;
  size: number;
  contentType: string;
  key: string;
  folderId: string | null;
}): Promise<Revoked | void> {
  try {
    await files.confirmUpload(input);
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    throw e;
  }
}

export async function createFolderAction(
  name: string,
  parentId: string | null,
): Promise<{ error?: string }> {
  try {
    await files.createFolder(name, parentId);
    return {};
  } catch (e) {
    if (isRevoked(e)) return { error: "Sesiune expirată." };
    return { error: e instanceof Error ? e.message : "Eroare." };
  }
}

// Find-or-create a folder; returns its id (used when uploading a folder tree).
export async function ensureFolderAction(
  name: string,
  parentId: string | null,
): Promise<{ id: string } | Revoked> {
  try {
    return { id: await files.ensureFolder(name, parentId) };
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    throw e;
  }
}

export async function deleteFolderAction(id: string): Promise<Revoked | void> {
  try {
    await files.deleteFolder(id);
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    throw e;
  }
}

export async function renameFolderAction(
  id: string,
  name: string,
): Promise<{ error?: string }> {
  try {
    await files.renameFolder(id, name);
    return {};
  } catch (e) {
    if (isRevoked(e)) return { error: "Sesiune expirată." };
    return { error: e instanceof Error ? e.message : "Eroare." };
  }
}

export async function moveFolderAction(
  id: string,
  newParentId: string | null,
): Promise<{ error?: string }> {
  try {
    await files.moveFolder(id, newParentId);
    return {};
  } catch (e) {
    if (isRevoked(e)) return { error: "Sesiune expirată." };
    return { error: errMsg(e) };
  }
}

export async function listAllFoldersAction(): Promise<
  { id: string; name: string; parent_id: string | null }[] | Revoked
> {
  try {
    const folders = await files.listAllFolders();
    return folders.map((f) => ({ id: f.id, name: f.name, parent_id: f.parent_id }));
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    throw e;
  }
}

export async function folderStatsAction(
  id: string,
): Promise<{ size: number; count: number } | Revoked> {
  try {
    return await files.folderStats(id);
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    throw e;
  }
}

export async function getViewUrlAction(
  id: string,
): Promise<{ url: string; name: string; mime: string | null } | Revoked> {
  try {
    return await files.getViewUrl(id);
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    throw e;
  }
}

export async function getTextPreviewAction(
  id: string,
): Promise<{ text: string } | Revoked> {
  try {
    return { text: await files.getTextPreview(id) };
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    throw e;
  }
}

export async function getDownloadUrlAction(id: string): Promise<string | Revoked> {
  try {
    return await files.getDownloadUrl(id);
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    throw e;
  }
}

export async function deleteFileAction(id: string): Promise<Revoked | void> {
  try {
    await files.deleteFile(id);
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    throw e;
  }
}

export async function renameFileAction(
  id: string,
  name: string,
): Promise<{ error?: string }> {
  try {
    await files.renameFile(id, name);
    return {};
  } catch (e) {
    if (isRevoked(e)) return { error: "Sesiune expirată." };
    return { error: errMsg(e) };
  }
}

export async function moveFileAction(
  id: string,
  folderId: string | null,
): Promise<{ error?: string }> {
  try {
    await files.moveFile(id, folderId);
    return {};
  } catch (e) {
    if (isRevoked(e)) return { error: "Sesiune expirată." };
    return { error: errMsg(e) };
  }
}

export async function copyFileAction(id: string): Promise<{ error?: string }> {
  try {
    await files.copyFile(id);
    return {};
  } catch (e) {
    if (isRevoked(e)) return { error: "Sesiune expirată." };
    return { error: errMsg(e) };
  }
}

export async function moveFileToTrashAction(
  id: string,
): Promise<Revoked | void> {
  try {
    await files.moveFileToTrash(id);
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    throw e;
  }
}
