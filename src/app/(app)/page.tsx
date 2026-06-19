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

export const metadata = { title: "Fișierele mele" };

export default async function Home({
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

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {folderId && <FolderInfoButton folderId={folderId} name={title} />}
      </div>

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

        <CurrentFolderDropZone folderId={folderId}>
          <DriveTransition id={folderId ?? "root"}>
            <FolderList
              folderId={folderId}
              folders={folders.map((f) => ({ id: f.id, name: f.name }))}
            />
            <FileList
              folderId={folderId}
              files={files.map((f) => ({
                id: f.id,
                name: f.name,
                size: f.size,
                mimeType: f.mime_type,
                createdAt: f.created_at,
              }))}
            />
            {empty && <DriveEmpty folderId={folderId} />}
          </DriveTransition>
        </CurrentFolderDropZone>
      </DriveDndProvider>
    </div>
  );
}
