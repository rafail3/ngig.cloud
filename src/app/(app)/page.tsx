import { listMyFiles, myUsage } from "@/server/files/service";
import { formatBytes } from "@/lib/format";
import { UploadButton } from "@/components/drive/UploadButton";
import { FileList } from "@/components/drive/FileList";

export default async function Home() {
  const files = await listMyFiles();

  // Effective quota (null = unlimited, until an admin sets a per-user cap).
  const { used, quota } = await myUsage();
  const pct = quota ? Math.min(100, Math.round((used / quota) * 100)) : 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Fișierele mele
        </h1>
        <UploadButton />
      </div>

      {/* storage usage */}
      <div className="mb-8">
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

      <FileList
        files={files.map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size,
          mimeType: f.mime_type,
          createdAt: f.created_at,
        }))}
      />
    </div>
  );
}
