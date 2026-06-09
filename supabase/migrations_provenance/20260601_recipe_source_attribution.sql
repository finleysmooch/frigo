-- ============================================
-- NYT Import: richer source attribution + provenance dates
-- ============================================
-- Captures the distinct attribution roles NYT (and similar sources) expose,
-- plus dates that let us monitor for upstream changes over time.
--
--   source_authors       — all original authors the recipe is "from"
--                          (NYT splits co-authors with " and ", e.g.
--                          ["Yotam Ottolenghi", "Sami Tamimi"])
--   source_byline        — the page byline / adapter (e.g. "Sam Sifton")
--   source_credit        — credit line (e.g. "Adapted from Yotam Ottolenghi")
--   source_published_at  — when the source first published it
--   source_updated_at    — source's last major modification (the "Updated …" date)
--   source_extracted_at  — when WE scraped it
--
-- Note: source_author / chef_id remain SINGLE (the primary = source_authors[0],
-- e.g. "Yotam Ottolenghi"), so the existing single-chef machinery is untouched.
-- source_authors holds the full list for display; per-author chef pages/stats
-- (a join table) are a deliberate later upgrade.
--
-- Staleness monitoring (future): re-scrape and compare the live
-- last-modification against the stored source_updated_at; flag when newer.
-- source_extracted_at records when we last pulled. All purely additive.
-- ============================================

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS source_authors      text[],
  ADD COLUMN IF NOT EXISTS source_byline       text,
  ADD COLUMN IF NOT EXISTS source_credit       text,
  ADD COLUMN IF NOT EXISTS source_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_updated_at   timestamptz,
  ADD COLUMN IF NOT EXISTS source_extracted_at timestamptz;

COMMENT ON COLUMN public.recipes.source_byline IS
  'NYT Import: page byline / adapter (e.g. "Sam Sifton"). Distinct from source_author, which is the original author the recipe is "from".';
COMMENT ON COLUMN public.recipes.source_credit IS
  'NYT Import: credit line as shown on the source, e.g. "Adapted from Yotam Ottolenghi".';
COMMENT ON COLUMN public.recipes.source_updated_at IS
  'NYT Import: source last-major-modification date. Compare against a fresh scrape to detect upstream recipe changes.';
COMMENT ON COLUMN public.recipes.source_extracted_at IS
  'NYT Import: when Frigo last scraped this recipe from the source.';
