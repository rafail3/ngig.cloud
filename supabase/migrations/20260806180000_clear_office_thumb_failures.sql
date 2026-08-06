-- ngig.cloud — clear thumbnail failures recorded against Office documents.
--
-- When Office thumbnails first ran, the address the Document Server was told to
-- fetch the document from pointed at the Document Server itself. It downloaded
-- a 404 page, failed to convert it, and reported error -3 — which the code read
-- as "this document can never be rendered" and wrote to `thumb_failed_at`. The
-- documents were fine; the URL was not.
--
-- A mark like that is invisible and permanent: the drive simply never tries
-- again. So the marks are cleared here, and the code now only records the error
-- codes that unambiguously describe the document (-5, -7, -9, -10).
-- Run in Supabase → SQL Editor (or `npm run db:push`).

update public.files
set thumb_failed_at = null
where thumb_failed_at is not null
  and thumb_key is null
  and name ~* '\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf)$';
