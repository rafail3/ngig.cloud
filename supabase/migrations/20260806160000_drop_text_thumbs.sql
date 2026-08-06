-- ngig.cloud — text and code files no longer carry a thumbnail.
--
-- They briefly did: the first lines were rendered as a page. What actually
-- identifies such a file is its FORMAT, and that is derivable from the
-- filename — so the list now draws a badge ("TXT", "HTML", "PYTHON") itself,
-- with nothing fetched, rendered or stored.
--
-- This drops the references those files picked up. The daily B2 cleanup then
-- reclaims the orphaned objects on its next run: it deletes objects no row
-- points at, and after this nothing points at these.
-- Run in Supabase → SQL Editor (or `npm run db:push`).

update public.files
set thumb_key = null,
    thumb_failed_at = null
where (thumb_key is not null or thumb_failed_at is not null)
  and name ~* '\.(txt|md|markdown|json|jsonc|js|jsx|ts|tsx|css|scss|html|xml|yml|yaml|csv|log|ini|env|sh|py|rb|go|rs|java|c|h|cpp|sql|toml)$';
