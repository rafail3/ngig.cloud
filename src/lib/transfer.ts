// Client-safe vocabulary for user-to-user transfers ("Trimite utilizator").
// No server imports — pulled into the share modal and the /transfers page.

import type { SharePreviewKind } from "./share";

export type TransferMode = "copy" | "move";
export type TransferStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "expired";

export type UserSearchResult = { id: string; username: string };

// Romanian count phrases, matching the wording used for share bundles.
function foldersPhrase(n: number): string {
  return `${n} ${n === 1 ? "folder" : "foldere"}`;
}
function filesPhrase(n: number): string {
  return `${n} ${n === 1 ? "fișier" : "fișiere"}`;
}

// "2 fișiere" / "1 folder" / "2 foldere și 1 fișier" — same phrasing rule as
// the public share page, for consistency across the app.
export function transferItemLabel(folderCount: number, fileCount: number): string {
  if (folderCount > 0 && fileCount > 0) {
    return `${foldersPhrase(folderCount)} și ${filesPhrase(fileCount)}`;
  }
  if (folderCount > 0) return foldersPhrase(folderCount);
  return filesPhrase(fileCount);
}

// What a transfer card leads with. "1 folder" is a count, not information —
// the name is what the user actually recognises. Falls back to the count label
// when the names are gone (a completed MOVE cascades its item rows away, so
// old history genuinely has nothing left to name).
export function transferTitle(
  names: string[],
  folderCount: number,
  fileCount: number,
): string {
  if (names.length === 0) return transferItemLabel(folderCount, fileCount);
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

export const TRANSFER_STATUS_LABEL: Record<TransferStatus, string> = {
  pending: "În așteptare",
  accepted: "Acceptat",
  declined: "Refuzat",
  cancelled: "Anulat",
  expired: "Expirat",
};

export type ReceivedTransferView = {
  id: string;
  senderUsername: string;
  mode: TransferMode;
  itemLabel: string;
  // Names of the items being sent, for the card title. Empty once the source
  // rows are gone (see transferTitle).
  itemNames: string[];
  folderCount: number;
  fileCount: number;
  createdAt: string;
  expiresAt: string;
  // Non-null only while acceptTransfer is actively copying — a live progress
  // bar replaces the Refuză/Acceptă buttons for as long as it's set.
  progressDone: number;
  progressTotal: number | null;
};

export type SentTransferView = {
  id: string;
  recipientUsername: string;
  mode: TransferMode;
  itemLabel: string;
  // Names of the items being sent, for the card title. Empty once the source
  // rows are gone (see transferTitle).
  itemNames: string[];
  folderCount: number;
  fileCount: number;
  status: TransferStatus;
  createdAt: string;
  expiresAt: string;
  resolvedAt: string | null;
  progressDone: number;
  progressTotal: number | null;
};

// Browsable contents of a still-pending transfer — same shape as the public
// share tree (see lib/share.ts's ShareFolderNode/ShareFileNode), reused by
// TransferContentsModal + the SharePreviewModal it hands previews off to.
// Visible to sender AND recipient, preview-only (no download URLs) — the
// items only actually land in the recipient's drive on Accept.
export type TransferFileNode = {
  name: string;
  size: number;
  previewKind: SharePreviewKind;
  previewUrl: string | null;
};
export type TransferFolderNode = {
  id: string;
  name: string;
  folders: TransferFolderNode[];
  files: TransferFileNode[];
};
export type TransferContents = {
  folders: TransferFolderNode[];
  files: TransferFileNode[];
};
