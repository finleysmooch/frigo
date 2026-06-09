# Frigo — Database Migrations Workflow
**Created:** 2026-06-09
**Last Updated:** 2026-06-09
**Owner topic:** Supabase schema change management (resolves P7-23)

This doc is the single source of truth for how Frigo's Postgres schema is
changed and tracked. It was adopted in CP1 (P7-23): before this, 20+ DDL
changes were applied ad hoc via the Supabase SQL editor and were **not** in any
migration history, so the database was not reproducible for a fresh
environment. CP1 baselined the live schema and switched to CLI-tracked
migrations.

---

## ⚠️ Shared production database — read first

There is **one** Supabase project (ref `siaawxcgyghuphwgufkn`) and it backs the
real app. **A git branch does NOT isolate the database.** Any
remote-touching command (`db push`, `migration repair`, `db pull`) hits
production immediately. There is no staging DB.

Consequences:
- Treat every `db push` as a production deploy.
- `db push --dry-run` first, always, to see exactly what will run.
- Destructive DDL (drop column/table, type changes) needs extra care — see the
  tiered push policy below.

---

## The everyday workflow

```bash
# 1. Author a new migration (creates an empty timestamped file)
supabase migration new <short_snake_case_name>

# 2. Edit the generated file:
#    supabase/migrations/<timestamp>_<name>.sql
#    Write forward DDL. Keep it idempotent where practical
#    (IF NOT EXISTS / IF EXISTS, guards).

# 3. Preview what would run against the remote
supabase db push --dry-run

# 4. Apply it (records the version in remote migration history)
supabase db push
```

Check sync any time with:
```bash
supabase migration list        # Local vs Remote columns should match
```

### Prerequisites / environment notes
- **Authentication:** `supabase login` (one-time, machine-level).
- **Link:** `supabase link --project-ref siaawxcgyghuphwgufkn`. The DB password
  is read from `SUPABASE_DB_PASSWORD` in `.env` (gitignored — never commit it).
- **CLI version:** use **≥ 2.105.0**. The older 2.58.5 crashed `db pull` /
  `db diff` because it pulled a newer `storage-api` image whose internal
  migrations it didn't recognise (`StorageBackendError: Migration
  optimize-existing-functions-again not found`). 2.105.0 fixed it.
- **Docker:** `db pull` and `db diff` spin up a local shadow Postgres
  (via Docker Desktop) to version-match the server. Docker must be running for
  those two commands. `db push` / `migration list` / `migration new` do **not**
  need Docker — **applying** a migration (including CP5) needs only the linked
  project + the DB password (`SUPABASE_DB_PASSWORD`), not the daemon. A schema
  change can be pushed with Docker stopped; Docker is only for the pull/diff
  verification tooling.

---

## Standing rule — function/RPC grants (anon-EXECUTE lockdown)

**Every migration that creates a function/RPC MUST explicitly lock down EXECUTE, not assume the defaults are safe.** A freshly created public function is callable by `anon` immediately, from **two** independent sources:

1. **The default `PUBLIC` grant** — Postgres grants `EXECUTE` to `PUBLIC` on every new function, and `anon`/`authenticated` inherit `PUBLIC`.
2. **Supabase's default privileges** — which *also* hand `anon` / `authenticated` / `service_role` an **explicit** `EXECUTE` grant on new functions in `public`.

Neutralizing only one source leaves the function callable. The reliable recipe is to revoke **both** the `PUBLIC` grant and any role you don't intend, then grant to the intended roles:

```sql
REVOKE ALL ON FUNCTION public.my_fn(args) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_fn(args) FROM anon;          -- if anon must NOT call it
GRANT EXECUTE ON FUNCTION public.my_fn(args) TO authenticated; -- only the roles you intend
```

Always verify after pushing: `SELECT has_function_privilege('anon','public.my_fn(args)','execute');`

**Worked example:** CP2's `redeem_invite_code` shipped *still callable by `anon`* even though the base migration did `REVOKE … FROM PUBLIC` + `GRANT … TO authenticated` — because the **explicit** `anon` grant from Supabase's default privileges survived (source #2). Fixed forward-only by `supabase/migrations/20260609184359_invite_codes_restrict_redeem_to_authenticated.sql` (`REVOKE EXECUTE … FROM anon`). `validate_invite_code` *intentionally* stays anon-callable (pre-account gate).

This rule protects CP5's auth-trigger function and every future RPC migration.

---

## The baseline (CP1)

- **Baseline migration:** `supabase/migrations/20260609155555_baseline_public.sql`
  — a full `pg_dump` of the live **public** schema (76 tables, 46 functions,
  148 policies). Generated with `supabase db pull --schema public`.
- It is registered in remote history as **applied** (via
  `supabase migration repair --status applied 20260609155555`), so `db push`
  will never try to re-run it.
- **Public schema only.** The `auth` schema is deliberately **not** tracked —
  GoTrue manages it, and tracking it would invite conflicts on any reset or
  fresh environment. The baseline contains zero `auth`-schema DDL (the only
  `auth.` references are foreign keys on public tables pointing at
  `auth.users(id)`, which is correct and expected).
- **Forward-loop proof:** `20260609163207_adopt_migrations_marker.sql` is an
  inert `COMMENT ON SCHEMA public` migration pushed in CP1 to prove the
  author → push → tracked cycle end-to-end. It mutates no schema structure.

### Known `db diff` caveat (not a real difference)
`supabase db diff --linked --schema public` (migra engine) reports a no-op
drop + re-add of three complex `CHECK` constraints
(`measurement_units.has_metric_conversion`, `measurement_units.valid_unit_type`,
`recipe_extraction_comparison.valid_scores`). These constraints **are** present
in the baseline with identical expressions — migra simply can't reconcile
`CHECK`s that use `ANY(ARRAY[...])` / `<> ALL` and emits a balanced, self-
cancelling drop+recreate. It is cosmetic tooling churn, **not** a schema gap.
(The alternate `--use-pg-schema` engine can't be used against the pooler here —
it exhausts the session-mode 15-connection limit, `EMAXCONNSESSION`.)

**When verifying future migrations (especially CP5): ignore these three
constraint drop/re-adds in any `db diff` output — they are baseline noise, not
a real change.** A genuine change shows up as DDL *other than* those three
self-cancelling CHECK re-adds; if the only output is those three, the diff is
effectively clean.

---

## Tiered push policy

Who runs `db push` depends on how risky the migration is:

| Tier | What | Who pushes |
|------|------|-----------|
| **Mechanical** | Additive / reversible DDL: new columns, new tables, new indexes, new functions, RLS additions, comments, backfills with guards. | **CC** may push directly (after `--dry-run`). |
| **Sensitive** | Anything touching auth wiring (e.g. CP5 — the `auth.users` trigger / `handle_new_user`), destructive DDL (drop/rename column or table, type changes), or anything that could affect live users' data or login. | **Tom** runs the push (CC prepares the migration + dry-run output; Tom hits enter). Examples called out in the plan: **CP5** (auth trigger) and **CP8**. |

When in doubt, treat it as Sensitive and hand the push to Tom.

---

## CP5 reference snapshot — auth.users trigger (pre-CP5 "before")

CP5 will modify the new-user trigger. Because the `auth` schema is not tracked
in migrations, the **current live binding** is recorded here verbatim (read
from the live DB on 2026-06-09, not assumed):

```sql
CREATE OR REPLACE TRIGGER "on_auth_user_created"
  AFTER INSERT ON "auth"."users"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."handle_new_user"();
```

- Trigger name: **`on_auth_user_created`**
- Timing/event: **AFTER INSERT**, **FOR EACH ROW**, on **`auth.users`**
- Calls: **`public.handle_new_user()`**

The `handle_new_user()` function itself is a **public** function and lives in
the baseline: `supabase/migrations/20260609155555_baseline_public.sql`
(definition around lines 1273–1293; grants ~8505–8507). Only the trigger
*binding* (which sits in the auth schema) is untracked and snapshotted here.

> CP5 note: when changing the trigger, author the change as a normal tracked
> migration that operates on the `auth.users` trigger object, but do **not**
> add the auth schema to the baseline. Tom runs that push (Sensitive tier).

---

## Pre-baseline provenance (do NOT replay)

The live schema's true history predates this tracking setup and is **not**
reproducible by replaying old files — the baseline supersedes all of it. These
are kept only as provenance / archaeology:

1. **The 20 pre-baseline migration files**, moved out of the active migrations
   path to **`supabase/migrations_provenance/`** (git-tracked, but the Supabase
   CLI ignores sibling folders so they never re-run). Their effects are all
   captured in the baseline. Includes the two most recent
   (`20260604_supply_auto_list_rules.sql`,
   `20260604_supply_dedup_and_unique.sql`) plus the Phase 8 / 8C / source-
   attribution / usage-level series back to `20260424`.
2. **Phase 7 "Direct DB Migrations" ledger** — DDL Tom ran by hand in the SQL
   editor during Phase 7, recorded at
   `docs/archive/phases/PHASE_7_SOCIAL_FEED.md` (section "Direct DB Migrations
   (ran outside a migrations folder)", ~line 655).
3. **Six historical loose `.sql` files** referenced by past CPs:
   - `docs/CC_PROMPTS/8D_CP1_cheese_cleanup_migration.sql`
   - `docs/CC_PROMPTS/8D_CP1.5_base_set_corrections.sql`
   - `docs/CC_PROMPTS/8D_CP1.5_variant_linkage_migration.sql`
   - `docs/archive/handoffs/phase_8r_cp1_schema_migration.sql`
   - `docs/archive/handoffs/cp6e_schema_migration.sql`
   - `docs/archive/handoffs/8R_UX1_add_garden_storage_migration.sql`

Historical DDL is known to be **incomplete** (e.g. `handle_new_user` and the
`on_auth_user_created` trigger existed live but appeared in none of the 20
files). That incompleteness is exactly why CP1 baselines from the live DB
rather than replaying history.
