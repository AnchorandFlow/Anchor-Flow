# Restoring from a backup

How to get Anchor & Flow data back from a `pg_dump` backup in `~/Desktop/af-backups/`.

- Backups live **only** in `~/Desktop/af-backups/<MM-DD-YYYY>/`. Never copy them into this repo. They hold
  every family's data plus password hashes and session tokens.
- Never paste the database password into a file, a commit, or chat. Type it at the prompt or keep it in
  your password manager.
- **Always restore to a local copy first** (Step 1) and check it before you touch production.

Last drilled: **2026-11-21**, using backup `11-12-2026/af-full-2026-11-12.sql` on Postgres 17.11 (Homebrew,
Intel Mac). The restore ran clean (0 errors). It produced 52 households, 54 members, 58 household backups,
19 exhale cards, 11 shopping items, 4 subscriptions and 73 auth users. Household `hh_o7yzu28` was present
with its people, meals, exhale buckets/waves, vault/home systems and Tide Pool (coveData) data.

---

## What a backup contains

`af-full-YYYY-MM-DD.sql` is a plain-SQL `pg_dump` of the whole Supabase database:

| Schema | What's in it |
|---|---|
| `public.households` | **Almost all app data.** Each household is one row; `data` is a JSON object keyed like the app's storage (`people`, `calEvents`, `meals`, `exhale_buckets`, `vaultSystems`, `homeSystems`, `coveData`, `cove_*_v1`, `af_sunset_log` once Sunset shipped, …). |
| `public.household_members`, `household_backups`, `exhale_cards`, `shopping_items`, `subscriptions`, `stripe_events`, `push_subscriptions` | Membership, the app's own rolling snapshots, and billing state. |
| `auth.*` | Supabase logins (emails, password hashes, sessions). |
| `storage`, `realtime`, `cron`, `vault` | Supabase internals. |

The `*_rows.csv` files next to it are table-editor exports. They're handy for a quick look but are not a
full backup.

## Step 1 — Restore into a throwaway local Postgres (safe; touches nothing online)

```bash
brew install postgresql@17            # once; the version must be >= the server's (17.x)
export PATH="$(brew --prefix postgresql@17)/bin:$PATH"

BACKUP=$(ls -t ~/Desktop/af-backups/*/af-full-*.sql | head -1); echo "$BACKUP"
WORK=$(mktemp -d /tmp/afr.XXXX)       # keep it short (macOS socket paths max out at 103 chars)

# A private cluster on port 54329, listening on localhost only
initdb -D "$WORK/db" -U drill --auth=trust -E UTF8 >/dev/null
pg_ctl -D "$WORK/db" -o "-p 54329 -k '' -c listen_addresses=127.0.0.1" -l "$WORK/pg.log" start
P="psql -h 127.0.0.1 -p 54329 -U drill -X -q"

# Supabase's roles must exist for OWNER/GRANT lines (placeholders, no login)
for r in anon authenticated postgres service_role supabase_functions_admin; do
  $P -d postgres -c "DO \$\$BEGIN CREATE ROLE $r NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END\$\$;"
done
$P -d postgres -c "CREATE DATABASE af_restore"

# pg_cron and supabase_vault exist only on Supabase. Drop just those lines (cron run
# logs + an empty vault) into a working copy. The backup file itself is never edited.
awk '
  skip && /^\\\.$/ { skip=0; next }
  skip { next }
  /^COPY (cron|vault)\./ { skip=1; next }
  /^(CREATE EXTENSION IF NOT EXISTS|COMMENT ON EXTENSION) (pg_cron|supabase_vault)/ { next }
  /setval\(.cron\./ { next }
  { print }' "$BACKUP" > "$WORK/restore.sql"

$P -d af_restore -v ON_ERROR_STOP=1 --single-transaction -f "$WORK/restore.sql" && echo RESTORE-OK
```

Expect `RESTORE-OK` and two harmless `wal_level is insufficient` warnings (Supabase realtime publications).
If roles change in a future dump, the error names the missing role: add it to the `for r in …` list and run
again.

### Check it

```bash
P="psql -h 127.0.0.1 -p 54329 -U drill -X -d af_restore"
$P -c "select 'households',count(*) from public.households union all select 'members',count(*) from public.household_members union all select 'backups',count(*) from public.household_backups union all select 'exhale_cards',count(*) from public.exhale_cards union all select 'users',count(*) from auth.users"
# One household: how many items in each key area (counts only, no content)
$P -c "select k, jsonb_typeof(data->k), case jsonb_typeof(data->k) when 'array' then jsonb_array_length(data->k) when 'object' then (select count(*) from jsonb_object_keys(data->k)) end from public.households, unnest(array['people','calEvents','meals','exhale_buckets','vaultSystems','homeSystems','coveData','af_sunset_log']) k where id='hh_o7yzu28'"
```

Compare with the numbers at the top of this file. A big drop (e.g. `people` 0, or `households` far fewer)
means you picked the wrong or a corrupt backup.

### Clean up when done (always)

```bash
pg_ctl -D "$WORK/db" stop -m fast && rm -rf "$WORK"
```

## Step 2 — Put data back in production (only after Step 1 checks out)

Try the least invasive option first.

**A. Supabase's own backups.** Dashboard → Database → Backups (or Point-in-Time Recovery if enabled).
This is the fastest way back to "an hour ago", and it needs none of the steps below.

**B. One household rolled back** (the usual emergency: a bad sync wiped a family's data).
1. With the Step 1 copy running, export that household's JSON:
   `psql -h 127.0.0.1 -p 54329 -U drill -X -Atd af_restore -c "select data from public.households where id='hh_XXXX'" > /tmp/hh.json`
2. Check it looks right (`jq 'keys' /tmp/hh.json`, `jq '.people|length' /tmp/hh.json`).
3. Supabase Dashboard → SQL Editor. First save the current state:
   `insert into public.household_backups (household_id, data) select id, data from public.households where id='hh_XXXX';`
4. Then `update public.households set data = '<paste JSON>'::jsonb, updated_at = now() where id='hh_XXXX';`
5. Ask the family to close and reopen the app (each device pulls the restored data on open).
6. Delete `/tmp/hh.json`.

**C. Whole project lost** (not yet drilled, so expect to adapt):
1. Create a new Supabase project. From this repo, link it and apply the schema:
   `supabase link --project-ref <new-ref>` then `supabase db push`.
2. Load the `public.*` data (and `auth.users` / `auth.identities` if logins must keep working) from the
   Step 1 copy with `pg_dump --data-only --table=public.households …` piped into the new project's
   connection string. Copy that string from Dashboard → Connect and type the password when `psql` prompts.
3. Point the app's `VITE_SUPABASE_URL` / anon key in Vercel at the new project and redeploy with `./deploy.sh`.

## Taking a backup

```bash
pg_dump "postgresql://postgres.<ref>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
  --no-owner --exclude-table-data='auth.refresh_tokens' --exclude-table-data='auth.sessions' \
  > ~/Desktop/af-backups/$(date +%m-%d-%Y)/af-full-$(date +%F).sql
```

`pg_dump` prompts for the password, so never put it in the URL. Excluding refresh tokens and sessions keeps
live login tokens out of the file; on restore, people simply sign in again.
