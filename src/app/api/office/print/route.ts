import { NextResponse } from "next/server";
import { contentDisposition } from "@/lib/http";
import { convertToPdf } from "@/server/office/onlyoffice";

// A print-ready PDF of an Office document, for the preview's print button.
//
// A route rather than a server action: the browser needs the raw bytes to build
// a blob it can hand to the print dialog, and an action would have to base64 a
// whole document through the RSC payload to deliver them.
//
// Unlike the sibling /api/office/file route, the caller here is the user's own
// browser, so this one runs on their session — no token, just RLS.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return new NextResponse("Bad request", { status: 400 });

  try {
    const { bytes, name } = await convertToPdf(id);
    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(name.replace(/\.[^.]+$/, ".pdf")),
        "Content-Length": String(bytes.byteLength),
        // The PDF is a snapshot of the file as it is right now; the next edit
        // must not print the old one.
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nu am putut printa documentul.";
    return new NextResponse(message, { status: 400 });
  }
}
