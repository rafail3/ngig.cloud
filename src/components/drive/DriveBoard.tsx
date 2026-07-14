"use client";

import { useSearchParams } from "next/navigation";
import { formatBytes } from "@/lib/format";
import { UploadArea } from "@/components/drive/UploadArea";
import { Breadcrumb } from "@/components/drive/Breadcrumb";
import { FolderList } from "@/components/drive/FolderList";
import { FileList } from "@/components/drive/FileList";
import { SuggestedFiles } from "@/components/drive/SuggestedFiles";
import { DriveEmpty } from "@/components/drive/DriveEmpty";
import { FolderInfoButton } from "@/components/drive/FolderInfoButton";
import { DriveDndProvider, CurrentFolderDropZone } from "@/components/drive/DriveDndProvider";
import { SelectionProvider, type SelItem } from "@/components/drive/SelectionProvider";
import { SelectionBar } from "@/components/drive/SelectionBar";
import { FilterProvider, useFilter } from "@/components/drive/FilterProvider";
import { FilterBar } from "@/components/drive/FilterBar";
import { DriveResults } from "@/components/drive/SearchResults";
import { DriveSkeleton } from "@/components/drive/DriveSkeleton";
import { useFolder } from "@/components/drive/useDriveData";

// The Files board. Data is fetched on the client with SWR (see useDriveData) so
// switching folders / returning to this page is instant from cache, with a
// silent background refresh — no skeleton except on the very first cold load.
export function DriveBoard() {
  const searchParams = useSearchParams();
  const folder = searchParams.get("folder");
  // Treat a missing or malformed param as root (never let the literal string
  // "undefined" reach the DB as a folder id).
  const folderId =
    folder && folder !== "undefined" && folder !== "null" ? folder : null;

  const { data } = useFolder(folderId);

  // Cold cache only — once loaded, `keepPreviousData` keeps showing content.
  if (!data) return <DriveSkeleton />;

  const { folders, files, breadcrumb, used, quota } = data;

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
      {/* Search + filters stick to the top (just under the navbar) as you
          scroll. Solid background + hairline so scrolled content tucks cleanly
          underneath without fading the content at rest. */}
      <div className="sticky top-16 z-30 -mx-4 mb-6 border-b border-zinc-900 bg-zinc-950 px-4 pb-3 pt-3 sm:-mx-6 sm:px-6">
        <FilterBar />
      </div>

      <SelectionProvider items={selItems} folderId={folderId}>
        <DriveDndProvider folderId={folderId}>
          {/* Breadcrumb only inside folders — the root needs no path. */}
          {breadcrumb.length > 0 && (
            <div className="mb-2">
              <Breadcrumb crumbs={breadcrumb} />
            </div>
          )}

          {/* Page header: title + contents summary, with a compact storage
              meter on the right (the drawer holds the detailed one). */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-3">
                <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                  {title}
                </h1>
                {folderId && <FolderInfoButton folderId={folderId} name={title} />}
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                {roCount(folders.length, "folder", "foldere")}
                <span aria-hidden="true"> · </span>
                {roCount(files.length, "fișier", "fișiere")}
              </p>
            </div>
            <StorageMeter used={used} quota={quota} />
          </div>

          <HiddenWhileSearching>
            <div className="mb-6">
              <UploadArea folderId={folderId} />
            </div>
          </HiddenWhileSearching>

          {/* Suggested (recent) files — only on the home root, hidden while
              searching/filtering. */}
          {folderId === null && <SuggestedFiles />}

          <SelectionBar />

          <DriveResults>
            <CurrentFolderDropZone folderId={folderId}>
              {/* No keyed transition here: the list updates IN PLACE when the
                  folder data changes (keepPreviousData keeps the old contents
                  visible meanwhile), so there's no unmount/remount and no layout
                  collapse — the source of the navigation flash. */}
              <div className="flex flex-col gap-4">
                {folderId === null && !empty && (
                  <h2 className="text-sm font-medium text-zinc-400">
                    Folderele și fișierele tale
                  </h2>
                )}
                <FolderList folderId={folderId} />
                <FileList folderId={folderId} />
                {empty && <DriveEmpty folderId={folderId} />}
              </div>
            </CurrentFolderDropZone>
          </DriveResults>
        </DriveDndProvider>
      </SelectionProvider>
    </FilterProvider>
  );
}

// Hides its children while a search/filter is active, so the results view has
// the whole stage (no upload zone above the matches). Must live below
// <FilterProvider>, hence a child component instead of a check in DriveBoard.
function HiddenWhileSearching({ children }: { children: React.ReactNode }) {
  const { active } = useFilter();
  if (active) return null;
  return <>{children}</>;
}

// Romanian count: "1 folder", "3 foldere", "21 de foldere".
function roCount(n: number, one: string, many: string): string {
  if (n === 1) return `1 ${one}`;
  const needsDe = n !== 0 && !(n % 100 >= 1 && n % 100 <= 19);
  return `${n} ${needsDe ? "de " : ""}${many}`;
}

// Compact storage read-out for the page header — full width on mobile, a
// slim block on the right on larger screens.
function StorageMeter({ used, quota }: { used: number; quota: number | null }) {
  const pct = quota ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  return (
    <div className="w-full shrink-0 sm:w-56">
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-zinc-400">Spațiu folosit</span>
        <span className="tabular-nums text-zinc-500">
          {quota
            ? `${formatBytes(used)} / ${formatBytes(quota)}`
            : `${formatBytes(used)}`}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${quota ? pct : 100}%`, opacity: quota ? 1 : 0.3 }}
        />
      </div>
    </div>
  );
}
