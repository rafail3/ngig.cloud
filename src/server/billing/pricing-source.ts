import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_B2_RATES, type B2Rates } from "@/lib/pricing";

// Keeps the B2 rates fresh. The dashboard's math always uses whatever this
// returns; a daily cron calls refreshB2Pricing() to pull the current published
// numbers off B2's pricing page. Everything degrades to the hardcoded defaults
// if the fetch ever fails or was never run — the calculator never breaks.

const SETTINGS_KEY = "b2_pricing";
const PRICING_URL = "https://www.backblaze.com/cloud-storage/pricing";

// Only the two dollar figures actually move; the free-tier policy (3x egress,
// 10 GB storage) is stable, so we keep those from the defaults.
type StoredPricing = {
  storageUsdPerTbMonth: number;
  egressUsdPerGb: number;
  fetchedAt: string;
};

export type EffectiveRates = {
  rates: B2Rates;
  updatedAt: string | null;
  source: "b2" | "default";
};

// Sanity bounds so a bad parse (or a page redesign) can never persist a garbage
// rate that would wildly mis-state the cost.
function sane(storage: number, egress: number): boolean {
  return storage >= 1 && storage <= 50 && egress > 0 && egress <= 1;
}

// The active rates for cost math + where they came from.
export async function getEffectiveRates(): Promise<EffectiveRates> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();
    const v = data?.value as StoredPricing | undefined;
    if (v && sane(v.storageUsdPerTbMonth, v.egressUsdPerGb)) {
      return {
        rates: {
          ...DEFAULT_B2_RATES,
          storageUsdPerTbMonth: v.storageUsdPerTbMonth,
          egressUsdPerGb: v.egressUsdPerGb,
        },
        updatedAt: v.fetchedAt ?? null,
        source: "b2",
      };
    }
  } catch {
    // fall through to defaults
  }
  return { rates: DEFAULT_B2_RATES, updatedAt: null, source: "default" };
}

// Pull the current published rates off B2's pricing page and persist them.
// Best-effort: on any failure it returns { ok:false } and leaves the last known
// (or default) rates untouched. Runs from the daily cron, never on a page load.
export async function refreshB2Pricing(): Promise<
  { ok: true; storage: number; egress: number } | { ok: false; reason: string }
> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(PRICING_URL, {
      signal: controller.signal,
      headers: { "user-agent": "ngig.cloud-pricing-refresh/1.0" },
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };

    const html = await res.text();
    const storageMatch = html.match(/\$\s*([0-9]+(?:\.[0-9]+)?)\s*\/?\s*TB/i);
    const egressMatch = html.match(/\$\s*([0-9]*\.[0-9]+)\s*(?:\/|per)\s*GB/i);
    const storage = storageMatch ? Number(storageMatch[1]) : NaN;
    const egress = egressMatch ? Number(egressMatch[1]) : NaN;

    if (!sane(storage, egress)) {
      return { ok: false, reason: `unparsable (storage=${storage}, egress=${egress})` };
    }

    const admin = createAdminClient();
    const value: StoredPricing = {
      storageUsdPerTbMonth: storage,
      egressUsdPerGb: egress,
      fetchedAt: new Date().toISOString(),
    };
    await admin
      .from("app_settings")
      .upsert({ key: SETTINGS_KEY, value, updated_at: new Date().toISOString() });
    return { ok: true, storage, egress };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "fetch failed" };
  }
}
