# CC PROMPT — Phase 7I Checkpoint 1 (Data Migration)

## What this is

Phase 7I is a full architectural redesign of the Frigo feed around cook posts as the primary unit, with meal events becoming lightweight connective tissue. Full design context lives in `PHASE_7I_MASTER_PLAN.md` in this chat's outputs. **Read that doc before starting** — especially the "Supersession Notes" section which explains how this work overrides earlier decisions D44/D41/D45/D46 from the 4/9 Phase 7F wireframe session.

Wireframes: `frigo_phase_7i_wireframes.html` (seven states L1–L7).

**This is Checkpoint 1 of 7**, and it's the riskiest single step in the whole phase: the SQL data migration. Get this wrong and everything downstream is compromised. Get it right and the rest of 7I is normal UI work.

## SCOPE LOCK

In this checkpoint, you may only:
- Create SQL migration scripts in the standard Supabase migrations directory
- Create a pre-migration SQL snapshot / backup export for rollback
- Run diagnostic SQL queries against the dev database to verify the migration worked
- Update the TypeScript type definitions in `lib/types/` that describe `post_type` values

You may NOT:
- Touch any component files, screens, or services
- Delete any data (preserve everything — cleanup happens in later checkpoints)
- Alter existing table schemas beyond what's documented below
- Run the migration against production (dev/staging only)

**If the migration requires anything beyond these steps, STOP and report back with the specific change needed and why.**

---

## Background — the data model today

From reading the current state of the repo (post-Fix-Pass-9):

- `posts.post_type` is a **text column, not an enum**. Current values include `'dish'`, `'meal'`, and possibly `null` for legacy rows.
- `posts.parent_meal_id` (uuid, nullable) threads dish posts to their parent meal post. For a dish posted as part of a meal, `parent_meal_id` references the meal post's `id`.
- `post_participants` has columns `post_id`, `participant_user_id`, `external_name`, `role`, `status`, `invited_by_user_id`. Role values include `'host'`, `'sous_chef'`, `'ate_with'` (verify against the actual DB — don't trust this doc).
- `meal_participants` is a separate table with overlap. Don't touch it in Checkpoint 1.
- Meal posts (`post_type='meal'`) currently render as feed cards via `MealPostCard.tsx`. Dish posts render via `PostCard.tsx`. Linked dish groups render via `LinkedPostsGroup.tsx` (which is unwired in practice but imported by FeedScreen).
- FeedScreen's `loadDishPosts` filters with:
  - `.or('post_type.eq.dish,post_type.is.null')` — dish posts only
  - `.is('parent_meal_id', null)` — **meal-attached dishes are currently hidden from the feed** and only surface via MealPostCard's dish peek
  - `.or('visibility.eq.everyone,visibility.eq.followers,visibility.is.null')`

**Before running any migration, run these diagnostic queries and report the results in SESSION_LOG:**

```sql
-- 1. Count posts by type
SELECT post_type, COUNT(*) FROM posts GROUP BY post_type;

-- 2. Count dish posts with a parent meal
SELECT COUNT(*) FROM posts WHERE post_type = 'dish' AND parent_meal_id IS NOT NULL;

-- 3. Distinct roles in post_participants (verify role values actually in use)
SELECT role, COUNT(*) FROM post_participants GROUP BY role;

-- 4. Find any dish posts whose parent_meal_id points at a non-meal post (data integrity check)
SELECT COUNT(*) FROM posts p1
WHERE p1.post_type = 'dish'
  AND p1.parent_meal_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM posts p2 WHERE p2.id = p1.parent_meal_id AND p2.post_type = 'meal'
  );

-- 5. Find meal posts with no child dish posts (orphan meals)
SELECT COUNT(*) FROM posts p1
WHERE p1.post_type = 'meal'
  AND NOT EXISTS (
    SELECT 1 FROM posts p2 WHERE p2.parent_meal_id = p1.id
  );

-- 6. Count post_participants rows attached to meal posts
SELECT COUNT(*) FROM post_participants pp
JOIN posts p ON p.id = pp.post_id
WHERE p.post_type = 'meal';
```

**If query 4 returns anything > 0**, STOP. That's broken referential integrity that predates 7I and needs a decision before migrating. Report the count in SESSION_LOG and wait for Tom.

---

## Target state after this checkpoint

- `posts.post_type` column supports a new value `'meal_event'` (text column, so no `ALTER TYPE` needed — just a normal UPDATE).
- All existing `post_type='meal'` rows migrated to `post_type='meal_event'`. These rows retain all their fields (title, description, photos, meal_time, meal_location, meal_status, etc.) but will no longer appear as feed cards after Checkpoint 4 retires the meal feed rendering path.
- Dish posts with `parent_meal_id` pointing at a (now-renamed) meal_event post continue to work. No change to `parent_meal_id` semantics — the column references the same rows, only the `post_type` of those rows has changed.
- `post_participants` table is unchanged. Checkpoint 2 will reinterpret the semantics of `sous_chef` (→ cook partner) and `ate_with` (→ meal event attendee) at the service layer. No data or schema changes here.
- `meal_participants` table is unchanged.
- Pre-migration snapshot exists as a rollback path.
- `lib/types/` `PostType` union includes `'meal_event'`. `'meal'` stays in the union for backward compatibility during the transition.

**Explicitly NOT done in this checkpoint:**
- No new tables (no `cook_partner_links`, no `feed_groups`)
- No changes to `post_participants` data
- No changes to any component, screen, or service
- No removal of the `'meal'` value from the type union (that happens in Checkpoint 7 cleanup)

---

## The migration itself

### Step 1 — Pre-migration snapshot

Create a backup of the pre-migration state. Two acceptable approaches:

**Approach A (preferred) — Supabase CLI dump.** Use `supabase db dump` or equivalent to export the full schema + data to a file. Store it in `supabase/backups/pre_7i_checkpoint_1_<timestamp>.sql`.

**Approach B — In-DB snapshot table.** Create a table `posts_backup_pre_7i` with `CREATE TABLE posts_backup_pre_7i AS SELECT * FROM posts;`. Use only if the CLI dump isn't workable.

**The backup must exist before running any UPDATE statement.** Verify the backup has the expected row count (should match the total posts count from query 1).

### Step 2 — Migrate meal rows to meal_event (atomic transaction)

```sql
BEGIN;

-- Migrate all meal posts to meal_event
UPDATE posts
SET post_type = 'meal_event'
WHERE post_type = 'meal';

-- Sanity check: capture the affected row count and compare to pre-migration query 1

COMMIT;
```

The row count affected by the UPDATE should match the `'meal'` count from diagnostic query 1. If it doesn't, something is wrong — STOP and report.

### Step 3 — Post-migration verification queries

Run these and report results in SESSION_LOG:

```sql
-- Confirm all meal rows became meal_event rows
SELECT post_type, COUNT(*) FROM posts GROUP BY post_type;
-- Expected: no more 'meal' rows, new count for 'meal_event' matches pre-migration 'meal' count

-- Confirm parent_meal_id still points at valid meal_event rows
SELECT COUNT(*) FROM posts p1
WHERE p1.post_type = 'dish'
  AND p1.parent_meal_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM posts p2 WHERE p2.id = p1.parent_meal_id AND p2.post_type = 'meal_event'
  );
-- Expected: 0

-- Confirm no orphaned parent_meal_id references
SELECT COUNT(*) FROM posts p1
WHERE p1.post_type = 'dish'
  AND p1.parent_meal_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM posts p2 WHERE p2.id = p1.parent_meal_id
  );
-- Expected: 0

-- Confirm post_participants still attached correctly to meal_event posts
SELECT pp.role, COUNT(*)
FROM post_participants pp
JOIN posts p ON p.id = pp.post_id
WHERE p.post_type = 'meal_event'
GROUP BY pp.role;
-- Expected: matches pre-migration query 6's count, broken out by role
```

### Step 4 — Update TypeScript type definitions

Find the TypeScript file where `PostType` is defined (likely `lib/types/post.ts` or similar). Update the union:

```typescript
/**
 * Phase 7I note: 'meal' is deprecated and being migrated to 'meal_event'.
 * Meal events are now connective-tissue records that link multiple cook posts
 * (post_type='dish') into a shared event context. They are not rendered as
 * feed cards — see PHASE_7I_MASTER_PLAN.md for full context.
 *
 * After Checkpoint 4, only 'dish' post types render in the feed.
 * The 'meal' value stays in this union for backward compatibility during the
 * transition between Checkpoint 1 and Checkpoint 7; it will be removed in
 * Checkpoint 7 cleanup after all feed paths have been updated.
 *
 * This supersedes the D44 M3 architecture framing (see PHASE_7F_DESIGN_DECISIONS.md)
 * per the 2026-04-13 planning session.
 */
export type PostType = 'dish' | 'meal' | 'meal_event';
```

Do NOT remove `'meal'` from the union yet — code elsewhere in the repo still references it, and we need backward compat through Checkpoints 2-6.

---

## Verification after the full migration

### Mandatory verifications (all must pass before the HARD STOP)

1. **Pre-migration snapshot exists.** Confirm the file (or backup table) is in place and has the expected row count.
2. **Migration ran without errors.** The transaction committed cleanly.
3. **Post-migration diagnostic queries pass.** No `post_type='meal'` rows remain, zero orphaned `parent_meal_id` references, post_participants still attached to meal_event posts.
4. **TypeScript type definitions updated.** `PostType` union includes `'meal_event'` and the comment block is in place.

### Critical runtime check: the feed still loads without crashing

After the migration, **the existing FeedScreen code will behave differently but should not crash:**

- `loadDishPosts` filters `.or('post_type.eq.dish,post_type.is.null')` — this still works. Dish posts still load normally.
- `getMealsForFeed` (in `lib/services/mealService.ts`) likely queries `post_type='meal'` somewhere. After migration, **it will return zero meal rows** because all former meal rows are now `'meal_event'`. This means the feed will show dish posts only — no meal cards. **This is EXPECTED behavior during the Checkpoint 1 → Checkpoint 4 transition.** It is NOT a bug.

- **However:** the app must not crash or throw runtime errors. If loading the feed produces an error in the console or an unrecovered exception, flag it in SESSION_LOG with the stack trace. We'll decide in Checkpoint 2 whether to patch `getMealsForFeed` as a defensive measure or let it sit until Checkpoint 4 retires the call entirely.

**Explicit test:** After migration, run the app in dev, open the Feed tab, and report what happens:
- **Expected:** Feed shows dish posts only, no meal cards. No errors in console. Pull-to-refresh works. Dish card interactions (yas chef, comment) all work.
- **Unexpected:** Error boundary triggers, stack trace in console, or feed fails to load. Flag in SESSION_LOG.

### Nice-to-have verifications (if time allows)

5. **Verify meal photos are still queryable.** Run `SELECT COUNT(*) FROM meal_photos;` and confirm the count is unchanged. The `meal_photos` table is unaffected by this migration but worth a sanity check.
6. **Verify meal_participants is untouched.** Run `SELECT COUNT(*) FROM meal_participants;` — unchanged from pre-migration.

---

## HARD STOP

After Checkpoint 1 is complete:

1. **Do not proceed to any other work.**
2. Write a SESSION_LOG entry titled `Phase 7I Checkpoint 1 — Data migration meal → meal_event` with:
   - Results of all 6 pre-migration diagnostic queries
   - Confirmation the pre-migration snapshot exists (file path and row count)
   - Results of all 4 post-migration verification queries
   - The feed load runtime check result (clean, or error with stack trace)
   - Any surprises — data integrity issues, schema quirks, unexpected row counts
   - A clear GO / NO-GO recommendation for Checkpoint 2
3. **Stop and wait for Tom to review.**

Tom will review the SESSION_LOG and ask Claude.ai to generate the Checkpoint 2 prompt once this one is confirmed clean. **Do not generate or start Checkpoint 2 autonomously.**

---

## Important notes

- **This is a data migration, not a code refactor.** The only code change in this checkpoint is the PostType union in `lib/types/`. Everything else is SQL. If scope creeps into touching component/service/screen code, STOP.
- **Preserve all data.** Every `post_likes`, `post_comments`, `post_participants`, `meal_participants`, `posts`, `meal_photos`, `dish_courses`, etc. row that exists today should still exist after the migration. The only field that changes is `posts.post_type` for former meal rows.
- **The pre-migration snapshot is not optional.** If you can't create one, STOP and report back.
- **Do not run against production.** Dev / staging / local only.
- **If diagnostic query 4 returns > 0** (dish posts with broken parent_meal_id references), STOP. That's a data integrity issue that predates 7I and needs its own decision before we migrate.
- **The `'meal'` value stays in the TypeScript PostType union** during the transition. Do NOT remove it. Removal is a Checkpoint 7 cleanup task.
- **`getMealsForFeed` returning 0 rows after migration is expected**, not a bug. Do NOT patch it in this checkpoint. If Checkpoint 2 work requires stubbing it earlier, that's a Checkpoint 2 decision.

## Reference links

- Master plan: `PHASE_7I_MASTER_PLAN.md` (outputs folder — read before starting)
- Wireframes: `frigo_phase_7i_wireframes.html` (outputs folder — visual reference for L1-L7)
- Superseded decisions: `PHASE_7F_DESIGN_DECISIONS.md` D41, D44, D45, D46 (read for historical context on why the model shift happened — note that the 4/13 session explicitly overrides parts of each per the master plan's Supersession Notes section)
