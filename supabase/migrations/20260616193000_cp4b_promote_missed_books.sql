-- CP4b correction (2026-06-16) — promote 3 transcribed books MISSED by the
-- first promotion (20260616190000). That pass scoped via a single
-- recipes.select('book_id') capped at PostgREST's 1000-row default, which
-- silently dropped books whose recipe rows fell outside the first 1000 — the
-- highest-recipe books, ironically. A paginated re-count found 16 recipe-bearing
-- books (not 13); these 3 (recipes 130–197, named authors, no title collision
-- with the seed) were the omissions. Same idempotent, non-destructive flag flip.

UPDATE public.books
   SET is_catalog = true
 WHERE is_catalog = false
   AND id IN (
     'ce8abb27-5524-4b6d-924c-886eb185a6fe',  -- Six Seasons: A New Way with Vegetables — Joshua McFadden (197)
     'b0886981-eec6-45a4-8b01-3033e4dfacfe',  -- Simple — Yotam Ottolenghi (130)
     'aa631119-2121-4188-a34a-60d26832f272'   -- The Ambitious Kitchen Cookbook — Monique Volz (130)
   );
