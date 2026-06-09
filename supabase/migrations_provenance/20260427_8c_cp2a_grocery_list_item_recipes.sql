-- Phase 8C-CP2a — grocery_list_item_recipes junction table
-- Enables many-to-many attribution of grocery items to recipes,
-- preserving per-recipe quantities for CP3's UI annotations.
-- Replaces the single-recipe_id-per-item model with a junction.
-- Legacy grocery_list_items.recipe_id is kept for backward compat.

BEGIN;

CREATE TABLE IF NOT EXISTS grocery_list_item_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grocery_list_item_id UUID NOT NULL REFERENCES grocery_list_items(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  recipe_quantity_amount NUMERIC,
  recipe_quantity_unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (grocery_list_item_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS idx_glir_item_id
  ON grocery_list_item_recipes (grocery_list_item_id);

CREATE INDEX IF NOT EXISTS idx_glir_recipe_id
  ON grocery_list_item_recipes (recipe_id);

COMMENT ON TABLE grocery_list_item_recipes IS
  'Junction table linking grocery list items to recipes (many-to-many). Each row attributes a portion of an item to a specific recipe, preserving the per-recipe quantity for UI annotations. Added 2026-04-27 (Phase 8C-CP2a).';

-- RLS: inherits security from grocery_list_items + recipes via FKs.
-- Since grocery_list_items has user-scoped RLS and recipes is broadly readable,
-- the junction is effectively user-scoped through the grocery_list_item FK.
-- Add a basic RLS policy allowing all authenticated reads, restricted writes
-- to rows where the user owns the parent grocery_list_item.

ALTER TABLE grocery_list_item_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read junction rows for their own list items"
  ON grocery_list_item_recipes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM grocery_list_items gli
      WHERE gli.id = grocery_list_item_recipes.grocery_list_item_id
        AND gli.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert junction rows for their own list items"
  ON grocery_list_item_recipes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM grocery_list_items gli
      WHERE gli.id = grocery_list_item_recipes.grocery_list_item_id
        AND gli.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update junction rows for their own list items"
  ON grocery_list_item_recipes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM grocery_list_items gli
      WHERE gli.id = grocery_list_item_recipes.grocery_list_item_id
        AND gli.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete junction rows for their own list items"
  ON grocery_list_item_recipes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM grocery_list_items gli
      WHERE gli.id = grocery_list_item_recipes.grocery_list_item_id
        AND gli.user_id = auth.uid()
    )
  );

-- Backfill: copy existing single-recipe attributions from grocery_list_items.recipe_id
-- into junction rows. Per-recipe quantity is approximated by the item's merged total
-- (no per-recipe quantity exists in legacy data; this is best-effort).
INSERT INTO grocery_list_item_recipes (grocery_list_item_id, recipe_id, recipe_quantity_amount, recipe_quantity_unit)
SELECT
  id AS grocery_list_item_id,
  recipe_id,
  quantity_display AS recipe_quantity_amount,
  unit_display AS recipe_quantity_unit
FROM grocery_list_items
WHERE recipe_id IS NOT NULL
ON CONFLICT (grocery_list_item_id, recipe_id) DO NOTHING;

COMMIT;

-- Rollback (if needed):
-- BEGIN;
-- DROP TABLE grocery_list_item_recipes;
-- COMMIT;
