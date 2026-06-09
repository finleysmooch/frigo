-- ============================================
-- 8D-CP3 — cheese + protein subtype split
-- ============================================
-- Splits four overloaded `ingredient_subtype` values into substitution-
-- meaningful sub-subtypes. Paired with whitelist additions in
-- lib/services/pantryMatchingService.ts.
--
-- 61 rows reassigned across:
--   • cheese          → 6 subtypes (fresh_cheese 12, hard_cheese 4,
--                       semi_hard_cheese 14, soft_ripened_cheese 3,
--                       blue_cheese 3, processed_cheese 1)
--   • beef            → 3 subtypes (beef_steak 5, beef_braising 4,
--                       beef_ground 1) — base 'beef' row stays as 'beef'
--   • chicken         → carve out chicken_dark (3); other chicken rows stay
--   • cured_meat      → 3 subtypes (cured_pork_sliced 3, sausage 4,
--                       ham_and_salami 4)
--
-- IMPORTANT — column-type pre-flight:
--   If `ingredient_subtype` is an ENUM, run the ALTER TYPE statements
--   below FIRST (uncomment them) so the UPDATEs don't fail on
--   invalid-value errors. If it's TEXT, you can run the UPDATEs directly.
--   Verify with:
--     SELECT pg_typeof(ingredient_subtype) FROM ingredients LIMIT 1;
--   If the result is `text`, skip the ALTER TYPE block.
--   If the result is some enum name (e.g., `ingredient_subtype_enum`),
--   uncomment the ALTER TYPE statements and run them first.
-- ============================================

-- ============================================
-- ALTER TYPE (uncomment IF ingredient_subtype is an ENUM — see note above)
-- ============================================
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'fresh_cheese';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'hard_cheese';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'semi_hard_cheese';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'soft_ripened_cheese';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'blue_cheese';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'processed_cheese';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'beef_steak';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'beef_braising';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'beef_ground';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'chicken_dark';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'cured_pork_sliced';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'sausage';
-- ALTER TYPE ingredient_subtype_enum ADD VALUE 'ham_and_salami';

-- ============================================
-- CHEESE → 6 subtypes
-- ============================================

-- fresh_cheese (12 rows): feta, mozzarella, goat cheese, ricotta, cream cheese,
-- cottage cheese, halloumi, mascarpone, manouri, paneer, fresh mozzarella,
-- young sheep's milk cheese
UPDATE ingredients SET ingredient_subtype = 'fresh_cheese' WHERE id IN (
  '8d2b34fa-d6fa-41cc-8282-55468e3b8718',  -- feta
  '4a9182de-36f8-426b-b676-11d5fcfcc7d0',  -- mozzarella
  'f36acb3c-833a-4c92-a2c6-998b9345eb6e',  -- goat cheese
  '48840de1-a43f-4efc-aaf5-48e746b770d7',  -- ricotta
  '00c6cb38-45a5-4ca6-a478-41657319aa2d',  -- cream cheese
  '7e22c624-83b8-4c24-9970-160e4025dd63',  -- cottage cheese
  '0a29b46c-d7ef-4bec-8763-78f68afb96d4',  -- halloumi
  '1335c9c6-e212-4f6e-817a-7843ba1ef3ae',  -- mascarpone
  'e6e60fd8-d01a-42ff-911a-fb90289b213f',  -- manouri cheese
  'adde7c05-f5fd-4fce-accc-1bb21fc4e891',  -- paneer
  '592a9e8e-6939-4ad6-a938-48b73b9d9189',  -- fresh mozzarella
  'ec421ad3-6a16-4af9-b21e-6ce6e88bf1a4'   -- young sheep's milk cheese
);

-- hard_cheese (4 rows): parmesan, pecorino, parmigiano, parmigiano reggiano
UPDATE ingredients SET ingredient_subtype = 'hard_cheese' WHERE id IN (
  '611a8ebe-828d-46c2-b8fb-97f935363e28',  -- parmesan
  'eb2d032d-8cd8-4eb5-83f8-9a567a0358a6',  -- pecorino
  '35784da5-e39f-4cf1-84c9-ccaff2d3327d',  -- parmigiano
  '5c023e13-ebff-426e-8e1b-4d64b18a2cb4'   -- parmigiano reggiano
);

-- semi_hard_cheese (14 rows): cheddar, gruyere, manchego, kashkaval, cotija,
-- scamorza, gouda, monterey jack, pepper jack, provolone, swiss, cheddar
-- cheese, sharp cheddar, gouda cheese
UPDATE ingredients SET ingredient_subtype = 'semi_hard_cheese' WHERE id IN (
  'ea9be16a-1697-497c-bb31-25668f9eebea',  -- cheddar
  '92c47629-e854-4ebb-8ec5-f9bbc278190a',  -- gruyere
  '024a6aae-cb05-4174-94f2-58d11fe1a2d3',  -- manchego
  'a0ff710c-430a-46cf-88f9-4e5f29e0ec23',  -- kashkaval cheese
  'cec57f4b-2ffb-4f5a-abd4-9b5a3ce85495',  -- cotija cheese
  '507c4d40-c087-4741-a580-d6612622ebf5',  -- scamorza
  'd17ec4f7-ee00-463d-b73b-f667a610f5d4',  -- gouda
  'e9721f67-bbeb-423e-a448-510b38bcd314',  -- monterey jack cheese
  '5b92a2f5-f71e-4216-b27e-8aece9d11829',  -- pepper jack
  '317a42e3-df70-4754-8650-6d1250894877',  -- provolone
  'ee789715-243b-49f0-ae5f-f72127572580',  -- swiss
  'b9a50889-655a-4edd-bbf3-36696a499b9a',  -- cheddar cheese (variant)
  '8f9e1f76-f6ab-4e2a-9bf6-e96a5716b1d3',  -- sharp cheddar (variant)
  'e5ec8ab3-f924-466b-90bc-7c4ef0097c94'   -- gouda cheese (variant)
);

-- soft_ripened_cheese (3 rows): brie, camembert, taleggio
UPDATE ingredients SET ingredient_subtype = 'soft_ripened_cheese' WHERE id IN (
  'b0bc1b46-b884-4070-8512-e51b1562283d',  -- brie
  '70c42614-fceb-40d0-ad3f-feaed945486c',  -- camembert
  '5703f439-7d4b-4cea-86b4-8a85a975d256'   -- taleggio
);

-- blue_cheese (3 rows): gorgonzola, roquefort, blue cheese (generic)
UPDATE ingredients SET ingredient_subtype = 'blue_cheese' WHERE id IN (
  '72f55c37-0fb2-454c-9d26-c7190c929717',  -- gorgonzola
  '9f0bad36-6afb-4415-a4f8-c321dc2ecd48',  -- roquefort
  'fe477b89-cd3b-4186-a9e7-a30739c4b418'   -- blue cheese
);

-- processed_cheese (1 row): american cheese
UPDATE ingredients SET ingredient_subtype = 'processed_cheese' WHERE id IN (
  'e576a345-6762-4920-8837-b2e53bd6aac3'   -- american cheese
);

-- Note: the generic "cheese" row (8fbe2d77-3f3e-4b01-abec-f82d176fa45d) is
-- left in subtype='cheese' deliberately. Catalog hygiene issue — surfaced as
-- DEFERRED_WORK P8D-CP3-1.

-- ============================================
-- BEEF → 3 subtypes (base 'beef' row stays as subtype='beef')
-- ============================================

-- beef_steak (5 rows): beef steak, skirt steak, flank steak, ribeye, sirloin
UPDATE ingredients SET ingredient_subtype = 'beef_steak' WHERE id IN (
  'ba76d986-92a0-4021-88aa-076086099dc3',  -- beef steak
  '1fd193bf-8cc7-4d5e-a51a-b402fee7f436',  -- skirt steak
  'c7176d4f-9824-4cb8-9107-8e2b4aef32ea',  -- flank steak
  '91fb881e-6e9b-4c52-a1a6-dc58eab43d7d',  -- ribeye
  '8e71058d-4ff0-41cb-b971-0fcbd835016f'   -- sirloin
);

-- beef_braising (4 rows): short ribs, brisket, beef ribs, beef roast
UPDATE ingredients SET ingredient_subtype = 'beef_braising' WHERE id IN (
  '57d8d1d4-bd59-4cbe-9eef-105311f8ce0d',  -- short ribs
  '6d56eb8b-faf5-486d-81a7-d6f45ab959de',  -- brisket
  '8bc1c511-ff15-481a-821e-63eba6b4bea5',  -- beef ribs
  'cd0cad03-dfe5-4e80-ae71-870e0fe29859'   -- beef roast
);

-- beef_ground (1 row): ground beef
UPDATE ingredients SET ingredient_subtype = 'beef_ground' WHERE id IN (
  '5df092c9-0afc-4a45-8a70-f0752105302e'   -- ground beef
);

-- Base 'beef' row (a2e1e030-d8cf-45d6-a3bd-68709c6cdab0) stays as subtype='beef'.

-- ============================================
-- CHICKEN → carve out chicken_dark
-- ============================================

-- chicken_dark (3 rows): chicken thigh, chicken leg, chicken drumstick
UPDATE ingredients SET ingredient_subtype = 'chicken_dark' WHERE id IN (
  'be6b480f-6261-4a46-8ced-cd8cbf4389c9',  -- chicken thigh
  '43bc1bb3-a505-4417-a91f-7318156a3664',  -- chicken leg
  '182dd53e-c923-4497-80ed-00029810aebc'   -- chicken drumstick
);

-- The other 5 chicken rows (chicken base, chicken breast, whole chicken,
-- chicken wing, ground chicken) stay as subtype='chicken'. NOT whitelisted —
-- breast/wing/whole/ground are too distinct to surface as substitutes.

-- ============================================
-- CURED_MEAT → 3 subtypes
-- ============================================

-- cured_pork_sliced (3 rows): bacon, pancetta, prosciutto
UPDATE ingredients SET ingredient_subtype = 'cured_pork_sliced' WHERE id IN (
  'bf234822-5e3f-4216-8749-30e6ca8c5e80',  -- bacon
  '61bce288-3b9c-4f3e-8354-19f84f14b2ee',  -- pancetta
  '7f10c965-2dc6-4c94-b5d8-6f22128a0e16'   -- prosciutto
);

-- sausage (4 rows): sausage, chorizo, kielbasa, italian sausage
UPDATE ingredients SET ingredient_subtype = 'sausage' WHERE id IN (
  '9c6beaf3-5ecf-4a83-8c16-07629434b7a6',  -- sausage
  '1f46977a-7878-4a0e-bb96-d10b34b546c1',  -- chorizo
  '95393ad1-e10b-4fc9-89fb-10ea6256884b',  -- kielbasa
  'f8c75431-aed0-4e3b-aa02-6677c2345a50'   -- italian sausage
);

-- ham_and_salami (4 rows): ham hock, salami, ham, hard salami
UPDATE ingredients SET ingredient_subtype = 'ham_and_salami' WHERE id IN (
  '8a8c7339-a8b5-474f-a243-a54afdbacb0a',  -- ham hock
  '04976ca0-7752-4758-afb4-69949d1aa6ce',  -- salami
  '8a3eb586-9bfd-454e-a15c-6a3417af685f',  -- ham
  '72b50723-16a6-4f78-b0e2-a7ff9bdc0909'   -- hard salami
);

-- ============================================
-- VERIFICATION QUERY (run after migration)
-- ============================================
-- SELECT ingredient_subtype, COUNT(*) AS row_count
-- FROM ingredients
-- WHERE ingredient_subtype IN (
--   'fresh_cheese', 'hard_cheese', 'semi_hard_cheese', 'soft_ripened_cheese',
--   'blue_cheese', 'processed_cheese', 'beef_steak', 'beef_braising',
--   'beef_ground', 'chicken_dark', 'cured_pork_sliced', 'sausage',
--   'ham_and_salami'
-- )
-- GROUP BY ingredient_subtype
-- ORDER BY ingredient_subtype;
--
-- Expected counts:
--   blue_cheese          | 3
--   beef_braising        | 4
--   beef_ground          | 1
--   beef_steak           | 5
--   chicken_dark         | 3
--   cured_pork_sliced    | 3
--   fresh_cheese         | 12
--   ham_and_salami       | 4
--   hard_cheese          | 4
--   processed_cheese     | 1
--   sausage              | 4
--   semi_hard_cheese     | 14
--   soft_ripened_cheese  | 3
-- Total: 61 rows.
