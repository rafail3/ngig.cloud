import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fileCategory, type FileCategory } from "@/lib/file-type";
import { notifyUserEvent } from "@/server/notifications/service";

// "ngig Insights" — a private, rules-based per-user behavior engine. It runs
// entirely in the caller's own session (RLS keeps every read/write owner-scoped),
// derives a profile through a pipeline of weighted logical conditions ("like an
// AI, without an AI"), caches it, and feeds multiple surfaces (file suggestions,
// a private activity panel, tip notifications).

// Bump when the profile shape changes so older cached rows are recomputed.
const PROFILE_VERSION = 2;
const CACHE_MS = 60 * 60 * 1000; // recompute at most hourly
const TIP_COOLDOWN_MS = 7 * 24 * 3600 * 1000; // don't repeat the same tip within a week
const BIG_FILE = 50 * 1024 * 1024;
const DAY_MS = 86_400_000;

const CATEGORY_LABEL: Record<FileCategory, string> = {
  image: "imagini",
  video: "clipuri video",
  audio: "fișiere audio",
  document: "documente",
  spreadsheet: "foi de calcul",
  presentation: "prezentări",
  code: "fișiere cod",
  archive: "arhive",
  other: "diverse",
};

const DAY_LABEL = ["duminică", "luni", "marți", "miercuri", "joi", "vineri", "sâmbătă"];

export type InsightTip = { key: string; text: string; link: string };

export type TypeSlice = { category: FileCategory; label: string; count: number; pct: number };
export type StorageSlice = { category: FileCategory; label: string; bytes: number; pct: number };

export type UserProfile = {
  version: number;
  filesCount: number;
  storageUsed: number;
  foldersCount: number;
  avgFileSize: number;
  largestFile: { name: string; size: number } | null;
  topTypes: TypeSlice[];
  storageByType: StorageSlice[];
  activityByHour: number[]; // 24 buckets
  activityByDay: number[]; // 7 buckets, 0 = Sunday
  weeklyActivity: number[]; // last 8 weeks, oldest → newest
  counts: { uploads: number; downloads: number; previews: number; searches: number };
  activePeriod: "dimineața" | "după-amiaza" | "seara" | "noaptea" | null;
  busiestDay: string | null;
  peakHour: number | null;
  uploadTrend: "up" | "down" | "flat";
  usesFolders: boolean;
  summary: string;
  tips: InsightTip[];
  lastTip?: { key: string; at: string };
  generatedAt: string;
};

type FileRow = {
  name: string;
  mime_type: string | null;
  size: number;
  created_at: string;
  updated_at: string;
  folder_id: string | null;
  deleted_at: string | null;
  archived_at: string | null;
};
type EventRow = { type: string; created_at: string };

// Reused formatters (hoisted so we don't build one per timestamp).
const HOUR_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Bucharest",
  hour: "2-digit",
  hour12: false,
});
const DAY_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Bucharest",
  weekday: "short",
});
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Hour (0-23) of an ISO timestamp in the app's timezone.
function hourRO(iso: string): number {
  return Number(HOUR_FMT.format(new Date(iso)));
}
function dayRO(iso: string): number {
  return WEEKDAYS.indexOf(DAY_FMT.format(new Date(iso)));
}

async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub as string | undefined;
  if (!uid) throw new Error("Neautentificat.");
  return { supabase, uid };
}

// The rules pipeline: signals → features → weighted conditions → profile + tips.
function computeProfile(
  files: FileRow[],
  events: EventRow[],
  foldersCount: number,
  prev: UserProfile | null,
): UserProfile {
  const live = files.filter((f) => !f.deleted_at && !f.archived_at);
  const now = Date.now();

  // --- File types + storage breakdown --------------------------------------
  const catCount = new Map<FileCategory, number>();
  const catBytes = new Map<FileCategory, number>();
  let largestFile: { name: string; size: number } | null = null;
  for (const f of live) {
    const c = fileCategory(f.name, f.mime_type);
    catCount.set(c, (catCount.get(c) ?? 0) + 1);
    catBytes.set(c, (catBytes.get(c) ?? 0) + Number(f.size));
    if (!largestFile || f.size > largestFile.size) largestFile = { name: f.name, size: Number(f.size) };
  }
  const total = live.length || 1;
  const storageUsed = live.reduce((s, f) => s + Number(f.size), 0);
  const topTypes: TypeSlice[] = [...catCount.entries()]
    .map(([category, count]) => ({
      category,
      label: CATEGORY_LABEL[category],
      count,
      pct: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const storageByType: StorageSlice[] = [...catBytes.entries()]
    .map(([category, bytes]) => ({
      category,
      label: CATEGORY_LABEL[category],
      bytes,
      pct: storageUsed > 0 ? Math.round((bytes / storageUsed) * 100) : 0,
    }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5);

  // --- Activity histograms (from events + file activity) -------------------
  const activityByHour = new Array(24).fill(0) as number[];
  const activityByDay = new Array(7).fill(0) as number[];
  const stamp = (iso: string) => {
    activityByHour[hourRO(iso)]++;
    activityByDay[dayRO(iso)]++;
  };
  for (const e of events) stamp(e.created_at);
  for (const f of live) stamp(f.updated_at);

  const periods: { key: UserProfile["activePeriod"]; from: number; to: number }[] = [
    { key: "dimineața", from: 6, to: 12 },
    { key: "după-amiaza", from: 12, to: 18 },
    { key: "seara", from: 18, to: 24 },
    { key: "noaptea", from: 0, to: 6 },
  ];
  const anyStamp = activityByHour.some((n) => n > 0);
  const activePeriod = anyStamp
    ? periods
        .map((p) => ({
          key: p.key,
          n: activityByHour.slice(p.from, p.to).reduce((a, b) => a + b, 0),
        }))
        .sort((a, b) => b.n - a.n)[0].key
    : null;
  const maxHour = Math.max(...activityByHour);
  const peakHour = anyStamp ? activityByHour.indexOf(maxHour) : null;
  const maxDay = Math.max(...activityByDay);
  const busiestDay = maxDay > 0 ? DAY_LABEL[activityByDay.indexOf(maxDay)] : null;

  // --- Weekly activity (last 8 weeks, events + uploads) --------------------
  const weeklyActivity = new Array(8).fill(0) as number[];
  const bumpWeek = (iso: string) => {
    const wAgo = Math.floor((now - new Date(iso).getTime()) / (7 * DAY_MS));
    if (wAgo >= 0 && wAgo < 8) weeklyActivity[7 - wAgo]++;
  };
  for (const e of events) bumpWeek(e.created_at);
  for (const f of files) bumpWeek(f.created_at);

  // --- Event counts (last 90 days worth we keep) ---------------------------
  const counts = { uploads: 0, downloads: 0, previews: 0, searches: 0 };
  for (const e of events) {
    if (e.type === "upload") counts.uploads++;
    else if (e.type === "download") counts.downloads++;
    else if (e.type === "preview") counts.previews++;
    else if (e.type === "search") counts.searches++;
  }

  // --- Upload trend (last 30d vs previous 30d) -----------------------------
  const recent = files.filter((f) => now - new Date(f.created_at).getTime() < 30 * DAY_MS).length;
  const prior = files.filter((f) => {
    const age = now - new Date(f.created_at).getTime();
    return age >= 30 * DAY_MS && age < 60 * DAY_MS;
  }).length;
  const uploadTrend: UserProfile["uploadTrend"] =
    recent > prior * 1.2 ? "up" : recent < prior * 0.8 ? "down" : "flat";

  const usesFolders = foldersCount > 0 || live.some((f) => f.folder_id);
  const avgFileSize = live.length > 0 ? Math.round(storageUsed / live.length) : 0;

  // --- Summary -------------------------------------------------------------
  const summaryBits: string[] = [];
  if (topTypes[0]) summaryBits.push(`lucrezi mai ales cu ${topTypes[0].label}`);
  if (activePeriod) summaryBits.push(`ești activ mai ales ${activePeriod}`);
  if (usesFolders) summaryBits.push("îți organizezi fișierele în foldere");
  const summary =
    summaryBits.length > 0
      ? summaryBits.join(", ").replace(/^./, (c) => c.toUpperCase()) + "."
      : "Încă strângem date despre cum folosești cloud-ul.";

  // --- Tips (prioritized rules) --------------------------------------------
  const tips: InsightTip[] = [];
  const trashed = files.filter((f) => f.deleted_at).length;
  const staleBig = live.filter(
    (f) => f.size > BIG_FILE && now - new Date(f.updated_at).getTime() > 90 * DAY_MS,
  ).length;
  const oldUntouched = live.filter(
    (f) => now - new Date(f.updated_at).getTime() > 180 * DAY_MS,
  ).length;

  if (staleBig > 0) {
    tips.push({
      key: "stale_big",
      text: `Ai ${staleBig} fișier(e) mari nefolosite de peste 3 luni — șterge-le sau arhivează-le ca să eliberezi spațiu.`,
      link: "/",
    });
  }
  if (trashed > 5) {
    tips.push({
      key: "trash",
      text: `Ai ${trashed} fișiere în coș — golește-l pentru a elibera spațiu.`,
      link: "/trash",
    });
  }
  if (oldUntouched >= 10 && usesFolders === false) {
    tips.push({
      key: "organize",
      text: "Ai multe fișiere vechi neatinse — organizează-le în foldere ca să le găsești mai ușor.",
      link: "/",
    });
  }
  if (uploadTrend === "up") {
    tips.push({
      key: "growing",
      text: "Folosești cloud-ul tot mai intens — verifică din când în când spațiul rămas.",
      link: "/",
    });
  }

  return {
    version: PROFILE_VERSION,
    filesCount: live.length,
    storageUsed,
    foldersCount,
    avgFileSize,
    largestFile,
    topTypes,
    storageByType,
    activityByHour,
    activityByDay,
    weeklyActivity,
    counts,
    activePeriod,
    busiestDay,
    peakHour,
    uploadTrend,
    usesFolders,
    summary,
    tips: tips.slice(0, 3),
    lastTip: prev?.lastTip,
    generatedAt: new Date(now).toISOString(),
  };
}

// Read the cached profile or recompute it (hourly). Recompute also emits the
// single top tip as a notification, at most once a week per tip.
export async function getInsights(force = false): Promise<UserProfile> {
  const { supabase, uid } = await currentUser();

  const { data: cached } = await supabase
    .from("user_insights")
    .select("profile, computed_at")
    .eq("user_id", uid)
    .maybeSingle();

  const cachedProfile = cached?.profile as UserProfile | undefined;
  if (
    !force &&
    cachedProfile?.version === PROFILE_VERSION &&
    Date.now() - new Date(cached!.computed_at).getTime() < CACHE_MS
  ) {
    return cachedProfile;
  }

  const [{ data: files }, { data: events }, { count: foldersCount }] = await Promise.all([
    supabase
      .from("files")
      .select("name, mime_type, size, created_at, updated_at, folder_id, deleted_at, archived_at")
      .eq("owner_id", uid),
    supabase
      .from("user_events")
      .select("type, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("folders").select("id", { count: "exact", head: true }).eq("owner_id", uid),
  ]);

  const prev = (cached?.profile as UserProfile | undefined) ?? null;
  const profile = computeProfile(
    (files ?? []) as FileRow[],
    (events ?? []) as EventRow[],
    foldersCount ?? 0,
    prev,
  );

  // Emit the top tip as a notification, respecting a per-tip weekly cooldown.
  const top = profile.tips[0];
  if (top) {
    const last = prev?.lastTip;
    const fresh =
      !last || last.key !== top.key || Date.now() - new Date(last.at).getTime() > TIP_COOLDOWN_MS;
    if (fresh) {
      await notifyUserEvent(uid, "suggestion", { tip: top.text }, top.link);
      profile.lastTip = { key: top.key, at: new Date().toISOString() };
    }
  }

  await supabase
    .from("user_insights")
    .upsert({ user_id: uid, profile, computed_at: new Date().toISOString() });

  return profile;
}

// Reusable ranked file suggestions: recency + affinity to the user's top types.
// Returns the shape the home "Suggested files" section already renders.
export type SuggestedFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getSuggestedFiles(limit = 6): Promise<SuggestedFile[]> {
  const { supabase, uid } = await currentUser();
  const profile = await getInsights().catch(() => null);
  const affinity = new Map((profile?.topTypes ?? []).map((t) => [t.category, t.pct]));

  const { data } = await supabase
    .from("files")
    .select("id, name, mime_type, size, created_at, updated_at")
    .eq("owner_id", uid)
    .is("deleted_at", null)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(80);

  type Row = {
    id: string;
    name: string;
    mime_type: string | null;
    size: number;
    created_at: string;
    updated_at: string;
  };
  const rows = (data ?? []) as Row[];
  const now = Date.now();
  const scored = rows.map((f) => {
    const ageDays = (now - new Date(f.updated_at).getTime()) / DAY_MS;
    const recency = Math.max(0, 30 - ageDays); // newer = higher, ~0 after a month
    const cat = fileCategory(f.name, f.mime_type);
    const typeBonus = (affinity.get(cat) ?? 0) / 5; // up to ~20 for a dominant type
    return { f, score: recency + typeBonus };
  });
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ f }) => ({
    id: f.id,
    name: f.name,
    size: f.size,
    mimeType: f.mime_type,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
  }));
}

// Best-effort behavior log. Owner-scoped by RLS (the user's own client).
export async function logEvent(type: string, meta?: Record<string, unknown>): Promise<void> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const uid = data?.claims?.sub as string | undefined;
    if (!uid) return;
    await supabase.from("user_events").insert({ user_id: uid, type, meta: meta ?? null });
  } catch {
    // non-critical
  }
}
