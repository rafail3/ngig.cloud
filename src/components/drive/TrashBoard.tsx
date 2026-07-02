"use client";

import { TrashList } from "@/components/drive/TrashList";
import { ListSkeleton } from "@/components/drive/ListSkeleton";
import { useTrash } from "@/components/drive/useDriveData";

// Trashed files fetched on the client with SWR, so revisiting is instant from
// cache and a change made elsewhere (e.g. trashing a file on Files) shows up
// here in the background — no skeleton on revisit.
export function TrashBoard() {
  const { data } = useTrash();
  if (!data) return <ListSkeleton />;
  return <TrashList files={data} />;
}
