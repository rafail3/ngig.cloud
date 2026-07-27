"use server";

import {
  searchUsers,
  createTransfer,
  getFrequentRecipients,
  listReceivedTransfers,
  listSentTransfers,
  getTransferContents,
  acceptTransfer,
  declineTransfer,
  cancelTransfer,
} from "@/server/transfers/service";
import type { Revoked } from "@/app/drive-actions";
import type {
  TransferMode,
  UserSearchResult,
  ReceivedTransferView,
  SentTransferView,
  TransferContents,
} from "@/lib/transfer";
import type { ShareTargetType } from "@/lib/share";
import { SESSION_REVOKED } from "@/server/auth/active-user";

// Thin server-action wrappers over the transfer service, matching
// drive-actions.ts's isRevoked/errMsg pattern (the session guard lives in
// requireActiveUser inside the service).

function isRevoked(e: unknown): boolean {
  return e instanceof Error && e.message === SESSION_REVOKED;
}

function errMsg(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return "Eroare.";
}

export async function searchUsersAction(
  query: string,
): Promise<UserSearchResult[] | Revoked> {
  try {
    return await searchUsers(query);
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    throw e;
  }
}

export async function createTransferAction(input: {
  targets: { type: ShareTargetType; id: string }[];
  recipientIds: string[];
  mode: TransferMode;
}): Promise<{ ids: string[] } | { error: string } | Revoked> {
  try {
    return await createTransfer(input);
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    return { error: errMsg(e) };
  }
}

export async function getFrequentRecipientsAction(): Promise<
  UserSearchResult[] | Revoked
> {
  try {
    return await getFrequentRecipients();
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    throw e;
  }
}

export async function listReceivedTransfersAction(): Promise<
  ReceivedTransferView[] | Revoked
> {
  try {
    return await listReceivedTransfers();
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    throw e;
  }
}

export async function listSentTransfersAction(): Promise<SentTransferView[] | Revoked> {
  try {
    return await listSentTransfers();
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    throw e;
  }
}

export async function getTransferContentsAction(
  transferId: string,
): Promise<TransferContents | { error: string } | Revoked> {
  try {
    return await getTransferContents(transferId);
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    return { error: errMsg(e) };
  }
}

export async function acceptTransferAction(
  transferId: string,
  destinationFolderId: string | null,
): Promise<{ error?: string } | Revoked> {
  try {
    return await acceptTransfer(transferId, destinationFolderId);
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    return { error: errMsg(e) };
  }
}

export async function declineTransferAction(
  transferId: string,
): Promise<{ error?: string } | Revoked> {
  try {
    return await declineTransfer(transferId);
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    return { error: errMsg(e) };
  }
}

export async function cancelTransferAction(
  transferId: string,
): Promise<{ error?: string } | Revoked> {
  try {
    return await cancelTransfer(transferId);
  } catch (e) {
    if (isRevoked(e)) return { revoked: true };
    return { error: errMsg(e) };
  }
}
