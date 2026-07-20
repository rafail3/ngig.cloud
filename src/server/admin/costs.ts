import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { listUsers } from "@/server/admin/users";
import { platformUsage } from "@/server/admin/stats";
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

const RO_MONTHS = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

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

// Resolve a month key (e.g. "2026-07") back to its window, defaulting to the
// current month when the key is missing or malformed.
export function resolveMonth(key?: string): MonthOption {
  const months = recentMonths(12);
  return months.find((m) => m.key === key) ?? months[0];
}

// Build the full cost report for a period. Egress is summed over [from, to);
// storage is the live snapshot.
export async function getCostReport(from: string, to: string): Promise<CostReport> {
  const admin = createAdminClient();
  const [users, platformStorage, egressRes] = await Promise.all([
    listUsers(),
    platformUsage(),
    admin.rpc("admin_egress_by_user", { from_ts: from, to_ts: to }),
  ]);

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
      const storageCost = storageCostUsd(storageBytes);
      // Per-user attribution: each user's own storage funds their free egress.
      const { cost: egressCost } = egressCostUsd(egressBytes, storageBytes);
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
  const platformStorageCost = storageCostUsd(platformStorage, true);
  const {
    cost: platformEgressCost,
    freeBytes: egressFreeBytes,
    billableBytes: egressBillableBytes,
  } = egressCostUsd(platformEgress, platformStorage);
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

  return { users: userCosts, platform };
}
