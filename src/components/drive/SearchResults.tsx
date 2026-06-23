"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Folder, Search, Home, ChevronRight, Download } from "lucide-react";
import { searchDriveAction, getDownloadUrlAction } from "@/app/drive-actions";
import { formatBytes } from "@/lib/format";
import { formatDateShort } from "@/lib/format-date";
import { fileTypeShort } from "@/lib/file-type";
import { fuzzyScore } from "@/lib/fuzzy";
import { useFilter, fileMatchesFilters } from "./FilterProvider";
import { listContainer, listItem } from "./anim";
import { PreviewModal, type PreviewFile } from "./PreviewModal";

type Crumb = { id: string; name: string };
type FileHit = PreviewFile & { folderId: string | null; path: Crumb[] };
type FolderHit = { id: string; name: string; parentId: string | null; path: Crumb[] };

// Switch shown in place of the folder view: when a search query OR any filter is
// active we render global (whole-cloud) results, otherwise the normal
// current-folder content.
export function DriveResults({ children }: { children: ReactNode }) {
  const { active } = useFilter();
  return active ? <SearchResults /> : <>{children}</>;
}

function SearchResults() {
  const router = useRouter();
  const f = useFilter();
  const q = f.query.trim();

  const [hits, setHits] = useState<{ files: FileHit[]; folders: FolderHit[] }>({
    files: [],
    folders: [],
  });
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<FileHit | null>(null);

  // Debounced fetch of the whole-cloud set. Re-runs when the query changes; a
  // query-less fetch (filters only) returns the whole drive for the filters to
  // narrow. setState lives inside the (async) timeout callback, never
  // synchronously in the effect body.
  const active = f.active;
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await searchDriveAction(q);
      if (cancelled) return;
      if (res && "revoked" in res) {
        window.location.assign("/login");
        return;
      }
      setHits(res);
      setLoading(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, active]);

  function goToFolder(id: string | null) {
    f.setQuery(""); // leave search mode so we land in the folder view
    router.push(id ? `/?folder=${id}` : "/");
  }

  async function download(id: string) {
    const res = await getDownloadUrlAction(id);
    if (typeof res !== "string") {
      window.location.assign("/login");
      return;
    }
    window.location.assign(res);
  }

  // Refine the server hits with the active type/date/size filters, then rank by
  // fuzzy score (the server already substring-matched, so this is order only).
  const files = hits.files
    .filter((h) => fileMatchesFilters(h, f))
    .sort((a, b) => fuzzyScore(q, b.name) - fuzzyScore(q, a.name));
  // Folders carry no type/size/date — hidden once a file-only filter is on.
  const folders = f.fileFiltersActive
    ? []
    : [...hits.folders].sort((a, b) => fuzzyScore(q, b.name) - fuzzyScore(q, a.name));

  const total = files.length + folders.length;

  if (loading && total === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Caut pe tot cloud-ul…
      </div>
    );
  }

  if (total === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 px-6 py-14 text-center"
      >
        <Search className="h-7 w-7 text-zinc-600" />
        <p className="mt-3 text-base font-medium text-zinc-300">Niciun rezultat</p>
        <p className="mt-1 text-sm text-zinc-500">
          {q
            ? `Nimic pe tot cloud-ul nu se potrivește cu „${q}”.`
            : "Niciun fișier de pe cloud nu se potrivește cu filtrele."}
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-zinc-500">
        {total === 1 ? "1 rezultat" : `${total} rezultate`} pe tot cloud-ul
        {loading && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" />}
      </p>

      {folders.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Foldere
          </h2>
          <motion.ul
            variants={listContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
          >
            {folders.map((folder) => (
              <motion.li
                key={folder.id}
                variants={listItem}
                onClick={() => goToFolder(folder.id)}
                className="group flex cursor-pointer items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 transition-colors hover:border-zinc-700 hover:bg-zinc-900/70"
              >
                <Folder className="h-5 w-5 shrink-0 text-indigo-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {folder.name}
                  </p>
                  <PathLine path={folder.path} />
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </section>
      )}

      {files.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Fișiere
          </h2>
          <motion.ul
            variants={listContainer}
            initial="hidden"
            animate="show"
            className="divide-y divide-zinc-900 overflow-hidden rounded-xl border border-zinc-900"
          >
            {files.map((file) => (
              <motion.li
                key={file.id}
                variants={listItem}
                onClick={() => setPreview(file)}
                className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-900/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-zinc-100">
                    {file.name}
                  </p>
                  <p className="truncate text-sm text-zinc-500">
                    {fileTypeShort(file.name, file.mimeType)} ·{" "}
                    {formatBytes(file.size)} · {formatDateShort(file.createdAt)}
                  </p>
                  <PathLine
                    path={file.path}
                    onNavigate={() => goToFolder(file.folderId)}
                  />
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    download(file.id);
                  }}
                  aria-label="Descarcă"
                  className="shrink-0 rounded-md p-1.5 text-zinc-400 opacity-0 transition hover:bg-zinc-800 hover:text-zinc-100 group-hover:opacity-100"
                >
                  <Download className="h-4 w-4" />
                </button>
              </motion.li>
            ))}
          </motion.ul>
        </section>
      )}

      <AnimatePresence>
        {preview && (
          <PreviewModal
            key="preview"
            file={preview}
            onClose={() => setPreview(null)}
            onDownload={() => download(preview.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// The location of a hit, root → containing folder. Clickable when onNavigate is
// given (jumps to the folder that holds the item).
function PathLine({
  path,
  onNavigate,
}: {
  path: Crumb[];
  onNavigate?: () => void;
}) {
  const content = (
    <>
      <Home className="h-3 w-3 shrink-0" />
      <span>Acasă</span>
      {path.map((c) => (
        <span key={c.id} className="flex min-w-0 items-center gap-1">
          <ChevronRight className="h-3 w-3 shrink-0" />
          <span className="truncate">{c.name}</span>
        </span>
      ))}
    </>
  );

  if (!onNavigate) {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-xs text-zinc-600">
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onNavigate();
      }}
      className="mt-0.5 flex max-w-full items-center gap-1 text-xs text-zinc-600 transition hover:text-indigo-400"
    >
      {content}
    </button>
  );
}
