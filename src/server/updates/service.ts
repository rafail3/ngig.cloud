import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// The "new version" notification: on the first request after a prod deploy, all
// users in the chosen audience get a one-off notification with the version and
// the changelog highlights. Toggle + audience live in app_settings.

export type UpdateRole = "admin" | "user";
export type UpdateNotifySettings = {
  enabled: boolean;
  audience: UpdateRole[];
};

const KEY_ENABLED = "update_notify_enabled";
const KEY_AUDIENCE = "update_notify_audience";
const DEFAULT_AUDIENCE: UpdateRole[] = ["admin", "user"];
const GITHUB_REPO = "rafail3/ngig.cloud";

function deployedVersion(): string | null {
  return process.env.NEXT_PUBLIC_APP_VERSION || null;
}

export async function getUpdateNotifySettings(): Promise<UpdateNotifySettings> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("key, value")
    .in("key", [KEY_ENABLED, KEY_AUDIENCE]);
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  const enabled = map.get(KEY_ENABLED);
  const audience = map.get(KEY_AUDIENCE);
  return {
    enabled: typeof enabled === "boolean" ? enabled : true,
    audience: Array.isArray(audience)
      ? (audience.filter((a): a is UpdateRole => a === "admin" || a === "user"))
      : DEFAULT_AUDIENCE,
  };
}

export async function setUpdateNotifySettings(s: UpdateNotifySettings): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin.from("app_settings").upsert([
    { key: KEY_ENABLED, value: s.enabled, updated_at: now },
    { key: KEY_AUDIENCE, value: s.audience, updated_at: now },
  ]);
}

// Release notes for a version tag, pulled off GitHub (best-effort) and reduced
// to a short plain-text highlight list. Null if unavailable.
async function fetchChangelogHighlights(version: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/tags/v${version}`,
      {
        signal: controller.signal,
        headers: { accept: "application/vnd.github+json", "user-agent": "ngig.cloud" },
      },
    ).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const json = (await res.json()) as { body?: string };
    const bullets = (json.body ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("* ") || l.startsWith("- "))
      .map((l) =>
        l
          .replace(/^[*-]\s+/, "")
          .replace(/\(\[[^\]]*\]\([^)]*\)\)/g, "") // strip ([abc](url)) refs
          .replace(/\*\*/g, "")
          .replace(/`/g, "")
          .trim(),
      )
      .filter(Boolean)
      .slice(0, 5);
    return bullets.length ? bullets.map((b) => `• ${b}`).join("\n") : null;
  } catch {
    return null;
  }
}

async function broadcastUpdate(
  audience: UpdateRole[],
  title: string,
  body: string,
): Promise<void> {
  if (audience.length === 0) return;
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id").in("role", audience);
  const rows = (data ?? []).map((p) => ({
    user_id: p.id as string,
    type: "app_updated",
    title,
    body,
    link: "/",
  }));
  if (rows.length > 0) await admin.from("notifications").insert(rows);
}

// Per-instance memo so we do the DB work at most once per instance per version.
let handledVersion: string | null = null;

// Fire the "new version" broadcast once per deploy. Safe to call on every
// request (via after()): a per-instance memo skips the common case, and an
// atomic DB claim guarantees exactly one broadcast across all instances.
export async function maybeAnnounceUpdate(): Promise<void> {
  const version = deployedVersion();
  if (!version || handledVersion === version) return;
  try {
    const { enabled, audience } = await getUpdateNotifySettings();
    if (!enabled) return; // not cached — pick it up if it gets re-enabled
    const admin = createAdminClient();
    const { data: claimed, error } = await admin.rpc("claim_update_version", { v: version });
    // Don't memo on RPC failure (e.g. the migration isn't applied yet) so a
    // later request can retry without needing a restart.
    if (error) return;
    handledVersion = version;
    if (!claimed) return; // another request already announced this version
    const highlights = await fetchChangelogHighlights(version);
    const body = `Aplicația a fost actualizată la versiunea v${version}.${
      highlights ? `\n\n${highlights}` : ""
    }`;
    await broadcastUpdate(audience, "Implementări noi", body);
  } catch {
    // non-critical — a missed broadcast is recoverable on the next deploy
  }
}
