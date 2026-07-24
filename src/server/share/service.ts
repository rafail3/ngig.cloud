import "server-only";
import { randomBytes } from "crypto";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveUser } from "@/server/auth/active-user";
import * as repo from "@/server/files/repository";
import { presignDownload, presignInline } from "@/server/storage/b2";
import { logEgress } from "@/server/billing/egress";
import { notifyUserEvent } from "@/server/notifications/service";
import { appOrigin } from "@/lib/dashboard";
import {
  hashSharePassword,
  verifySharePassword,
  SHARE_PASSWORD_MIN,
  SHARE_PASSWORD_MAX,
} from "./password";
import {
  expiryLabel,
  isExpired,
  sharePath,
  sharePreviewKind,
  type ShareTargetType,
  type ShareLinkKind,
  type SharePreviewKind,
  type MyShareLinkView,
  type ShareFolderNode,
  type ShareFileNode,
  type SharePageData,
} from "@/lib/share";

// ---------------------------------------------------------------------------
// Public share links — Faza A.
//
// SECURITY MODEL
//  - A link's ONLY authority is its random token (128 bits, url-safe).
//  - CREATING a link is ownership-gated: every target is read through the
//    user-scoped (RLS) client, so a caller can only share files/folders they
//    own. RLS also pins owner_id on insert. A bundle's items are all
//    ownership-checked before insert.
//  - RESOLVING (public, no session) runs through the service-role client, but
//    every path is scoped to the link row's own owner_id + target ids, never to
//    caller-supplied ids.
//  - Expired links resolve as non-existent AND are deleted on sight; the cron is
//    only a backstop.
// ---------------------------------------------------------------------------

type ShareLinkRow = {
  id: string;
  token: string;
  owner_id: string;
  target_type: ShareLinkKind;
  file_id: string | null;
  folder_id: string | null;
  expires_at: string | null;
  access_count: number;
  created_at: string;
  password_hash: string | null;
  max_downloads: number | null;
  download_count: number;
  notify_on_access: boolean;
  last_notified_at: string | null;
};

// Cap on how many items one bundle link can carry (guards a hostile client).
const MAX_BUNDLE_ITEMS = 100;

// A link is dead (treated as non-existent) when it has expired or its download
// limit is used up. Both cases: hide from the owner's list, 404 the public page,
// reclaim on the cron.
function isLinkDead(row: ShareLinkRow, nowMs: number): boolean {
  if (isExpired(row.expires_at, nowMs)) return true;
  if (row.max_downloads !== null && row.download_count >= row.max_downloads)
    return true;
  return false;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertId(id: string, label: string): void {
  if (typeof id !== "string" || !UUID_RE.test(id)) throw new Error(label);
}

// 128 bits of entropy, url-safe, 22 chars. The whole security of a public link
// rests on this token being unpredictable.
function mintToken(): string {
  return randomBytes(16).toString("base64url");
}

function isTokenShape(token: unknown): token is string {
  return (
    typeof token === "string" &&
    token.length >= 16 &&
    token.length <= 64 &&
    /^[A-Za-z0-9_-]+$/.test(token)
  );
}

// Verify the caller owns a target. RLS-scoped reads return a row only for the
// owner, so this is what stops sharing a foreign object. Throws on any problem.
async function assertOwnsTarget(t: { type: ShareTargetType; id: string }) {
  assertId(t.id, "Element invalid.");
  if (t.type === "file") {
    const file = await repo.getFileById(t.id);
    if (!file) throw new Error("Fișier inexistent.");
    if (file.deleted_at) throw new Error("Fișierul este în coșul de gunoi.");
  } else if (t.type === "folder") {
    const folder = await repo.getFolder(t.id);
    if (!folder) throw new Error("Folder inexistent.");
  } else {
    throw new Error("Tip de element invalid.");
  }
}

function validateExpiry(expiresAt: string | null): string | null {
  if (expiresAt === null) return null;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) throw new Error("Dată de expirare invalidă.");
  if (t <= Date.now()) throw new Error("Data de expirare trebuie să fie în viitor.");
  return new Date(t).toISOString();
}

// ---- Owner-facing (authenticated, RLS) ------------------------------------

// Create a share link for one or more of the caller's own files/folders. A
// single target makes a file/folder link; several make a bundle link.
export async function createShareLink(input: {
  targets: { type: ShareTargetType; id: string }[];
  expiresAt: string | null;
  password?: string | null;
  maxDownloads?: number | null;
  notifyOnAccess?: boolean;
}): Promise<{ id: string; token: string; url: string; expiresAt: string | null }> {
  const { id: userId } = await requireActiveUser();

  const targets = input.targets ?? [];
  if (targets.length === 0) throw new Error("Niciun element de partajat.");
  if (targets.length > MAX_BUNDLE_ITEMS) {
    throw new Error(`Poți partaja cel mult ${MAX_BUNDLE_ITEMS} elemente într-un link.`);
  }

  // Ownership gate for every target before anything is written.
  for (const t of targets) await assertOwnsTarget(t);

  const expiresAt = validateExpiry(input.expiresAt);

  // Optional password → hashed server-side (never stored or sent in the clear).
  let passwordHash: string | null = null;
  if (input.password != null && input.password !== "") {
    const pw = input.password;
    if (pw.length < SHARE_PASSWORD_MIN || pw.length > SHARE_PASSWORD_MAX) {
      throw new Error(
        `Parola trebuie să aibă între ${SHARE_PASSWORD_MIN} și ${SHARE_PASSWORD_MAX} caractere.`,
      );
    }
    passwordHash = await hashSharePassword(pw);
  }

  // Optional download limit.
  let maxDownloads: number | null = null;
  if (input.maxDownloads != null) {
    const n = Math.floor(input.maxDownloads);
    if (!Number.isFinite(n) || n < 1 || n > 1_000_000) {
      throw new Error("Limita de descărcări trebuie să fie un număr pozitiv.");
    }
    maxDownloads = n;
  }

  const notifyOnAccess = input.notifyOnAccess === true;
  const supabase = await createClient();

  const single = targets.length === 1 ? targets[0] : null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const token = mintToken();
    const { data, error } = await supabase
      .from("share_links")
      .insert({
        token,
        owner_id: userId,
        target_type: single ? single.type : "bundle",
        file_id: single?.type === "file" ? single.id : null,
        folder_id: single?.type === "folder" ? single.id : null,
        expires_at: expiresAt,
        password_hash: passwordHash,
        max_downloads: maxDownloads,
        notify_on_access: notifyOnAccess,
      })
      .select("id, token, expires_at")
      .single();

    if (error) {
      if (error.code === "23505") continue; // token collision — retry
      throw error;
    }

    // Bundle: attach the members. RLS on share_link_items checks the parent
    // share is owned by the caller, so this can't graft items onto a foreign
    // share.
    if (!single) {
      const rows = targets.map((t) => ({
        share_id: data.id as string,
        file_id: t.type === "file" ? t.id : null,
        folder_id: t.type === "folder" ? t.id : null,
      }));
      const { error: itemsError } = await supabase
        .from("share_link_items")
        .insert(rows);
      if (itemsError) {
        // Roll back the orphan share row so we never leave an empty bundle.
        await supabase.from("share_links").delete().eq("id", data.id);
        throw itemsError;
      }
    }

    return {
      id: data.id as string,
      token: data.token as string,
      url: sharePath(data.token as string),
      expiresAt: (data.expires_at as string | null) ?? null,
    };
  }
  throw new Error("Nu am putut genera linkul. Încearcă din nou.");
}

export type MyShareLink = MyShareLinkView;

// The caller's active links, newest first. Expired links are omitted so they
// vanish from "Linkurile mele" the instant they lapse.
export async function listMyShares(): Promise<MyShareLink[]> {
  await requireActiveUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("share_links")
    .select(
      "id, token, target_type, file_id, folder_id, expires_at, access_count, created_at, password_hash, max_downloads, download_count, notify_on_access, files(name), folders(name), share_link_items(file_id, folder_id)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  const now = Date.now();
  type NameRel = { name: string } | { name: string }[] | null;
  type Row = {
    id: string;
    token: string;
    target_type: ShareLinkKind;
    expires_at: string | null;
    access_count: number;
    created_at: string;
    password_hash: string | null;
    max_downloads: number | null;
    download_count: number;
    notify_on_access: boolean;
    files: NameRel;
    folders: NameRel;
    share_link_items: { file_id: string | null; folder_id: string | null }[] | null;
  };
  const pickName = (v: NameRel): string | null =>
    Array.isArray(v) ? (v[0]?.name ?? null) : (v?.name ?? null);

  const dead = (r: Row): boolean =>
    isExpired(r.expires_at, now) ||
    (r.max_downloads !== null && r.download_count >= r.max_downloads);

  return ((data ?? []) as Row[])
    .filter((r) => !dead(r))
    .map((r) => {
      const isBundle = r.target_type === "bundle";
      const members = r.share_link_items ?? [];
      const n = members.length;
      // Name a bundle by what it holds — all files / all folders / "X foldere
      // și Y fișiere" when mixed.
      let name: string;
      if (isBundle) {
        const nf = members.filter((m) => m.folder_id).length;
        const ff = members.filter((m) => m.file_id).length;
        name =
          nf > 0 && ff > 0
            ? `${foldersPhrase(nf)} și ${filesPhrase(ff)}`
            : nf > 0
              ? foldersPhrase(nf)
              : filesPhrase(ff);
      } else {
        name = pickName(r.files) ?? pickName(r.folders) ?? "(indisponibil)";
      }
      return {
        id: r.id,
        token: r.token,
        url: sharePath(r.token),
        kind: r.target_type,
        name,
        itemCount: isBundle ? n : 1,
        expiresAt: r.expires_at,
        accessCount: r.access_count,
        createdAt: r.created_at,
        hasPassword: r.password_hash !== null,
        maxDownloads: r.max_downloads,
        downloadCount: r.download_count,
        notifyOnAccess: r.notify_on_access,
      };
    });
}

// Revoke (delete) one of the caller's links. RLS scopes the delete to the owner.
export async function revokeShare(id: string): Promise<void> {
  await requireActiveUser();
  assertId(id, "Link invalid.");
  const supabase = await createClient();
  const { error } = await supabase.from("share_links").delete().eq("id", id);
  if (error) throw error;
}

// ---- Public-facing (no session, service-role) -----------------------------

type BundleItem = {
  kind: "file" | "folder";
  name: string;
  size: number | null;
  fileId: string | null;
  folderId: string | null;
  storageKey: string | null;
};

type ResolvedShare = {
  id: string;
  token: string;
  kind: ShareLinkKind;
  name: string;
  size: number | null;
  mime: string | null;
  expiresAt: string | null;
  ownerId: string;
  fileId: string | null;
  folderId: string | null;
  storageKey: string | null;
  items: BundleItem[] | null; // bundle only
  passwordHash: string | null;
  hasPassword: boolean;
  notifyOnAccess: boolean;
  lastNotifiedAt: string | null;
};

// Resolve a token to its live target. Returns null for a missing, expired,
// download-exhausted or dangling link. Does NOT count an access or check the
// password — callers decide when to register access / require unlocking.
async function resolveShare(token: string): Promise<ResolvedShare | null> {
  if (!isTokenShape(token)) return null;
  const admin = createAdminClient();

  const { data: link } = await admin
    .from("share_links")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!link) return null;
  const row = link as ShareLinkRow;

  if (isLinkDead(row, Date.now())) {
    // Expired or its download limit is used up → gone on sight.
    await admin.from("share_links").delete().eq("id", row.id);
    return null;
  }

  const base = {
    id: row.id,
    token: row.token,
    expiresAt: row.expires_at,
    ownerId: row.owner_id,
    passwordHash: row.password_hash,
    hasPassword: row.password_hash !== null,
    notifyOnAccess: row.notify_on_access,
    lastNotifiedAt: row.last_notified_at,
  };

  if (row.target_type === "file") {
    const { data: file } = await admin
      .from("files")
      .select("id, name, size, mime_type, storage_key, deleted_at")
      .eq("id", row.file_id!)
      .maybeSingle();
    if (!file || file.deleted_at) return null;
    return {
      ...base,
      kind: "file",
      name: file.name as string,
      size: Number(file.size ?? 0),
      mime: (file.mime_type as string | null) ?? null,
      fileId: file.id as string,
      folderId: null,
      storageKey: file.storage_key as string,
      items: null,
    };
  }

  if (row.target_type === "folder") {
    const { data: folder } = await admin
      .from("folders")
      .select("id, name")
      .eq("id", row.folder_id!)
      .maybeSingle();
    if (!folder) return null;
    return {
      ...base,
      kind: "folder",
      name: folder.name as string,
      size: null,
      mime: null,
      fileId: null,
      folderId: folder.id as string,
      storageKey: null,
      items: null,
    };
  }

  // bundle
  const items = await loadBundleItems(admin, row.id);
  if (items.length === 0) return null; // every member gone → dead link
  return {
    ...base,
    kind: "bundle",
    name: `${items.length} elemente`,
    size: null,
    mime: null,
    fileId: null,
    folderId: null,
    storageKey: null,
    items,
  };
}

// Register an access: bump the counter atomically, and — if the owner asked to
// be notified and we haven't pinged recently for this link — send a bell notif.
// Throttled to at most once per link per NOTIFY_THROTTLE_MS to avoid flooding.
const NOTIFY_THROTTLE_MS = 10 * 60 * 1000;
async function registerAccess(share: ResolvedShare): Promise<void> {
  await bumpAccess(share.id);
  if (!share.notifyOnAccess) return;
  const now = Date.now();
  const last = share.lastNotifiedAt ? new Date(share.lastNotifiedAt).getTime() : 0;
  if (now - last < NOTIFY_THROTTLE_MS) return;
  try {
    const admin = createAdminClient();
    // Claim the notify slot first (best-effort throttle) so concurrent hits
    // don't all fire.
    await admin
      .from("share_links")
      .update({ last_notified_at: new Date(now).toISOString() })
      .eq("id", share.id);
    await notifyUserEvent(
      share.ownerId,
      "share_accessed",
      { nume: share.name },
      `${appOrigin()}/links`,
    );
  } catch {
    // non-critical
  }
}

// A bundle's live members (skips files that were trashed/removed).
async function loadBundleItems(
  admin: ReturnType<typeof createAdminClient>,
  shareId: string,
): Promise<BundleItem[]> {
  const { data } = await admin
    .from("share_link_items")
    .select(
      "file_id, folder_id, files(id, name, size, storage_key, deleted_at), folders(id, name)",
    )
    .eq("share_id", shareId);

  type Rel<T> = T | T[] | null;
  const one = <T,>(v: Rel<T>): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

  const out: BundleItem[] = [];
  for (const r of (data ?? []) as {
    file_id: string | null;
    folder_id: string | null;
    files: Rel<{ id: string; name: string; size: number; storage_key: string; deleted_at: string | null }>;
    folders: Rel<{ id: string; name: string }>;
  }[]) {
    if (r.file_id) {
      const f = one(r.files);
      if (f && !f.deleted_at) {
        out.push({
          kind: "file",
          name: f.name,
          size: Number(f.size ?? 0),
          fileId: f.id,
          folderId: null,
          storageKey: f.storage_key,
        });
      }
    } else if (r.folder_id) {
      const fd = one(r.folders);
      if (fd) {
        out.push({
          kind: "folder",
          name: fd.name,
          size: null,
          fileId: null,
          folderId: fd.id,
          storageKey: null,
        });
      }
    }
  }
  return out;
}

// Atomic access-count bump via SECURITY DEFINER RPC (never loses increments).
async function bumpAccess(id: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.rpc("bump_share_access", { p_id: id });
  } catch {
    // non-critical
  }
}

// Minimal locked payload — reveals nothing about the shared item until unlocked.
function lockedPage(): SharePageData {
  return {
    kind: "file",
    label: "",
    name: "",
    size: null,
    expiryText: "",
    previewKind: null,
    previewUrl: null,
    tree: null,
    locked: true,
  };
}

// Guard: how many files at most we presign/render for a shared folder tree.
const MAX_TREE_FILES = 1000;

// Build a browsable tree for a shared folder: subfolders (recursive) + files,
// presigning previewable files. Owner-scoped, service-role.
async function buildFolderTree(
  admin: ReturnType<typeof createAdminClient>,
  rootId: string,
  ownerId: string,
): Promise<ShareFolderNode | null> {
  const { data: folderRows } = await admin
    .from("folders")
    .select("id, name, parent_id")
    .eq("owner_id", ownerId);
  const all = (folderRows ?? []) as {
    id: string;
    name: string;
    parent_id: string | null;
  }[];
  const byId = new Map(all.map((f) => [f.id, f]));
  if (!byId.has(rootId)) return null;

  const childFolders = new Map<string, typeof all>();
  for (const f of all) {
    if (!f.parent_id) continue;
    const arr = childFolders.get(f.parent_id) ?? [];
    arr.push(f);
    childFolders.set(f.parent_id, arr);
  }

  // Subtree folder ids (root + descendants).
  const subIds: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    subIds.push(cur);
    for (const c of childFolders.get(cur) ?? []) stack.push(c.id);
  }

  const { data: fileRows } = await admin
    .from("files")
    .select("id, name, size, storage_key, folder_id")
    .eq("owner_id", ownerId)
    .is("deleted_at", null)
    .in("folder_id", subIds)
    .limit(MAX_TREE_FILES);
  const files = (fileRows ?? []) as {
    id: string;
    name: string;
    size: number;
    storage_key: string;
    folder_id: string | null;
  }[];

  // Presign each file: a download URL for all, plus an inline URL for the
  // previewable ones (best-effort, in parallel).
  const filesByFolder = new Map<string, ShareFileNode[]>();
  await Promise.all(
    files.map(async (f) => {
      const previewKind = sharePreviewKind(f.name);
      const [downloadUrl, previewUrl] = await Promise.all([
        presignDownload(f.storage_key, f.name),
        previewKind ? presignInline(f.storage_key) : Promise.resolve(null),
      ]);
      const node: ShareFileNode = {
        name: f.name,
        size: Number(f.size ?? 0),
        previewKind,
        previewUrl,
        downloadUrl,
      };
      const key = f.folder_id ?? "";
      const arr = filesByFolder.get(key) ?? [];
      arr.push(node);
      filesByFolder.set(key, arr);
    }),
  );

  const sortByName = <T extends { name: string }>(a: T, b: T) =>
    a.name.localeCompare(b.name, "ro");

  const build = (id: string): ShareFolderNode => {
    const f = byId.get(id)!;
    const folders = (childFolders.get(id) ?? [])
      .map((c) => build(c.id))
      .sort(sortByName);
    const nodeFiles = (filesByFolder.get(id) ?? []).slice().sort(sortByName);
    return { id, name: f.name, folders, files: nodeFiles };
  };
  return build(rootId);
}

const SINGLE_LABEL: Record<"file" | "folder", string> = {
  file: "Fișier partajat",
  folder: "Folder partajat",
};

// Total bytes of every file in a tree (recursive) — the shared item's size,
// whatever its shape (folder, bundle of files+folders, etc).
function sumTreeBytes(node: ShareFolderNode): number {
  let bytes = node.files.reduce((s, f) => s + (f.size ?? 0), 0);
  for (const sub of node.folders) bytes += sumTreeBytes(sub);
  return bytes;
}

// Romanian count phrases, e.g. "1 folder" / "2 foldere", "1 fișier" / "2 fișiere".
function foldersPhrase(n: number): string {
  return `${n} ${n === 1 ? "folder" : "foldere"}`;
}
function filesPhrase(n: number): string {
  return `${n} ${n === 1 ? "fișier" : "fișiere"}`;
}

// Name + kicker for a bundle, worded by what it contains: all files, all
// folders, or "X foldere și Y fișiere" when mixed.
function bundleTitle(items: { kind: "file" | "folder" }[]): {
  label: string;
  name: string;
} {
  const nf = items.filter((i) => i.kind === "folder").length;
  const ff = items.filter((i) => i.kind === "file").length;
  if (nf > 0 && ff > 0) {
    return {
      label: "Elemente partajate",
      name: `${foldersPhrase(nf)} și ${filesPhrase(ff)}`,
    };
  }
  if (nf > 0) return { label: "Foldere partajate", name: foldersPhrase(nf) };
  return { label: "Fișiere partajate", name: filesPhrase(ff) };
}

// Everything the public page needs. A password-protected link returns a locked
// payload (no content) and is NOT counted as an access until unlocked.
export async function getSharePage(token: string): Promise<SharePageData | null> {
  const share = await resolveShare(token);
  if (!share) return null;
  if (share.hasPassword) return lockedPage();
  await registerAccess(share);
  return buildFullPageData(share);
}

// Verify a password for a protected link; on success return the full content
// (and count the access). Returns { error } on a wrong password, null if the
// link is gone.
export async function unlockSharePage(
  token: string,
  password: string,
): Promise<SharePageData | { error: string } | null> {
  const share = await resolveShare(token);
  if (!share) return null;
  if (share.hasPassword) {
    const ok = await verifySharePassword(password ?? "", share.passwordHash!);
    if (!ok) return { error: "Parolă greșită." };
  }
  await registerAccess(share);
  return buildFullPageData(share);
}

// Build the full (unlocked) page payload for an already-resolved share.
async function buildFullPageData(share: ResolvedShare): Promise<SharePageData> {
  // Single previewable file → one inline URL (and count it as egress).
  let previewKind: SharePreviewKind = null;
  let previewUrl: string | null = null;
  if (share.kind === "file" && share.storageKey) {
    previewKind = sharePreviewKind(share.name);
    if (previewKind) previewUrl = await presignInline(share.storageKey);
    after(() =>
      logEgress(share.size ?? 0, "preview", {
        userId: share.ownerId,
        fileId: share.fileId ?? undefined,
      }),
    );
  }

  // Browsable contents. A folder → its own tree. A bundle → a synthetic root
  // whose folder members are full trees (so a visitor can enter them) and whose
  // file members are previewable leaves.
  let tree: ShareFolderNode | null = null;
  if (share.kind === "folder" && share.folderId) {
    tree = await buildFolderTree(createAdminClient(), share.folderId, share.ownerId);
  } else if (share.kind === "bundle" && share.items) {
    const admin = createAdminClient();
    const folders: ShareFolderNode[] = [];
    const files: ShareFileNode[] = [];
    for (const it of share.items) {
      if (it.kind === "folder" && it.folderId) {
        const sub = await buildFolderTree(admin, it.folderId, share.ownerId);
        if (sub) folders.push(sub);
      } else if (it.kind === "file" && it.storageKey) {
        const pk = sharePreviewKind(it.name);
        const [downloadUrl, pu] = await Promise.all([
          presignDownload(it.storageKey, it.name),
          pk ? presignInline(it.storageKey) : Promise.resolve(null),
        ]);
        files.push({
          name: it.name,
          size: it.size,
          previewKind: pk,
          previewUrl: pu,
          downloadUrl,
        });
      }
    }
    tree = { id: "bundle-root", name: "", folders, files };
  }

  const title =
    share.kind === "bundle" && share.items
      ? bundleTitle(share.items)
      : { label: SINGLE_LABEL[share.kind as "file" | "folder"], name: share.name };

  return {
    kind: share.kind,
    label: title.label,
    name: title.name,
    // Single file → its own size; folder/bundle → total bytes of all files.
    size: tree ? sumTreeBytes(tree) : share.size,
    expiryText: expiryLabel(share.expiresAt, Date.now()),
    previewKind,
    previewUrl,
    tree,
    locked: false,
  };
}

// Gate a download request: enforce the password (via the unlock cookie the
// route passes as `cookieOk`) and the download limit (consumed atomically), in
// one place before any bytes are served. Returns { ok } to proceed or a status
// to reject with. Every download — file, folder, bundle, sub-folder — passes
// through here exactly once.
export async function shareDownloadGate(
  token: string,
  cookieOk: boolean,
): Promise<{ ok: true } | { status: number }> {
  const share = await resolveShare(token);
  if (!share) return { status: 404 };
  if (share.hasPassword && !cookieOk) return { status: 401 };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("try_consume_share_download", {
    p_id: share.id,
  });
  if (error) return { status: 500 };
  if (data !== true) return { status: 403 }; // download limit reached
  return { ok: true };
}

// Presigned download URL for a shared FILE (the public route redirects to it).
export async function getShareFileDownloadUrl(
  token: string,
): Promise<{ url: string; name: string } | null> {
  const share = await resolveShare(token);
  if (!share || share.kind !== "file" || !share.storageKey) return null;
  const url = await presignDownload(share.storageKey, share.name);
  after(() => logEgress(share.size ?? 0, "download", { userId: share.ownerId }));
  return { url, name: share.name };
}

// Every file in a folder's subtree — owner-scoped, service-role. Shared by the
// folder link and the bundle zip.
async function folderSubtreeEntries(
  admin: ReturnType<typeof createAdminClient>,
  folderId: string,
  ownerId: string,
  prefix: string,
): Promise<{ entries: { key: string; path: string }[]; bytes: number }> {
  const { data: folderRows } = await admin
    .from("folders")
    .select("id, name, parent_id")
    .eq("owner_id", ownerId);
  const list = (folderRows ?? []) as {
    id: string;
    name: string;
    parent_id: string | null;
  }[];
  const byId = new Map(list.map((f) => [f.id, f]));
  const target = byId.get(folderId);
  if (!target) return { entries: [], bytes: 0 };

  const childrenOf = new Map<string, string[]>();
  for (const f of list) {
    if (!f.parent_id) continue;
    const arr = childrenOf.get(f.parent_id) ?? [];
    arr.push(f.id);
    childrenOf.set(f.parent_id, arr);
  }
  const pathOf = new Map<string, string>([[target.id, prefix]]);
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
    .eq("owner_id", ownerId)
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
    path: `${pathOf.get(f.folder_id ?? "") ?? prefix}/${f.name}`,
  }));
  const bytes = files.reduce((s, f) => s + Number(f.size ?? 0), 0);
  return { entries, bytes };
}

// Zip manifest for a shared FOLDER.
export async function getShareFolderManifest(
  token: string,
): Promise<{ name: string; files: { key: string; path: string }[] } | null> {
  const share = await resolveShare(token);
  if (!share || share.kind !== "folder" || !share.folderId) return null;

  const admin = createAdminClient();
  const { data: folder } = await admin
    .from("folders")
    .select("name")
    .eq("id", share.folderId)
    .maybeSingle();
  const name = (folder?.name as string) ?? "folder";
  const { entries, bytes } = await folderSubtreeEntries(
    admin,
    share.folderId,
    share.ownerId,
    name,
  );
  after(() => logEgress(bytes, "folder", { userId: share.ownerId }));
  return { name, files: entries };
}

// Zip manifest for a BUNDLE: files at the root by name, folders as subtrees.
export async function getShareBundleManifest(
  token: string,
): Promise<{ name: string; files: { key: string; path: string }[] } | null> {
  const share = await resolveShare(token);
  if (!share || share.kind !== "bundle" || !share.items) return null;

  const admin = createAdminClient();
  const entries: { key: string; path: string }[] = [];
  let bytes = 0;
  for (const item of share.items) {
    if (item.kind === "file" && item.storageKey) {
      entries.push({ key: item.storageKey, path: item.name });
      bytes += item.size ?? 0;
    } else if (item.kind === "folder" && item.folderId) {
      const sub = await folderSubtreeEntries(
        admin,
        item.folderId,
        share.ownerId,
        item.name,
      );
      entries.push(...sub.entries);
      bytes += sub.bytes;
    }
  }
  after(() => logEgress(bytes, "folder", { userId: share.ownerId }));
  return { name: `partajare-${share.token.slice(0, 8)}`, files: entries };
}

// Every folder id reachable within a share: the shared folder's subtree, or the
// union of a bundle's folder members' subtrees. Gates per-folder downloads.
async function shareFolderIds(
  admin: ReturnType<typeof createAdminClient>,
  roots: string[],
  ownerId: string,
): Promise<Set<string>> {
  const { data } = await admin
    .from("folders")
    .select("id, parent_id")
    .eq("owner_id", ownerId);
  const list = (data ?? []) as { id: string; parent_id: string | null }[];
  const children = new Map<string, string[]>();
  for (const f of list) {
    if (!f.parent_id) continue;
    const a = children.get(f.parent_id) ?? [];
    a.push(f.id);
    children.set(f.parent_id, a);
  }
  const set = new Set<string>();
  const stack = [...roots];
  while (stack.length) {
    const cur = stack.pop()!;
    if (set.has(cur)) continue;
    set.add(cur);
    for (const c of children.get(cur) ?? []) stack.push(c);
  }
  return set;
}

// Zip manifest for ONE sub-folder within a share (the per-folder download in the
// tree). The folder must belong to the share — a visitor can never fetch a
// folder outside what was actually shared.
export async function getShareSubfolderManifest(
  token: string,
  folderId: string,
): Promise<{ name: string; files: { key: string; path: string }[] } | null> {
  if (typeof folderId !== "string" || !UUID_RE.test(folderId)) return null;
  const share = await resolveShare(token);
  if (!share) return null;

  let roots: string[] = [];
  if (share.kind === "folder" && share.folderId) {
    roots = [share.folderId];
  } else if (share.kind === "bundle" && share.items) {
    roots = share.items
      .filter((i) => i.kind === "folder" && i.folderId)
      .map((i) => i.folderId!);
  } else {
    return null;
  }

  const admin = createAdminClient();
  const allowed = await shareFolderIds(admin, roots, share.ownerId);
  if (!allowed.has(folderId)) return null; // folder is not part of this share

  const { data: folder } = await admin
    .from("folders")
    .select("name")
    .eq("id", folderId)
    .maybeSingle();
  const name = (folder?.name as string) ?? "folder";
  const { entries, bytes } = await folderSubtreeEntries(
    admin,
    folderId,
    share.ownerId,
    name,
  );
  after(() => logEgress(bytes, "folder", { userId: share.ownerId }));
  return { name, files: entries };
}

// Cron backstop: hard-delete links already past expiry.
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
