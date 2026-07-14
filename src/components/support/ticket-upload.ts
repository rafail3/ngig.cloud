import { presignTicketUploadAction } from "@/app/(app)/support/actions";
import type { IncomingAttachment } from "@/lib/tickets";

// Upload one file straight to B2 via a presigned PUT, returning the metadata the
// create/reply actions expect. Used by both the user and admin ticket forms.
export async function uploadTicketFile(file: File): Promise<IncomingAttachment> {
  const res = await presignTicketUploadAction({
    name: file.name,
    size: file.size,
    contentType: file.type,
  });
  if (!res.ok) throw new Error(res.error);

  const put = await fetch(res.url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  if (!put.ok) throw new Error(`Nu am putut încărca „${file.name}”.`);

  return {
    key: res.key,
    name: file.name,
    size: file.size,
    mimeType: file.type || null,
  };
}
