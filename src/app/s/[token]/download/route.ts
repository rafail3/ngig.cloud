import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { contentDisposition } from "@/lib/http";
import { getObjectStream } from "@/server/storage/b2";
import {
  getShareFileDownloadUrl,
  getShareFolderManifest,
  getShareBundleManifest,
  getShareSubfolderManifest,
  shareDownloadGate,
} from "@/server/share/service";
import { unlockCookieName, verifyUnlockValue } from "@/server/share/unlock-cookie";

// Read one cookie value from the raw Cookie header.
function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

// Public download for a share token. No session — the token is the authority.
// File → 302 to a short-lived presigned URL (bytes stream straight from B2).
// Folder / bundle / one sub-folder (?folder=<id>) → a zip streamed from B2.
// Every path is gated once (password via unlock cookie + download limit).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const subfolderId = new URL(req.url).searchParams.get("folder");

  // Password + download-limit gate (once per request).
  const cookieVal = readCookie(req.headers.get("cookie"), unlockCookieName(token));
  const cookieOk = verifyUnlockValue(token, cookieVal);
  const gate = await shareDownloadGate(token, cookieOk);
  if ("status" in gate) {
    const msg =
      gate.status === 401
        ? "Link protejat cu parolă."
        : gate.status === 403
          ? "Limita de descărcări a fost atinsă."
          : "Link inexistent sau expirat.";
    return new Response(msg, { status: gate.status });
  }

  // ?folder=<id> → zip just that sub-folder (validated to be part of the share).
  if (subfolderId) {
    const sub = await getShareSubfolderManifest(token, subfolderId);
    if (!sub) return new Response("Folder inexistent.", { status: 404 });
    return zipResponse(sub);
  }

  const file = await getShareFileDownloadUrl(token);
  if (file) return Response.redirect(file.url, 302);

  // Whole folder or bundle → a streamed zip.
  const manifest =
    (await getShareFolderManifest(token)) ?? (await getShareBundleManifest(token));
  if (!manifest) {
    return new Response("Link inexistent sau expirat.", { status: 404 });
  }
  return zipResponse(manifest);
}

function zipResponse(manifest: {
  name: string;
  files: { key: string; path: string }[];
}): Response {

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
