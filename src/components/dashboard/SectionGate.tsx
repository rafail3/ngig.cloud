import { connection } from "next/server";
import { Lock } from "lucide-react";
import { viewerAllowedSections, type DashboardSection } from "@/server/admin/guard";

// Per-manager section gate for dashboard pages. The nav already hides
// restricted sections; this covers direct URLs. Renders the children only when
// the viewer's permissions include the section (null = full access). UI-level
// companion of requireSection — mutations still enforce it server-side.
export async function SectionGate({
  section,
  children,
}: {
  section: DashboardSection;
  children: React.ReactNode;
}) {
  await connection();
  const allowed = await viewerAllowedSections();
  if (allowed !== null && !allowed.includes(section)) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800/60 text-zinc-400">
          <Lock className="h-5 w-5" />
        </span>
        <p className="text-sm text-zinc-400">
          Nu ai acces la această secțiune — permisiunile contului tău de manager nu o includ.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
