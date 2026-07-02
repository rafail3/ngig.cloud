-- ngig.cloud — recursive folder stats (total size + file count) for the info box.
-- Run in Supabase → SQL Editor.

create or replace function public.folder_stats(fid uuid)
returns table (total_size bigint, file_count bigint)
language sql
security definer
stable
set search_path = public
as $$
  with recursive sub as (
    select id from public.folders where id = fid and owner_id = auth.uid()
    union all
    select f.id from public.folders f join sub s on f.parent_id = s.id
  )
  select coalesce(sum(fl.size), 0)::bigint, count(*)::bigint
  from public.files fl
  where fl.owner_id = auth.uid()
    and fl.folder_id in (select id from sub);
$$;

revoke execute on function public.folder_stats(uuid) from anon;
grant   execute on function public.folder_stats(uuid) to authenticated;
