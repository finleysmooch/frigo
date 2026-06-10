-- CP6b (Task 1) — recipe provenance columns (ADDITIVE).
--
-- Part of the copy-on-verify delivery engine: every delivered copy is stamped with how it was
-- produced (extraction_method / extraction_model) and whether the author authenticated the copy
-- (is_author_authenticated, always false for machine-extracted copies). These columns also let the
-- full delivered set be identified for the purge story (Fix #3), alongside parent_recipe_id.
--
-- ADDITIVE ONLY: three new nullable/defaulted columns on public.recipes. No existing row is written
-- (the boolean's DEFAULT is applied virtually by Postgres' fast-default; no table rewrite). The legacy
-- backfill of these columns on pre-existing canonical/workstream rows is OUT of scope here (§4.5 —
-- a separate, assembly-coordinated step).
--
-- GATED CP. Authored by CC; rollback-wrapped de-risk + db push --dry-run. CC does NOT push, does NOT
-- commit. Tom pushes after oversight post-review.
--
-- NOTE: this migration is the only part of CP6b authored this session — the delivery ENGINE (Tasks
-- 2–6) is STOPPED pending an oversight decision on the deep-copy mechanism (saveRecipeToDatabase is an
-- extraction-path saver that cannot faithfully copy-all; see docs/SESSION_LOG.md for the finding).

ALTER TABLE "public"."recipes"
  ADD COLUMN IF NOT EXISTS "extraction_method"       text,
  ADD COLUMN IF NOT EXISTS "extraction_model"        text,
  ADD COLUMN IF NOT EXISTS "is_author_authenticated" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "public"."recipes"."extraction_method" IS
  'Provenance: how this recipe was produced (e.g. book_photo, url, manual, copy_on_verify). Stamped on delivered copies (CP6b); legacy backfill of pre-existing rows is a separate step.';
COMMENT ON COLUMN "public"."recipes"."extraction_model" IS
  'Provenance: the model/version that extracted this recipe (from raw_extraction_data or models.ts constants). NULL for non-AI sources.';
COMMENT ON COLUMN "public"."recipes"."is_author_authenticated" IS
  'Whether the recipe author authenticated/licensed this copy. Always false for machine-extracted copy-on-verify deliveries (CP6b); reserved for a future authenticated-author path.';
