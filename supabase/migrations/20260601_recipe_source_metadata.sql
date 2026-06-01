-- ============================================
-- NYT Import — Increment 1: Recipe source-metadata foundation
-- ============================================
-- Makes source provenance a first-class, queryable property of a recipe row.
-- Today the source URL only lives inside the raw_extraction_data jsonb blob;
-- this promotes three derived fields to top-level columns so later increments
-- can dedup-on-import by canonical ID (#2) and gate non-owner views (#3).
--
-- Purely additive. None of source_url / external_source_id / source_domain
-- existed on the recipes table before this migration (was 56 columns).
--
--   source_url         — cleaned source URL (query/tracking params stripped)
--   source_domain      — hostname with leading "www." removed
--   external_source_id — site-specific canonical ID. Currently populated only
--                        for cooking.nytimes.com (the numeric recipe ID from
--                        the URL path). Null for every other domain for now.
--
-- Photo- and book-extracted recipes have no source URL; all three columns
-- staying NULL for them is correct, not a failure.
--
-- IMPORTANT: NO UNIQUE constraint on these columns. Increment 2 is
-- copy-on-import, so multiple user rows will intentionally share the same
-- (source_domain, external_source_id). The index below is a plain partial
-- btree to make the future dedup lookup fast — it does NOT enforce uniqueness.
-- ============================================

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS source_url         text,
  ADD COLUMN IF NOT EXISTS external_source_id text,
  ADD COLUMN IF NOT EXISTS source_domain      text;

CREATE INDEX IF NOT EXISTS idx_recipes_source_dedup
  ON public.recipes (source_domain, external_source_id)
  WHERE external_source_id IS NOT NULL;

COMMENT ON COLUMN public.recipes.source_url IS
  'NYT Import #1: cleaned source URL (query string / tracking params stripped). NULL for photo/book recipes. Derived at save time from raw_extraction_data.source_url.';
COMMENT ON COLUMN public.recipes.source_domain IS
  'NYT Import #1: source hostname with leading "www." removed (e.g. cooking.nytimes.com). NULL for photo/book recipes.';
COMMENT ON COLUMN public.recipes.external_source_id IS
  'NYT Import #1: site-specific canonical recipe ID. Currently the numeric NYT Cooking ID parsed from /recipes/(\d+); NULL for all other domains. NOT unique — copy-on-import (#2) intentionally duplicates this across user rows.';
