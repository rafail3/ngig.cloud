import "server-only";
import { randomBytes } from "crypto";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveUser } from "@/server/auth/active-user";
import * as repo from "@/server/files/repository";
import { presignDownload, presignInline } from "@/server/storage/b2";
import { logEgress } from "@/server/billing/egress";
import {
  isExpired,
  sharePath,
  sharePreviewKind,
  type ShareTargetType,
  type SharePreviewKind,
} from "@/lib/share";

// ---------------------------------------------------------------------------
// Public share links — Faza A.
//
// SECURITY MODEL
//  - A link's ONLY authority is its random token (128 bits, url-safe). Holding
//    the token = permission to view/download that one file/folder. There is no
//    other access-control on the public side by design.
//  - CREATING a link is gated by ownership: we read the target through the
//    user-scoped (RLS) client, so a caller can only ever share a file/folder
//    they own. RLS also pins owner_id on insert. A user cannot mint a link for
//    someone else's object even by supplying a foreign id.
//  - RESOLVING a link (the public page/route has no session) runs through the
//    service-role client, which bypasses RLS. Every such path is scoped to the
//    values on the link row itself (owner_id + the single target id), never to
//    caller-supplied ids, so the service role can't be steered off the target.
//  - Expired links are treated as non-existent AND deleted on sight (the user
//    chose "disappear immediately"); the cron sweep is only a backstop.
// ---------------------------------------------------------------------------

type ShareLinkRow = {
  id: string;
  token: string;
  owner_id: string;
  target_type: ShareTargetType;
  file_id: string | null;
  folder_id: string | null;
  expires_at: string | null;
  access_count: number;
  created_at: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertId(id: string, label: string): void {
  if (typeof id !== "string" || !UUID_RE.test(id)) throw new Error(label);
}

// 128 bits of entropy, url-safe (A–Z a–z 0–9 - _), 22 chars. Unguessable: the
// whole security of a public link rests on this token not being predictable.
function mintToken(): string {
  return randomBytes(16).toString("base64url");
}

// A token is always a base64url string of a fixed length. Reject anything off
// that shape before touching the DB, so junk/probing never runs a real query.
function isTokenShape(token: unknown): token is string {
  return (
    typeof token === "string" &&
    token.length >= 16 &&
    token.length <= 64 &&
    /^[A-Za-z0-9_-]+$/.test(token)
  );
}

// ---- Owner-facing (authenticated, RLS) ------------------------------------

// Create a share link for one of the caller's own files/folders.
// `expiresAt` = null means never; otherwise it must be a valid future instant.
export async function createShareLink(input: {
  targetType: ShareTargetType;
  targetId: string;
  expiresAt: string | null;
}): Promise<{ id: string; token: string; url: string; expiresAt: string | null }> {
  const { id: userId } = await requireActiveUser();
  assertId(input.targetId, "Element invalid.");

  // Ownership gate: these reads are RLS-scoped, so a row comes back only if the
  // caller owns the target. This is what stops sharing a foreign object.
  if (input.targetType === "file") {
    const file = await repo.getFileById(input.targetId);
    if (!file) throw new Error("Fișier inexistent.");
    if (file.deleted_at) throw new Error("Fișierul este în coșul de gunoi.");
  } else if (input.targetType === "folder") {
    const folder = await repo.getFolder(input.targetId);
    if (!folder) throw new Error("Folder inexistent.");
  } else {
    throw new Error("Tip de element invalid.");
  }

  // Recompute/validate expiry against the server clock — never persist a
  // client-supplied timestamp blindly.
  let expiresAt: string | null = null;
  if (input.expiresAt !== null) {
    const t = new Date(input.expiresAt).getTime();
    if (Number.isNaN(t)) throw new Error("Dată de expirare invalidă.");
    if (t <= Date.now()) throw new Error("Data de expirare trebuie să fie în viitor.");
    expiresAt = new Date(t).toISOString();
  }

  const supabase = await createClient();
  // Retry only on a token collision (unique_violation) — astronomically rare at
  // 128 bits, but cheap to guard.
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = mintToken();
    const { data, error } = await supabase
      .from("share_links")
      .insert({
        token,
        owner_id: userId,
        target_type: input.targetType,
        file_id: input.targetType === "file" ? input.targetId : null,
        folder_id: input.targetType === "folder" ? input.targetId : null,
        expires_at: expiresAt,
      })
      .select("id, token, expires_at")
      .single();

    if (!error && data) {
      return {
        id: data.id as string,
        token: data.token as string,
        url: sharePath(data.token as string),
        expiresAt: (data.expires_at as string | null) ?? null,
      };
    }
    if (error && error.code !== "23505") throw error; // 23505 = unique_violation
  }
  throw new Error("Nu am putut genera linkul. Încearcă din nou.");
}

export type MyShareLink = {
  id: string;
  token: string;
  url: string;
  targetType: ShareTargetType;
  name: string;
  expiresAt: string | null;
  accessCount: number;
  createdAt: string;
};

// The caller's active links, newest first. Expired links are omitted so they
// vanish from "Linkurile mele" the instant they lapse (the cron only reclaims
// the rows later).
export async function listMyShares(): Promise<MyShareLink[]> {
  await requireActiveUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("share_links")
    .select(
      "id, token, target_type, file_id, folder_id, expires_at, access_count, created_at, files(name), folders(name)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  const now = Date.now();
  type Row = {
    id: string;
    token: string;
    target_type: ShareTargetType;
    expires_at: string | null;
    access_count: number;
    created_at: string;
    files: { name: string } | { name: string }[] | null;
    folders: { name: string } | { name: string }[] | null;
  };
  const pick = (v: Row["files"]): string | null =>
    Array.isArray(v) ? (v[0]?.name ?? null) : (v?.name ?? null);

  return ((data ?? []) as Row[])
    .filter((r) => !isExpired(r.expires_at, now))
    .map((r) => ({
      id: r.id,
      token: r.token,
      url: sharePath(r.token),
      targetType: r.target_type,
      name: pick(r.files) ?? pick(r.folders) ?? "(indisponibil)",
      expiresAt: r.expires_at,
      accessCount: r.access_count,
      createdAt: r.created_at,
    }));
}

// Revoke (delete) one of the caller's links. RLS scopes the delete to the owner,
// so this can never remove another user's link.
export async function revokeShare(id: string): Promise<void> {
  await requireActiveUser();
  assertId(id, "Link invalid.");
  const supabase = await createClient();
  const { error } = await supabase.from("share_links").delete().eq("id", id);
  if (error) throw error;
}

// ---- Public-facing (no session, service-role) -----------------------------

type ResolvedShare = {
  id: string;
  token: string;
  targetType: ShareTargetType;
  name: string;
  size: number | null; // file only
  mime: string | null; // file only
  expiresAt: string | null;
  ownerId: string;
  fileId: string | null;
  folderId: string | null;
  storageKey: string | null; // file only — server-internal, never sent to client
};

// Resolve a token to its (live, non-expired) target. Returns null for a missing,
// expired or dangling link. Expired links are deleted on sight. Set `bump` to
// count this as an access.
async function resolveShare(
  token: string,
  opts?: { bump?: boolean },
): Promise<ResolvedShare | null> {
  if (!isTokenShape(token)) return null;
  const admin = createAdminClient();

  const { data: link } = await admin
    .from("share_links")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!link) return null;
  const row = link as ShareLinkRow;

  if (isExpired(row.expires_at, Date.now())) {
    // Immediate cleanup (best-effort): an expired link is gone the moment it's hit.
    await admin.from("share_links").delete().eq("id", row.id);
    return null;
  }

  if (row.target_type === "file") {
    const { data: file } = await admin
      .from("files")
      .select("id, name, size, mime_type, storage_key, deleted_at")
      .eq("id", row.file_id!)
      .maybeSingle();
    if (!file || file.deleted_at) return null; // trashed/removed → link is dead
    if (opts?.bump) await bumpAccess(row.id, row.access_count);
    return {
      id: row.id,
      token: row.token,
      targetType: "file",
      name: file.name as string,
      size: Number(file.size ?? 0),
      mime: (file.mime_type as string | null) ?? null,
      expiresAt: row.expires_at,
      ownerId: row.owner_id,
      fileId: file.id as string,
      folderId: null,
      storageKey: file.storage_key as string,
    };
  }

  const { data: folder } = await admin
    .from("folders")
    .select("id, name")
    .eq("id", row.folder_id!)
    .maybeSingle();
  if (!folder) return null;
  if (opts?.bump) await bumpAccess(row.id, row.access_count);
  return {
    id: row.id,
    token: row.token,
    targetType: "folder",
    name: folder.name as string,
    size: null,
    mime: null,
    expiresAt: row.expires_at,
    ownerId: row.owner_id,
    fileId: null,
    folderId: folder.id as string,
    storageKey: null,
  };
}

// Access counter bump. access_count is a soft engagement metric (like egress),
// so a read-modify-write is acceptable — a lost increment under simultaneous
// hits only slightly undercounts, and never affects access control.
async function bumpAccess(id: string, current: number): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin
      .from("share_links")
      .update({ access_count: current + 1 })
      .eq("id", id);
  } catch {
    // non-critical
  }
}

export type SharePageData = {
  targetType: ShareTargetType;
  name: string;
  size: number | null;
  expiresAt: string | null;
  previewKind: SharePreviewKind;
  previewUrl: string | null; // presigned inline URL, only for previewable files
};

// Everything the public page needs. Counts as an access (bump). For a
// previewable file we hand back a short-lived inline URL so the browser can
// render it directly from B2 — the storage key never leaves the server.
export async function getSharePage(token: string): Promise<SharePageData | null> {
  const share = await resolveShare(token, { bump: true });
  if (!share) return null;

  let previewKind: SharePreviewKind = null;
  let previewUrl: string | null = null;
  if (share.targetType === "file" && share.storageKey) {
    previewKind = sharePreviewKind(share.name);
    if (previewKind) previewUrl = await presignInline(share.storageKey);
    // A rendered preview streams bytes from B2 too — bill it to the owner.
    after(() => logEgress(share.size ?? 0, "preview", { userId: share.ownerId, fileId: share.fileId ?? undefined }));
  }

  return {
    targetType: share.targetType,
    name: share.name,
    size: share.size,
    expiresAt: share.expiresAt,
    previewKind,
    previewUrl,
  };
}

// A presigned download URL for a shared FILE (the public download route
// redirects to it). Resolves the token fresh — the route is public. No bump:
// the page open already counted the access.
export async function getShareFileDownloadUrl(
  token: string,
): Promise<{ url: string; name: string } | null> {
  const share = await resolveShare(token);
  if (!share || share.targetType !== "file" || !share.storageKey) return null;
  const url = await presignDownload(share.storageKey, share.name);
  after(() => logEgress(share.size ?? 0, "download", { userId: share.ownerId }));
  return { url, name: share.name };
}

// Zip manifest for a shared FOLDER (the public download route streams it). Built
// with the service-role client but strictly scoped to the link's owner + target
// subtree, so it can only ever reach that owner's own objects.
export async function getShareFolderManifest(
  token: string,
): Promise<{ name: string; files: { key: string; path: string }[] } | null> {
  const share = await resolveShare(token);
  if (!share || share.targetType !== "folder" || !share.folderId) return null;

  const admin = createAdminClient();
  const { data: folderRows } = await admin
    .from("folders")
    .select("id, name, parent_id")
    .eq("owner_id", share.ownerId);
  const list = (folderRows ?? []) as {
    id: string;
    name: string;
    parent_id: string | null;
  }[];
  const byId = new Map(list.map((f) => [f.id, f]));
  const target = byId.get(share.folderId);
  if (!target) return null;

  // Build subtree ids + display paths.
  const childrenOf = new Map<string, string[]>();
  for (const f of list) {
    if (!f.parent_id) continue;
    const arr = childrenOf.get(f.parent_id) ?? [];
    arr.push(f.id);
    childrenOf.set(f.parent_id, arr);
  }
  const pathOf = new Map<string, string>([[target.id, target.name]]);
  const subIds = [target.id];
  const stack = [target.id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of childrenOf.get(cur) ?? []) {
      const cf = byId.get(c)!;
      pathOf.set(c, `${pathOf.get(cur)!}/${cf.name}`);
      subIds.push(c);
      stack.push(c);
    }
  }

  const { data: fileRows } = await admin
    .from("files")
    .select("storage_key, name, size, folder_id")
    .eq("owner_id", share.ownerId)
    .is("deleted_at", null)
    .in("folder_id", subIds);
  const files = (fileRows ?? []) as {
    storage_key: string;
    name: string;
    size: number;
    folder_id: string | null;
  }[];

  const entries = files.map((f) => ({
    key: f.storage_key,
    path: `${pathOf.get(f.folder_id ?? "") ?? target.name}/${f.name}`,
  }));
  const totalBytes = files.reduce((s, f) => s + Number(f.size ?? 0), 0);
  after(() => logEgress(totalBytes, "folder", { userId: share.ownerId }));
  return { name: target.name, files: entries };
}

// Cron backstop: hard-delete links already past expiry. The list view hides
// them immediately; this reclaims the rows. Returns how many were removed.
export async function purgeExpiredShareLinks(): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("share_links")
    .delete()
    .not("expires_at", "is", null)
    .lt("expires_at", new Date().toISOString())
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}
