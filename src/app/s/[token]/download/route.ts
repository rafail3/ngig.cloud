import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { contentDisposition } from "@/lib/http";
import { getObjectStream } from "@/server/storage/b2";
import { resolveShareDownload } from "@/server/share/service";
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
//
// The service resolves the token ONCE and gates (password + download limit)
// before serving. Any refusal — dead link, missing password, exhausted limit —
// redirects to the share page itself, which renders the polished
// unavailable/locked card instead of a bare text response.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const subfolderId = new URL(req.url).searchParams.get("folder");

  const cookieVal = readCookie(req.headers.get("cookie"), unlockCookieName(token));
  const cookieOk = verifyUnlockValue(token, cookieVal);

  const result = await resolveShareDownload(token, cookieOk, subfolderId);

  if ("status" in result) {
    return Response.redirect(new URL(`/s/${token}`, req.url), 302);
  }
  if ("redirect" in result) {
    return Response.redirect(result.redirect, 302);
  }
  return zipResponse(result.zip);
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
