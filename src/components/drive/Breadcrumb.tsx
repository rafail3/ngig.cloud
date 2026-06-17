import Link from "next/link";
import { Home, ChevronRight } from "lucide-react";

export type Crumb = { id: string; name: string };

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-zinc-400">
      <Link
        href="/"
        className="flex items-center gap-1.5 rounded px-1.5 py-1 transition hover:bg-zinc-900 hover:text-zinc-100"
      >
        <Home className="h-4 w-4" />
        Acasă
      </Link>
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={c.id} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-zinc-600" />
            {last ? (
              <span className="rounded px-1.5 py-1 font-medium text-zinc-100">
                {c.name}
              </span>
            ) : (
              <Link
                href={`/?folder=${c.id}`}
                className="rounded px-1.5 py-1 transition hover:bg-zinc-900 hover:text-zinc-100"
              >
                {c.name}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
