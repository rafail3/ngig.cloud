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
import {
  isOfficeEditable,
  officeDocType,
  officeFileType,
  type OfficeMode,
  type OfficeTheme,
} from "@/lib/office";

// Integration with a self-hosted OnlyOffice Document Server, which serves both
// the previews and the editor — same config, different mode.
//
// How an edit flows:
//   1. the browser asks us for a config (buildEditorConfig) and hands it to the
//      Document Server's JS API;
//   2. the Document Server downloads the file itself, from the presigned B2 URL
//      in that config (server-to-server — it never goes through us);
//   3. when the last editor closes the tab, the Document Server POSTs the
//      finished file's URL to our callback, which stores it back in B2.
//
// A preview stops at step 2: it gets no callback URL and no write permission,
// so nothing can flow back.
//
// Everything is signed with a shared secret both ends know: our config is only
// honoured if it carries a valid token, and the callback is only honoured if it
// does too — otherwise anyone who learned the URL could hand us a file.

const DS_URL = process.env.NEXT_PUBLIC_ONLYOFFICE_URL ?? "";
const SECRET = process.env.ONLYOFFICE_JWT_SECRET ?? "";

// Where the Document Server should POST the finished file. Defaults to our own
// origin, which is right in production — but the Document Server has to REACH
// it, and in local dev it runs inside Docker, where "localhost" means the
// container itself, not the machine. Set this to
// http://host.docker.internal:3002 locally; leave it unset everywhere else.
const CALLBACK_ORIGIN = process.env.ONLYOFFICE_CALLBACK_ORIGIN || "";

function callbackOrigin(): string {
  return CALLBACK_ORIGIN.replace(/\/$/, "") || appOrigin();
}

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
export type { OfficeMode, OfficeTheme };

export type EditorConfig = {
  dsUrl: string;
  // The document's version key — needed to command a force-save on this session.
  key: string;
  config: Record<string, unknown>;
};

export async function buildEditorConfig(
  fileId: string,
  mode: OfficeMode = "edit",
  theme: OfficeTheme = "dark",
): Promise<EditorConfig> {
  if (!isOfficeEditingConfigured()) {
    throw new Error("Serverul de documente nu e configurat.");
  }
  const { id: userId } = await requireActiveUser();

  // RLS-scoped read: a user can only ever open their own file.
  const file = await repo.getFileById(fileId);
  if (!file) throw new Error("Fișier inexistent.");

  const docType = officeDocType(file.name);
  if (!docType) throw new Error("Tipul acestui fișier nu se poate deschide.");
  // Legacy .doc/.xls/.ppt render fine but must never be saved back — that would
  // mean converting the file to OOXML behind the user's back.
  if (mode === "edit" && !isOfficeEditable(file.name)) {
    throw new Error("Tipul acestui fișier nu se poate edita.");
  }

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

  // One token for both directions. Neither endpoint has a session — the caller
  // is the Document Server — so this is the only authority they get: it says
  // which file, whose, and whether this session may write. Long-lived enough to
  // outlast an editing session.
  const access = await sign({ fileId, ownerId: userId, mode }, "24h");
  const t = encodeURIComponent(access);
  // The document is served BY US, not straight from B2 — see the route for why.
  const documentUrl = `${callbackOrigin()}/api/office/file?t=${t}`;
  const editing = mode === "edit";

  const config: Record<string, unknown> = {
    documentType: docType,
    // "embedded" is the Document Server's minimal viewer: no toolbar tabs, no
    // title bar of its own, just the document — which is what lets our preview
    // modal keep a single header instead of stacking one on top of theirs.
    // (Hiding those in the full editor is a white-label licence feature; this
    // isn't.) Its own slim toolbar carries only page nav and zoom: the download
    // and share buttons appear solely if we hand it URLs for them, and we don't
    // — Descarcă lives in our header.
    ...(editing ? {} : { type: "embedded" }),
    document: {
      fileType: officeFileType(file.name),
      key,
      title: file.name,
      url: documentUrl,
      // In a preview `edit: false` is also what hides the Document Server's own
      // "Edit current file" button — with it on, that button appears and does
      // nothing unless we handle onRequestEditRights. Our own toolbar owns the
      // switch into editing.
      permissions: { edit: editing, download: editing, print: true },
    },
    editorConfig: {
      mode,
      // A preview gets no callback URL at all: with nowhere to post, the
      // Document Server cannot write anything back.
      ...(editing
        ? { callbackUrl: `${callbackOrigin()}/api/onlyoffice/callback?t=${t}` }
        : { embedded: { toolbarDocked: "bottom" } }),
      lang: "ro",
      user: { id: userId, name: profile?.username ?? "Utilizator" },
      customization: {
        compactHeader: false,
        // Column headers, row numbers and the bottom bar are the editor's own
        // chrome, so they only go dark if its theme does. Our app's theme is
        // what decides. NOTE: if a theme is ever picked from inside the editor's
        // own UI, the Document Server remembers that in the browser's local
        // storage and it wins over this value.
        uiTheme: theme === "dark" ? "theme-dark" : "theme-light",
        ...(editing ? { autosave: true, forcesave: true } : {}),
      },
    },
  };

  // The Document Server rejects a config whose token doesn't match its contents.
  const token = await sign(config, "12h");
  return { dsUrl: DS_URL, key, config: { ...config, token } };
}

// Tell the Document Server to flush the current session to us NOW. It answers
// the command, then posts the document to our callback (status 6) — which is
// what actually stores it. Used by the editor's Save button and before closing,
// so a user never has to trust autosave's timing.
export async function forceSave(key: string): Promise<void> {
  if (!isOfficeEditingConfigured()) throw new Error("Editorul Office nu e configurat.");

  const payload = { c: "forcesave", key };
  const token = await sign(payload, "5m");
  const res = await fetch(`${DS_URL.replace(/\/$/, "")}/coauthoring/CommandService.ashx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, token }),
  });
  const body = (await res.json()) as { error?: number };

  // 0 = saved, 4 = nothing had changed. Everything else is a real failure.
  if (body.error !== 0 && body.error !== 4) {
    throw new Error("Nu am putut salva documentul.");
  }
}

// ── Printing ────────────────────────────────────────────────────────────────
// The preview runs in an iframe on the Document Server's origin, so we cannot
// reach into it to call print() — the same-origin policy stops us, and the
// Document Server exposes no print method of its own. So we print what the
// browser can always print: a PDF. The Document Server converts it for us, from
// the same document it is already rendering, which also gives .doc/.xls/.ppt a
// print that no browser-side renderer could.
const CONVERT_TIMEOUT_MS = 25_000;
const CONVERT_POLL_MS = 700;

export async function convertToPdf(fileId: string): Promise<{ bytes: Buffer; name: string }> {
  if (!isOfficeEditingConfigured()) throw new Error("Serverul de documente nu e configurat.");
  const { id: ownerId } = await requireActiveUser();

  // RLS-scoped: converting is reading, and a user can only read their own file.
  const file = await repo.getFileById(fileId);
  if (!file) throw new Error("Fișier inexistent.");
  if (!officeDocType(file.name)) throw new Error("Tipul acestui fișier nu se poate printa.");

  const access = await sign({ fileId, ownerId, mode: "view" satisfies OfficeMode }, "5m");
  const version = new Date(file.updated_at ?? file.created_at).getTime();

  const payload = {
    async: false,
    filetype: officeFileType(file.name),
    outputtype: "pdf",
    // Same rule as the editor's key: tie it to the bytes, or the Document Server
    // hands back the PDF of a version the user has already edited past.
    key: `${fileId}-${version}-pdf`,
    title: file.name,
    url: `${callbackOrigin()}/api/office/file?t=${encodeURIComponent(access)}`,
  };
  const token = await sign(payload, "5m");

  const deadline = Date.now() + CONVERT_TIMEOUT_MS;
  for (;;) {
    const res = await fetch(`${DS_URL.replace(/\/$/, "")}/ConvertService.ashx`, {
      method: "POST",
      // Without this the Document Server answers in XML.
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ...payload, token }),
    });
    const body = (await res.json()) as {
      fileUrl?: string;
      endConvert?: boolean;
      error?: number;
    };
    if (body.error) throw new Error("Nu am putut pregăti documentul pentru printare.");
    if (body.endConvert && body.fileUrl) {
      const pdf = await fetch(body.fileUrl);
      if (!pdf.ok) throw new Error("Nu am putut pregăti documentul pentru printare.");
      return { bytes: Buffer.from(await pdf.arrayBuffer()), name: file.name };
    }
    // Long documents keep converting past the first answer: ask again until it's
    // done, rather than handing the user a half-made PDF.
    if (Date.now() > deadline) throw new Error("Documentul e prea mare pentru printare.");
    await new Promise((r) => setTimeout(r, CONVERT_POLL_MS));
  }
}

// ── Serving the document to the editor ──────────────────────────────────────
// Streams the file out of B2 for the Document Server. No session here either —
// the token minted at open time is what authorises this, and ownership is
// re-checked against the row before a single byte moves.
export async function openFileForEditor(token: string): Promise<{
  stream: ReadableStream<Uint8Array>;
  name: string;
  contentType: string;
  size: number | null;
}> {
  const { fileId, ownerId } = await verifyAccessToken(token);

  const admin = createAdminClient();
  const { data: file } = await admin
    .from("files")
    .select("name, owner_id, storage_key, mime_type, size")
    .eq("id", fileId)
    .maybeSingle();
  if (!file) throw new Error("Fișier inexistent.");
  if (file.owner_id !== ownerId) throw new Error("Fișier străin.");

  const res = await fetch(await presignView(file.storage_key as string, 600));
  if (!res.ok || !res.body) throw new Error("Nu am putut citi fișierul.");

  return {
    stream: res.body,
    name: file.name as string,
    contentType: (file.mime_type as string) ?? "application/octet-stream",
    size: (file.size as number) ?? null,
  };
}

// ── Saving ──────────────────────────────────────────────────────────────────
// The token we minted at open time, carried by both the document URL and the
// callback URL. `mode` is what keeps a preview a preview: a session opened for
// viewing must never be able to write, even if its URL leaks.
export async function verifyAccessToken(
  token: string,
): Promise<{ fileId: string; ownerId: string; mode: OfficeMode }> {
  const { payload } = await jwtVerify(token, secretKey());
  return {
    fileId: payload.fileId as string,
    ownerId: payload.ownerId as string,
    mode: payload.mode === "view" ? "view" : "edit",
  };
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
