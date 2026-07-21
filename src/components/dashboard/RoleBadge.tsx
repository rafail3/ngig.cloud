import { Crown, Shield } from "lucide-react";

// Distinct role chips: the owner reads as "MASTER ADMIN" (gold), regular admins
// as "ADMIN" (indigo). Plain users get no badge. Shared by the users table and
// the user detail so the labelling stays consistent.
export function RoleBadge({
  role,
  superAdmin,
}: {
  role: "user" | "admin";
  superAdmin?: boolean;
}) {
  if (superAdmin) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-gradient-to-r from-amber-500/25 to-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
        <Crown className="h-3 w-3" /> Master admin
      </span>
    );
  }
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/40 bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-300">
        <Shield className="h-3 w-3" /> Admin
      </span>
    );
  }
  return null;
}
