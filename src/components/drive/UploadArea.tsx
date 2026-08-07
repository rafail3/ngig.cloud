"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { revalidateDrive } from "@/components/drive/useDriveData";
import { UploadCloud, FolderPlus } from "lucide-react";
import { useDrivePicker, entriesFromDrop } from "./useDrivePicker";
import { CreateFolderModal } from "./CreateFolderModal";
import { useIsTouch } from "./anim";

/* The drop target for the current folder.

   It used to carry its own row of buttons — Încarcă fișiere / Încarcă folder /
   Folder nou — stacked above a tall dashed box. Those actions now live in the
   shell's "Nou" menu, reachable from every page, so what is left here is the one
   thing that can only exist on this page: a place to drop things into THIS
   folder. Being a single-purpose band, it no longer needs the height it had. */
export function UploadArea({ folderId }: { folderId: string | null }) {
  const [dragOver, setDragOver] = useState(false);
  const [creating, setCreating] = useState(false);
  const picker = useDrivePicker(folderId);
  // Touch devices can't drag files, so the band becomes a tap target that opens
  // the native file picker instead.
  const isTouch = useIsTouch();

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const entries = await entriesFromDrop(e.dataTransfer);
    if (entries.length) void picker.enqueuePaths(entries);
  }

  return (
    <div>
      {picker.inputs}

      <div
        role="button"
        tabIndex={0}
        onClick={picker.openFiles}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            picker.openFiles();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        aria-label="Alege fișiere de încărcat"
        className={`flex cursor-pointer select-none items-center justify-center gap-2.5 rounded-xl border border-dashed px-4 py-3.5 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400/50 ${
          dragOver
            ? "border-indigo-400 bg-indigo-500/10"
            : "border-zinc-800 bg-zinc-900/20 hover:border-indigo-500/40 hover:bg-indigo-500/[0.04]"
        }`}
      >
        <UploadCloud
          className={`h-5 w-5 shrink-0 transition-colors ${dragOver ? "text-indigo-400" : "text-zinc-500"}`}
        />
        <p className="text-sm text-zinc-400">
          {isTouch
            ? "Apasă pentru a alege fișiere"
            : "Trage fișiere aici, sau apasă pentru a alege"}
        </p>
        {/* Creating a folder right where you are, without going up to the menu.
            A span rather than a <button>: nesting one inside a role="button"
            is invalid markup, so the click is stopped from reaching the drop
            target instead. */}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            setCreating(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setCreating(true);
            }
          }}
          className="ml-1 hidden cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50 sm:inline-flex"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          Folder nou
        </span>
      </div>

      <AnimatePresence>
        {creating && (
          <CreateFolderModal
            key="create"
            parentId={folderId}
            onClose={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              revalidateDrive();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
