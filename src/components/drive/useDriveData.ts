"use client";

import useSWR, { mutate, preload, type SWRConfiguration } from "swr";
import {
  getFolderAction,
  getArchiveAction,
  getTrashAction,
} from "@/app/drive-actions";

// Client-side data layer for the drive (Files / Archive / Trash). SWR keeps the
// results in an in-memory cache keyed by route, so:
//   - revisiting a page shows the cached data instantly (no skeleton),
//   - the data is revalidated silently in the background (stale-while-revalidate),
//   - a mutation calls revalidateDrive() to refresh every drive cache without
//     clearing it — so no skeleton ever flashes after an action.
// keepPreviousData: on a folder change, keep showing the previous folder's
// contents until the new ones load instead of unmounting to a skeleton. This is
// the key to fluid navigation (the pattern fast apps use) — never blank the UI
// during a fetch, so there's no layout shift / flash. The skeleton then only
// appears on the very first cold load (no previous data to keep).
const SWR_OPTS: SWRConfiguration = {
  keepPreviousData: true,
  revalidateOnFocus: true,
};

// Server actions return `{ revoked: true }` if the session was killed mid-use.
// Bounce to /login (navigations are also guarded by the proxy middleware).
function unwrap<T>(result: T | { revoked: true }): T {
  if (result && typeof result === "object" && "revoked" in result) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("SESSION_REVOKED");
  }
  return result as T;
}

export function useFolder(folderId: string | null) {
  return useSWR(
    ["drive", "folder", folderId],
    () => getFolderAction(folderId).then(unwrap),
    SWR_OPTS,
  );
}

export function useArchive() {
  return useSWR(["drive", "archive"], () => getArchiveAction().then(unwrap), SWR_OPTS);
}

export function useTrash() {
  return useSWR(["drive", "trash"], () => getTrashAction().then(unwrap), SWR_OPTS);
}

// Refresh every drive cache (all folders + archive + trash + usage) in the
// background. Call this after ANY file/folder mutation instead of router.refresh
// — it updates the data without dropping the cache, so revisited pages stay
// instant and just update in place.
export function revalidateDrive() {
  return mutate((key) => Array.isArray(key) && key[0] === "drive");
}

// Warm the drive caches once, right after the app shell mounts, so even the
// FIRST visit to Files/Archive/Trash renders instantly from cache (not just
// revisits). preload() shares SWR's dedup — if the page already requested the
// key, no duplicate call is made. Failures are ignored: this is opportunistic;
// the page's own useSWR will fetch (and surface errors) normally.
export function prefetchDrive() {
  void preload(["drive", "folder", null], () =>
    getFolderAction(null).then(unwrap),
  ).catch(() => {});
  void preload(["drive", "archive"], () =>
    getArchiveAction().then(unwrap),
  ).catch(() => {});
  void preload(["drive", "trash"], () =>
    getTrashAction().then(unwrap),
  ).catch(() => {});
}
