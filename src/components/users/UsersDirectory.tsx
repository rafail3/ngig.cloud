"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Loader2, UsersRound } from "lucide-react";
import { listDirectoryUsersAction } from "@/app/(app)/users/actions";
import { UserCard, UserCardSkeleton } from "./UserCard";
import { DIRECTORY_PAGE_SIZE, type DirectoryUser } from "@/lib/users";

// The /users directory: search + paginated list of everyone else on the cloud.
// The query lives in the URL (?q=…) so a filtered directory is shareable and
// survives back/forward — the drive search's "Vezi toți" link deep-links
// straight into a pre-filtered view.
export function UsersDirectory({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(initialQuery);
  const [users, setUsers] = useState<DirectoryUser[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(0);

  // `query` is the single source of truth for both the box and the fetch; it is
  // seeded from the server-rendered ?q= and thereafter owned here. The URL is
  // WRITTEN on type (for shareable/deep-linkable results) but never read back
  // into state — mirroring it both ways would mean two sources of truth for the
  // same value, and the round-trip would fight the user's keystrokes.
  // A deep link still works: arriving at /users?q=x mounts this fresh with
  // initialQuery already set.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      pageRef.current = 0;
      const res = await listDirectoryUsersAction({ query, page: 0 });
      if (cancelled) return;
      if ("revoked" in res) {
        window.location.assign("/login");
        return;
      }
      setUsers(res.users);
      setHasMore(res.hasMore);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  // Push the typed query into the URL (replace, so typing doesn't stack a
  // history entry per keystroke).
  function onType(value: string) {
    setQuery(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) params.set("q", value.trim());
    else params.delete("q");
    router.replace(params.toString() ? `/users?${params}` : "/users", { scroll: false });
  }

  async function loadMore() {
    setLoadingMore(true);
    const next = pageRef.current + 1;
    const res = await listDirectoryUsersAction({ query, page: next });
    setLoadingMore(false);
    if ("revoked" in res) {
      window.location.assign("/login");
      return;
    }
    pageRef.current = next;
    setUsers((prev) => [...(prev ?? []), ...res.users]);
    setHasMore(res.hasMore);
  }

  return (
    <div>
      <div className="relative mb-5">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input variant="unstyled"
          value={query}
          onChange={(e) => onType(e.target.value)}
          placeholder="Caută după username…"
          aria-label="Caută utilizatori"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 py-2.5 pl-9 pr-3 text-sm text-zinc-100 outline-none transition focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/40"
        />
      </div>

      {users === null ? (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <UserCardSkeleton />
            </li>
          ))}
        </ul>
      ) : users.length === 0 ? (
        <Empty query={query} onClear={() => onType("")} />
      ) : (
        <>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {users.map((u) => (
              <li key={u.id}>
                <UserCard user={u} />
              </li>
            ))}
          </ul>

          {hasMore && (
            <div className="mt-5 flex justify-center">
              <Button variant="unstyled"
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50 disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                {loadingMore ? "Se încarcă…" : `Încarcă încă ${DIRECTORY_PAGE_SIZE}`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// A dead end is the thing to avoid here: when a search misses, say what missed
// and offer the way back, rather than rendering nothing.
function Empty({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/50 text-zinc-500">
        <UsersRound className="h-7 w-7" />
      </div>
      {query ? (
        <>
          <p className="text-sm text-zinc-300">
            Niciun utilizator pentru „{query}”.
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Verifică scrierea username-ului sau caută după o parte din el.
          </p>
          <Button variant="unstyled"
            type="button"
            onClick={onClear}
            className="mt-4 rounded-lg border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-50"
          >
            Vezi toți utilizatorii
          </Button>
        </>
      ) : (
        <p className="text-sm text-zinc-500">
          Deocamdată ești singurul cont din cloud.
        </p>
      )}
    </div>
  );
}
