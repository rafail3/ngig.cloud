"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { Plus, Upload, FolderPlus, FolderUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { revalidateDrive } from "@/components/drive/useDriveData";
import { useDrivePicker } from "./useDrivePicker";
import { CreateFolderModal } from "./CreateFolderModal";

/* The shell's primary action. It sits at the head of the sidebar so creating
   something is always one click away, from any page — not only from the files
   board. Uploads land in the folder you're looking at when you're on the drive,
   and at the root otherwise, which is the only reading that can't surprise you. */
export function NewMenu({ onAction }: { onAction?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [creating, setCreating] = useState(false);

  // Only the files board has a "current folder"; every other page uploads to
  // the root. Guard against the literal strings a stale URL can carry.
  const raw = pathname === "/" ? searchParams.get("folder") : null;
  const folderId = raw && raw !== "undefined" && raw !== "null" ? raw : null;

  const picker = useDrivePicker(folderId);

  function run(fn: () => void) {
    fn();
    onAction?.();
  }

  return (
    <>
      {picker.inputs}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="unstyled"
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-950/40 transition hover:bg-indigo-400 active:bg-indigo-600 data-[state=open]:bg-indigo-400"
          >
            <Plus className="h-4 w-4" />
            Nou
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onSelect={() => run(() => setCreating(true))}>
            <FolderPlus className="h-4 w-4 text-zinc-400" /> Folder nou
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run(picker.openFiles)}>
            <Upload className="h-4 w-4 text-zinc-400" /> Încarcă fișiere
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run(picker.openFolder)}>
            <FolderUp className="h-4 w-4 text-zinc-400" /> Încarcă folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
    </>
  );
}
