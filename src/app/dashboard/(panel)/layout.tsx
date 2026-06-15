import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/shell/DashboardShell";
import { Forbidden } from "@/components/shell/Forbidden";

// Wraps every dashboard panel page. The proxy already redirects unauthenticated
// requests to the login. Here we enforce the ADMIN gate authoritatively:
// a logged-in non-admin gets a Forbidden screen (with sign-out), never the panel.
export default async function DashboardPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  const email = (data?.claims?.email as string | undefined) ?? "";

  // No session shouldn't reach here (proxy redirects), but guard anyway.
  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, role")
    .eq("id", userId)
    .single();

  if (profile?.role !== "admin") {
    return <Forbidden />;
  }

  return (
    <DashboardShell user={{ username: profile.username ?? "", email }}>
      {children}
    </DashboardShell>
  );
}
