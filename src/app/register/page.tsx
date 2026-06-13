import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <AuthCard
      subtitle="Creează cont cu cod de invitație"
      footer={
        <>
          Ai deja cont?{" "}
          <Link href="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
            Autentifică-te
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
