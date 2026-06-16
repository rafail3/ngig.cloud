import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { InviteRequestForm } from "@/components/auth/InviteRequestForm";

export const metadata = { title: "Cere invitație" };

export default function RequestInvitePage() {
  return (
    <AuthCard
      subtitle="Cere o invitație"
      footer={
        <>
          Ai deja cont?{" "}
          <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
            Autentificare
          </Link>
        </>
      }
    >
      <InviteRequestForm />
    </AuthCard>
  );
}
