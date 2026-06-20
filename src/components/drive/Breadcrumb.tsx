"use client";

import Link from "next/link";
import { Home, ChevronRight } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import type { DropData } from "./DriveDndProvider";

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
  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-zinc-400">
      <CrumbDrop dropId="drop-root" destFolderId={null}>
        <Link
          href="/"
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
                <span className="block rounded px-1.5 py-1 font-medium text-zinc-100">
                  {c.name}
                </span>
              </CrumbDrop>
            ) : (
              <CrumbDrop dropId={`drop-crumb:${c.id}`} destFolderId={c.id}>
                <Link
                  href={`/?folder=${c.id}`}
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
