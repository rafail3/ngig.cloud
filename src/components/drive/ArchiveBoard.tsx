"use client";

import { ArchiveList } from "@/components/drive/ArchiveList";
import { ListSkeleton } from "@/components/drive/ListSkeleton";
import { useArchive } from "@/components/drive/useDriveData";

// Archived files fetched on the client with SWR, so revisiting is instant from
// cache and a change made elsewhere (e.g. archiving a file on Files) shows up
// here in the background — no skeleton on revisit.
export function ArchiveBoard() {
  const { data } = useArchive();
  if (!data) return <ListSkeleton />;
  return <ArchiveList files={data} />;
}
