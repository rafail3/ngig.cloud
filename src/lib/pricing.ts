// Backblaze B2 cost model — the numbers behind the admin cost calculator.
//
// These are B2's public pay-as-you-go rates (verified 2026-07). They are the
// operator's real infra cost, with no markup: the dashboard answers "what does
// each user / the whole platform actually cost me at B2?".
//
// Client-safe (pure constants + pure functions, no server imports) so both the
// server aggregation layer and the dashboard UI share one source of truth. If
// B2 ever changes its rates, edit them here and nowhere else.

// --- Rates -----------------------------------------------------------------

// $/TB/month for stored data. B2 measures capacity in decimal units, so a "TB"
// here is 10^12 bytes (matching how B2 bills, not binary TiB).
export const B2_STORAGE_USD_PER_TB_MONTH = 6.95;

// $/GB for egress (downloads) ABOVE the free allowance. GB = 10^9 bytes.
export const B2_EGRESS_USD_PER_GB = 0.01;

// Free egress allowance = this multiple of the average monthly stored bytes.
// (We approximate "average monthly storage" with the current snapshot — the app
// keeps no historical storage timeline yet.)
export const B2_FREE_EGRESS_MULTIPLIER = 3;

// First slice of stored data B2 never charges for (platform-wide, once).
export const B2_FREE_STORAGE_BYTES = 10 * 1e9; // 10 GB

// Decimal byte units B2 bills in.
const TB = 1e12;
const GB = 1e9;

// --- Pure cost functions ---------------------------------------------------

// Monthly storage cost for a given number of stored bytes. `applyFreeTier` is
// only meaningful at the platform level (the 10 GB free slice is granted once
// for the whole account, never per user).
export function storageCostUsd(bytes: number, applyFreeTier = false): number {
  const billable = applyFreeTier ? Math.max(0, bytes - B2_FREE_STORAGE_BYTES) : bytes;
  return (billable / TB) * B2_STORAGE_USD_PER_TB_MONTH;
}

// Free egress that a given amount of stored data earns for the month.
export function freeEgressBytes(storageBytes: number): number {
  return storageBytes * B2_FREE_EGRESS_MULTIPLIER;
}

// Egress cost for `egressBytes` moved, given the storage that funds the free
// allowance. Free up to 3x storage, then $0.01/GB. Returns the billable bytes
// too so the UI can show how much of the allowance was used.
export function egressCostUsd(
  egressBytes: number,
  storageBytes: number,
): { cost: number; freeBytes: number; billableBytes: number } {
  const freeBytes = freeEgressBytes(storageBytes);
  const billableBytes = Math.max(0, egressBytes - freeBytes);
  return { cost: (billableBytes / GB) * B2_EGRESS_USD_PER_GB, freeBytes, billableBytes };
}

// Class A/B/C transactions are free on B2 pay-as-you-go; only the rare Class D
// costs ($0.004 / 10k, first 2,500/day free). For this drive's usage that is
// effectively zero — surfaced as $0 in the UI, kept as a function so a future
// real number has a home.
export function transactionsCostUsd(): number {
  return 0;
}

// --- Formatting ------------------------------------------------------------

// USD with cent precision, and enough decimals that sub-cent per-user costs
// (common on a small drive) don't all collapse to "$0.00".
export function formatUsd(n: number): string {
  if (n === 0) return "$0";
  if (n > 0 && n < 0.01) return "<$0.01";
  const digits = n < 1 ? 4 : 2;
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  })}`;
}

// --- Report shapes (client-safe) -------------------------------------------
// Kept here (not in the server-only cost module) so the dashboard client
// components can type their props without importing "server-only" code.

export type UserCost = {
  id: string;
  username: string | null;
  storageBytes: number;
  storageCost: number; // $/month at current storage
  egressBytes: number; // over the selected period
  egressCost: number; // attributed with the user's own free allowance
  totalCost: number;
};

export type PlatformCost = {
  userCount: number;
  storageBytes: number;
  storageCost: number; // 10 GB free tier applied once, platform-wide
  egressBytes: number;
  egressFreeBytes: number; // free allowance earned by platform storage
  egressBillableBytes: number;
  egressCost: number;
  transactionsCost: number;
  totalCost: number; // storage + egress + transactions
};

export type CostReport = {
  users: UserCost[];
  platform: PlatformCost;
};

// A named month window, used both to label the UI and to bound the egress query.
export type MonthOption = { key: string; label: string; from: string; to: string };
