import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { listMyFiles, USER_QUOTA } from "@/server/files/service";
import { formatBytes } from "@/lib/format";
import { UploadButton } from "@/components/drive/UploadButton";
import { FileList } from "@/components/drive/FileList";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;

  // Fetch profile and files in parallel (one round trip each, not sequential).
  const profilePromise = userId
    ? supabase.from("profiles").select("username, role").eq("id", userId).single()
    : null;
  const [profileRes, files] = await Promise.all([profilePromise, listMyFiles()]);

  const username = profileRes?.data?.username ?? "";
  const role = profileRes?.data?.role ?? "";

  // Derive usage from the files we already loaded — no extra query.
  const used = files.reduce((sum, f) => sum + Number(f.size), 0);
  const quota = USER_QUOTA;
  const pct = Math.min(100, Math.round((used / quota) * 100));

  return (
    <div className="flex flex-1 flex-col bg-zinc-950 text-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-900 px-6 py-3">
        <span className="font-semibold tracking-tight">
          ngig<span className="text-indigo-400">.cloud</span>
        </span>
        <div className="flex items-center gap-4 text-base">
          <span className="text-zinc-400">
            {username}
            {role === "admin" && (
              <span className="ml-2 rounded bg-indigo-500/20 px-1.5 py-0.5 text-xs text-indigo-300">
                admin
              </span>
            )}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-zinc-800 px-3 py-1.5 text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-50"
            >
              Logout
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
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
              {formatBytes(used)} / {formatBytes(quota)} ({pct}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-900">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
              style={{ width: `${pct}%` }}
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
      </main>
    </div>
  );
}
