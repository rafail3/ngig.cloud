import {
  Image as ImageIcon,
  FileText,
  Table,
  Presentation,
  Code,
  Video,
  Music,
  Archive,
  File as FileIcon,
  type LucideIcon,
} from "lucide-react";
import { fileCategory, type FileCategory } from "@/lib/file-type";

// One tinted icon chip per file category — the color-coding does the scanning
// work a thumbnail would. Classes are static strings so Tailwind sees them.
const STYLES: Record<FileCategory, { icon: LucideIcon; cls: string }> = {
  image: { icon: ImageIcon, cls: "bg-sky-500/10 text-sky-400" },
  document: { icon: FileText, cls: "bg-indigo-500/10 text-indigo-400" },
  spreadsheet: { icon: Table, cls: "bg-emerald-500/10 text-emerald-400" },
  presentation: { icon: Presentation, cls: "bg-amber-500/10 text-amber-400" },
  code: { icon: Code, cls: "bg-zinc-500/10 text-zinc-300" },
  video: { icon: Video, cls: "bg-red-500/10 text-red-400" },
  audio: { icon: Music, cls: "bg-green-500/10 text-green-400" },
  archive: { icon: Archive, cls: "bg-zinc-500/10 text-zinc-400" },
  other: { icon: FileIcon, cls: "bg-zinc-500/10 text-zinc-400" },
};

export function FileTypeIcon({
  name,
  mime,
  size = "md",
}: {
  name: string;
  mime?: string | null;
  size?: "sm" | "md";
}) {
  const { icon: Icon, cls } = STYLES[fileCategory(name, mime)];
  const box = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const ic = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";
  return (
    <span
      aria-hidden
      className={`flex ${box} shrink-0 items-center justify-center rounded-lg ${cls}`}
    >
      <Icon className={ic} />
    </span>
  );
}
