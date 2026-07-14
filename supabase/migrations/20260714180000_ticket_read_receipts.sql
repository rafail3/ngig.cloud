-- Live read receipts + a badge that clears per opened ticket.

-- Read receipts need each side to see WHEN the other opened the thread, so the
-- own-rows-only policy is replaced by a participants policy: admins see all
-- view rows, an owner sees the rows of their own tickets. That exposure IS the
-- feature (the double tick), and it's scoped to threads you're part of.
drop policy if exists ticket_views_own on public.ticket_views;

create policy ticket_views_participants on public.ticket_views
  for select using (
    is_admin()
    or exists (
      select 1 from public.tickets t
      where t.id = ticket_id and t.user_id = auth.uid()
    )
  );

-- ...and the ticks must light up without a manual refresh.
alter publication supabase_realtime add table public.ticket_views;
alter table public.ticket_views replica identity full;

-- The nav badge now counts unread THREADS (cleared by opening each ticket),
-- exactly matching the "nou" rows — so the inbox-level stamp is dead weight.
drop table if exists public.ticket_inbox_views;
