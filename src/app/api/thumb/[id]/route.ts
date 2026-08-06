import { NextResponse } from "next/server";
import { getFileThumbKey } from "@/server/files/service";
import { presignInline } from "@/server/storage/b2";

// Serves a file's thumbnail.
//
// A route rather than a presigned URL, because the URL has to be STABLE: the
// file list re-renders on every folder navigation, and a fresh presigned URL
// each time would miss the browser cache and re-fetch the same bytes forever.
// `/api/thumb/<id>` is cacheable, so a thumbnail is fetched once per file and
// then served from disk — which is also why this isn't logged as egress: after
// the first paint the real repeat traffic is close to zero.
//
// Ownership is enforced by RLS inside getFileThumbKey (owner-scoped read), so a
// guessed id returns 404 rather than someone else's picture.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let key: string | null;
  try {
    key = await getFileThumbKey(id);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  if (!key) return new NextResponse(null, { status: 404 });

  try {
    // Fetch the presigned URL and forward the WEB stream — the same pattern the
    // OnlyOffice file route uses. `getObjectStream` returns a NODE stream, which
    // NextResponse cannot consume: it type-checks behind a cast and then fails
    // at runtime, which is exactly how this route shipped broken the first time.
    const res = await fetch(await presignInline(key, 600));
    if (!res.ok || !res.body) return new NextResponse(null, { status: 404 });

    return new NextResponse(res.body, {
      headers: {
        // Browser-made thumbnails are JPEG; the ones the Document Server renders
        // for Office documents come back as PNG. Forward what the object
        // actually is rather than asserting one of them.
        "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
        // Immutable in practice: a new thumbnail always lands under a new key,
        // so a cached response can never go stale for this file.
        "Cache-Control": "private, max-age=604800, immutable",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
