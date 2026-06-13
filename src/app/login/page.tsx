import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthCard
      subtitle="Autentificare"
      footer={
        <>
          Ai un cod de invitație?{" "}
          <Link href="/register" className="font-medium text-indigo-400 hover:text-indigo-300">
            Creează cont
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
