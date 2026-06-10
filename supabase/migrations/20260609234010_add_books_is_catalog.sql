-- CP4-seed (part 1 of 2) — add the is_catalog marker column.
--
-- Additive only: NOT NULL DEFAULT false leaves all existing book rows false structurally. This
-- migration writes NO existing row (the column DEFAULT handles the current 16 books). Existing
-- transcribed/assembly-workstream books are NOT promoted here — that's CP4b, gated on the
-- assembly owner.
--
-- `is_catalog` is ORTHOGONAL to ownership (user_books) and to transcription (toc_extracted_at):
--   - is_catalog = true  → a curated global catalog title for onboarding T8 search.
--   - is_catalog = false → everything else (owned books, workstream books) — unchanged.
-- searchBookCatalog filters is_catalog = true, so existing owned/workstream rows never surface there.
--
-- The net-new catalog SEED (the CSV rows) is a SEPARATE migration, authored once
-- docs/seed/cookbook_titles.csv is provided. Catalog UPDATES are likewise always a NEW migration
-- (a tracked migration runs once per environment).

ALTER TABLE "public"."books" ADD COLUMN "is_catalog" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "public"."books"."is_catalog" IS
  'true = curated global catalog title for onboarding T8 (searchBookCatalog filters on this). Orthogonal to user_books ownership and toc_extracted_at. Seeded net-new; existing rows default false; catalog updates = new migration.';
