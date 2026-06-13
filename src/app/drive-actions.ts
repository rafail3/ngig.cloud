"use server";

import * as files from "@/server/files/service";

// Thin server-action wrappers over the files service (the actual logic lives
// in src/server). Called from client components.

export async function createUploadAction(input: {
  name: string;
  size: number;
  contentType: string;
}) {
  return files.createUpload(input);
}

export async function confirmUploadAction(input: {
  name: string;
  size: number;
  contentType: string;
  key: string;
}) {
  await files.confirmUpload(input);
}

export async function getDownloadUrlAction(id: string) {
  return files.getDownloadUrl(id);
}

export async function deleteFileAction(id: string) {
  await files.deleteFile(id);
}
