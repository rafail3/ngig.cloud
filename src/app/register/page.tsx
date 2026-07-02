import { Suspense } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata = { title: "Înregistrare" };

// The invite email links here with ?code=… (dynamic), so the form reads it
// behind <Suspense> while the auth card frame paints instantly.
async function RegisterFormWithCode({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return <RegisterForm initialCode={code} />;
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-11 animate-pulse rounded-xl bg-zinc-50/10" />
      <div className="h-11 animate-pulse rounded-xl bg-zinc-50/10" />
      <div className="h-11 animate-pulse rounded-xl bg-zinc-50/10" />
      <div className="mt-1 h-11 animate-pulse rounded-xl bg-zinc-50/10" />
    </div>
  );
}

export default function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  return (
    <AuthCard
      subtitle="Creează cont cu cod de invitație"
      footer={
        <div className="flex flex-col gap-2">
          <div>
            Ai deja cont?{" "}
            <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
              Autentifică-te
            </Link>
          </div>
          <div>
            Nu ai cod?{" "}
            <Link href="/cere-invitatie" className="font-medium text-indigo-400 hover:text-indigo-300">
              Cere invitație
            </Link>
          </div>
        </div>
      }
    >
      <Suspense fallback={<FormSkeleton />}>
        <RegisterFormWithCode searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}
