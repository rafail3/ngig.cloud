"use client";

import { useState } from "react";
import { File as FileIcon, Folder, Eye } from "lucide-react";
import { formatBytes } from "@/lib/format";
import type { ShareBundleItemView } from "@/lib/share";
import { SharePreviewModal, type SharePreviewTarget } from "./SharePreviewModal";

// The members of a bundle link. A previewable file opens a pop-up lightbox on
// click; folders and non-previewable files are plain rows.
export function ShareBundleList({ items }: { items: ShareBundleItemView[] }) {
  const [preview, setPreview] = useState<SharePreviewTarget | null>(null);

  return (
    <>
      <ul className="max-h-[26rem] space-y-1.5 overflow-y-auto">
        {items.map((item, i) => {
          const canPreview = item.previewUrl != null && item.previewKind != null;
          const Row = canPreview ? "button" : "div";
          return (
            <li key={i}>
              <Row
                {...(canPreview
                  ? {
                      type: "button" as const,
                      onClick: () =>
                        setPreview({
                          url: item.previewUrl!,
                          kind: item.previewKind!,
                          name: item.name,
                        }),
                    }
                  : {})}
                className={`flex w-full items-center gap-2.5 rounded-xl border border-zinc-800/70 bg-zinc-950/40 px-3 py-2.5 text-left transition-colors ${
                  canPreview
                    ? "cursor-pointer hover:border-zinc-700 hover:bg-zinc-900/60"
                    : "cursor-default"
                }`}
              >
                <span className="text-indigo-400" aria-hidden>
                  {item.kind === "folder" ? (
                    <Folder className="h-4 w-4" />
                  ) : (
                    <FileIcon className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                  {item.name}
                </span>
                {item.size != null && (
                  <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                    {formatBytes(item.size)}
                  </span>
                )}
                {canPreview && (
                  <Eye className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                )}
              </Row>
            </li>
          );
        })}
      </ul>

      <SharePreviewModal target={preview} onClose={() => setPreview(null)} />
    </>
  );
}
