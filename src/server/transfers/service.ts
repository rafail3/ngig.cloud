import "server-only";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveUser } from "@/server/auth/active-user";
import * as filesRepo from "@/server/files/repository";
import { myUsage } from "@/server/files/service";
import { copyObject, deleteObject } from "@/server/storage/b2";
import { notifyUserEvent } from "@/server/notifications/service";
import { sendTransferRequest } from "@/server/email/resend";
import { formatBytes } from "@/lib/format";
import {
  transferItemLabel,
  type TransferMode,
  type UserSearchResult,
  type ReceivedTransferView,
  type SentTransferView,
} from "@/lib/transfer";

// ---------------------------------------------------------------------------
// User-to-user transfers ("Trimite utilizator").
//
// SECURITY MODEL
//  - CREATING a transfer runs on the sender's own RLS session: every target is
//    ownership-checked via the normal owner-scoped reads (same as share links),
//    and both the transfers row (sender_id) and its items are written through
//    that same session — RLS enforces the sender can't reference someone
//    else's files or attach items to a foreign transfer.
//  - Two parties, no RLS update policy: accepting/declining/cancelling has
//    cross-user side effects (reading — and for a move, deleting — the OTHER
//    party's rows) that RLS cannot express. Every transition runs through the
//    service-role client with explicit sender_id/recipient_id/status checks in
//    code, the same pattern already used for account wipes and admin actions.
//  - COPYING, however, writes through the RECIPIENT's own session (repo.insertFile
//    /insertFolder with owner_id = recipientId): the recipient IS the caller
//    during acceptTransfer, so the ordinary "owner can insert" RLS policy
//    covers it — only the READ of the sender's source data needs the
//    service-role client.
//  - MOVE mode deletes the sender's originals only AFTER every item has copied
//    successfully. If the copy loop throws partway, nothing is deleted — worst
//    case is a partial duplicate at the destination, never lost data.
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertId(id: string, label: string): void {
  if (typeof id !== "string" || !UUID_RE.test(id)) throw new Error(label);
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && e.code === "23505";
}

// Cap on how many items one transfer can carry (guards a hostile client).
const MAX_TRANSFER_ITEMS = 100;

type Admin = ReturnType<typeof createAdminClient>;

// ---- Live username search ---------------------------------------------------

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  await requireActiveUser();
  const q = query.trim();
  if (q.length < 2) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_users", { q });
  if (error) throw error;
  return (data ?? []) as UserSearchResult[];
}

// ---- Create ------------------------------------------------------------------

async function assertOwnsTarget(t: { type: "file" | "folder"; id: string }) {
  assertId(t.id, "Element invalid.");
  if (t.type === "file") {
    const file = await filesRepo.getFileById(t.id);
    if (!file) throw new Error("Fișier inexistent.");
    if (file.deleted_at) throw new Error("Fișierul este în coșul de gunoi.");
  } else {
    const folder = await filesRepo.getFolder(t.id);
    if (!folder) throw new Error("Folder inexistent.");
  }
}

export async function createTransfer(input: {
  targets: { type: "file" | "folder"; id: string }[];
  recipientId: string;
  mode: TransferMode;
}): Promise<{ id: string }> {
  const { id: senderId } = await requireActiveUser();

  const targets = input.targets ?? [];
  if (targets.length === 0) throw new Error("Niciun element de trimis.");
  if (targets.length > MAX_TRANSFER_ITEMS) {
    throw new Error(`Poți trimite cel mult ${MAX_TRANSFER_ITEMS} elemente.`);
  }
  assertId(input.recipientId, "Destinatar invalid.");
  if (input.recipientId === senderId) {
    throw new Error("Nu poți trimite un transfer către tine însuți.");
  }
  if (input.mode !== "copy" && input.mode !== "move") {
    throw new Error("Mod de transfer invalid.");
  }

  for (const t of targets) await assertOwnsTarget(t);

  // profiles RLS is self-or-admin-only, so the sender can't read the
  // recipient's row through their own session — verify existence + grab the
  // username (for the notification) via the service role.
  const admin = createAdminClient();
  const { data: recipient } = await admin
    .from("profiles")
    .select("username")
    .eq("id", input.recipientId)
    .maybeSingle();
  if (!recipient) throw new Error("Utilizator inexistent.");

  const supabase = await createClient();
  const { data: transfer, error } = await supabase
    .from("transfers")
    .insert({ sender_id: senderId, recipient_id: input.recipientId, mode: input.mode })
    .select("id")
    .single();
  if (error) throw error;

  const rows = targets.map((t) => ({
    transfer_id: transfer.id as string,
    file_id: t.type === "file" ? t.id : null,
    folder_id: t.type === "folder" ? t.id : null,
  }));
  const { error: itemsError } = await supabase.from("transfer_items").insert(rows);
  if (itemsError) {
    // Roll back the orphan transfer row so we never leave an empty request.
    await supabase.from("transfers").delete().eq("id", transfer.id);
    throw itemsError;
  }

  const folderCount = targets.filter((t) => t.type === "folder").length;
  const fileCount = targets.filter((t) => t.type === "file").length;
  const label = transferItemLabel(folderCount, fileCount);

  const { data: sender } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", senderId)
    .single();
  const senderUsername = (sender?.username as string | undefined) ?? "Un utilizator";

  await notifyUserEvent(
    input.recipientId,
    "transfer_request",
    { utilizator: senderUsername, elemente: label },
    "/transfers",
  );
  const { data: authUser } = await admin.auth.admin.getUserById(input.recipientId);
  if (authUser.user?.email) {
    void sendTransferRequest({
      email: authUser.user.email,
      senderUsername,
      itemLabel: label,
    }).catch(() => {});
  }

  return { id: transfer.id as string };
}

// ---- Lists ---------------------------------------------------------------

// Batch-fetch usernames for a set of ids via the service role (profiles RLS
// blocks reading other users' rows through a normal session).
async function usernamesOf(admin: Admin, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await admin.from("profiles").select("id, username").in("id", ids);
  return new Map((data ?? []).map((r) => [r.id as string, r.username as string]));
}

type ItemsRow = { transfer_id: string; file_id: string | null; folder_id: string | null };

function countsByTransfer(items: ItemsRow[]): Map<string, { folders: number; files: number }> {
  const m = new Map<string, { folders: number; files: number }>();
  for (const it of items) {
    const c = m.get(it.transfer_id) ?? { folders: 0, files: 0 };
    if (it.folder_id) c.folders++;
    else c.files++;
    m.set(it.transfer_id, c);
  }
  return m;
}

// Pending requests addressed to the caller — the actionable inbox.
export async function listReceivedTransfers(): Promise<ReceivedTransferView[]> {
  const { id: userId } = await requireActiveUser();
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("transfers")
    .select("id, sender_id, mode, created_at, expires_at")
    .eq("recipient_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const transfers = (rows ?? []) as {
    id: string;
    sender_id: string;
    mode: TransferMode;
    created_at: string;
    expires_at: string;
  }[];
  if (transfers.length === 0) return [];

  const ids = transfers.map((t) => t.id);
  const { data: itemRows } = await supabase
    .from("transfer_items")
    .select("transfer_id, file_id, folder_id")
    .in("transfer_id", ids);
  const counts = countsByTransfer((itemRows ?? []) as ItemsRow[]);

  const admin = createAdminClient();
  const usernames = await usernamesOf(admin, transfers.map((t) => t.sender_id));

  return transfers.map((t) => {
    const c = counts.get(t.id) ?? { folders: 0, files: 0 };
    return {
      id: t.id,
      senderUsername: usernames.get(t.sender_id) ?? "(cont șters)",
      mode: t.mode,
      itemLabel: transferItemLabel(c.folders, c.files),
      folderCount: c.folders,
      fileCount: c.files,
      createdAt: t.created_at,
      expiresAt: t.expires_at,
    };
  });
}

// Everything the caller has sent, any status, newest first.
export async function listSentTransfers(): Promise<SentTransferView[]> {
  const { id: userId } = await requireActiveUser();
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("transfers")
    .select("id, recipient_id, mode, status, created_at, expires_at, resolved_at")
    .eq("sender_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const transfers = (rows ?? []) as {
    id: string;
    recipient_id: string;
    mode: TransferMode;
    status: SentTransferView["status"];
    created_at: string;
    expires_at: string;
    resolved_at: string | null;
  }[];
  if (transfers.length === 0) return [];

  const ids = transfers.map((t) => t.id);
  const { data: itemRows } = await supabase
    .from("transfer_items")
    .select("transfer_id, file_id, folder_id")
    .in("transfer_id", ids);
  const counts = countsByTransfer((itemRows ?? []) as ItemsRow[]);

  const admin = createAdminClient();
  const usernames = await usernamesOf(admin, transfers.map((t) => t.recipient_id));

  return transfers.map((t) => {
    const c = counts.get(t.id) ?? { folders: 0, files: 0 };
    return {
      id: t.id,
      recipientUsername: usernames.get(t.recipient_id) ?? "(cont șters)",
      mode: t.mode,
      itemLabel: transferItemLabel(c.folders, c.files),
      folderCount: c.folders,
      fileCount: c.files,
      status: t.status,
      createdAt: t.created_at,
      expiresAt: t.expires_at,
      resolvedAt: t.resolved_at,
    };
  });
}

// ---- Resolving + copying the sender's data (service-role reads) ----------

type SrcFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string | null;
  storageKey: string;
};
type SrcFolder = { id: string; name: string; files: SrcFile[]; folders: SrcFolder[] };
type ResolvedItem =
  | { kind: "file"; file: SrcFile }
  | { kind: "folder"; folderId: string; tree: SrcFolder };

// Recreate a shared-service-style folder tree, but scoped to the SENDER's
// objects (owner_id = senderId), read via the service role.
async function buildSenderFolderTree(
  admin: Admin,
  rootId: string,
  senderId: string,
): Promise<SrcFolder | null> {
  const { data: folderRows } = await admin
    .from("folders")
    .select("id, name, parent_id")
    .eq("owner_id", senderId);
  const all = (folderRows ?? []) as { id: string; name: string; parent_id: string | null }[];
  const byId = new Map(all.map((f) => [f.id, f]));
  if (!byId.has(rootId)) return null;

  const childrenOf = new Map<string, typeof all>();
  for (const f of all) {
    if (!f.parent_id) continue;
    const arr = childrenOf.get(f.parent_id) ?? [];
    arr.push(f);
    childrenOf.set(f.parent_id, arr);
  }
  const subIds: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    subIds.push(cur);
    for (const c of childrenOf.get(cur) ?? []) stack.push(c.id);
  }

  const { data: fileRows } = await admin
    .from("files")
    .select("id, name, size, mime_type, storage_key, folder_id")
    .eq("owner_id", senderId)
    .is("deleted_at", null)
    .in("folder_id", subIds);
  const filesByFolder = new Map<string, SrcFile[]>();
  for (const f of (fileRows ?? []) as {
    id: string;
    name: string;
    size: number;
    mime_type: string | null;
    storage_key: string;
    folder_id: string | null;
  }[]) {
    const key = f.folder_id ?? "";
    const arr = filesByFolder.get(key) ?? [];
    arr.push({
      id: f.id,
      name: f.name,
      size: Number(f.size ?? 0),
      mimeType: f.mime_type,
      storageKey: f.storage_key,
    });
    filesByFolder.set(key, arr);
  }

  const build = (id: string): SrcFolder => {
    const f = byId.get(id)!;
    return {
      id,
      name: f.name,
      files: filesByFolder.get(id) ?? [],
      folders: (childrenOf.get(id) ?? []).map((c) => build(c.id)),
    };
  };
  return build(rootId);
}

async function resolveTransferItems(
  admin: Admin,
  senderId: string,
  items: { file_id: string | null; folder_id: string | null }[],
): Promise<ResolvedItem[]> {
  const out: ResolvedItem[] = [];
  for (const it of items) {
    if (it.file_id) {
      const { data: f } = await admin
        .from("files")
        .select("id, name, size, mime_type, storage_key, deleted_at")
        .eq("id", it.file_id)
        .eq("owner_id", senderId)
        .maybeSingle();
      if (f && !f.deleted_at) {
        out.push({
          kind: "file",
          file: {
            id: f.id as string,
            name: f.name as string,
            size: Number(f.size ?? 0),
            mimeType: (f.mime_type as string | null) ?? null,
            storageKey: f.storage_key as string,
          },
        });
      }
    } else if (it.folder_id) {
      const tree = await buildSenderFolderTree(admin, it.folder_id, senderId);
      if (tree) out.push({ kind: "folder", folderId: it.folder_id, tree });
    }
  }
  return out;
}

function sumTreeBytes(node: SrcFolder): number {
  let bytes = node.files.reduce((s, f) => s + f.size, 0);
  for (const sub of node.folders) bytes += sumTreeBytes(sub);
  return bytes;
}
function totalResolvedBytes(items: ResolvedItem[]): number {
  return items.reduce((s, it) => s + (it.kind === "file" ? it.file.size : sumTreeBytes(it.tree)), 0);
}
function collectFileKeys(node: SrcFolder): string[] {
  const keys = node.files.map((f) => f.storageKey);
  for (const sub of node.folders) keys.push(...collectFileKeys(sub));
  return keys;
}

// Create a folder for the recipient, appending " (2)", " (3)"… on a name clash
// at the destination (their existing folder is left untouched — this makes a
// genuinely new one, it never merges into it).
async function insertFolderDeduped(
  ownerId: string,
  baseName: string,
  parentId: string | null,
): Promise<{ id: string }> {
  let name = baseName;
  for (let i = 2; i <= 50; i++) {
    try {
      return await filesRepo.insertFolder({ owner_id: ownerId, name, parent_id: parentId });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      name = `${baseName} (${i})`;
    }
  }
  throw new Error("Nu am putut crea folderul de destinație.");
}

// Copy every resolved item into the recipient's drive. Writes go through the
// RECIPIENT's own session (repo.insertFile/insertFolder) — the caller of
// acceptTransfer IS the recipient, so the normal owner-scoped insert policy
// covers it; only the reads above needed the service role.
async function copyResolvedItems(
  items: ResolvedItem[],
  recipientId: string,
  destFolderId: string | null,
): Promise<void> {
  for (const it of items) {
    if (it.kind === "file") {
      const destKey = `${recipientId}/${randomUUID()}`;
      await copyObject(it.file.storageKey, destKey);
      await filesRepo.insertFile({
        owner_id: recipientId,
        name: it.file.name,
        size: it.file.size,
        mime_type: it.file.mimeType,
        storage_key: destKey,
        folder_id: destFolderId,
      });
    } else {
      await copyTreeRecursive(it.tree, recipientId, destFolderId);
    }
  }
}
async function copyTreeRecursive(
  node: SrcFolder,
  recipientId: string,
  destParentId: string | null,
): Promise<void> {
  const created = await insertFolderDeduped(recipientId, node.name, destParentId);
  for (const f of node.files) {
    const destKey = `${recipientId}/${randomUUID()}`;
    await copyObject(f.storageKey, destKey);
    await filesRepo.insertFile({
      owner_id: recipientId,
      name: f.name,
      size: f.size,
      mime_type: f.mimeType,
      storage_key: destKey,
      folder_id: created.id,
    });
  }
  for (const sub of node.folders) await copyTreeRecursive(sub, recipientId, created.id);
}

// Move mode: delete the sender's originals — ONLY called after every item has
// already copied successfully. B2 objects first, then rows (folder-row delete
// cascades to its descendant folders/files automatically).
async function deleteSenderOriginals(
  admin: Admin,
  senderId: string,
  items: ResolvedItem[],
): Promise<void> {
  const keys: string[] = [];
  for (const it of items) {
    if (it.kind === "file") keys.push(it.file.storageKey);
    else keys.push(...collectFileKeys(it.tree));
  }
  await Promise.all(keys.map((k) => deleteObject(k).catch(() => {})));

  for (const it of items) {
    if (it.kind === "file") {
      await admin.from("files").delete().eq("owner_id", senderId).eq("id", it.file.id);
    } else {
      await admin.from("folders").delete().eq("owner_id", senderId).eq("id", it.folderId);
    }
  }
}

// ---- Accept / decline / cancel --------------------------------------------

type TransferRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: string;
  mode: TransferMode;
  expires_at: string;
};

export async function acceptTransfer(
  transferId: string,
  destinationFolderId: string | null,
): Promise<{ error?: string }> {
  const { id: recipientId } = await requireActiveUser();
  assertId(transferId, "Transfer invalid.");
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("transfers")
    .select("id, sender_id, recipient_id, status, mode, expires_at")
    .eq("id", transferId)
    .eq("recipient_id", recipientId)
    .maybeSingle();
  if (!row) return { error: "Cerere de transfer inexistentă." };
  const transfer = row as TransferRow;
  if (transfer.status !== "pending") return { error: "Această cerere a fost deja rezolvată." };
  if (new Date(transfer.expires_at).getTime() <= Date.now()) {
    await admin
      .from("transfers")
      .update({ status: "expired", resolved_at: new Date().toISOString() })
      .eq("id", transfer.id);
    return { error: "Cererea a expirat." };
  }

  // The destination must be the recipient's own folder (or root). Session-scoped
  // read: RLS only returns it if the caller (the recipient) owns it.
  if (destinationFolderId !== null) {
    const folder = await filesRepo.getFolder(destinationFolderId);
    if (!folder) return { error: "Folder de destinație invalid." };
  }

  const { data: itemRows } = await admin
    .from("transfer_items")
    .select("file_id, folder_id")
    .eq("transfer_id", transfer.id);
  const resolved = await resolveTransferItems(
    admin,
    transfer.sender_id,
    (itemRows ?? []) as { file_id: string | null; folder_id: string | null }[],
  );
  if (resolved.length === 0) {
    // Every item was deleted by the sender before acceptance — nothing to give.
    await admin
      .from("transfers")
      .update({ status: "expired", resolved_at: new Date().toISOString() })
      .eq("id", transfer.id);
    return { error: "Elementele trimise nu mai există." };
  }

  const totalBytes = totalResolvedBytes(resolved);
  const { used, quota } = await myUsage();
  if (quota !== null && used + totalBytes > quota) {
    const free = Math.max(0, quota - used);
    return {
      error: `Spațiu insuficient — necesari ${formatBytes(totalBytes)}, disponibili ${formatBytes(free)}.`,
    };
  }

  await copyResolvedItems(resolved, recipientId, destinationFolderId);

  if (transfer.mode === "move") {
    await deleteSenderOriginals(admin, transfer.sender_id, resolved);
  }

  await admin
    .from("transfers")
    .update({ status: "accepted", resolved_at: new Date().toISOString() })
    .eq("id", transfer.id);

  const { data: recipientProfile } = await admin
    .from("profiles")
    .select("username")
    .eq("id", recipientId)
    .maybeSingle();
  await notifyUserEvent(
    transfer.sender_id,
    "transfer_accepted",
    { utilizator: (recipientProfile?.username as string | undefined) ?? "Destinatarul" },
    "/links",
  );

  return {};
}

export async function declineTransfer(transferId: string): Promise<{ error?: string }> {
  const { id: recipientId } = await requireActiveUser();
  assertId(transferId, "Transfer invalid.");
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("transfers")
    .update({ status: "declined", resolved_at: new Date().toISOString() })
    .eq("id", transferId)
    .eq("recipient_id", recipientId)
    .eq("status", "pending")
    .select("id, sender_id")
    .maybeSingle();
  if (!row) return { error: "Cerere de transfer inexistentă sau deja rezolvată." };

  await notifyUserEvent(row.sender_id as string, "transfer_declined", {}, "/links");
  return {};
}

export async function cancelTransfer(transferId: string): Promise<{ error?: string }> {
  const { id: senderId } = await requireActiveUser();
  assertId(transferId, "Transfer invalid.");
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("transfers")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("id", transferId)
    .eq("sender_id", senderId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!row) return { error: "Cerere de transfer inexistentă sau deja rezolvată." };
  return {};
}

// Cron backstop: expire pending requests past their 7-day window.
export async function purgeExpiredTransfers(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("transfers")
    .update({ status: "expired", resolved_at: new Date().toISOString() })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString())
    .select("id, sender_id");
  const rows = (data ?? []) as { id: string; sender_id: string }[];
  for (const r of rows) {
    await notifyUserEvent(r.sender_id, "transfer_expired", {}, "/links");
  }
  return rows.length;
}
