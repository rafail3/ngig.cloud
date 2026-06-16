import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetRequestForm } from "@/components/auth/ResetRequestForm";

export const metadata = { title: "Resetare parolă" };

export default function ResetPage() {
  return (
    <AuthCard
      subtitle="Resetare parolă"
      footer={
        <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
          Înapoi la autentificare
        </Link>
      }
    >
      <ResetRequestForm />
    </AuthCard>
  );
}
