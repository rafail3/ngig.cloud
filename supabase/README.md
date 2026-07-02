# Database migrations

Migrations are plain SQL files in `migrations/`, applied with the Supabase CLI
(installed as a dev dependency). We do NOT paste SQL into the Supabase dashboard
anymore.

## Create and apply a migration

```bash
npm run db:new -- <short_name>   # creates supabase/migrations/<timestamp>_<short_name>.sql
# write your SQL in the new file
npm run db:preview               # dry-run: shows exactly what will run on prod
npm run db:push                  # applies to the production database
```

## Notes

- Files are applied in filename order (14-digit timestamp prefix).
- RLS policies, security-definer functions, RPCs, and triggers are just SQL and
  live in these files like everything else.
- One production database, no staging: run `db:preview` before every `db:push`.
- First-time setup on a new machine: `npx supabase login` then
  `npx supabase link --project-ref ruzitzylefyhpvxfitrq`.
- The `db push` output may print a non-fatal `pgdelta ... ca.crt` warning from
  the CLI's experimental catalog cache; it does not affect migrations.
```
