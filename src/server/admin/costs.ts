import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { listUsers, getUser } from "@/server/admin/users";
import { platformUsage } from "@/server/admin/stats";
import { getEffectiveRates } from "@/server/billing/pricing-source";
import {
  storageCostUsd,
  egressCostUsd,
  transactionsCostUsd,
  type UserCost,
  type PlatformCost,
  type CostReport,
  type MonthOption,
} from "@/lib/pricing";

// Admin cost calculator — turns real storage + egress data into B2 dollars.
//
// Storage is a CURRENT snapshot (the app keeps no historical storage timeline),
// so its monthly cost is period-independent: it's the run-rate right now.
// Egress IS period-scoped — summed from egress_events over [from, to).

export type { UserCost, PlatformCost, CostReport, MonthOption };

export type EgressDay = { day: string; bytes: number };
export type EgressFlow = { bytes: number; source: string; createdAt: string };
export type SourceTotal = { source: string; bytes: number };

export type UserCostDetail = {
  id: string;
  username: string | null;
  storageBytes: number;
  fileCount: number;
  storageCost: number;
  egressBytes: number;
  egressCost: number;
  totalCost: number;
  egressDaily: EgressDay[]; // over the period
  egressBySource: SourceTotal[];
  recentFlow: EgressFlow[]; // latest egress events in the period
};

const RO_MONTHS = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

// Rolling windows (ending now) offered above the calendar months. The free
// egress allowance is monthly, so each carries how many months it spans.
const ROLLING: { key: string; label: string; days: number }[] = [
  { key: "r30", label: "Ultimele 30 de zile", days: 30 },
  { key: "r90", label: "Ultimele 3 luni", days: 90 },
  { key: "r180", label: "Ultimele 6 luni", days: 180 },
  { key: "r270", label: "Ultimele 9 luni", days: 270 },
  { key: "r365", label: "Ultimele 12 luni", days: 365 },
];

const DAY_MS = 86_400_000;

export function rollingOptions(): MonthOption[] {
  const now = new Date();
  return ROLLING.map((r) => ({
    key: r.key,
    label: r.label,
    from: new Date(now.getTime() - r.days * DAY_MS).toISOString(),
    to: now.toISOString(),
  }));
}

// How many monthly free-egress allowances a window earns (calendar month = 1).
export function monthsInWindow(from: string, to: string): number {
  const days = (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS;
  return Math.max(1, Math.round(days / 30));
}

// The last `count` months (most recent first), as UTC month boundaries.
export function recentMonths(count = 12): MonthOption[] {
  const now = new Date();
  const out: MonthOption[] = [];
  for (let i = 0; i < count; i++) {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() - i;
    const from = new Date(Date.UTC(y, m, 1));
    const to = new Date(Date.UTC(y, m + 1, 1));
    out.push({
      key: `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, "0")}`,
      label: `${RO_MONTHS[from.getUTCMonth()]} ${from.getUTCFullYear()}`,
      from: from.toISOString(),
      to: to.toISOString(),
    });
  }
  return out;
}

// Resolve a period key — a rolling window ("r90") or a month ("2026-07") —
// back to its bounds, defaulting to the current month.
export function resolveMonth(key?: string): MonthOption {
  const rolling = rollingOptions().find((r) => r.key === key);
  if (rolling) return rolling;
  const months = recentMonths(12);
  return months.find((m) => m.key === key) ?? months[0];
}

// Build the full cost report for a period. Egress is summed over [from, to);
// storage is the live snapshot.
export async function getCostReport(from: string, to: string): Promise<CostReport> {
  const admin = createAdminClient();
  const [users, platformStorage, egressRes, effective] = await Promise.all([
    listUsers(),
    platformUsage(),
    admin.rpc("admin_egress_by_user", { from_ts: from, to_ts: to }),
    getEffectiveRates(),
  ]);
  const { rates } = effective;
  const months = monthsInWindow(from, to);

  const egressByUser = new Map<string, number>(
    (egressRes.data ?? []).map((r: { user_id: string; bytes: number }) => [
      r.user_id,
      Number(r.bytes),
    ]),
  );

  const userCosts: UserCost[] = users
    .map((u) => {
      const storageBytes = Number(u.total_size ?? 0);
      const egressBytes = egressByUser.get(u.id) ?? 0;
      const storageCost = storageCostUsd(storageBytes, false, rates);
      // Per-user attribution: each user's own storage funds their free egress.
      const { cost: egressCost } = egressCostUsd(egressBytes, storageBytes, rates, months);
      return {
        id: u.id,
        username: u.username,
        storageBytes,
        storageCost,
        egressBytes,
        egressCost,
        totalCost: storageCost + egressCost,
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost || b.storageBytes - a.storageBytes);

  // Platform totals — the authoritative figures. The free tiers are applied
  // once here (not per user), so this is what B2 actually bills.
  const platformEgress = [...egressByUser.values()].reduce((s, b) => s + b, 0);
  const platformStorageCost = storageCostUsd(platformStorage, true, rates);
  const {
    cost: platformEgressCost,
    freeBytes: egressFreeBytes,
    billableBytes: egressBillableBytes,
  } = egressCostUsd(platformEgress, platformStorage, rates, months);
  const transactionsCost = transactionsCostUsd();

  const platform: PlatformCost = {
    userCount: users.length,
    storageBytes: platformStorage,
    storageCost: platformStorageCost,
    egressBytes: platformEgress,
    egressFreeBytes,
    egressBillableBytes,
    egressCost: platformEgressCost,
    transactionsCost,
    totalCost: platformStorageCost + platformEgressCost + transactionsCost,
  };

  return {
    users: userCosts,
    platform,
    rates,
    ratesUpdatedAt: effective.updatedAt,
    ratesSource: effective.source,
  };
}

// Detail for one user: their cost breakdown plus the egress flux over the
// period (daily series, per-source split, and the most recent events).
export async function getUserCostDetail(
  userId: string,
  from: string,
  to: string,
): Promise<UserCostDetail | null> {
  const [user, effective] = await Promise.all([getUser(userId), getEffectiveRates()]);
  if (!user) return null;
  const { rates } = effective;

  const admin = createAdminClient();
  const { data } = await admin
    .from("egress_events")
    .select("bytes, source, created_at")
    .eq("user_id", userId)
    .gte("created_at", from)
    .lt("created_at", to)
    .order("created_at", { ascending: false })
    .limit(1000);

  const rows = (data ?? []) as { bytes: number; source: string; created_at: string }[];

  const egressBytes = rows.reduce((s, r) => s + Number(r.bytes), 0);
  const dayMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();
  for (const r of rows) {
    const day = r.created_at.slice(0, 10); // YYYY-MM-DD (UTC)
    dayMap.set(day, (dayMap.get(day) ?? 0) + Number(r.bytes));
    sourceMap.set(r.source, (sourceMap.get(r.source) ?? 0) + Number(r.bytes));
  }

  const storageBytes = Number(user.total_size ?? 0);
  const storageCost = storageCostUsd(storageBytes, false, rates);
  const { cost: egressCost } = egressCostUsd(
    egressBytes,
    storageBytes,
    rates,
    monthsInWindow(from, to),
  );

  return {
    id: user.id,
    username: user.username,
    storageBytes,
    fileCount: Number(user.file_count ?? 0),
    storageCost,
    egressBytes,
    egressCost,
    totalCost: storageCost + egressCost,
    egressDaily: [...dayMap.entries()]
      .map(([day, bytes]) => ({ day, bytes }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    egressBySource: [...sourceMap.entries()]
      .map(([source, bytes]) => ({ source, bytes }))
      .sort((a, b) => b.bytes - a.bytes),
    recentFlow: rows.slice(0, 40).map((r) => ({
      bytes: Number(r.bytes),
      source: r.source,
      createdAt: r.created_at,
    })),
  };
}
