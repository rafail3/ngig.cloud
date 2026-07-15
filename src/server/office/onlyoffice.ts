import "server-only";
import { after } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveUser } from "@/server/auth/active-user";
import * as repo from "@/server/files/repository";
import { presignView, putObject } from "@/server/storage/b2";
import { logEvent } from "@/server/insights/engine";
import { appOrigin } from "@/lib/dashboard";
import { extensionOf } from "@/lib/file-type";
import { officeDocType, officeFileType } from "@/lib/office";

// Integration with a self-hosted OnlyOffice Document Server.
//
// How an edit flows:
//   1. the browser asks us for a config (buildEditorConfig) and hands it to the
//      Document Server's JS API;
//   2. the Document Server downloads the file itself, from the presigned B2 URL
//      in that config (server-to-server — it never goes through us);
//   3. when the last editor closes the tab, the Document Server POSTs the
//      finished file's URL to our callback, which stores it back in B2.
//
// Everything is signed with a shared secret both ends know: our config is only
// honoured if it carries a valid token, and the callback is only honoured if it
// does too — otherwise anyone who learned the URL could hand us a file.

const DS_URL = process.env.NEXT_PUBLIC_ONLYOFFICE_URL ?? "";
const SECRET = process.env.ONLYOFFICE_JWT_SECRET ?? "";

function secretKey(): Uint8Array {
  if (!SECRET) throw new Error("Editorul Office nu e configurat.");
  return new TextEncoder().encode(SECRET);
}

export function isOfficeEditingConfigured(): boolean {
  return Boolean(DS_URL && SECRET);
}

async function sign(payload: Record<string, unknown>, expires: string): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(secretKey());
}

// ── Opening ─────────────────────────────────────────────────────────────────
export type EditorConfig = {
  dsUrl: string;
  config: Record<string, unknown>;
};

export async function buildEditorConfig(fileId: string): Promise<EditorConfig> {
  if (!isOfficeEditingConfigured()) {
    throw new Error("Editorul Office nu e configurat.");
  }
  const { id: userId } = await requireActiveUser();

  // RLS-scoped read: a user can only ever open their own file.
  const file = await repo.getFileById(fileId);
  if (!file) throw new Error("Fișier inexistent.");

  const docType = officeDocType(file.name);
  if (!docType) throw new Error("Tipul acestui fișier nu se poate edita.");

  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();

  // Identifies this exact VERSION of the document. It must change whenever the
  // bytes do, or the Document Server serves everyone its cached copy and the
  // next edit is applied on top of stale content.
  const version = new Date(file.updated_at ?? file.created_at).getTime();
  const key = `${fileId}-${version}`;

  // Proves to our own callback which file is being saved, and for whom. The
  // callback has no session, so this token is the only authority it gets.
  const callbackToken = await sign({ fileId, ownerId: userId }, "24h");
  const callbackUrl = `${appOrigin()}/api/onlyoffice/callback?t=${encodeURIComponent(callbackToken)}`;

  const config: Record<string, unknown> = {
    documentType: docType,
    document: {
      fileType: officeFileType(file.name),
      key,
      title: file.name,
      url: await presignView(file.storage_key, 3600),
      permissions: { edit: true, download: true, print: true },
    },
    editorConfig: {
      callbackUrl,
      lang: "ro",
      user: { id: userId, name: profile?.username ?? "Utilizator" },
      customization: { autosave: true, forcesave: true, compactHeader: false },
    },
  };

  // The Document Server rejects a config whose token doesn't match its contents.
  const token = await sign(config, "12h");
  return { dsUrl: DS_URL, config: { ...config, token } };
}

// ── Saving ──────────────────────────────────────────────────────────────────
export async function verifyCallbackToken(
  token: string,
): Promise<{ fileId: string; ownerId: string }> {
  const { payload } = await jwtVerify(token, secretKey());
  return { fileId: payload.fileId as string, ownerId: payload.ownerId as string };
}

// The Document Server signs its own requests with the same secret. Without this
// check the callback would accept a file from anyone who guessed the URL.
export async function verifyDocumentServerToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secretKey());
    return true;
  } catch {
    return false;
  }
}

// Store the edited document back over the original. Runs without a session (the
// Document Server is the caller), so ownership comes from the signed callback
// token and is re-checked against the row before anything is written.
export async function saveEditedFile(input: {
  fileId: string;
  ownerId: string;
  bytes: Buffer;
}): Promise<void> {
  const admin = createAdminClient();
  const { data: file } = await admin
    .from("files")
    .select("id, name, owner_id, storage_key, mime_type")
    .eq("id", input.fileId)
    .maybeSingle();

  if (!file) throw new Error("Fișier inexistent.");
  if (file.owner_id !== input.ownerId) throw new Error("Fișier străin.");

  await putObject(
    file.storage_key as string,
    input.bytes,
    (file.mime_type as string) ?? "application/octet-stream",
  );

  await admin
    .from("files")
    .update({ size: input.bytes.byteLength, updated_at: new Date().toISOString() })
    .eq("id", input.fileId);

  after(() => logEvent("edit", { ext: extensionOf(file.name as string) }, input.ownerId));
}
