import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
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
      <RegisterForm />
    </AuthCard>
  );
}
