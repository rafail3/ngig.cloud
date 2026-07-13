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
import { FilterProvider } from "@/components/drive/FilterProvider";
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
