# Supabase CLI Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual copy-paste of SQL into the Supabase editor with a versioned Supabase CLI workflow (`supabase db push`), keeping the existing 26 hand-written SQL migrations and the Supabase-client data layer untouched.

**Architecture:** Adopt the Supabase CLI as a dev dependency. Rename the existing numeric-prefixed migrations to the CLI-native 14-digit timestamp format (content unchanged), link the repo to the production project, and baseline all 26 as already-applied so `db push` never re-runs them. New migrations follow `migration new` → edit SQL → `db push --dry-run` → `db push`.

**Tech Stack:** Supabase CLI (npm dev dependency), Node 24 / npm 11, existing Postgres/Supabase project (ref `ruzitzylefyhpvxfitrq`).

## Global Constraints

- Do NOT introduce Prisma in any form.
- Do NOT change any application code — data access stays on the Supabase client.
- Do NOT use `db pull` / schema squashing — the 26 hand-written files are the source of truth.
- Do NOT re-run existing migrations against prod — they are already applied; baseline them.
- No CI automation and no local Docker stack (both are out of scope / future).
- SQL file **contents** must remain byte-identical through the rename (only filenames change).
- Secrets (access token, DB password) NEVER committed. Only `config.toml` is committed.
- Project ref: `ruzitzylefyhpvxfitrq`.
- **Who runs what:** file edits = performed in-session. Commands needing the real environment, Supabase auth, the production DB, or git (`npm`, `npx supabase login/link/migration/db`, `git`) = **run by the user**, output verified together. Each command step is tagged `[USER RUNS]`.

---

### Task 1: Install the Supabase CLI and initialize config

**Files:**
- Modify: `package.json` (adds `supabase` to devDependencies)
- Modify: `package-lock.json`
- Create: `supabase/config.toml` (by `supabase init`)
- Modify: `.gitignore`

**Interfaces:**
- Produces: a working `npx supabase` command and a committed `supabase/config.toml`; the `supabase/` directory now holds both `migrations/` (existing) and `config.toml`.

- [ ] **Step 1: Install the CLI as a dev dependency** — `[USER RUNS]`

```bash
npm install -D supabase
```
Expected: installs without error; `package.json` gains `"supabase"` under `devDependencies`.

- [ ] **Step 2: Verify the CLI runs**

```bash
npx supabase --version
```
Expected: prints a version number (e.g. `2.x.x`).

- [ ] **Step 3: Initialize Supabase config** — `[USER RUNS]`

```bash
printf 'n\nn\n' | npx supabase init
```
(The two `n` answers decline the optional VS Code / IntelliJ Deno settings prompts.)
Expected: creates `supabase/config.toml`. It will report that `supabase/migrations` already exists — that is fine, it is left untouched.

- [ ] **Step 4: Ignore CLI temp/secret artifacts**

Append to `.gitignore`:

```gitignore

# Supabase CLI local/temp artifacts (never commit secrets or linked-project state)
supabase/.temp
supabase/.branches
supabase/.env
```

- [ ] **Step 5: Confirm no unexpected files are staged**

```bash
git status --short
```
Expected: shows `package.json`, `package-lock.json`, `.gitignore`, and `supabase/config.toml` (plus possibly `supabase/.gitignore` created by init). No `.temp`/secret files.

- [ ] **Step 6: Commit** — `[USER RUNS]`

```bash
git add package.json package-lock.json .gitignore supabase/config.toml supabase/.gitignore
git commit -m "chore(db): add Supabase CLI and init config"
```

---

### Task 2: Rename the 26 migrations to CLI-native timestamp format

**Files:**
- Rename (content unchanged): all 26 files in `supabase/migrations/` from `NNNN_<name>.sql` to `<14-digit>_<name>.sql`.

**Interfaces:**
- Consumes: the existing `supabase/migrations/0001_…0026_*.sql`.
- Produces: the same 26 files with timestamp versions `20240101000001`…`20240101000026`, preserving order 0001→0026. These exact version strings are consumed by Task 4's baseline command.

**Version mapping (synthetic, order-preserving; real authorship remains in git blame):**

| Old | New version | Name |
|-----|-------------|------|
| 0001 | 20240101000001 | init_auth |
| 0002 | 20240101000002 | files |
| 0003 | 20240101000003 | rename_storage_key |
| 0004 | 20240101000004 | invite_revoke |
| 0005 | 20240101000005 | admin_list_invites |
| 0006 | 20240101000006 | user_admin |
| 0007 | 20240101000007 | admin_signout |
| 0008 | 20240101000008 | block_enforcement |
| 0009 | 20240101000009 | force_logout |
| 0010 | 20240101000010 | account_gate |
| 0011 | 20240101000011 | account_gate_noarg |
| 0012 | 20240101000012 | app_settings |
| 0013 | 20240101000013 | logins_daily |
| 0014 | 20240101000014 | daily_full_range |
| 0015 | 20240101000015 | my_sessions |
| 0016 | 20240101000016 | my_login_devices |
| 0017 | 20240101000017 | invite_fk_set_null |
| 0018 | 20240101000018 | session_logout |
| 0019 | 20240101000019 | folders |
| 0020 | 20240101000020 | folder_stats |
| 0021 | 20240101000021 | file_trash |
| 0022 | 20240101000022 | file_updated_at |
| 0023 | 20240101000023 | file_archive |
| 0024 | 20240101000024 | session_dedup |
| 0025 | 20240101000025 | email_has_account |
| 0026 | 20240101000026 | profile_email_change |

- [ ] **Step 1: Rename all 26 files with `git mv`** — `[USER RUNS]`

```bash
cd supabase/migrations
for f in [0-9][0-9][0-9][0-9]_*.sql; do
  n="${f%%_*}"                 # e.g. 0007
  rest="${f#*_}"              # e.g. admin_signout.sql
  ts="202401010000$(printf '%02d' "$((10#$n))")"   # 0007 -> 20240101000007
  git mv "$f" "${ts}_${rest}"
done
cd ../..
```
Expected: 26 renames, no errors.

- [ ] **Step 2: Verify the rename is content-preserving and complete**

```bash
git status --short supabase/migrations/ | grep -c '^R'
git diff --cached --stat -M supabase/migrations/ | tail -1
```
Expected: first command prints `26` (26 renames). The stat line shows 0 insertions/0 deletions (pure renames — `-M` detects them). If any file shows content change, STOP and investigate.

- [ ] **Step 3: Verify all new names match the 14-digit pattern**

```bash
ls -1 supabase/migrations/ | grep -vcE '^[0-9]{14}_.+\.sql$'
```
Expected: `0` (every file matches `<14 digits>_<name>.sql`).

- [ ] **Step 4: Commit** — `[USER RUNS]`

```bash
git add -A supabase/migrations/
git commit -m "chore(db): rename migrations to Supabase timestamp format"
```

---

### Task 3: Authenticate and link the repo to the production project

**Files:** none (writes CLI auth state outside the repo + `supabase/.temp`, which is git-ignored).

**Interfaces:**
- Consumes: project ref `ruzitzylefyhpvxfitrq`.
- Produces: a linked CLI able to reach the production DB, used by Task 4.

- [ ] **Step 1: Log in to Supabase** — `[USER RUNS]`

```bash
npx supabase login
```
(Opens a browser to authorize / paste an access token.)
Expected: `Finished supabase login.`

- [ ] **Step 2: Link the repo to the project** — `[USER RUNS]`

```bash
npx supabase link --project-ref ruzitzylefyhpvxfitrq
```
(Prompts for the database password — the project's Postgres password from the Supabase dashboard → Settings → Database.)
Expected: `Finished supabase link.`

- [ ] **Step 3: Confirm the link resolves**

```bash
npx supabase projects list
```
Expected: the project row for `ruzitzylefyhpvxfitrq` is marked as linked (●).

---

### Task 4: Baseline — mark all 26 migrations as already applied

This is the correctness-critical task: it tells the remote tracking table these
migrations are done, so `db push` treats them as applied and never re-runs them.

**Files:** none (writes to the remote `supabase_migrations.schema_migrations` table only).

**Interfaces:**
- Consumes: the 26 timestamp versions from Task 2.
- Produces: a remote migration history where all 26 are `applied` and 0 are pending — the precondition for the Task 5 workflow.

- [ ] **Step 1: Inspect current local-vs-remote state** — `[USER RUNS]`

```bash
npx supabase migration list
```
Expected: a table listing all 26 local versions. The REMOTE column is empty for every row (the CLI has never tracked them). This also confirms the CLI parses the new timestamp filenames without a format error. If any filename triggers a format warning, STOP — the rename in Task 2 is wrong.

- [ ] **Step 2: Baseline all 26 versions as applied (no SQL is executed)** — `[USER RUNS]`

```bash
npx supabase migration repair --status applied \
  20240101000001 20240101000002 20240101000003 20240101000004 20240101000005 \
  20240101000006 20240101000007 20240101000008 20240101000009 20240101000010 \
  20240101000011 20240101000012 20240101000013 20240101000014 20240101000015 \
  20240101000016 20240101000017 20240101000018 20240101000019 20240101000020 \
  20240101000021 20240101000022 20240101000023 20240101000024 20240101000025 \
  20240101000026
```
Expected: `Repaired migration history: [20240101000001 … 20240101000026] => applied`.

- [ ] **Step 3: Verify everything is in sync with nothing pending** — `[USER RUNS]`

```bash
npx supabase migration list
```
Expected: all 26 rows now show BOTH a LOCAL and a REMOTE version (in sync).

- [ ] **Step 4: Verify `db push` sees no pending migrations (dry run)** — `[USER RUNS]`

```bash
npx supabase db push --dry-run
```
Expected: `Remote database is up to date.` (or "no migrations to apply"). This proves the baseline worked — prod is untouched and nothing would be re-run.

---

### Task 5: Add npm scripts, document the workflow, and prove the write path

**Files:**
- Modify: `package.json` (scripts)
- Create: `supabase/migrations/README.md`

**Interfaces:**
- Consumes: the linked + baselined project from Tasks 3–4.
- Produces: `npm run db:new`, `npm run db:preview`, `npm run db:push`; an in-repo how-to.

- [ ] **Step 1: Add convenience scripts to `package.json`**

Add to the `"scripts"` block (keep existing scripts intact):

```json
    "db:new": "supabase migration new",
    "db:preview": "supabase db push --dry-run",
    "db:push": "supabase db push"
```

- [ ] **Step 2: Document the workflow**

Create `supabase/migrations/README.md`:

```markdown
# Database migrations

Migrations are plain SQL files applied with the Supabase CLI (installed as a dev
dependency). We do NOT paste SQL into the Supabase dashboard anymore.

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
- One production database, no staging: `db:preview` before every `db:push`.
- First-time setup on a new machine: `npx supabase login` then
  `npx supabase link --project-ref ruzitzylefyhpvxfitrq`.
```

- [ ] **Step 3: Prove the full write path with a harmless real migration** — `[USER RUNS]`

Create the migration file via the CLI:

```bash
npm run db:new -- cli_baseline_marker
```
Then put this idempotent, side-effect-free SQL in the created file (safe to run on prod — it only sets a database comment):

```sql
-- Proves the Supabase CLI push path works end to end.
comment on schema public is 'ngig.cloud — migrations managed by Supabase CLI';
```

Preview then apply:

```bash
npm run db:preview   # expected: shows the one new migration will be applied
npm run db:push      # expected: applies it; "Finished supabase db push."
npx supabase migration list   # expected: the new migration now LOCAL + REMOTE
```

- [ ] **Step 4: Commit** — `[USER RUNS]`

```bash
git add package.json supabase/migrations/README.md supabase/migrations/*_cli_baseline_marker.sql
git commit -m "chore(db): add migration npm scripts, docs, and verify push path"
```

- [ ] **Step 5: Push the branch** — `[USER RUNS]`

```bash
git push -u origin chore/supabase-cli-migrations
```

---

## PR

**Title:** `chore(db): manage migrations with the Supabase CLI`

**Description (EN):**

```markdown
## What

Adopts the Supabase CLI to manage database migrations, replacing the manual
copy-paste of SQL into the Supabase dashboard editor.

## Why

Every schema change previously had to be pasted by hand into the SQL editor —
error-prone and unversioned against the actual apply step. The CLI applies our
existing SQL migrations with a single previewed command.

## Changes

- Add `supabase` CLI as a dev dependency + `supabase/config.toml`.
- Rename the 26 existing migrations to the CLI-native 14-digit timestamp format
  (SQL contents unchanged; real authorship preserved in git blame).
- Baseline all 26 as already-applied on the production project so they are never
  re-run.
- Add npm scripts `db:new` / `db:preview` / `db:push` and a `supabase/migrations/README.md`.

## Not included (by design)

No Prisma, no CI automation, no local Docker stack, no application-code changes.
A local Docker test stack is a noted future option once the app grows.

## Reviewer notes

- No application code changed; data access stays on the Supabase client.
- Migration file **contents** are byte-identical — the diff is renames only,
  plus config/scripts/docs.
```

---

## Self-Review

**Spec coverage:**
- Install CLI as dev dep → Task 1. ✅
- `supabase init` + config → Task 1. ✅
- `.gitignore` for temp/secrets → Task 1. ✅
- Link to project → Task 3. ✅
- Baseline 26 without re-running → Task 4. ✅
- Keep files as source of truth / no `db pull` → honored (rename only). ✅
- Numbering-format risk → resolved deterministically by the Task 2 rename; re-checked in Task 4 Step 1. ✅
- npm scripts + `--dry-run` preview → Task 5. ✅
- No Prisma / no CI / no Docker / no app-code change → Global Constraints + PR. ✅
- Future Docker note → PR "Not included". ✅

**Placeholder scan:** No TBD/TODO; every command and SQL snippet is concrete.

**Type/version consistency:** The 26 timestamp versions in Task 2's table exactly match the versions listed in Task 4's baseline command (`20240101000001`…`20240101000026`).
