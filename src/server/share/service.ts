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
  expiryLabel,
  isExpired,
  sharePath,
  sharePreviewKind,
  type ShareTargetType,
  type ShareLinkKind,
  type SharePreviewKind,
  type MyShareLinkView,
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
};

// Cap on how many items one bundle link can carry (guards a hostile client).
const MAX_BUNDLE_ITEMS = 100;

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
      "id, token, target_type, file_id, folder_id, expires_at, access_count, created_at, files(name), folders(name), share_link_items(count)",
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
    files: NameRel;
    folders: NameRel;
    share_link_items: { count: number }[] | null;
  };
  const pickName = (v: NameRel): string | null =>
    Array.isArray(v) ? (v[0]?.name ?? null) : (v?.name ?? null);

  return ((data ?? []) as Row[])
    .filter((r) => !isExpired(r.expires_at, now))
    .map((r) => {
      const bundleCount = r.share_link_items?.[0]?.count ?? 0;
      const isBundle = r.target_type === "bundle";
      return {
        id: r.id,
        token: r.token,
        url: sharePath(r.token),
        kind: r.target_type,
        name: isBundle
          ? `${bundleCount} elemente`
          : (pickName(r.files) ?? pickName(r.folders) ?? "(indisponibil)"),
        itemCount: isBundle ? bundleCount : 1,
        expiresAt: r.expires_at,
        accessCount: r.access_count,
        createdAt: r.created_at,
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
};

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
    await admin.from("share_links").delete().eq("id", row.id);
    return null;
  }

  const base = {
    id: row.id,
    token: row.token,
    expiresAt: row.expires_at,
    ownerId: row.owner_id,
  };

  if (row.target_type === "file") {
    const { data: file } = await admin
      .from("files")
      .select("id, name, size, mime_type, storage_key, deleted_at")
      .eq("id", row.file_id!)
      .maybeSingle();
    if (!file || file.deleted_at) return null;
    if (opts?.bump) await bumpAccess(row.id);
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
    if (opts?.bump) await bumpAccess(row.id);
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
  if (opts?.bump) await bumpAccess(row.id);
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

export type ShareBundleItem = { kind: "file" | "folder"; name: string; size: number | null };

export type SharePageData = {
  kind: ShareLinkKind;
  name: string;
  size: number | null;
  expiryText: string;
  previewKind: SharePreviewKind;
  previewUrl: string | null; // previewable single file only
  items: ShareBundleItem[] | null; // bundle only
};

// Everything the public page needs. Counts as an access.
export async function getSharePage(token: string): Promise<SharePageData | null> {
  const share = await resolveShare(token, { bump: true });
  if (!share) return null;

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

  return {
    kind: share.kind,
    name: share.name,
    size: share.size,
    expiryText: expiryLabel(share.expiresAt, Date.now()),
    previewKind,
    previewUrl,
    items: share.items
      ? share.items.map((i) => ({ kind: i.kind, name: i.name, size: i.size }))
      : null,
  };
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
