import "server-only";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireActiveUser } from "@/server/auth/active-user";
import * as filesRepo from "@/server/files/repository";
import { myUsage } from "@/server/files/service";
import { copyObject, deleteObject } from "@/server/storage/b2";
import { notifyUserEvent } from "@/server/notifications/service";
import {
  sendTransferRequest,
  sendTransferAccepted,
  sendTransferDeclined,
} from "@/server/email/resend";
import { formatBytes } from "@/lib/format";
import { after } from "next/server";
import { presignInline } from "@/server/storage/b2";
import { logEgress } from "@/server/billing/egress";
import { sharePreviewKind } from "@/lib/share";
import {
  transferItemLabel,
  type TransferMode,
  type UserSearchResult,
  type ReceivedTransferView,
  type SentTransferView,
  type TransferContents,
  type TransferFolderNode,
  type TransferFileNode,
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
// Cap on how many recipients a single "send" can fan out to.
const MAX_TRANSFER_RECIPIENTS = 10;
// How many of the sender's own past transfers to scan when ranking frequent
// recipients — recent history is what matters, not the whole lifetime log.
const FREQUENT_RECIPIENTS_SCAN = 200;

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

// One transfer row + its items, per recipient — every recipient gets an
// independent request they accept/decline on their own; the underlying
// file/folder ids are simply referenced by more than one transfer_items set
// (the source stays owned by the sender until whichever recipient accepts).
export async function createTransfer(input: {
  targets: { type: "file" | "folder"; id: string }[];
  recipientIds: string[];
  mode: TransferMode;
}): Promise<{ ids: string[] }> {
  const { id: senderId } = await requireActiveUser();

  const targets = input.targets ?? [];
  if (targets.length === 0) throw new Error("Niciun element de trimis.");
  if (targets.length > MAX_TRANSFER_ITEMS) {
    throw new Error(`Poți trimite cel mult ${MAX_TRANSFER_ITEMS} elemente.`);
  }
  const recipientIds = [...new Set(input.recipientIds ?? [])];
  if (recipientIds.length === 0) throw new Error("Alege cel puțin un destinatar.");
  if (recipientIds.length > MAX_TRANSFER_RECIPIENTS) {
    throw new Error(`Poți trimite cel mult către ${MAX_TRANSFER_RECIPIENTS} utilizatori odată.`);
  }
  for (const id of recipientIds) assertId(id, "Destinatar invalid.");
  if (recipientIds.includes(senderId)) {
    throw new Error("Nu poți trimite un transfer către tine însuți.");
  }
  if (input.mode !== "copy" && input.mode !== "move") {
    throw new Error("Mod de transfer invalid.");
  }
  // A move deletes the sender's originals the instant ONE recipient accepts —
  // with several recipients, everyone else's pending request would then point
  // at files that no longer exist. Copy has no such conflict.
  if (input.mode === "move" && recipientIds.length > 1) {
    throw new Error("Mutarea definitivă este permisă doar către un singur destinatar.");
  }

  for (const t of targets) await assertOwnsTarget(t);

  // profiles RLS is self-or-admin-only, so the sender can't read another
  // user's row through their own session — verify existence + grab
  // usernames (for notifications) via the service role, in one batch.
  const admin = createAdminClient();
  const { data: recipientRows } = await admin
    .from("profiles")
    .select("id, username")
    .in("id", recipientIds);
  const recipients = (recipientRows ?? []) as { id: string; username: string }[];
  if (recipients.length !== recipientIds.length) {
    throw new Error("Unul sau mai mulți utilizatori nu există.");
  }

  const supabase = await createClient();
  const { data: sender } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", senderId)
    .single();
  const senderUsername = (sender?.username as string | undefined) ?? "Un utilizator";

  const folderCount = targets.filter((t) => t.type === "folder").length;
  const fileCount = targets.filter((t) => t.type === "file").length;
  const label = transferItemLabel(folderCount, fileCount);

  const ids: string[] = [];
  for (const recipient of recipients) {
    const { data: transfer, error } = await supabase
      .from("transfers")
      .insert({ sender_id: senderId, recipient_id: recipient.id, mode: input.mode })
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
      // Roll back this one orphan transfer row so we never leave it empty —
      // any recipients already created before it stay valid.
      await supabase.from("transfers").delete().eq("id", transfer.id);
      throw itemsError;
    }
    ids.push(transfer.id as string);

    await notifyUserEvent(
      recipient.id,
      "transfer_request",
      { utilizator: senderUsername, elemente: label },
      "/transfers",
    );
    const { data: authUser } = await admin.auth.admin.getUserById(recipient.id);
    if (authUser.user?.email) {
      void sendTransferRequest({
        email: authUser.user.email,
        senderUsername,
        itemLabel: label,
      }).catch(() => {});
    }
  }

  return { ids };
}

// Recipients the caller has sent to most often, most-recent-first among ties
// — lets the picker surface "usually sent to X" without the user searching
// again. Reads only the caller's own transfers (their own RLS session).
export async function getFrequentRecipients(): Promise<UserSearchResult[]> {
  const { id: senderId } = await requireActiveUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("transfers")
    .select("recipient_id")
    .eq("sender_id", senderId)
    .order("created_at", { ascending: false })
    .limit(FREQUENT_RECIPIENTS_SCAN);
  const rows = (data ?? []) as { recipient_id: string }[];
  if (rows.length === 0) return [];

  const order: string[] = []; // first-seen order == most-recent order
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!counts.has(r.recipient_id)) order.push(r.recipient_id);
    counts.set(r.recipient_id, (counts.get(r.recipient_id) ?? 0) + 1);
  }
  const ranked = order
    .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
    .slice(0, 5);

  const admin = createAdminClient();
  const usernames = await usernamesOf(admin, ranked);
  return ranked
    .filter((id) => usernames.has(id))
    .map((id) => ({ id, username: usernames.get(id)! }));
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
    .select("id, sender_id, mode, created_at, expires_at, progress_done, progress_total")
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
    progress_done: number;
    progress_total: number | null;
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
      progressDone: t.progress_done,
      progressTotal: t.progress_total,
    };
  });
}

// Everything the caller has sent, any status, newest first.
export async function listSentTransfers(): Promise<SentTransferView[]> {
  const { id: userId } = await requireActiveUser();
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("transfers")
    .select(
      "id, recipient_id, mode, status, created_at, expires_at, resolved_at, progress_done, progress_total",
    )
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
    progress_done: number;
    progress_total: number | null;
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
      progressDone: t.progress_done,
      progressTotal: t.progress_total,
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
// covers it; only the reads above needed the service role. `onFileDone` fires
// after each individual file lands, with its byte size — acceptTransfer uses
// it to stream progress into the transfers row.
async function copyResolvedItems(
  items: ResolvedItem[],
  recipientId: string,
  destFolderId: string | null,
  onFileDone: (bytes: number) => void,
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
      onFileDone(it.file.size);
    } else {
      await copyTreeRecursive(it.tree, recipientId, destFolderId, onFileDone);
    }
  }
}
async function copyTreeRecursive(
  node: SrcFolder,
  recipientId: string,
  destParentId: string | null,
  onFileDone: (bytes: number) => void,
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
    onFileDone(f.size);
  }
  for (const sub of node.folders) {
    await copyTreeRecursive(sub, recipientId, created.id, onFileDone);
  }
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

// ---- Browsable contents (preview-only, pending transfers) ----------------

// Mirrors buildFolderTree/buildFullPageData in server/share/service.ts:
// presign an inline URL for every previewable file, best-effort in parallel,
// and log the read as egress under the SENDER (the file's actual owner) —
// browsing a pending transfer reads the sender's B2 objects same as a share
// preview would.
async function buildContentFileNode(senderId: string, f: SrcFile): Promise<TransferFileNode> {
  const previewKind = sharePreviewKind(f.name);
  const previewUrl = previewKind ? await presignInline(f.storageKey) : null;
  if (previewUrl) {
    after(() => logEgress(f.size, "preview", { userId: senderId, fileId: f.id }));
  }
  return { name: f.name, size: f.size, previewKind, previewUrl };
}

async function buildContentFolderNode(senderId: string, node: SrcFolder): Promise<TransferFolderNode> {
  const [files, folders] = await Promise.all([
    Promise.all(node.files.map((f) => buildContentFileNode(senderId, f))),
    Promise.all(node.folders.map((sub) => buildContentFolderNode(senderId, sub))),
  ]);
  return { id: node.id, name: node.name, files, folders };
}

// Preview-only browsable contents of a still-PENDING transfer, visible to
// either party (sender re-checking what they sent, recipient deciding
// whether to accept) — never on a resolved transfer, and never a download
// URL: items only actually land in the recipient's drive via acceptTransfer.
export async function getTransferContents(transferId: string): Promise<TransferContents> {
  const { id: userId } = await requireActiveUser();
  assertId(transferId, "Transfer invalid.");
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("transfers")
    .select("id, sender_id, recipient_id, status")
    .eq("id", transferId)
    .maybeSingle();
  if (!row) throw new Error("Cerere de transfer inexistentă.");
  const transfer = row as { id: string; sender_id: string; recipient_id: string; status: string };
  if (transfer.sender_id !== userId && transfer.recipient_id !== userId) {
    throw new Error("Cerere de transfer inexistentă.");
  }
  if (transfer.status !== "pending") {
    throw new Error("Conținutul nu mai este disponibil pentru o cerere rezolvată.");
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

  const files: TransferFileNode[] = [];
  const folders: TransferFolderNode[] = [];
  for (const it of resolved) {
    if (it.kind === "file") files.push(await buildContentFileNode(transfer.sender_id, it.file));
    else folders.push(await buildContentFolderNode(transfer.sender_id, it.tree));
  }
  return { files, folders };
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

  // Mark the row as actively processing — both parties' clients are already
  // subscribed to `transfers` via Realtime, so this flips their UI from
  // Refuză/Acceptă straight into a live progress bar for the whole copy.
  await admin
    .from("transfers")
    .update({ progress_total: totalBytes, progress_done: 0 })
    .eq("id", transfer.id);

  // Stream progress as files land, throttled so a folder with hundreds of
  // small files doesn't turn into hundreds of writes — one every ~400ms is
  // plenty smooth for a progress bar, plus we always flush the final value.
  let doneBytes = 0;
  let lastWriteAt = 0;
  const PROGRESS_THROTTLE_MS = 400;
  const onFileDone = (bytes: number) => {
    doneBytes += bytes;
    const now = Date.now();
    if (now - lastWriteAt < PROGRESS_THROTTLE_MS) return;
    lastWriteAt = now;
    void admin.from("transfers").update({ progress_done: doneBytes }).eq("id", transfer.id);
  };

  await copyResolvedItems(resolved, recipientId, destinationFolderId, onFileDone);
  await admin.from("transfers").update({ progress_done: doneBytes }).eq("id", transfer.id);

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
  const recipientUsername =
    (recipientProfile?.username as string | undefined) ?? "Destinatarul";
  const itemLabel = transferItemLabel(
    resolved.filter((it) => it.kind === "folder").length,
    resolved.filter((it) => it.kind === "file").length,
  );

  await notifyUserEvent(
    transfer.sender_id,
    "transfer_accepted",
    { utilizator: recipientUsername },
    "/transfers",
  );
  const { data: senderAuth } = await admin.auth.admin.getUserById(transfer.sender_id);
  if (senderAuth.user?.email) {
    void sendTransferAccepted({
      email: senderAuth.user.email,
      recipientUsername,
      itemLabel,
    }).catch(() => {});
  }

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
  const senderId = row.sender_id as string;

  await notifyUserEvent(senderId, "transfer_declined", {}, "/transfers");

  const { data: itemRows } = await admin
    .from("transfer_items")
    .select("file_id, folder_id")
    .eq("transfer_id", transferId);
  const items = (itemRows ?? []) as { file_id: string | null; folder_id: string | null }[];
  const itemLabel = transferItemLabel(
    items.filter((i) => i.folder_id).length,
    items.filter((i) => i.file_id).length,
  );
  const { data: senderAuth } = await admin.auth.admin.getUserById(senderId);
  if (senderAuth.user?.email) {
    void sendTransferDeclined({ email: senderAuth.user.email, itemLabel }).catch(() => {});
  }

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
    await notifyUserEvent(r.sender_id, "transfer_expired", {}, "/transfers");
  }
  return rows.length;
}
