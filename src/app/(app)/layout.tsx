import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import { touchLastSeen } from "@/server/admin/audit";

// Shell for every authenticated page. Auth itself is enforced by the proxy
// middleware; here we just load the profile once and hand it to the shell.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  const email = (data?.claims?.email as string | undefined) ?? "";

  // No session (e.g. re-render right after a forced sign-out) → clean redirect
  // instead of letting a child throw "Neautentificat.".
  if (!userId) redirect("/login");

  const profile = (
    await supabase
      .from("profiles")
      .select("username, role, last_seen_at")
      .eq("id", userId)
      .single()
  ).data;

  // Heartbeat for "online" status (throttled inside the helper).
  if (profile) {
    await touchLastSeen(userId, profile.last_seen_at);
  }

  const collapsed = (await cookies()).get("sidebar_collapsed")?.value === "1";

  return (
    <AppShell
      user={{ username: profile?.username ?? "", role: profile?.role ?? "", email }}
      defaultCollapsed={collapsed}
    >
      {children}
    </AppShell>
  );
}
