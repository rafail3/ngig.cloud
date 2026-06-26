import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetUpdateForm } from "@/components/auth/ResetUpdateForm";

export const metadata = { title: "Setează parola nouă" };

// The recovery-session check is per-request, so it runs behind <Suspense> while
// the auth card frame paints instantly.
async function ResetUpdateContent() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/reset");

  return <ResetUpdateForm />;
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-11 animate-pulse rounded-xl bg-zinc-50/10" />
      <div className="h-11 animate-pulse rounded-xl bg-zinc-50/10" />
      <div className="mt-1 h-11 animate-pulse rounded-xl bg-zinc-50/10" />
    </div>
  );
}

export default function ResetUpdatePage() {
  return (
    <AuthCard subtitle="Setează o parolă nouă">
      <Suspense fallback={<FormSkeleton />}>
        <ResetUpdateContent />
      </Suspense>
    </AuthCard>
  );
}
