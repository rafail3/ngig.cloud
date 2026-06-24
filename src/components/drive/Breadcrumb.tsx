"use client";

import Link from "next/link";
import { Home, ChevronRight } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import type { DropData } from "./DriveDndProvider";
import { useFilter } from "./FilterProvider";

export type Crumb = { id: string; name: string };

// A breadcrumb segment that accepts a dropped file/folder (moves it there).
function CrumbDrop({
  dropId,
  destFolderId,
  children,
}: {
  dropId: string;
  destFolderId: string | null;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver, active } = useDroppable({
    id: dropId,
    data: { destFolderId } satisfies DropData,
  });
  return (
    <span
      ref={setNodeRef}
      className={`rounded transition-colors ${
        isOver && active ? "bg-indigo-500/20 ring-1 ring-indigo-400/60" : ""
      }`}
    >
      {children}
    </span>
  );
}

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  const { query, setQuery } = useFilter();
  const searching = query.trim().length > 0;
  // Navigating from the breadcrumb must also drop the (global) search, otherwise
  // the URL changes but the view stays on the search results.
  const clearSearch = () => setQuery("");

  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-zinc-400">
      <CrumbDrop dropId="drop-root" destFolderId={null}>
        <Link
          href="/"
          onClick={clearSearch}
          className="flex items-center gap-1.5 rounded px-1.5 py-1 transition hover:bg-zinc-900 hover:text-zinc-100"
        >
          <Home className="h-4 w-4" />
          Acasă
        </Link>
      </CrumbDrop>
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={c.id} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-zinc-600" />
            {last ? (
              <CrumbDrop dropId={`drop-crumb:${c.id}`} destFolderId={c.id}>
                {searching ? (
                  // While searching, the current folder is clickable too — it
                  // exits the search back to this folder (no navigation needed).
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="block rounded px-1.5 py-1 font-medium text-zinc-100 transition hover:bg-zinc-900"
                  >
                    {c.name}
                  </button>
                ) : (
                  <span className="block rounded px-1.5 py-1 font-medium text-zinc-100">
                    {c.name}
                  </span>
                )}
              </CrumbDrop>
            ) : (
              <CrumbDrop dropId={`drop-crumb:${c.id}`} destFolderId={c.id}>
                <Link
                  href={`/?folder=${c.id}`}
                  onClick={clearSearch}
                  className="rounded px-1.5 py-1 transition hover:bg-zinc-900 hover:text-zinc-100"
                >
                  {c.name}
                </Link>
              </CrumbDrop>
            )}
          </span>
        );
      })}
    </nav>
  );
}
