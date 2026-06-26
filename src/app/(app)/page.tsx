import { Suspense } from "react";
import { listFolder, myUsage } from "@/server/files/service";
import { formatBytes } from "@/lib/format";
import { UploadArea } from "@/components/drive/UploadArea";
import { Breadcrumb } from "@/components/drive/Breadcrumb";
import { FolderList } from "@/components/drive/FolderList";
import { FileList } from "@/components/drive/FileList";
import { DriveEmpty } from "@/components/drive/DriveEmpty";
import { FolderInfoButton } from "@/components/drive/FolderInfoButton";
import { DriveTransition } from "@/components/drive/DriveTransition";
import { DriveDndProvider, CurrentFolderDropZone } from "@/components/drive/DriveDndProvider";
import { SelectionProvider, type SelItem } from "@/components/drive/SelectionProvider";
import { SelectionBar } from "@/components/drive/SelectionBar";
import { FilterProvider } from "@/components/drive/FilterProvider";
import { FilterBar } from "@/components/drive/FilterBar";
import { DriveResults } from "@/components/drive/SearchResults";

export const metadata = { title: "Fișierele mele" };
// The static shell (skeleton) is identical for every folder — the `folder`
// param only selects which content streams in. Declare it absent so instant
// validation knows the shell doesn't vary by it.
export const unstable_instant = {
  prefetch: "static",
  samples: [{ searchParams: { folder: null } }],
};

// Everything below depends on the (dynamic) folder param and the per-user file
// list + usage, so it streams behind <Suspense> while the page container and
// the skeleton paint instantly.
async function DriveContent({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const { folder } = await searchParams;
  // Treat a missing or malformed param as root (never let the literal string
  // "undefined" reach the DB as a folder id).
  const folderId = folder && folder !== "undefined" && folder !== "null" ? folder : null;

  const [{ folders, files, breadcrumb }, { used, quota }] = await Promise.all([
    listFolder(folderId),
    myUsage(),
  ]);

  const pct = quota ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const title =
    breadcrumb.length > 0
      ? breadcrumb[breadcrumb.length - 1].name
      : "Fișierele mele";
  const empty = folders.length === 0 && files.length === 0;

  // Visual order (folders then files) for Shift-range selection; files carry
  // metadata so the selection bar can show Info/Download without re-fetching.
  const selItems: SelItem[] = [
    ...folders.map((f) => ({ kind: "folder" as const, id: f.id, name: f.name })),
    ...files.map((f) => ({
      kind: "file" as const,
      id: f.id,
      name: f.name,
      size: f.size,
      mimeType: f.mime_type,
      createdAt: f.created_at,
    })),
  ];

  return (
    <FilterProvider
      folders={folders.map((f) => ({ id: f.id, name: f.name }))}
      files={files.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        mimeType: f.mime_type,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
      }))}
    >
      {/* Search + filters sit above everything else on the page. */}
      <FilterBar />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {folderId && <FolderInfoButton folderId={folderId} name={title} />}
      </div>

      <SelectionProvider items={selItems} folderId={folderId}>
        <DriveDndProvider folderId={folderId}>
        <div className="mb-4">
          <Breadcrumb crumbs={breadcrumb} />
        </div>

        {/* storage usage */}
        <div className="mb-6">
          <div className="mb-1.5 flex justify-between text-sm text-zinc-400">
            <span>Spațiu folosit</span>
            <span>
              {quota
                ? `${formatBytes(used)} / ${formatBytes(quota)} (${pct}%)`
                : `${formatBytes(used)} folosiți`}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-900">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
              style={{ width: `${quota ? pct : 100}%`, opacity: quota ? 1 : 0.3 }}
            />
          </div>
        </div>

        <div className="mb-6">
          <UploadArea folderId={folderId} />
        </div>

        <SelectionBar />

        <DriveResults>
          <CurrentFolderDropZone folderId={folderId}>
            <DriveTransition id={folderId ?? "root"}>
              <FolderList folderId={folderId} />
              <FileList folderId={folderId} />
              {empty && <DriveEmpty folderId={folderId} />}
            </DriveTransition>
          </CurrentFolderDropZone>
        </DriveResults>
        </DriveDndProvider>
      </SelectionProvider>
    </FilterProvider>
  );
}

// Mirrors the drive layout (filter bar, title, usage bar, upload area, rows) so
// the structure is visible instantly while the real content streams in.
function DriveSkeleton() {
  return (
    <>
      <div className="mb-6 h-12 w-full animate-pulse rounded-full bg-zinc-900" />
      <div className="mb-4 h-8 w-44 animate-pulse rounded-lg bg-zinc-900" />
      <div className="mb-6 h-2 w-full animate-pulse rounded-full bg-zinc-900" />
      <div className="mb-6 h-32 w-full animate-pulse rounded-2xl border border-zinc-900 bg-zinc-900/40" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl border border-zinc-900 bg-zinc-900/40"
          />
        ))}
      </div>
    </>
  );
}

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Suspense fallback={<DriveSkeleton />}>
        <DriveContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
