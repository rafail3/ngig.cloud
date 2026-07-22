import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Authoritative dashboard gate for server actions / data loads. The "admin" role
// value is the MANAGER role in the product; the platform owner is additionally
// flagged is_super_admin (the "super admin"). UI hiding is not security — every
// mutation must call this first. Returns the caller's user id, or throws.
export async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub as string | undefined;
  if (!id) throw new Error("Neautentificat.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .single();

  if (profile?.role !== "admin") throw new Error("Acces interzis.");
  return id;
}

// Stricter gate: only the super admin (owner). Backs the reserved actions —
// changing roles, deleting accounts, editing global settings, managing other
// managers.
export async function requireSuperAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub as string | undefined;
  if (!id) throw new Error("Neautentificat.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", id)
    .single();

  if (!profile?.is_super_admin) throw new Error("Acces interzis. Doar super admin.");
  return id;
}

// Non-throwing check for UI decisions (hide super-only controls). NOT a
// security gate — the actions still call requireSuperAdmin themselves.
export async function viewerIsSuperAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub as string | undefined;
  if (!id) return false;
  const { data: p } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", id)
    .single();
  return p?.is_super_admin ?? false;
}

// The dashboard sections a manager's access can be narrowed to. Overview is
// deliberately absent: it's the landing surface and always visible. Settings is
// absent too — it's super-admin-only outright, not a per-manager choice.
export const DASHBOARD_SECTIONS = [
  "invites",
  "invite-requests",
  "users",
  "costs",
  "tickets",
  "announcements",
] as const;
export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

// profiles.permissions → allowed sections. NULL / malformed = full access
// (null), so a manager without explicit config keeps everything.
export function parseSections(permissions: unknown): DashboardSection[] | null {
  if (permissions == null || typeof permissions !== "object") return null;
  const sections = (permissions as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return null;
  return DASHBOARD_SECTIONS.filter((s) => sections.includes(s));
}

// The viewer's allowed sections, for nav filtering and page gates. null = full
// access (super admin, or a manager with no restriction). Not a security gate
// by itself — mutations go through requireSection below.
export async function viewerAllowedSections(): Promise<DashboardSection[] | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub as string | undefined;
  if (!id) return null;
  const { data: p } = await supabase
    .from("profiles")
    .select("is_super_admin, permissions")
    .eq("id", id)
    .single();
  if (p?.is_super_admin) return null;
  return parseSections(p?.permissions);
}

// Authoritative per-section gate for server actions / data loads: the caller
// must be a manager AND allowed on this section. Returns the caller's id.
export async function requireSection(section: DashboardSection): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub as string | undefined;
  if (!id) throw new Error("Neautentificat.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_super_admin, permissions")
    .eq("id", id)
    .single();

  if (profile?.role !== "admin") throw new Error("Acces interzis.");
  if (!profile.is_super_admin) {
    const allowed = parseSections(profile.permissions);
    if (allowed !== null && !allowed.includes(section)) {
      throw new Error("Nu ai acces la această secțiune.");
    }
  }
  return id;
}

// A manager may act on plain users, but not on other managers / the super admin
// — only the super admin can. Call after requireAdmin in user-management actions.
export async function assertCanManageTarget(callerId: string, targetId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: caller } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", callerId)
    .single();
  if (caller?.is_super_admin) return; // the super admin can manage anyone

  const { data: target } = await admin
    .from("profiles")
    .select("role, is_super_admin")
    .eq("id", targetId)
    .single();
  if (target?.role === "admin" || target?.is_super_admin) {
    throw new Error("Doar super admin poate gestiona conturi de manager.");
  }
}
