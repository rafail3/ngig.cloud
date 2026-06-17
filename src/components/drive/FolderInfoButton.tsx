"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { folderStatsAction } from "@/app/drive-actions";
import { formatBytes } from "@/lib/format";
import { InfoModal } from "./InfoModal";

// Info for the folder you're currently inside, shown next to the page title.
export function FolderInfoButton({
  folderId,
  name,
}: {
  folderId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<{ size: number; count: number } | null>(null);

  function show() {
    setOpen(true);
    setStats(null);
    folderStatsAction(folderId).then((res) => {
      if ("revoked" in res) {
        window.location.assign("/login");
        return;
      }
      setStats(res);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={show}
        aria-label="Detalii folder"
        className="rounded-md border border-zinc-800 p-2 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
      >
        <Info className="h-4 w-4" />
      </button>

      {open && (
        <InfoModal
          title={name}
          onClose={() => setOpen(false)}
          rows={[
            { label: "Fișiere", value: stats ? String(stats.count) : "…" },
            {
              label: "Dimensiune totală",
              value: stats ? formatBytes(stats.size) : "…",
            },
          ]}
        />
      )}
    </>
  );
}
