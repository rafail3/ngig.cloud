import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { confirmEmailToken } from "@/server/account/profile";

export const metadata = { title: "Confirmare email" };

const LoginLink = (
  <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
    Mergi la autentificare
  </Link>
);

// Reads the token (dynamic) and activates the email, so the result streams
// behind <Suspense> while the card frame paints instantly.
async function ConfirmEmailContent({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  let ok = false;
  try {
    ok = token ? await confirmEmailToken(token) : false;
  } catch {
    ok = false;
  }

  return (
    <AuthCard subtitle={ok ? "Email confirmat" : "Confirmare email"} footer={LoginLink}>
      <div className="flex flex-col items-center gap-4 text-center">
        {ok ? (
          <>
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <p className="text-sm text-zinc-300">
              Emailul tău a fost confirmat cu succes. Contul tău e complet
              activat.
            </p>
          </>
        ) : (
          <>
            <XCircle className="h-12 w-12 text-red-400" />
            <p className="text-sm text-zinc-300">
              Link invalid sau deja folosit. Dacă ai schimbat din nou emailul,
              folosește cel mai recent link primit.
            </p>
          </>
        )}
      </div>
    </AuthCard>
  );
}

function ConfirmEmailFallback() {
  return (
    <AuthCard subtitle="Confirmare email" footer={LoginLink}>
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-zinc-500" />
        <p className="text-sm text-zinc-400">Se confirmă emailul…</p>
      </div>
    </AuthCard>
  );
}

export default function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return (
    <Suspense fallback={<ConfirmEmailFallback />}>
      <ConfirmEmailContent searchParams={searchParams} />
    </Suspense>
  );
}
