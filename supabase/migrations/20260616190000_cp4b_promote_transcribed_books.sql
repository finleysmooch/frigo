-- CP4b — promote transcribed cookbooks into the catalog (Tom-directed,
-- 2026-06-16). Flips is_catalog=true on the 10 fully-transcribed books so they
-- appear in onboarding T8a search with "recipes ready" badges (has_recipes=true
-- per anchor §4.1). Sensitive (books table) → Tom pushes after dry-run.
--
-- Scope confirmed by inspection (recipe counts 41–120, named authors, no title
-- collision with the 298 seeded catalog titles). EXCLUDED per anchor §4.2's
-- "3 junk rows": "Cooked Veg" (3), "Cook's Veg" (1), "More is more" (1) —
-- fragments with no author/TOC.
--
-- Idempotent: the WHERE guard re-runs as a no-op once promoted. Non-destructive
-- (only the is_catalog flag changes; recipes/user_books untouched).

UPDATE public.books
   SET is_catalog = true
 WHERE is_catalog = false
   AND id IN (
     'a4049bd2-9fb1-4595-bc82-f6abad3fc254',  -- By Heart — Hailee Catalano
     'a7a56abb-b82a-44fa-9c56-3469b53f9f05',  -- Cook This Book — Molly Baz
     '69afe612-7b50-4a97-bfba-557a6a1960d1',  -- Dinner Tonight — Alex Snodgrass
     '58d7d000-e254-40bf-be56-fc525a9d0a01',  -- Eating Out Loud — Eden Grinshpan
     '30adcbf1-7f6e-404f-ad9e-002058730e7d',  -- Plenty — Yotam Ottolenghi
     '7b79bc5c-2d58-407d-bcd8-c4a69c094283',  -- Rachael's Good Eats — Rachael DeVaux
     '6fad5a82-4a4d-4515-8061-a06494099f4a',  -- Something from Nothing — Alison Roman
     '49d2d226-678c-442f-8de3-582c05dea1cd',  -- Tahini Baby — Eden Grinshpan
     '8e4c9c16-c841-40b8-bf84-144620446d6b',  -- That Sounds So Good — Carla Lalli Music
     '69ddc44c-8fb1-4ebf-a7d4-9fa2ccb1e739'   -- The Comfortable Kitchen — Alex Snodgrass
   );
