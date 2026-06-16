import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetUpdateForm } from "@/components/auth/ResetUpdateForm";

export const metadata = { title: "Setează parola nouă" };
export const dynamic = "force-dynamic";

export default async function ResetUpdatePage() {
  // Reached only with a valid recovery session (set by /auth/confirm).
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/reset");

  return (
    <AuthCard subtitle="Setează o parolă nouă">
      <ResetUpdateForm />
    </AuthCard>
  );
}
