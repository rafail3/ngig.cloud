-- Editable notification message templates. A per-type override of the title and
-- body; null = use the code default from the catalog. Templates may contain
-- {placeholders} that are filled with the event's dynamic values at send time.

alter table public.notification_settings add column title text;
alter table public.notification_settings add column body text;
