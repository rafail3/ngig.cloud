# Design: Database migrations via Supabase CLI (TASK 6)

**Date:** 2026-07-02
**Status:** Approved, pending implementation
**Branch:** `chore/supabase-cli-migrations`

## Goal

Stop applying schema changes by copy-pasting SQL into the Supabase SQL editor.
Replace that manual step with a single versioned CLI command, while keeping the
existing hand-written SQL migrations and the Supabase-client data layer exactly
as they are.

## Why not Prisma

The task was originally noted as "Prisma", but the app relies heavily on
Postgres-native features that Prisma Migrate does not model natively: RLS
policies, security-definer functions, RPCs, and triggers (e.g. `auth.uid()`,
`admin_list_users`, `prune_duplicate_sessions`, `email_has_account`). With
Prisma we would still write all of that as raw SQL in manually-edited migrations,
gaining little while adding a heavy tool and risking drift between
`schema.prisma` and the real database.

Supabase CLI is purpose-built for this: it applies our existing `.sql` migration
files (RLS/functions/triggers are just SQL, native), versions them, links to the
project, and applies with one command. No rewrite required.

## Decisions (locked)

- **Tool:** Supabase CLI (not Prisma, not Prisma-for-migrations-only).
- **Apply mode:** manual `supabase db push` from the developer machine. No CI
  automation. Rationale: single production database, no staging — the developer
  stays in control of when schema changes hit prod.
- **Local database:** none for now. No Docker/local stack. Preview changes with
  `supabase db push --dry-run` before applying. (Same risk profile as today's
  manual SQL, but with a preview and a single command.)
- **Existing migrations:** keep all 26 hand-written files as the source of truth.
  Baseline them as already-applied; do NOT re-run them and do NOT regenerate via
  `db pull`.
- **App code:** unchanged. Data access stays on the Supabase client. This is a
  dev-workflow / tooling change only.

## Part 1 — One-time setup

1. **Install CLI as a dev dependency:** `npm install -D supabase`. Run via
   `npx supabase`. No global install; version pinned in `package.json`.
2. **Init:** `npx supabase init` creates `supabase/config.toml`. The existing
   `supabase/migrations/` folder coexists untouched. Set `[db] major_version`
   in `config.toml` to match the production Postgres version.
3. **Link:** `npx supabase link --project-ref <ref>` (project ref from the
   dashboard URL). Auth via `supabase login` (personal access token — lives in
   the CLI/global env, NEVER committed to the repo).
4. **Baseline the 26 existing migrations:** production already has 0001→0026
   applied, but the CLI's `supabase_migrations.schema_migrations` tracking table
   is empty. Mark them applied WITHOUT re-running:
   `npx supabase migration repair --status applied 0001 … 0026`. After this,
   `db push` will not touch them. Verify with `npx supabase migration list`
   (local vs remote should show all in sync).
5. **`.gitignore`:** ignore CLI temp/secret files (`supabase/.temp`,
   `supabase/.branches`). Commit `config.toml` (no secrets in it).

## Part 2 — Workflow for new migrations

```
npx supabase migration new <name>   # creates supabase/migrations/<timestamp>_<name>.sql
# write the SQL in that file
npx supabase db push --dry-run      # PREVIEW: exactly what will run on prod
npx supabase db push                # apply to prod
```

Add short npm scripts to `package.json`: `db:new`, `db:push`, `db:preview`
(= `db push --dry-run`).

## Known risk / thing to verify during implementation

Existing files use a 4-digit numeric prefix (`0001_`). Newer Supabase CLIs
generate 14-digit timestamp versions. Must verify the installed CLI accepts the
4-digit numbering at `repair`/`push`/`list`. If it rejects them, mechanically
rename the files to timestamp format preserving order — safe, because they are
baselined (never re-run). Always run `migration list` to confirm sync before any
`db push`.

## Out of scope (YAGNI)

- Prisma (any form).
- CI automation of `db push`.
- `db pull` / schema squashing.
- Any application code change.

## Future option (noted, not now)

When the app grows more complex, add a **local Docker stack** (`supabase start`)
to test migrations against a local Postgres before pushing to prod — a real
safety net. Deferred until the added complexity is warranted.
