import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { contentDisposition } from "@/lib/http";
import { getObjectStream } from "@/server/storage/b2";
import {
  getShareFileDownloadUrl,
  getShareFolderManifest,
} from "@/server/share/service";

// Public download for a share token. No session — the token is the authority.
// File → 302 to a short-lived presigned URL (bytes stream straight from B2).
// Folder → a zip streamed from B2 object streams.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const file = await getShareFileDownloadUrl(token);
  if (file) return Response.redirect(file.url, 302);

  const manifest = await getShareFolderManifest(token);
  if (!manifest) {
    return new Response("Link inexistent sau expirat.", { status: 404 });
  }

  const archive = new ZipArchive({ zlib: { level: 1 } });
  archive.on("error", () => archive.abort());

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
