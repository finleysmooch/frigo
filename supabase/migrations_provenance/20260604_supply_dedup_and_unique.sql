-- ============================================
-- 2026-06-04 — Supply de-duplication + active-uniqueness guard
-- ============================================
-- Problem: nothing at the DB level prevented two active supplies for the same
-- ingredient (or same custom name) in a space. The app-level dedup in
-- suppliesService.createSupply used `.maybeSingle()`, which ERRORS when 2+
-- matches already exist and then falls through to INSERT a third — so once a
-- duplicate exists it self-perpetuates (Tom's two "salt" rows).
--
-- This migration:
--   (1) Merges existing active duplicates: keeps the earliest-created row per
--       (space_id, ingredient_id) and per (space_id, lower(custom_name)) group,
--       repoints child rows (needs / supply_lots / supply_tags) to the survivor,
--       and ARCHIVES the losers (archived_at = now()) rather than deleting them
--       — non-destructive + reversible, and avoids any FK-delete surprises.
--   (2) Adds partial UNIQUE indexes scoped to active (archived_at IS NULL) rows
--       so the DB enforces one active supply per ingredient / per custom name.
--
-- Implementation note: each step recomputes the same loser→survivor mapping via
-- an inline CTE rather than a shared TEMP TABLE. The Supabase SQL editor commits
-- between statements (which would drop an `ON COMMIT DROP` temp table — the
-- cause of the earlier "relation supply_dupe_map does not exist" error), so the
-- self-contained form is required. The archive step runs LAST, so the earlier
-- repoint steps still see the losers as active (archived_at IS NULL) and compute
-- an identical mapping. The whole script is idempotent — safe to re-run.
--
-- NOTE: ingredient-linked "salt" and a separate custom-name "salt" are treated
-- as DISTINCT groups here (the constraint is per-type). Cross-type merges are
-- out of scope — flagged in SESSION_LOG.
-- ============================================

-- (1) Repoint needs from losers to survivors.
WITH ranked AS (
  SELECT
    id, space_id,
    COALESCE(ingredient_id::text, 'custom:' || lower(trim(custom_name))) AS grp,
    ROW_NUMBER() OVER (
      PARTITION BY space_id,
        COALESCE(ingredient_id::text, 'custom:' || lower(trim(custom_name)))
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM supplies
  WHERE archived_at IS NULL
    AND (ingredient_id IS NOT NULL OR (custom_name IS NOT NULL AND trim(custom_name) <> ''))
),
losers AS (
  SELECT l.id AS loser_id, s.id AS survivor_id
  FROM ranked l
  JOIN ranked s ON s.space_id = l.space_id AND s.grp = l.grp AND s.rn = 1
  WHERE l.rn > 1
)
UPDATE needs n
  SET supply_id = losers.survivor_id
  FROM losers
  WHERE n.supply_id = losers.loser_id;

-- (2) Repoint supply_lots.
WITH ranked AS (
  SELECT
    id, space_id,
    COALESCE(ingredient_id::text, 'custom:' || lower(trim(custom_name))) AS grp,
    ROW_NUMBER() OVER (
      PARTITION BY space_id,
        COALESCE(ingredient_id::text, 'custom:' || lower(trim(custom_name)))
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM supplies
  WHERE archived_at IS NULL
    AND (ingredient_id IS NOT NULL OR (custom_name IS NOT NULL AND trim(custom_name) <> ''))
),
losers AS (
  SELECT l.id AS loser_id, s.id AS survivor_id
  FROM ranked l
  JOIN ranked s ON s.space_id = l.space_id AND s.grp = l.grp AND s.rn = 1
  WHERE l.rn > 1
)
UPDATE supply_lots sl
  SET supply_id = losers.survivor_id
  FROM losers
  WHERE sl.supply_id = losers.loser_id;

-- (3) supply_tags has UNIQUE (supply_id, tag_id): drop loser rows that would
--     collide with an existing survivor tag before repointing the rest.
WITH ranked AS (
  SELECT
    id, space_id,
    COALESCE(ingredient_id::text, 'custom:' || lower(trim(custom_name))) AS grp,
    ROW_NUMBER() OVER (
      PARTITION BY space_id,
        COALESCE(ingredient_id::text, 'custom:' || lower(trim(custom_name)))
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM supplies
  WHERE archived_at IS NULL
    AND (ingredient_id IS NOT NULL OR (custom_name IS NOT NULL AND trim(custom_name) <> ''))
),
losers AS (
  SELECT l.id AS loser_id, s.id AS survivor_id
  FROM ranked l
  JOIN ranked s ON s.space_id = l.space_id AND s.grp = l.grp AND s.rn = 1
  WHERE l.rn > 1
)
DELETE FROM supply_tags st
  USING losers
  WHERE st.supply_id = losers.loser_id
    AND EXISTS (
      SELECT 1 FROM supply_tags st2
      WHERE st2.supply_id = losers.survivor_id
        AND st2.tag_id = st.tag_id
    );

-- (4) Repoint the remaining supply_tags.
WITH ranked AS (
  SELECT
    id, space_id,
    COALESCE(ingredient_id::text, 'custom:' || lower(trim(custom_name))) AS grp,
    ROW_NUMBER() OVER (
      PARTITION BY space_id,
        COALESCE(ingredient_id::text, 'custom:' || lower(trim(custom_name)))
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM supplies
  WHERE archived_at IS NULL
    AND (ingredient_id IS NOT NULL OR (custom_name IS NOT NULL AND trim(custom_name) <> ''))
),
losers AS (
  SELECT l.id AS loser_id, s.id AS survivor_id
  FROM ranked l
  JOIN ranked s ON s.space_id = l.space_id AND s.grp = l.grp AND s.rn = 1
  WHERE l.rn > 1
)
UPDATE supply_tags st
  SET supply_id = losers.survivor_id
  FROM losers
  WHERE st.supply_id = losers.loser_id;

-- (5) Archive the losers (non-destructive; recoverable by clearing archived_at).
--     MUST run last so steps 1-4 still saw them as active.
WITH ranked AS (
  SELECT
    id, space_id,
    COALESCE(ingredient_id::text, 'custom:' || lower(trim(custom_name))) AS grp,
    ROW_NUMBER() OVER (
      PARTITION BY space_id,
        COALESCE(ingredient_id::text, 'custom:' || lower(trim(custom_name)))
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM supplies
  WHERE archived_at IS NULL
    AND (ingredient_id IS NOT NULL OR (custom_name IS NOT NULL AND trim(custom_name) <> ''))
),
losers AS (
  SELECT l.id AS loser_id, s.id AS survivor_id
  FROM ranked l
  JOIN ranked s ON s.space_id = l.space_id AND s.grp = l.grp AND s.rn = 1
  WHERE l.rn > 1
)
UPDATE supplies
  SET archived_at = now(), updated_at = now()
  FROM losers
  WHERE supplies.id = losers.loser_id;

-- ============================================
-- Active-uniqueness guards (partial unique indexes)
-- ============================================
-- One active supply per (space, ingredient).
CREATE UNIQUE INDEX IF NOT EXISTS supplies_uniq_active_ingredient
  ON supplies (space_id, ingredient_id)
  WHERE archived_at IS NULL AND ingredient_id IS NOT NULL;

-- One active custom-name supply per (space, normalized name).
CREATE UNIQUE INDEX IF NOT EXISTS supplies_uniq_active_customname
  ON supplies (space_id, lower(trim(custom_name)))
  WHERE archived_at IS NULL
    AND ingredient_id IS NULL
    AND custom_name IS NOT NULL
    AND trim(custom_name) <> '';
