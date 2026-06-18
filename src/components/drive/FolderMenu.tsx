"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MoreVertical,
  Download,
  Info,
  Pencil,
  FolderInput,
  Trash2,
} from "lucide-react";

export function FolderMenu({
  onDownload,
  onInfo,
  onRename,
  onMove,
  onDelete,
}: {
  onDownload: () => void;
  onInfo: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function openMenu() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.right });
    setOpen(true);
  }

  function item(
    Icon: typeof Download,
    label: string,
    fn: () => void,
    danger = false,
  ) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          fn();
        }}
        className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition ${
          danger
            ? "text-red-400 hover:bg-red-950/40"
            : "text-zinc-200 hover:bg-zinc-800/70"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </button>
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-label="Opțiuni folder"
        className="shrink-0 rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
            <div
              className="fixed z-[71] w-44 -translate-x-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 py-1 shadow-2xl"
              style={{ top: pos.top, left: pos.left }}
            >
              {item(Download, "Descarcă", onDownload)}
              {item(Info, "Detalii", onInfo)}
              {item(Pencil, "Redenumește", onRename)}
              {item(FolderInput, "Mută", onMove)}
              <div className="my-1 h-px bg-zinc-800" />
              {item(Trash2, "Șterge", onDelete, true)}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
