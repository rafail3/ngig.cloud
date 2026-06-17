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
}): Promise<Revoked | void> {
  try {
    await files.confirmUpload(input);
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
