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

const SECRET = process.env.ONLYOFFICE_JWT_SECRET ?? "";

// ── Where the Document Server lives ─────────────────────────────────────────
// A runtime setting, not a build-time env var. The server may sit behind a
// tunnel whose URL changes every time the host reboots, and baking it into the
// build would mean a redeploy each time. Stored in app_settings, editable from
// the dashboard (and writable by the host itself — see /api/office/register).
//
// Falls back to the env var when no row is set, so local dev keeps working from
// .env.local with nothing in the database.
const URL_KEY = "office_server_url";
const URL_TTL_MS = 5_000;
let urlCache: { at: number; url: string } | null = null;

export async function getOfficeServerUrl(): Promise<string> {
  const now = Date.now();
  if (urlCache && now - urlCache.at < URL_TTL_MS) return urlCache.url;

  let url = "";
  try {
    const { data } = await createAdminClient()
      .from("app_settings")
      .select("value")
      .eq("key", URL_KEY)
      .maybeSingle();
    if (typeof data?.value === "string") url = data.value;
  } catch {
    // Fall through to the env var rather than taking the editor down.
  }
  url = (url || process.env.NEXT_PUBLIC_ONLYOFFICE_URL || "").trim().replace(/\/$/, "");
  urlCache = { at: now, url };
  return url;
}

export async function setOfficeServerUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/$/, "");
  await createAdminClient()
    .from("app_settings")
    .upsert({ key: URL_KEY, value: clean, updated_at: new Date().toISOString() });
  urlCache = null; // next read picks it up immediately
}

export async function isOfficeEditingConfigured(): Promise<boolean> {
  return Boolean((await getOfficeServerUrl()) && SECRET);
}

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

// ── Health ───────────────────────────────────────────────────────────────────
// The Document Server may run on a machine that isn't always on. This asks it
// whether it's alive, cached briefly so a room full of users polling the drive
// can't turn into a flood of health checks — the answer only needs to be a few
// seconds fresh.
const HEALTH_TTL_MS = 10_000;
const HEALTH_TIMEOUT_MS = 3_000;
let healthCache: { at: number; up: boolean } | null = null;

export async function isDocumentServerUp(): Promise<boolean> {
  const base = await getOfficeServerUrl();
  if (!base) return false;
  const now = Date.now();
  if (healthCache && now - healthCache.at < HEALTH_TTL_MS) return healthCache.up;

  let up = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    // The Document Server's own liveness endpoint; it answers the string "true".
    const res = await fetch(`${base}/healthcheck`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    up = res.ok && (await res.text()).trim() === "true";
  } catch {
    up = false;
  }

  healthCache = { at: now, up };
  return up;
}

// A single fresh probe for the admin status panel: no cache, and it measures how
// long the server took to answer. This is what powers the live latency graph, so
// each poll must actually hit the wire.
export type OfficeProbe = {
  up: boolean;
  /** Round-trip time in ms, or null if it never answered. */
  latencyMs: number | null;
  timedOut: boolean;
};

export async function probeDocumentServer(): Promise<OfficeProbe> {
  const base = await getOfficeServerUrl();
  if (!base) return { up: false, latencyMs: null, timedOut: false };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(`${base}/healthcheck`, {
      signal: controller.signal,
      cache: "no-store",
    });
    const latencyMs = Date.now() - started;
    const up = res.ok && (await res.text()).trim() === "true";
    return { up, latencyMs, timedOut: false };
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === "AbortError";
    return { up: false, latencyMs: null, timedOut };
  } finally {
    clearTimeout(timer);
  }
}

// The version the container is ACTUALLY running, asked of the server itself (not
// the tag we think we deployed). Rarely changes, so it's cached for a minute.
const VERSION_TTL_MS = 60_000;
let versionCache: { at: number; version: string | null } | null = null;

export async function getDocumentServerVersion(): Promise<string | null> {
  if (!(await isOfficeEditingConfigured())) return null;
  const now = Date.now();
  if (versionCache && now - versionCache.at < VERSION_TTL_MS) return versionCache.version;

  let version: string | null = null;
  try {
    const token = await sign({ c: "version" }, "1m");
    const res = await fetch(`${await getOfficeServerUrl()}/coauthoring/CommandService.ashx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ c: "version", token }),
    });
    const body = (await res.json()) as { error?: number; version?: string };
    if (body.error === 0 && typeof body.version === "string") version = body.version;
  } catch {
    version = null;
  }

  versionCache = { at: now, version };
  return version;
}

// Static-ish facts about the deployed server, for the status panel. The image
// and container name reflect what we run; the host isn't queryable for them.
export async function officeServerInfo(): Promise<{
  name: string;
  url: string;
  image: string;
  container: string;
}> {
  return {
    name: process.env.OFFICE_SERVER_NAME || "OnlyOffice Document Server",
    url: await getOfficeServerUrl(),
    image: "onlyoffice/documentserver",
    container: process.env.OFFICE_CONTAINER_NAME || "onlyoffice",
  };
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
  const base = await getOfficeServerUrl();
  if (!base || !SECRET) {
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
        : {}),
      lang: "ro",
      user: { id: userId, name: profile?.username ?? "Utilizator" },
      customization: {
        compactHeader: false,
        // Column headers, row numbers and the sheet bar are the editor's own
        // chrome, so they only go dark if its theme does. Our app's theme is
        // what decides.
        //
        // This is also why a preview runs the full editor in view mode rather
        // than the Document Server's "embedded" viewer, which would spare us its
        // toolbar: `uiTheme` reaches the frame as a `uitheme` URL parameter, and
        // nothing under web-apps/apps/*/embed/ so much as mentions it — that
        // viewer has no themes at all and is always light. Hiding the toolbar in
        // this one instead is gated on a white-label licence (LayoutManager is
        // handed `canBrandingExt`), so: their toolbar, in the right theme.
        //
        // NOTE: a theme picked from inside the editor's own UI is remembered in
        // the browser's local storage, and it wins over this value.
        uiTheme: theme === "dark" ? "theme-dark" : "theme-light",
        // Our modal header already says which file this is.
        toolbarHideFileName: true,
        ...(editing ? { autosave: true, forcesave: true } : { hideRightMenu: true }),
      },
    },
  };

  // The Document Server rejects a config whose token doesn't match its contents.
  const token = await sign(config, "12h");
  return { dsUrl: base, key, config: { ...config, token } };
}

// Tell the Document Server to flush the current session to us NOW. It answers
// the command, then posts the document to our callback (status 6) — which is
// what actually stores it. Used by the editor's Save button and before closing,
// so a user never has to trust autosave's timing.
export async function forceSave(key: string): Promise<void> {
  if (!(await isOfficeEditingConfigured())) throw new Error("Editorul Office nu e configurat.");

  const payload = { c: "forcesave", key };
  const token = await sign(payload, "5m");
  const res = await fetch(`${await getOfficeServerUrl()}/coauthoring/CommandService.ashx`, {
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
  const base = await getOfficeServerUrl();
  if (!base || !SECRET) throw new Error("Serverul de documente nu e configurat.");
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
    const res = await fetch(`${base}/ConvertService.ashx`, {
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
