"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/shell/Avatar";
import { formatDateShort } from "@/lib/format-date";
import type { DirectoryUser } from "@/lib/users";

// One user in the directory. A real <Link> (not a click handler on a div) so
// middle-click, ctrl-click and "open in new tab" all behave, and the whole card
// is one focus stop rather than a div with a nested button.
export function UserCard({ user }: { user: DirectoryUser }) {
  return (
    <Link
      href={`/users/${user.id}`}
      className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 transition-colors hover:border-indigo-400/40 hover:bg-indigo-500/[0.06] focus-visible:border-indigo-400/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400/40"
    >
      <Avatar username={user.username} className="h-10 w-10 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-zinc-100">{user.username}</p>
        <p className="truncate text-xs text-zinc-500">
          Membru din {formatDateShort(user.createdAt)}
        </p>
      </div>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-indigo-400"
        aria-hidden
      />
    </Link>
  );
}

// Matches UserCard's exact box so the list doesn't reflow when real data
// arrives (skeleton, not a spinner — the content shape is known).
export function UserCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-zinc-800" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3.5 w-28 animate-pulse rounded bg-zinc-800" />
        <div className="h-3 w-20 animate-pulse rounded bg-zinc-800/70" />
      </div>
    </div>
  );
}
