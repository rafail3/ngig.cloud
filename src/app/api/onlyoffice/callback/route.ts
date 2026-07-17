import { NextResponse } from "next/server";
import {
  verifyAccessToken,
  verifyDocumentServerToken,
  saveEditedFile,
} from "@/server/office/onlyoffice";

// Where the OnlyOffice Document Server hands back an edited document.
//
// This runs with NO user session — the caller is the Document Server, not a
// browser. Two signatures stand in for one: `?t=` is the token WE minted when
// the editor was opened (it says which file, and whose), and the body/header
// token is the Document Server's own (it says the file really came from there).
// Both are required; either one alone would let a stranger overwrite a file.
//
// The Document Server reads the RESPONSE BODY, not the status code: it only
// considers a save successful when it gets `{"error":0}`. Anything else and it
// keeps retrying, then warns the user their work couldn't be saved.

// Status codes the Document Server sends (the ones that mean "here's the file").
const READY_FOR_SAVING = 2;
const FORCE_SAVE = 6;

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("t");
  if (!token) return NextResponse.json({ error: 1 });

  let file: { fileId: string; ownerId: string; mode: string };
  try {
    file = await verifyAccessToken(token);
  } catch {
    return NextResponse.json({ error: 1 });
  }
  // A token minted for a preview carries no right to write, whatever it is
  // presented with. Previews are never given this URL in the first place.
  if (file.mode !== "edit") return NextResponse.json({ error: 1 });

  const body = (await request.json()) as {
    status?: number;
    url?: string;
    token?: string;
  };

  // The Document Server signs the callback either in the body or in the header,
  // depending on its config — accept both.
  const header = request.headers.get("authorization") ?? "";
  const dsToken = body.token ?? header.replace(/^Bearer\s+/i, "");
  if (!dsToken || !(await verifyDocumentServerToken(dsToken))) {
    return NextResponse.json({ error: 1 });
  }

  // Every other status (1 = being edited, 4 = closed with no changes) is just
  // progress reporting: acknowledge and do nothing.
  if (body.status !== READY_FOR_SAVING && body.status !== FORCE_SAVE) {
    return NextResponse.json({ error: 0 });
  }
  if (!body.url) return NextResponse.json({ error: 1 });

  try {
    const res = await fetch(body.url);
    if (!res.ok) return NextResponse.json({ error: 1 });
    const bytes = Buffer.from(await res.arrayBuffer());

    await saveEditedFile({ fileId: file.fileId, ownerId: file.ownerId, bytes });
    return NextResponse.json({ error: 0 });
  } catch {
    // Report the failure: the Document Server will retry and, if it keeps
    // failing, tell the user rather than losing their work silently.
    return NextResponse.json({ error: 1 });
  }
}
