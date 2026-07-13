import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import { AppShellSkeleton } from "@/components/shell/AppShellSkeleton";
import { touchLastSeen } from "@/server/admin/audit";

// Too dynamic to be the instant entry point: it reads auth + the sidebar cookie
// on every request. We exempt the layout itself from instant validation; what
// matters for instant navigation is the per-page static shells under it.
export const unstable_instant = false;

// Loads the per-request shell data (auth + profile + sidebar cookie). Under
// Cache Components this dynamic work must live behind a <Suspense> boundary so
// the static chrome can paint immediately and the real shell streams in.
// Client navigation between pages never re-runs this — the streamed shell stays
// put and only the page segment swaps.
async function Shell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  const email = (data?.claims?.email as string | undefined) ?? "";

  // Auth is enforced authoritatively by the proxy middleware, so a real request
  // always has a session here. During static prerender / instant validation
  // there's none — render the chrome with empty data (it sits behind <Suspense>,
  // and the live request fills it in).
  let username = "";
  let role = "";

  if (userId) {
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

    username = profile?.username ?? "";
    role = profile?.role ?? "";
  }

  return (
    <AppShell user={{ username, role, email }}>
      {children}
    </AppShell>
  );
}

// Auth itself is enforced by the proxy middleware; here we just load the profile
// once and hand it to the shell.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
