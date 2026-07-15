import { NextResponse } from "next/server";
import { openFileForEditor } from "@/server/office/onlyoffice";

// Serves a document TO the Document Server for editing.
//
// Why we proxy instead of handing it a presigned B2 link directly: with JWT
// enabled, the Document Server attaches `Authorization: Bearer <jwt>` to every
// outbound request. S3 refuses a request that presents two auth mechanisms at
// once — a signature in the query string AND an Authorization header — and
// answers 400 AuthorizationHeaderMalformed. B2 never sees that header now; it
// lands here, where it's simply ignored.
//
// Access is granted by the same signed token the editor was opened with, so
// this is no more exposed than a presigned URL would be.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t");
  if (!token) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const { stream, name, contentType, size } = await openFileForEditor(token);
    const headers = new Headers({
      "Content-Type": contentType,
      // The Document Server reads the filename from here when the URL has no
      // extension of its own. Header values are ASCII-only, and a Romanian file
      // name is very often not ("Achiziție…" threw on the ț and the whole
      // response blew up as a 404) — hence the plain fallback plus the RFC 5987
      // form that carries the real name.
      "Content-Disposition": contentDisposition(name),
      "Cache-Control": "no-store",
    });
    if (size) headers.set("Content-Length", String(size));
    return new NextResponse(stream, { headers });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
