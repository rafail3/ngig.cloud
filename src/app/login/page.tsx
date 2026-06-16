import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthCard
      subtitle="Autentificare"
      footer={
        <div className="flex flex-col gap-2">
          <Link href="/reset" className="font-medium text-indigo-400 hover:text-indigo-300">
            Ai uitat parola?
          </Link>
          <div>
            Ai un cod de invitație?{" "}
            <Link href="/register" className="font-medium text-indigo-400 hover:text-indigo-300">
              Creează cont
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
      <LoginForm />
    </AuthCard>
  );
}
