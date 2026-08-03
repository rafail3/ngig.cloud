"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { listDirectoryUsersAction } from "@/app/(app)/users/actions";
import { listContainer, listItem } from "@/components/drive/anim";
import { UserCard } from "./UserCard";
import { SEARCH_USER_PREVIEW, type DirectoryUser } from "@/lib/users";

// "Utilizatori" inside the drive's global search results. People are a
// different kind of hit than files, so this stays a capped preview at the
// bottom and defers the full list to /users — the drive search's job is still
// finding files.
//
// Only ever fetches for a real TEXT query: the type/size/date filters are
// file-specific, and a filter-only view has nothing to match a username on.
export function SearchUsersSection({
  query,
  onCount,
}: {
  query: string;
  onCount: (n: number) => void;
}) {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const q = query.trim();
  const enabled = q.length >= 2;

  // Nothing to do while disabled — and deliberately NO state reset here: any
  // leftover `users` are unreachable behind the `!enabled` guard below, and the
  // parent zeroes its own count from the same query, so clearing state in the
  // effect would only buy a cascading render.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await listDirectoryUsersAction({ query: q, page: 0 });
      if (cancelled) return;
      if ("revoked" in res) return; // the drive search already handles the redirect
      const shown = res.users.slice(0, SEARCH_USER_PREVIEW);
      setUsers(shown);
      onCount(shown.length);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, enabled, onCount]);

  if (!enabled || users.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-zinc-400">Utilizatori</h2>
        <Link
          href={`/users?q=${encodeURIComponent(q)}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition hover:text-indigo-300"
        >
          Vezi toți
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <motion.ul
        variants={listContainer}
        initial="hidden"
        animate="show"
        className="grid gap-2.5 sm:grid-cols-2"
      >
        {users.map((u) => (
          <motion.li key={u.id} variants={listItem}>
            <UserCard user={u} />
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}
