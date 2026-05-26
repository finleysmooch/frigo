-- ============================================================================
-- Phase 8R-CP1 Schema Migration
-- Unified Household Needs — Supplies + Needs + Tags + Views
-- ============================================================================
--
-- Run this entire file in Supabase Dashboard SQL Editor.
-- Supabase wraps multi-statement pastes in a transaction by default — if any
-- statement fails, all roll back. No partial state.
--
-- DESTRUCTIVE: This migration nukes all existing pantry + grocery data.
-- Tom and Mary should have backed up anything they want to preserve.
--
-- Decision references: D8R-Q1 through Q39 in PHASE_8R_UNIFIED_NEEDS.md v0.5
--
-- Structure:
--   PART 1: DROP old model (views, triggers, tables)
--   PART 2: CREATE new model (tables, constraints, indexes)
--   PART 3: RLS policies
--   PART 4: Triggers (updated_at)
--   PART 5: Seed function (default views per space)
--   PART 6: Verification queries (run separately after migration)
--
-- ============================================================================


-- ============================================================================
-- PART 1: DROP OLD MODEL
-- ============================================================================
-- Order matters: views first, then child tables, then parent tables.
-- CASCADE on DROP TABLE handles RLS policies, indexes, triggers automatically.
-- ============================================================================

-- 1a. Drop views that reference old tables
DROP VIEW IF EXISTS grocery_list_with_ingredients CASCADE;
DROP VIEW IF EXISTS grocery_lists_with_counts CASCADE;
DROP VIEW IF EXISTS regular_items_due_soon CASCADE;

-- 1b. Drop trigger + function for grocery_lists updated_at
DROP TRIGGER IF EXISTS update_grocery_lists_updated_at ON grocery_lists;
DROP FUNCTION IF EXISTS update_grocery_lists_updated_at();

-- 1c. Drop junction tables (may not exist — 8C-Shared planned but 8R supersedes)
DROP TABLE IF EXISTS grocery_list_item_recipes CASCADE;
DROP TABLE IF EXISTS grocery_list_members CASCADE;

-- 1d. Drop child tables first (FK dependencies)
DROP TABLE IF EXISTS grocery_list_items CASCADE;
DROP TABLE IF EXISTS regular_grocery_items CASCADE;

-- 1e. Drop parent tables
DROP TABLE IF EXISTS grocery_lists CASCADE;
DROP TABLE IF EXISTS pantry_staples CASCADE;
DROP TABLE IF EXISTS pantry_items CASCADE;

-- Note: `stores`, `user_pantry_preferences`, `space_settings` are intentionally
-- kept. `stores` has FK dependency from `user_ingredient_preferences`; migrated
-- to tags post-8R (8D/8E). `user_pantry_preferences` has staleness thresholds
-- potentially useful post-8R. `space_settings` untouched.


-- ============================================================================
-- PART 2: CREATE NEW MODEL
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 2a. tags — space-scoped tag taxonomy
-- ----------------------------------------------------------------------------
-- Per Q1: hybrid taxonomy with predefined dimensions + user-created values.
-- Per Q29: aisle is NOT a dimension (render-mode only, computed from
-- ingredients.typical_store_section).

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL CHECK (dimension IN ('store', 'urgency', 'recipe', 'event', 'storage')),
  value TEXT NOT NULL,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One tag value per dimension per space
  CONSTRAINT unique_tag_per_space UNIQUE (space_id, dimension, value)
);

CREATE INDEX idx_tags_space ON tags(space_id);
CREATE INDEX idx_tags_space_dimension ON tags(space_id, dimension);

COMMENT ON TABLE tags IS 'Space-scoped tag taxonomy. Dimensions are predefined (Q1); values are user-created within each dimension. Aisle is NOT a dimension (Q29).';


-- ----------------------------------------------------------------------------
-- 2b. supplies — household items kept in ongoing stock
-- ----------------------------------------------------------------------------
-- Per Q5: bulk / ongoing items. Cycle in_stock → low → critical → out.
-- Per Q14: identity = ingredient_id XOR custom_name.
-- Per Q15: status enum only for F&F (no quantitative tracking).
-- Per Q27/Q37: for_user_ids UUID[]. Empty = household-shared.
-- Per Q35: initial state restricted to in_stock/low/out at service layer
--   (Critical only reachable via state-cycling; DB allows all 4 for cycling).

CREATE TABLE supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  custom_name TEXT,
  status TEXT NOT NULL DEFAULT 'in_stock'
    CHECK (status IN ('in_stock', 'low', 'critical', 'out')),
  for_user_ids UUID[] NOT NULL DEFAULT '{}',
  brands TEXT[] NOT NULL DEFAULT '{}',
  added_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Q14: exactly one identity mechanism
  CONSTRAINT supply_has_identity CHECK (
    (ingredient_id IS NOT NULL AND custom_name IS NULL)
    OR
    (ingredient_id IS NULL AND custom_name IS NOT NULL)
  )
);

-- No UNIQUE constraint on (space_id, ingredient_id) because for_user_ids
-- creates valid duplicate-identity rows (Tom's olive oil vs household olive oil).
-- Service layer handles dedup logic. See deferred consideration below.
CREATE INDEX idx_supplies_space ON supplies(space_id);
CREATE INDEX idx_supplies_ingredient ON supplies(ingredient_id) WHERE ingredient_id IS NOT NULL;
CREATE INDEX idx_supplies_status ON supplies(space_id, status);
CREATE INDEX idx_supplies_attention ON supplies(space_id, status)
  WHERE status IN ('out', 'low', 'critical');

COMMENT ON TABLE supplies IS 'Household items kept in ongoing stock (Q5). Status-based tracking (Q15). for_user_ids: empty array = household-shared, all current+future members (Q37).';
COMMENT ON COLUMN supplies.custom_name IS 'For non-ingredient items (toilet paper, paper towels). When set, ingredient_id must be NULL.';
COMMENT ON COLUMN supplies.status IS 'DB allows all 4 states for cycling. Service layer restricts INITIAL state to in_stock/low/out per Q35 (critical only via state-cycling).';
COMMENT ON COLUMN supplies.brands IS 'Free-form brand list. E.g. {"Kerrygold", "Kirkland"}. Surfaces in supply detail (Q22).';
COMMENT ON COLUMN supplies.for_user_ids IS 'Empty array = household-shared (forward-compatible per Q37). Explicit subset = frozen owner list. UI writes empty for "Everyone" selection; never auto-populates with current member UUIDs.';


-- ----------------------------------------------------------------------------
-- 2c. needs — transient household needs
-- ----------------------------------------------------------------------------
-- Per Q5: immediate / one-off needs. Cycle need → in_cart → acquired.
-- Per Q10: auto-spawned when supply transitions to `out` (β — spawn on out only).
-- Per Q6: recipe attribution via needs_recipes junction.
-- Per Q28/Q36: merge predicate for display-merging is applied at query time
--   in the service layer (application-level merge for F&F scale).

CREATE TABLE needs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  custom_name TEXT,
  status TEXT NOT NULL DEFAULT 'need'
    CHECK (status IN ('need', 'in_cart', 'acquired')),
  quantity_display NUMERIC,
  unit_display TEXT,
  for_user_ids UUID[] NOT NULL DEFAULT '{}',
  supply_id UUID REFERENCES supplies(id) ON DELETE SET NULL,
  added_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  added_from TEXT CHECK (added_from IN ('recipe', 'supply_spawn', 'manual')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Q14: exactly one identity mechanism
  CONSTRAINT need_has_identity CHECK (
    (ingredient_id IS NOT NULL AND custom_name IS NULL)
    OR
    (ingredient_id IS NULL AND custom_name IS NOT NULL)
  )
);

CREATE INDEX idx_needs_space ON needs(space_id);
CREATE INDEX idx_needs_space_status ON needs(space_id, status);
CREATE INDEX idx_needs_active ON needs(space_id, status) WHERE status IN ('need', 'in_cart');
CREATE INDEX idx_needs_ingredient ON needs(ingredient_id) WHERE ingredient_id IS NOT NULL;
CREATE INDEX idx_needs_supply ON needs(supply_id) WHERE supply_id IS NOT NULL;

COMMENT ON TABLE needs IS 'Transient household needs (Q5). Lifecycle: need → in_cart → acquired. Supply→need spawn on out transition (Q10β).';
COMMENT ON COLUMN needs.supply_id IS 'Back-pointer to spawning supply. NULL for manually-created or recipe-added needs. Enables edit-routing modal toggle (Q23/Q34).';
COMMENT ON COLUMN needs.added_from IS 'recipe = from recipe-add flow; supply_spawn = auto-created on supply→out; manual = user-added directly.';
COMMENT ON COLUMN needs.quantity_display IS 'Nullable. Recipe-sourced needs have quantity; supply-spawned needs may not (supplies track status, not quantity per Q15).';
COMMENT ON COLUMN needs.for_user_ids IS 'Inherited from parent supply on spawn (Q27). Same semantics as supplies.for_user_ids (Q37).';


-- ----------------------------------------------------------------------------
-- 2d. supply_tags — supply ↔ tag junction
-- ----------------------------------------------------------------------------
-- Per Q39: split tables chosen over polymorphic. Real FK + ON DELETE CASCADE.

CREATE TABLE supply_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_id UUID NOT NULL REFERENCES supplies(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_supply_tag UNIQUE (supply_id, tag_id)
);

CREATE INDEX idx_supply_tags_supply ON supply_tags(supply_id);
CREATE INDEX idx_supply_tags_tag ON supply_tags(tag_id);

COMMENT ON TABLE supply_tags IS 'Supply ↔ tag junction (Q39: split tables for FK-cascade ergonomics). Stores, storage location, etc.';


-- ----------------------------------------------------------------------------
-- 2e. need_tags — need ↔ tag junction
-- ----------------------------------------------------------------------------
-- Per Q39: parallel structure to supply_tags.

CREATE TABLE need_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id UUID NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_need_tag UNIQUE (need_id, tag_id)
);

CREATE INDEX idx_need_tags_need ON need_tags(need_id);
CREATE INDEX idx_need_tags_tag ON need_tags(tag_id);

COMMENT ON TABLE need_tags IS 'Need ↔ tag junction (Q39: split tables for FK-cascade ergonomics). Store routing, urgency, recipe attribution tags, etc.';


-- ----------------------------------------------------------------------------
-- 2f. views — saved filter expressions presented as "lists"
-- ----------------------------------------------------------------------------
-- Per Q2: UI presents views as "lists" using familiar terminology.
-- Per Q19: 4 defaults ship pre-baked per space.
-- Per Q25: three render modes (tier / aisle / flat).
-- Per Q32: status filter defaults to "need only" in creator.

CREATE TABLE views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '📋',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  render_mode TEXT NOT NULL DEFAULT 'tier'
    CHECK (render_mode IN ('tier', 'aisle', 'flat')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_views_space ON views(space_id);
CREATE INDEX idx_views_space_default ON views(space_id, is_default) WHERE is_default = true;

COMMENT ON TABLE views IS 'Saved filter expressions presented as "lists" in UI (Q2). Defaults non-deletable but hidable (Q19).';
COMMENT ON COLUMN views.is_default IS 'True for the 4 pre-baked views (Q19). Defaults cannot be deleted, only hidden.';
COMMENT ON COLUMN views.render_mode IS 'Tier = urgency grouping, Aisle = ingredients.typical_store_section grouping (Q29), Flat = no grouping (Q25).';


-- ----------------------------------------------------------------------------
-- 2g. view_filters — filter predicates within a view
-- ----------------------------------------------------------------------------
-- Per Q16: AND across dimensions, multi-value within dimension.
-- Per Q3/Q29: checkbox-grouped form; no aisle dimension (render-mode only).
-- Dimension 'status' is a pseudo-dimension — filters the status field directly,
-- not through tags. All other dimensions filter through tag_memberships.

CREATE TABLE view_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id UUID NOT NULL REFERENCES views(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL
    CHECK (dimension IN ('status', 'store', 'urgency', 'recipe', 'event', 'storage')),
  values TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One filter row per dimension per view
  CONSTRAINT unique_filter_per_view_dimension UNIQUE (view_id, dimension)
);

CREATE INDEX idx_view_filters_view ON view_filters(view_id);

COMMENT ON TABLE view_filters IS 'Filter predicates for views. AND across dimensions; multi-value OR within dimension (Q16). Cross-dimension OR deferred (P8R-D2).';
COMMENT ON COLUMN view_filters.dimension IS '''status'' filters the row field directly. All others filter through need_tags/supply_tags joins.';
COMMENT ON COLUMN view_filters.values IS 'Array of values to match within this dimension. E.g. {''today'',''this-week''} for urgency; {''need''} for status.';


-- ----------------------------------------------------------------------------
-- 2h. needs_recipes — need ↔ recipe attribution junction
-- ----------------------------------------------------------------------------
-- Per Q6: preserves per-recipe quantity + author attribution.
-- Replaces the planned (but never created) grocery_list_item_recipes.

CREATE TABLE needs_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  need_id UUID NOT NULL REFERENCES needs(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  recipe_quantity_amount NUMERIC,
  recipe_quantity_unit TEXT,
  added_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One attribution row per need + recipe pair
  CONSTRAINT unique_need_recipe UNIQUE (need_id, recipe_id)
);

CREATE INDEX idx_needs_recipes_need ON needs_recipes(need_id);
CREATE INDEX idx_needs_recipes_recipe ON needs_recipes(recipe_id);

COMMENT ON TABLE needs_recipes IS 'Need ↔ recipe attribution (Q6). Multiple recipes can contribute to one need; display-merged at view time per Q28/Q36.';
COMMENT ON COLUMN needs_recipes.recipe_id IS 'FK CASCADE: if recipe deleted, attribution row deleted but the need itself survives.';


-- ============================================================================
-- PART 3: RLS POLICIES
-- ============================================================================
-- Pattern follows pantry_staples: space_members-scoped.
-- SELECT: accepted member of any role (owner, member, guest).
-- INSERT/UPDATE: accepted member of any role (guest can add + cycle state).
-- DELETE: owner + member only (guest cannot delete).
-- Per Q9: space-scoped. for_user_ids is NOT an RLS filter — it's an
-- ownership semantic, not a visibility restriction.
-- ============================================================================

-- Helper comment: all RLS policies use the same space_members subquery pattern.

-- ----- tags -----
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select" ON tags FOR SELECT
USING (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = tags.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
));

CREATE POLICY "tags_insert" ON tags FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = tags.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member', 'guest')
));

CREATE POLICY "tags_update" ON tags FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = tags.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member', 'guest')
));

CREATE POLICY "tags_delete" ON tags FOR DELETE
USING (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = tags.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member')
));

-- ----- supplies -----
ALTER TABLE supplies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplies_select" ON supplies FOR SELECT
USING (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = supplies.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
));

CREATE POLICY "supplies_insert" ON supplies FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = supplies.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member', 'guest')
));

CREATE POLICY "supplies_update" ON supplies FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = supplies.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member', 'guest')
));

CREATE POLICY "supplies_delete" ON supplies FOR DELETE
USING (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = supplies.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member')
));

-- ----- needs -----
ALTER TABLE needs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "needs_select" ON needs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = needs.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
));

CREATE POLICY "needs_insert" ON needs FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = needs.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member', 'guest')
));

CREATE POLICY "needs_update" ON needs FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = needs.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member', 'guest')
));

CREATE POLICY "needs_delete" ON needs FOR DELETE
USING (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = needs.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member')
));

-- ----- supply_tags -----
-- RLS scoped through the supply's space_id (join through supplies).
ALTER TABLE supply_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supply_tags_select" ON supply_tags FOR SELECT
USING (EXISTS (
  SELECT 1 FROM supplies s
  JOIN space_members sm ON sm.space_id = s.space_id
  WHERE s.id = supply_tags.supply_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
));

CREATE POLICY "supply_tags_insert" ON supply_tags FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM supplies s
  JOIN space_members sm ON sm.space_id = s.space_id
  WHERE s.id = supply_tags.supply_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member', 'guest')
));

CREATE POLICY "supply_tags_update" ON supply_tags FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM supplies s
  JOIN space_members sm ON sm.space_id = s.space_id
  WHERE s.id = supply_tags.supply_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member', 'guest')
));

CREATE POLICY "supply_tags_delete" ON supply_tags FOR DELETE
USING (EXISTS (
  SELECT 1 FROM supplies s
  JOIN space_members sm ON sm.space_id = s.space_id
  WHERE s.id = supply_tags.supply_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member')
));

-- ----- need_tags -----
-- RLS scoped through the need's space_id (join through needs).
ALTER TABLE need_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "need_tags_select" ON need_tags FOR SELECT
USING (EXISTS (
  SELECT 1 FROM needs n
  JOIN space_members sm ON sm.space_id = n.space_id
  WHERE n.id = need_tags.need_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
));

CREATE POLICY "need_tags_insert" ON need_tags FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM needs n
  JOIN space_members sm ON sm.space_id = n.space_id
  WHERE n.id = need_tags.need_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member', 'guest')
));

CREATE POLICY "need_tags_update" ON need_tags FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM needs n
  JOIN space_members sm ON sm.space_id = n.space_id
  WHERE n.id = need_tags.need_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member', 'guest')
));

CREATE POLICY "need_tags_delete" ON need_tags FOR DELETE
USING (EXISTS (
  SELECT 1 FROM needs n
  JOIN space_members sm ON sm.space_id = n.space_id
  WHERE n.id = need_tags.need_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member')
));

-- ----- views -----
ALTER TABLE views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "views_select" ON views FOR SELECT
USING (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = views.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
));

CREATE POLICY "views_insert" ON views FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = views.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member', 'guest')
));

CREATE POLICY "views_update" ON views FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = views.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member', 'guest')
));

-- Views: only owner + member can delete. Default views blocked at service layer.
CREATE POLICY "views_delete" ON views FOR DELETE
USING (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = views.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member')
));

-- ----- view_filters -----
-- RLS scoped through the view's space_id (join through views).
ALTER TABLE view_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_filters_select" ON view_filters FOR SELECT
USING (EXISTS (
  SELECT 1 FROM views v
  JOIN space_members sm ON sm.space_id = v.space_id
  WHERE v.id = view_filters.view_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
));

CREATE POLICY "view_filters_insert" ON view_filters FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM views v
  JOIN space_members sm ON sm.space_id = v.space_id
  WHERE v.id = view_filters.view_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member', 'guest')
));

CREATE POLICY "view_filters_update" ON view_filters FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM views v
  JOIN space_members sm ON sm.space_id = v.space_id
  WHERE v.id = view_filters.view_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member', 'guest')
));

CREATE POLICY "view_filters_delete" ON view_filters FOR DELETE
USING (EXISTS (
  SELECT 1 FROM views v
  JOIN space_members sm ON sm.space_id = v.space_id
  WHERE v.id = view_filters.view_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member')
));

-- ----- needs_recipes -----
-- RLS scoped through the need's space_id (join through needs).
ALTER TABLE needs_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "needs_recipes_select" ON needs_recipes FOR SELECT
USING (EXISTS (
  SELECT 1 FROM needs n
  JOIN space_members sm ON sm.space_id = n.space_id
  WHERE n.id = needs_recipes.need_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
));

CREATE POLICY "needs_recipes_insert" ON needs_recipes FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM needs n
  JOIN space_members sm ON sm.space_id = n.space_id
  WHERE n.id = needs_recipes.need_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member', 'guest')
));

CREATE POLICY "needs_recipes_update" ON needs_recipes FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM needs n
  JOIN space_members sm ON sm.space_id = n.space_id
  WHERE n.id = needs_recipes.need_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member', 'guest')
));

CREATE POLICY "needs_recipes_delete" ON needs_recipes FOR DELETE
USING (EXISTS (
  SELECT 1 FROM needs n
  JOIN space_members sm ON sm.space_id = n.space_id
  WHERE n.id = needs_recipes.need_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member')
));


-- ============================================================================
-- PART 4: TRIGGERS
-- ============================================================================

-- Generic updated_at trigger function (reusable across tables)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_supplies_updated_at
  BEFORE UPDATE ON supplies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_needs_updated_at
  BEFORE UPDATE ON needs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_views_updated_at
  BEFORE UPDATE ON views
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- PART 5: SEED DEFAULT VIEWS
-- ============================================================================
-- Per Q19: 4 defaults per space. Run once after migration for existing spaces.
-- New spaces should call this function at creation time (wired in CP2).
--
-- Tonight:    urgency = 'today'
-- This week:  urgency = 'this-week'  (includes today via derived hierarchy)
-- All needs:  status  = 'need'
-- In cart:    status  = 'in_cart'

CREATE OR REPLACE FUNCTION seed_default_views(target_space_id UUID)
RETURNS void AS $$
DECLARE
  v_tonight_id UUID;
  v_this_week_id UUID;
  v_all_needs_id UUID;
  v_in_cart_id UUID;
BEGIN
  -- Skip if defaults already exist for this space
  IF EXISTS (SELECT 1 FROM views WHERE space_id = target_space_id AND is_default = true) THEN
    RETURN;
  END IF;

  -- Tonight
  INSERT INTO views (space_id, name, emoji, is_default, render_mode, sort_order)
  VALUES (target_space_id, 'Tonight', '🌙', true, 'tier', 1)
  RETURNING id INTO v_tonight_id;

  INSERT INTO view_filters (view_id, dimension, values)
  VALUES (v_tonight_id, 'urgency', ARRAY['today']);

  -- This week
  INSERT INTO views (space_id, name, emoji, is_default, render_mode, sort_order)
  VALUES (target_space_id, 'This week', '📅', true, 'tier', 2)
  RETURNING id INTO v_this_week_id;

  INSERT INTO view_filters (view_id, dimension, values)
  VALUES (v_this_week_id, 'urgency', ARRAY['this-week']);

  -- All needs
  INSERT INTO views (space_id, name, emoji, is_default, render_mode, sort_order)
  VALUES (target_space_id, 'All needs', '📋', true, 'tier', 3)
  RETURNING id INTO v_all_needs_id;

  INSERT INTO view_filters (view_id, dimension, values)
  VALUES (v_all_needs_id, 'status', ARRAY['need']);

  -- In cart
  INSERT INTO views (space_id, name, emoji, is_default, render_mode, sort_order)
  VALUES (target_space_id, 'In cart', '🛒', true, 'flat', 4)
  RETURNING id INTO v_in_cart_id;

  INSERT INTO view_filters (view_id, dimension, values)
  VALUES (v_in_cart_id, 'status', ARRAY['in_cart']);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION seed_default_views IS 'Creates the 4 default views for a space (Q19). Idempotent — skips if defaults already exist.';

-- Seed defaults for Tom + Mary's space
SELECT seed_default_views('7aa945ab-fb32-4197-ae11-e6dbd3392587');


-- ============================================================================
-- PART 6: VERIFICATION QUERIES (run separately after migration)
-- ============================================================================
-- Copy-paste these into SQL Editor after the migration succeeds.
-- Expected: all checks pass. Any failure = investigate before proceeding.
-- ============================================================================

/*

-- 6a. Confirm old tables are gone
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'grocery_lists', 'grocery_list_items', 'grocery_list_item_recipes',
    'pantry_staples', 'pantry_items', 'regular_grocery_items'
  );
-- Expected: 0 rows

-- 6b. Confirm old views are gone
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN (
    'grocery_list_with_ingredients', 'grocery_lists_with_counts', 'regular_items_due_soon'
  );
-- Expected: 0 rows

-- 6c. Confirm new tables exist with correct column counts
SELECT table_name, COUNT(*) as col_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'tags', 'supplies', 'needs', 'supply_tags', 'need_tags',
    'views', 'view_filters', 'needs_recipes'
  )
GROUP BY table_name
ORDER BY table_name;
-- Expected (alpha order):
--   need_tags      =  4 columns
--   needs          = 14 columns
--   needs_recipes  =  7 columns
--   supply_tags    =  4 columns
--   supplies       = 11 columns
--   tags           =  6 columns
--   view_filters   =  5 columns
--   views          = 11 columns

-- 6d. Confirm RLS is enabled on all new tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'tags', 'supplies', 'needs', 'supply_tags', 'need_tags',
    'views', 'view_filters', 'needs_recipes'
  );
-- Expected: all rows show rowsecurity = true

-- 6e. Confirm RLS policies exist (4 per table = 32 total)
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'tags', 'supplies', 'needs', 'supply_tags', 'need_tags',
    'views', 'view_filters', 'needs_recipes'
  )
GROUP BY tablename
ORDER BY tablename;
-- Expected: 4 policies per table

-- 6f. Confirm default views seeded for Tom + Mary's space
SELECT v.name, v.emoji, v.is_default, v.render_mode, v.sort_order,
       vf.dimension, vf.values
FROM views v
LEFT JOIN view_filters vf ON vf.view_id = v.id
WHERE v.space_id = '7aa945ab-fb32-4197-ae11-e6dbd3392587'
ORDER BY v.sort_order;
-- Expected: 4 rows (Tonight, This week, All needs, In cart) with correct filters

-- 6g. Confirm CHECK constraints on key columns
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN (
  'supplies'::regclass, 'needs'::regclass, 'tags'::regclass,
  'views'::regclass, 'view_filters'::regclass
)
AND contype = 'c'
ORDER BY conrelid::text, conname;
-- Expected: supply_has_identity, need_has_identity, status checks, dimension checks, render_mode check

-- 6h. Confirm indexes exist
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'tags', 'supplies', 'needs', 'supply_tags', 'need_tags',
    'views', 'view_filters', 'needs_recipes'
  )
ORDER BY tablename, indexname;
-- Expected: all indexes from PART 2 present

-- 6i. Confirm triggers on updated_at
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('supplies', 'needs', 'views');
-- Expected: 3 triggers (one per table)

-- 6j. Confirm seed function exists
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'seed_default_views';
-- Expected: 1 row

-- 6k. Quick RLS smoke test — Tom can see default views
-- (Run as Tom's auth context or via service role)
SELECT COUNT(*) FROM views
WHERE space_id = '7aa945ab-fb32-4197-ae11-e6dbd3392587';
-- Expected: 4 (via service role; via Tom's auth = 4 if RLS passes)

*/
