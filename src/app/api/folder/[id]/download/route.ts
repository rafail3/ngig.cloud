import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { contentDisposition } from "@/lib/http";
import * as files from "@/server/files/service";
import { getObjectStream } from "@/server/storage/b2";

// Streams a zip built from B2 object streams (Node.js runtime — the default).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let manifest: { name: string; files: { key: string; path: string }[] };
  try {
    manifest = await files.folderManifest(id);
  } catch {
    return new Response("Folder inexistent.", { status: 404 });
  }

  const archive = new ZipArchive({ zlib: { level: 1 } });
  archive.on("error", () => archive.abort());

  // Feed the archive from B2, then finalize. Streams are consumed in order, so
  // their bytes don't all sit in memory at once.
  void (async () => {
    for (const entry of manifest.files) {
      try {
        const stream = await getObjectStream(entry.key);
        archive.append(stream as Readable, { name: entry.path });
      } catch {
        // skip a file whose object is missing
      }
    }
    void archive.finalize();
  })();

  const body = Readable.toWeb(archive) as unknown as ReadableStream;
  const filename = manifest.name.replace(/[\\/]/g, "").slice(0, 100) || "folder";
  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDisposition(`${filename}.zip`, "attachment"),
    },
  });
}
