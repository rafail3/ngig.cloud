import { AuthCard } from "@/components/auth/AuthCard";
import { DashboardLoginForm } from "@/components/auth/DashboardLoginForm";

// Public login page for the admin dashboard. Lives OUTSIDE the (panel) route
// group so the admin gate doesn't wrap it (which would loop).
export const metadata = { title: "Dashboard — Autentificare" };

export default function DashboardLoginPage() {
  return (
    <AuthCard subtitle="Dashboard — Administrare">
      <DashboardLoginForm />
    </AuthCard>
  );
}
