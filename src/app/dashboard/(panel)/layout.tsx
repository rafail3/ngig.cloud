import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/shell/DashboardShell";
import { DashboardShellSkeleton } from "@/components/shell/DashboardShellSkeleton";
import { Forbidden } from "@/components/shell/Forbidden";
import { RealtimeRefresh } from "@/components/realtime/RealtimeRefresh";
import { TicketInboxWatcher } from "@/components/dashboard/TicketInboxWatcher";
import { countNewTickets } from "@/server/tickets/service";

// Every dashboard data source — so any admin page/action updates live.
const DASHBOARD_TABLES = [
  "profiles",
  "invite_codes",
  "invite_requests",
  "app_settings",
  "login_audit",
  "announcements",
  "tickets",
  "ticket_messages",
];

// Too dynamic to be the instant entry point: it reads auth on every request.
// Exempt the layout from instant validation; the per-page static shells under
// it are what make navigation instant.
export const unstable_instant = false;

// Enforces the ADMIN gate authoritatively (a logged-in non-admin gets the
// Forbidden screen, never the panel). Under Cache Components this dynamic auth
// work sits behind <Suspense> so the static chrome paints immediately.
async function Shell({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  const email = (data?.claims?.email as string | undefined) ?? "";

  // Auth is enforced by the proxy middleware, so a real request always has a
  // session here. During static prerender / instant validation there's none —
  // render the chrome with empty data; the admin gate below runs on the live
  // (always-authenticated) request.
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, role")
      .eq("id", userId)
      .single();

    if (profile?.role !== "admin") {
      return <Forbidden />;
    }

    // Nav badge: tickets waiting on an admin that arrived since this admin last
    // opened the list. Realtime refreshes the layout, so it stays live without
    // polling; the Suport page stamps the inbox, which zeroes it out.
    const ticketsWaiting = await countNewTickets(userId);

    return (
      <DashboardShell
        user={{ username: profile.username ?? "", email }}
        badges={{ tickets: ticketsWaiting }}
      >
        <RealtimeRefresh tables={DASHBOARD_TABLES} />
        <TicketInboxWatcher />
        {children}
        {modal}
      </DashboardShell>
    );
  }

  return (
    <DashboardShell user={{ username: "", email: "" }}>
      {children}
      {modal}
    </DashboardShell>
  );
}

// Wraps every dashboard panel page. The proxy already redirects unauthenticated
// requests to the login.
export default function DashboardPanelLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardShellSkeleton />}>
      <Shell modal={modal}>{children}</Shell>
    </Suspense>
  );
}
