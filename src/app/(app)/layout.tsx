import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";

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

  const profile = userId
    ? (await supabase.from("profiles").select("username, role").eq("id", userId).single()).data
    : null;

  return (
    <AppShell user={{ username: profile?.username ?? "", role: profile?.role ?? "", email }}>
      {children}
    </AppShell>
  );
}
