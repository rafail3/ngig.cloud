// Client-safe vocabulary for user-to-user transfers ("Trimite utilizator").
// No server imports — pulled into the share modal and the /transfers page.

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
  folderCount: number;
  fileCount: number;
  createdAt: string;
  expiresAt: string;
};

export type SentTransferView = {
  id: string;
  recipientUsername: string;
  mode: TransferMode;
  itemLabel: string;
  folderCount: number;
  fileCount: number;
  status: TransferStatus;
  createdAt: string;
  expiresAt: string;
  resolvedAt: string | null;
};
