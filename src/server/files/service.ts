import "server-only";
import { randomUUID } from "crypto";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireActiveUser } from "@/server/auth/active-user";
import { getSettings, getUploadTypes } from "@/server/admin/settings";
import { platformUsage } from "@/server/admin/stats";
import { notifyUserEvent, notifyAdminsEvent } from "@/server/notifications/service";
import { logEvent } from "@/server/insights/engine";
import { logEgress } from "@/server/billing/egress";
import * as repo from "./repository";
import { extensionOf } from "@/lib/file-type";
import { fileTypeDenied } from "@/lib/upload-types";
import { checkStorageAlert } from "@/server/account/storage-alert";
import { formatBytes } from "@/lib/format";
import {
  presignUpload,
  presignDownload,
  presignView,
  copyObject,
  deleteObject,
  putObject,
  statObject,
  listKeys,
  cleanupPrefix,
  createMultipart,
  presignUploadPart,
  completeMultipart,
  abortMultipart,
  listUploadedParts,
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reject anything that isn't a real uuid before it reaches the DB, so a bad id
// surfaces as a clear message instead of a raw Postgres "invalid input syntax
// for type uuid" error.
function assertId(id: string, label: string): void {
  if (typeof id !== "string" || !UUID_RE.test(id)) throw new Error(label);
}

// Defense in depth for per-user storage isolation. Object keys are always
// `${ownerId}/<uuid>` and DB rows are already RLS-scoped to the owner, so a
// fetched row's key belongs to the caller. This guard makes that a hard
// invariant right before we touch B2: even if RLS were ever misconfigured or a
// row carried a corrupt/legacy key, we refuse to read, copy or delete any
// object outside the caller's own `${userId}/` prefix. No cross-user access,
// no wrong-file delete — regardless of how many users share a filename.
function assertOwnedKey(userId: string, key: string): void {
  if (typeof key !== "string" || !key.startsWith(`${userId}/`)) {
    throw new Error("Acces interzis la acest fișier.");
  }
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
  if (perFile != null && size > perFile) {
    await notifyUserEvent(userId, "quota_file", { limita: formatBytes(perFile) }, "/");
    throw new Error("Fișier prea mare.");
  }

  // Total quota: the admin's (per-user, else the global default) always wins;
  // only without one does the user's own self-set cap apply.
  const adminQuota = userMaxTotal ?? s.defaultUserQuota ?? null;
  let quota = adminQuota;
  let selfQuota = false;
  if (quota == null) {
    const supabase = await createClient();
    const { data: pref } = await supabase
      .from("profiles")
      .select("self_max_total_size")
      .eq("id", userId)
      .single();
    if (pref?.self_max_total_size != null) {
      quota = pref.self_max_total_size;
      selfQuota = true;
    }
  }
  const needPlatform = s.globalMaxTotal != null;

  // Run the two independent usage reads in parallel (only when actually needed).
  const [used, platform] = await Promise.all([
    quota != null ? repo.totalUsage(userId) : Promise.resolve(0),
    needPlatform ? platformUsage() : Promise.resolve(0),
  ]);

  if (quota != null && used + size > quota) {
    if (selfQuota) {
      // The user's own budget — their business alone, no admin flag. The bell
      // gets a note too, mirroring the admin-quota rejection.
      await notifyUserEvent(userId, "self_quota", { limita: formatBytes(quota) }, "/profil");
      throw new Error(
        `Ai atins plafonul de stocare pe care ți l-ai setat singur (${formatBytes(quota)}). Îl poți schimba din profil.`,
      );
    }
    // Tell the user, and flag the admins that someone hit their storage ceiling.
    await notifyUserEvent(userId, "quota_user", { limita: formatBytes(quota) }, "/");
    await notifyAdminsQuota(userId, quota);
    throw new Error("Spațiu insuficient.");
  }
  if (needPlatform && platform + size > s.globalMaxTotal!) {
    await notifyUserEvent(userId, "quota_platform", {}, "/");
    await notifyAdminsEvent("platform_full", {}, "/users");
    throw new Error("Spațiu insuficient pe platformă.");
  }
}

// Flag the admins that a user hit their storage ceiling, naming the user.
async function notifyAdminsQuota(userId: string, quota: number): Promise<void> {
  let username: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single();
    username = (data?.username as string | null) ?? null;
  } catch {
    // best-effort — fall back to a generic label below
  }
  await notifyAdminsEvent(
    "user_quota",
    { utilizator: username ?? "Un utilizator", limita: formatBytes(quota) },
    "/users",
  );
}

export type Crumb = { id: string; name: string };

// Ancestor chain root→current, for the breadcrumb.
async function breadcrumb(folderId: string | null): Promise<Crumb[]> {
  const crumbs: Crumb[] = [];
  let id = folderId;
  // Bounded walk up the tree (guard against cycles / very deep nesting).
  for (let i = 0; id && i < 64; i++) {
    const f = await repo.getFolder(id);
    if (!f) break;
    crumbs.unshift({ id: f.id, name: f.name });
    id = f.parent_id;
  }
  return crumbs;
}

// Contents of a folder (null = root): subfolders + files, plus the breadcrumb.
// Files missing from B2 are hidden on this same load; pruning + the orphan
// sweep run after the response so they never block the render.
export async function listFolder(folderId: string | null) {
  const userId = await requireUserId();
  const prefix = `${userId}/`;

  // Only the two indexed DB queries block the response. The B2 consistency
  // check (listKeys over ALL the user's objects — an external call that used to
  // add its full latency to EVERY folder navigation) now runs entirely in the
  // background below. Worst case a rare phantom row (B2 object gone, DB row
  // left) is visible for a few seconds until the prune + the next SWR refresh
  // drop it — the same degraded behavior the old code already had whenever the
  // blocking listKeys call failed.
  const [folders, files, crumbs] = await Promise.all([
    repo.listFoldersIn(folderId),
    repo.listFilesIn(folderId),
    breadcrumb(folderId),
  ]);

  after(async () => {
    try {
      const existing = await listKeys(prefix);
      // Admin client: the cookie-based user client isn't reliable in after(),
      // which left phantom rows (B2 object gone, DB row stays) uncleaned.
      const allKeys = await repo.adminListUserFileKeys(userId);
      const missing = allKeys.filter((k) => !existing.has(k));
      if (missing.length > 0) {
        await repo.adminDeleteFilesByKeys(userId, missing);
      }
    } catch {
      // best-effort prune
    }
    try {
      await cleanupPrefix(prefix);
    } catch {
      // best-effort cleanup
    }
  });

  return { folders, files, breadcrumb: crumbs };
}

// ---- Suggested (recent) files --------------------------------------------

export type RecentFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string | null;
  createdAt: string;
  updatedAt: string;
};

// Recent files for the home "suggested" section (whole cloud, RLS-scoped to the
// user). Shape matches the client PreviewFile so it can be previewed directly.
export async function listRecentFiles(limit = 6): Promise<RecentFile[]> {
  const rows = await repo.listRecentFiles(limit);
  return rows.map((f) => ({
    id: f.id,
    name: f.name,
    size: f.size,
    mimeType: f.mime_type,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
  }));
}

// ---- Global search --------------------------------------------------------

export type SearchCrumb = { id: string; name: string };
export type FileHit = {
  id: string;
  name: string;
  size: number;
  mimeType: string | null;
  createdAt: string;
  updatedAt: string;
  folderId: string | null;
  path: SearchCrumb[]; // ancestor folders, root → containing folder ([] = root)
};
export type FolderHit = {
  id: string;
  name: string;
  parentId: string | null;
  path: SearchCrumb[]; // ancestor folders, root → parent ([] = root)
};

// Cap each result set so a broad query stays snappy and bounded.
const SEARCH_LIMIT = 100;
// Higher cap for the no-query case (filter-only global view), where we pull the
// whole drive and the filters do the narrowing client-side.
const ALL_FILES_LIMIT = 1000;

// Escape LIKE wildcards so a literal "%" or "_" the user types isn't treated as
// a pattern.
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Search the whole drive (all folders, every depth) by name. Each hit carries
// the path to where it lives so the UI can show its location and navigate there.
export async function searchDrive(
  query: string,
): Promise<{ files: FileHit[]; folders: FolderHit[] }> {
  await requireUserId();
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeLike);
  const noQuery = tokens.length === 0;
  if (!noQuery) after(() => logEvent("search"));

  const [allFolders, files] = await Promise.all([
    repo.listAllFolders(),
    noQuery
      ? repo.listAllFiles(ALL_FILES_LIMIT)
      : repo.searchFiles(tokens, SEARCH_LIMIT),
  ]);
  // No name query → folders can't be name-matched; the file filters drive the
  // view and folders are hidden anyway.
  const folders: repo.FolderRow[] = noQuery
    ? []
    : await repo.searchFolders(tokens, SEARCH_LIMIT);

  const byId = new Map(allFolders.map((f) => [f.id, f]));
  const pathCache = new Map<string, SearchCrumb[]>();
  // Ancestor crumbs (root → folder) for a folder id, memoized across hits.
  function pathTo(folderId: string | null): SearchCrumb[] {
    if (!folderId) return [];
    const cached = pathCache.get(folderId);
    if (cached) return cached;
    const crumbs: SearchCrumb[] = [];
    let id: string | null = folderId;
    for (let i = 0; id && i < 64; i++) {
      const f = byId.get(id);
      if (!f) break;
      crumbs.unshift({ id: f.id, name: f.name });
      id = f.parent_id;
    }
    pathCache.set(folderId, crumbs);
    return crumbs;
  }

  return {
    files: files.map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      mimeType: f.mime_type,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
      folderId: f.folder_id,
      path: pathTo(f.folder_id),
    })),
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      parentId: f.parent_id,
      path: pathTo(f.parent_id),
    })),
  };
}

// ---- Folder operations ----------------------------------------------------

const FOLDER_NAME_RE = /^[^/\\]{1,255}$/;

export async function createFolder(
  name: string,
  parentId: string | null,
): Promise<void> {
  const { id: userId } = await requireActiveUser();
  const clean = name.trim();
  if (!FOLDER_NAME_RE.test(clean)) throw new Error("Nume de folder invalid.");
  const existing = await repo.findFolderByName(clean, parentId);
  if (existing) throw new Error("Există deja un folder cu acest nume.");
  await repo.insertFolder({ owner_id: userId, name: clean, parent_id: parentId });
  after(() => logEvent("folder_create"));
}

// Find-or-create a folder by name (used when uploading a folder tree). Safe
// against the unique constraint if two files race to create the same folder.
export async function ensureFolder(
  name: string,
  parentId: string | null,
): Promise<string> {
  const { id: userId } = await requireActiveUser();
  const clean = name.trim();
  if (!FOLDER_NAME_RE.test(clean)) throw new Error("Nume de folder invalid.");
  const existing = await repo.findFolderByName(clean, parentId);
  if (existing) return existing.id;
  try {
    const created = await repo.insertFolder({
      owner_id: userId,
      name: clean,
      parent_id: parentId,
    });
    return created.id;
  } catch {
    // Lost a race — the folder now exists.
    const f = await repo.findFolderByName(clean, parentId);
    if (f) return f.id;
    throw new Error("Nu am putut crea folderul.");
  }
}

// Delete a folder and everything inside it: remove the B2 objects of every file
// in the subtree, then drop the folder row (DB cascade removes subfolders/files).
export async function deleteFolder(id: string): Promise<void> {
  await requireActiveUser();
  const keys = await repo.descendantFileKeys(id);
  await Promise.all(keys.map((k) => deleteObject(k).catch(() => {})));
  await repo.deleteFolderRow(id);
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && e.code === "23505";
}

export async function renameFolder(id: string, name: string): Promise<void> {
  await requireActiveUser();
  const clean = name.trim();
  if (!FOLDER_NAME_RE.test(clean)) throw new Error("Nume de folder invalid.");
  try {
    await repo.updateFolder(id, { name: clean });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new Error("Există deja un folder cu acest nume aici.");
    }
    throw e;
  }
}

// Folders the caller owns — for the move-destination picker.
export async function listAllFolders() {
  await requireUserId();
  return repo.listAllFolders();
}

// Move a folder (with everything in it) under a new parent (null = root).
export async function moveFolder(
  id: string,
  newParentId: string | null,
): Promise<void> {
  await requireActiveUser();
  assertId(id, "Folder inexistent.");
  if (newParentId !== null) assertId(newParentId, "Destinație invalidă.");
  if (id === newParentId) throw new Error("Destinație invalidă.");

  const folders = await repo.listAllFolders();
  // Build the subtree of `id` to forbid moving a folder into itself/descendant.
  const childrenOf = new Map<string, string[]>();
  for (const f of folders) {
    if (!f.parent_id) continue;
    const arr = childrenOf.get(f.parent_id) ?? [];
    arr.push(f.id);
    childrenOf.set(f.parent_id, arr);
  }
  const sub = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of childrenOf.get(cur) ?? []) {
      if (!sub.has(c)) {
        sub.add(c);
        stack.push(c);
      }
    }
  }
  if (newParentId && sub.has(newParentId)) {
    throw new Error("Nu poți muta un folder în el însuși.");
  }

  try {
    await repo.updateFolder(id, { parent_id: newParentId });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new Error("Există deja un folder cu acest nume în destinație.");
    }
    throw e;
  }
}

// Manifest for zipping a folder: every file in the subtree with its path
// (relative to the folder's parent, so the zip contains the folder itself).
export async function folderManifest(
  id: string,
): Promise<{ name: string; files: { key: string; path: string }[] }> {
  await requireActiveUser();
  const folders = await repo.listAllFolders();
  const byId = new Map(folders.map((f) => [f.id, f]));
  const target = byId.get(id);
  if (!target) throw new Error("Folder inexistent.");

  const childrenOf = new Map<string, string[]>();
  for (const f of folders) {
    if (!f.parent_id) continue;
    const arr = childrenOf.get(f.parent_id) ?? [];
    arr.push(f.id);
    childrenOf.set(f.parent_id, arr);
  }

  const pathOf = new Map<string, string>([[id, target.name]]);
  const subIds = [id];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of childrenOf.get(cur) ?? []) {
      const cf = byId.get(c)!;
      pathOf.set(c, `${pathOf.get(cur)!}/${cf.name}`);
      subIds.push(c);
      stack.push(c);
    }
  }

  const files = await repo.listFilesInFolders(subIds);
  const entries = files.map((f) => ({
    key: f.storage_key,
    path: `${pathOf.get(f.folder_id ?? "") ?? target.name}/${f.name}`,
  }));
  // The whole folder streams out of B2 as one zip — count its total bytes as
  // egress (best-effort, off the hot path).
  const totalBytes = files.reduce((sum, f) => sum + (f.size ?? 0), 0);
  after(() => logEgress(totalBytes, "folder"));
  return { name: target.name, files: entries };
}

// Recursive size + file count of a folder (for the info box).
export async function folderStats(
  id: string,
): Promise<{ size: number; count: number }> {
  await requireUserId();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("folder_stats", { fid: id });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    | { total_size: number; file_count: number }
    | undefined;
  return {
    size: Number(row?.total_size ?? 0),
    count: Number(row?.file_count ?? 0),
  };
}

// A presigned inline-view URL for previewing a file in the browser.
export async function getViewUrl(
  id: string,
): Promise<{ url: string; name: string; mime: string | null }> {
  const { id: userId } = await requireActiveUser();
  const file = await repo.getFileById(id);
  if (!file) throw new Error("Fișier inexistent.");
  assertOwnedKey(userId, file.storage_key);
  const url = await presignView(file.storage_key);
  after(() => logEvent("preview", { ext: extensionOf(file.name) }));
  after(() => logEgress(file.size, "preview", { fileId: file.id }));
  return { url, name: file.name, mime: file.mime_type };
}

// First chunk of a text file, read server-side (no browser CORS needed). Capped
// so previewing a huge file doesn't pull the whole thing.
export async function getTextPreview(id: string): Promise<string> {
  const { id: userId } = await requireActiveUser();
  const file = await repo.getFileById(id);
  if (!file) throw new Error("Fișier inexistent.");
  assertOwnedKey(userId, file.storage_key);
  const url = await presignView(file.storage_key);
  const res = await fetch(url, { headers: { Range: "bytes=0-100000" } });
  return res.text();
}

// Largest text file we let the user edit in-app. Editing must load the WHOLE
// file (saving the capped preview would truncate it), so we bound it.
const MAX_EDIT_SIZE = 1024 * 1024; // 1 MB

// Full text of a file, for in-app editing (NOT capped like the preview).
// Returns { tooLarge: true } if the file exceeds the edit cap.
export async function getTextContent(
  id: string,
): Promise<{ content: string } | { tooLarge: true }> {
  const { id: userId } = await requireActiveUser();
  const file = await repo.getFileById(id);
  if (!file) throw new Error("Fișier inexistent.");
  assertOwnedKey(userId, file.storage_key);
  if (file.size > MAX_EDIT_SIZE) return { tooLarge: true };
  const url = await presignView(file.storage_key);
  const res = await fetch(url);
  return { content: await res.text() };
}

// Overwrite a text file's content in place (same B2 key), then bump size +
// updated_at so the drive shows it as modified. Quota is re-checked only for the
// growth. Owner-scoped via RLS + the key guard.
export async function saveTextFile(
  id: string,
  content: string,
): Promise<{ size: number; updatedAt: string }> {
  const { id: userId, maxFile, maxTotal } = await requireActiveUser();
  const file = await repo.getFileById(id);
  if (!file) throw new Error("Fișier inexistent.");
  assertOwnedKey(userId, file.storage_key);

  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > MAX_EDIT_SIZE) throw new Error("Fișier prea mare pentru editare.");

  const grew = bytes - file.size;
  if (grew > 0) await enforceQuota(userId, grew, maxFile, maxTotal);

  await putObject(
    file.storage_key,
    Buffer.from(content, "utf8"),
    file.mime_type ?? "text/plain; charset=utf-8",
  );

  const updatedAt = new Date().toISOString();
  await repo.updateFile(id, { size: bytes, updated_at: updatedAt });
  after(() => logEvent("edit", { ext: extensionOf(file.name) }));
  return { size: bytes, updatedAt };
}

// Total usage + quota for the drive's usage bar (null quota = unlimited). Usage
// is the sum across ALL the user's files, not just the current folder.
export async function myUsage(): Promise<{ used: number; quota: number | null }> {
  const userId = await requireUserId();
  const supabase = await createClient();
  const [used, { maxTotal }, { defaultUserQuota }, { data: pref }] = await Promise.all([
    repo.totalUsage(userId),
    effectiveLimits(userId),
    getSettings(),
    supabase.from("profiles").select("self_max_total_size").eq("id", userId).single(),
  ]);
  // Admin quota wins; the user's own cap fills in only when there is none.
  return {
    used,
    quota: maxTotal ?? defaultUserQuota ?? pref?.self_max_total_size ?? null,
  };
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

  // Platform-wide blocked extensions (super-admin setting; null = none).
  // The picker filters client-side too, but this is the authoritative gate.
  const denied = fileTypeDenied(input.name, await getUploadTypes());
  if (denied) throw new Error(denied);

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

// Resume a multipart upload after a page refresh: re-presign every part (the
// original URLs may have expired) and report which parts B2 already has so the
// client only re-uploads the missing ones.
export async function resumeUpload(input: {
  key: string;
  uploadId: string;
  size: number;
}): Promise<{
  partSize: number;
  partUrls: string[];
  doneParts: number[];
}> {
  const { id: userId } = await requireActiveUser();
  if (!input.key.startsWith(`${userId}/`)) throw new Error("Cheie invalidă.");

  const partCount = Math.ceil(input.size / PART_SIZE);
  const [partUrls, uploaded] = await Promise.all([
    Promise.all(
      Array.from({ length: partCount }, (_, i) =>
        presignUploadPart(input.key, input.uploadId, i + 1),
      ),
    ),
    listUploadedParts(input.key, input.uploadId),
  ]);

  return {
    partSize: PART_SIZE,
    partUrls,
    doneParts: uploaded.map((p) => p.partNumber),
  };
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
  folderId: string | null;
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

  after(() => logEvent("upload", { ext: extensionOf(input.name) }));
  after(() => checkStorageAlert(userId));
  return repo.insertFile({
    owner_id: userId,
    name: input.name,
    size: stat.size,
    mime_type: stat.contentType ?? input.contentType ?? null,
    storage_key: input.key,
    folder_id: input.folderId,
  });
}

export async function getDownloadUrl(id: string) {
  const { id: userId } = await requireActiveUser();
  const file = await repo.getFileById(id); // RLS → only owner's rows
  if (!file) throw new Error("Fișier inexistent.");
  assertOwnedKey(userId, file.storage_key);

  // Track the last time the user pulled a file (best-effort).
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ last_download_at: new Date().toISOString() })
    .eq("id", userId);

  after(() => logEvent("download", { ext: extensionOf(file.name) }));
  after(() => logEgress(file.size, "download"));
  return presignDownload(file.storage_key, file.name);
}

export async function deleteFile(id: string) {
  const { id: userId } = await requireActiveUser();
  const file = await repo.getFileById(id);
  if (!file) throw new Error("Fișier inexistent.");
  assertOwnedKey(userId, file.storage_key);
  try {
    await deleteObject(file.storage_key);
  } catch {
    // Object may already be gone from B2 (e.g. deleted straight from the bucket)
    // or a transient B2 error — either way, remove the DB row so the drive stays
    // consistent and the user never sees a delete error.
  }
  await repo.deleteFileRow(id);
}

// ---- File operations ------------------------------------------------------

// A file name may contain dots but not path separators.
const FILE_NAME_RE = /^[^/\\]{1,255}$/;

export async function renameFile(id: string, name: string): Promise<void> {
  await requireActiveUser();
  const file = await repo.getFileById(id);
  if (!file) throw new Error("Fișier inexistent.");

  const clean = name.trim();
  if (!FILE_NAME_RE.test(clean)) throw new Error("Nume de fișier invalid.");

  // Lock the original extension: the new name must keep it, so a rename can
  // never strip or change it (which would break the download filename). This is
  // the source of truth — it also covers direct calls that bypass the UI.
  const ext = extensionOf(file.name);
  const finalName =
    ext && clean.toLowerCase() !== ext.toLowerCase() &&
    !clean.toLowerCase().endsWith(ext.toLowerCase())
      ? clean + ext
      : clean;

  await repo.updateFile(id, { name: finalName });
  after(() => logEvent("rename", { ext: extensionOf(file.name) }));
}

// Move a file into a folder (null = root). The destination folder must belong to
// the caller — RLS only guards the file row, so we verify the folder explicitly
// to stop a file being parked under someone else's (or a nonexistent) folder.
export async function moveFile(
  id: string,
  folderId: string | null,
): Promise<void> {
  await requireActiveUser();
  assertId(id, "Fișier inexistent.");
  if (folderId !== null) {
    assertId(folderId, "Destinație invalidă.");
    const dest = await repo.getFolder(folderId);
    if (!dest) throw new Error("Destinație invalidă.");
  }
  await repo.updateFile(id, { folder_id: folderId });
  after(() => logEvent("move"));
}

// Insert " (copie)" before the extension: "report.pdf" → "report (copie).pdf".
function copyName(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return `${name} (copie)`;
  return `${name.slice(0, dot)} (copie)${name.slice(dot)}`;
}

// Make a real, independent copy: a fresh B2 object (counts against quota) plus a
// new DB row in the same folder.
export async function copyFile(id: string): Promise<void> {
  const { id: userId, maxFile, maxTotal } = await requireActiveUser();
  const file = await repo.getFileById(id);
  if (!file) throw new Error("Fișier inexistent.");
  assertOwnedKey(userId, file.storage_key);

  await enforceQuota(userId, file.size, maxFile, maxTotal);

  const destKey = `${userId}/${randomUUID()}`;
  await copyObject(file.storage_key, destKey);
  await repo.insertFile({
    owner_id: userId,
    name: copyName(file.name),
    size: file.size,
    mime_type: file.mime_type,
    storage_key: destKey,
    folder_id: file.folder_id,
  });
  after(() => logEvent("copy", { ext: extensionOf(file.name) }));
}

// Soft delete: hide the file from listings but keep its bytes + row so it can be
// restored from Trash. Also clears any archived state, so restoring from Trash
// returns the file to the drive (not back into the Archive).
export async function moveFileToTrash(id: string): Promise<void> {
  await requireActiveUser();
  await repo.updateFile(id, {
    deleted_at: new Date().toISOString(),
    archived_at: null,
  });
  after(() => logEvent("trash"));
}

// ---- Archive --------------------------------------------------------------

// Organisational soft-state: archived files leave the drive + global search and
// live in the Archive view. Kept indefinitely and still count toward quota.

export type ArchiveFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string;
};

export async function archiveFile(id: string): Promise<void> {
  await requireActiveUser();
  const file = await repo.getFileById(id);
  if (!file) throw new Error("Fișier inexistent.");
  await repo.updateFile(id, { archived_at: new Date().toISOString() });
  after(() => logEvent("archive"));
}

export async function listArchive(): Promise<ArchiveFile[]> {
  await requireUserId();
  const rows = await repo.listArchivedFiles();
  return rows.map((f) => ({
    id: f.id,
    name: f.name,
    size: f.size,
    mimeType: f.mime_type,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
    archivedAt: f.archived_at!,
  }));
}

// Bring an archived file back to the drive — to its original folder, or to the
// root if that folder has since been deleted.
export async function unarchiveFile(id: string): Promise<void> {
  await requireActiveUser();
  const file = await repo.getFileById(id);
  if (!file) throw new Error("Fișier inexistent.");
  let folderId = file.folder_id;
  if (folderId && !(await repo.getFolder(folderId))) folderId = null;
  await repo.updateFile(id, { archived_at: null, folder_id: folderId });
  after(() => logEvent("unarchive"));
}

// ---- Trash ----------------------------------------------------------------

// How long a trashed file is kept before the cron purge removes it for good.
export const TRASH_RETENTION_DAYS = 30;
const DAY_MS = 86_400_000;

export type TrashFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string | null;
  deletedAt: string;
  // Days until the file is auto-purged (0 = imminent). Computed server-side so
  // the client never needs Date.now() during render.
  expiresInDays: number;
};

export async function listTrash(): Promise<TrashFile[]> {
  await requireUserId();
  const rows = await repo.listTrashedFiles();
  const now = Date.now();
  return rows.map((f) => {
    const elapsedDays = Math.floor((now - new Date(f.deleted_at!).getTime()) / DAY_MS);
    return {
      id: f.id,
      name: f.name,
      size: f.size,
      mimeType: f.mime_type,
      deletedAt: f.deleted_at!,
      expiresInDays: Math.max(0, TRASH_RETENTION_DAYS - elapsedDays),
    };
  });
}

// Bring a trashed file back. It returns to its original folder, or to the root
// if that folder has since been deleted.
export async function restoreFile(id: string): Promise<void> {
  await requireActiveUser();
  const file = await repo.getFileById(id);
  if (!file) throw new Error("Fișier inexistent.");
  let folderId = file.folder_id;
  if (folderId && !(await repo.getFolder(folderId))) folderId = null;
  await repo.updateFile(id, { deleted_at: null, folder_id: folderId });
  after(() => logEvent("restore"));
}

// Permanently delete a single trashed file: remove its B2 object, then its row.
export async function deleteFilePermanently(id: string): Promise<void> {
  const { id: userId } = await requireActiveUser();
  const file = await repo.getFileById(id);
  if (!file) throw new Error("Fișier inexistent.");
  assertOwnedKey(userId, file.storage_key);
  try {
    await deleteObject(file.storage_key);
  } catch {
    // Object may already be gone from B2 — drop the row regardless.
  }
  await repo.deleteFileRow(id);
  // Usage dropped — re-arm (or clear) the user's storage alert.
  after(() => checkStorageAlert(userId));
}

// Permanently delete everything currently in the caller's trash.
export async function emptyTrash(): Promise<void> {
  const { id: userId } = await requireActiveUser();
  const rows = await repo.listTrashedFiles();
  const keys = rows.map((f) => f.storage_key);
  for (const k of keys) assertOwnedKey(userId, k);
  await Promise.all(keys.map((k) => deleteObject(k).catch(() => {})));
  await repo.deleteFileRowsByKeys(keys);
  // Usage dropped — re-arm (or clear) the user's storage alert.
  after(() => checkStorageAlert(userId));
}

// Cron-only: permanently remove trashed files older than the retention window,
// across ALL users. Runs without a user session (admin/service-role client).
export async function purgeExpiredTrash(): Promise<number> {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * DAY_MS).toISOString();
  const expired = await repo.adminListExpiredTrash(cutoff);
  if (expired.length === 0) return 0;
  await Promise.all(expired.map((f) => deleteObject(f.storage_key).catch(() => {})));
  await repo.adminDeleteFileRowsByIds(expired.map((f) => f.id));

  // Tell each affected user how many of their files were permanently removed,
  // and give the admins a single platform-wide cleanup summary. Keys are always
  // `${ownerId}/<uuid>`, so the owner is the prefix.
  const perOwner = new Map<string, number>();
  for (const f of expired) {
    const owner = f.storage_key.split("/")[0];
    if (owner) perOwner.set(owner, (perOwner.get(owner) ?? 0) + 1);
  }
  for (const [owner, count] of perOwner) {
    await notifyUserEvent(
      owner,
      "trash_purged",
      { numar: String(count), zile: String(TRASH_RETENTION_DAYS) },
      "/trash",
    );
  }
  await notifyAdminsEvent(
    "trash_purge_report",
    { total: String(expired.length), utilizatori: String(perOwner.size) },
    "/users",
  );

  return expired.length;
}
