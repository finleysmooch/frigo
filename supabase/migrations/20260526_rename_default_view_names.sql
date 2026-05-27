-- ============================================
-- 8R-UX6 Item 3: rename default views in seed function + migrate rows
-- ============================================
-- Renames the four DB-seeded default views from their original names to the
-- UI-facing names that have been overridden at the read layer since 8R-UX1:
--
--   Tonight     → Short List
--   This week   → Medium List
--   All needs   → Long List
--   In cart     → In Cart
--
-- Two operations in one atomic migration:
--   (1) CREATE OR REPLACE seed_default_views — new spaces inherit the new
--       names directly. Preserves the 8R-UX2 render_mode default ('aisle'
--       for the three urgency-based defaults; 'flat' for In Cart).
--   (2) UPDATE existing rows where the name matches the OLD default name
--       AND the view's filter shape matches the system-default shape (via
--       view_filters, the schema's actual filter store — NOT view_tags).
--       Defensive — user-created views that happen to share the name are
--       untouched.
--
-- Companion code change: removes DEFAULT_VIEW_NAME_OVERRIDES in
-- lib/services/viewsService.ts so the DB row name is authoritative.
-- ============================================

CREATE OR REPLACE FUNCTION seed_default_views(target_space_id UUID)
RETURNS void AS $$
DECLARE
  v_short_id UUID;
  v_medium_id UUID;
  v_long_id UUID;
  v_in_cart_id UUID;
BEGIN
  -- Skip if defaults already exist for this space
  IF EXISTS (SELECT 1 FROM views WHERE space_id = target_space_id AND is_default = true) THEN
    RETURN;
  END IF;

  -- Short List (urgency=today)
  INSERT INTO views (space_id, name, emoji, is_default, render_mode, sort_order)
  VALUES (target_space_id, 'Short List', '🌙', true, 'aisle', 1)
  RETURNING id INTO v_short_id;

  INSERT INTO view_filters (view_id, dimension, values)
  VALUES (v_short_id, 'urgency', ARRAY['today']);

  -- Medium List (urgency=this-week)
  INSERT INTO views (space_id, name, emoji, is_default, render_mode, sort_order)
  VALUES (target_space_id, 'Medium List', '📅', true, 'aisle', 2)
  RETURNING id INTO v_medium_id;

  INSERT INTO view_filters (view_id, dimension, values)
  VALUES (v_medium_id, 'urgency', ARRAY['this-week']);

  -- Long List (status=need, no urgency)
  INSERT INTO views (space_id, name, emoji, is_default, render_mode, sort_order)
  VALUES (target_space_id, 'Long List', '📋', true, 'aisle', 3)
  RETURNING id INTO v_long_id;

  INSERT INTO view_filters (view_id, dimension, values)
  VALUES (v_long_id, 'status', ARRAY['need']);

  -- In Cart (status=in_cart)
  INSERT INTO views (space_id, name, emoji, is_default, render_mode, sort_order)
  VALUES (target_space_id, 'In Cart', '🛒', true, 'flat', 4)
  RETURNING id INTO v_in_cart_id;

  INSERT INTO view_filters (view_id, dimension, values)
  VALUES (v_in_cart_id, 'status', ARRAY['in_cart']);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION seed_default_views IS '8R-UX6: creates the 4 default views for a space with the canonical UI names (Short / Medium / Long List + In Cart). Idempotent.';

-- ============================================
-- Row migration — rename existing defaults to match the new function output.
-- Defensive: only renames rows where the current name matches the OLD default
-- AND the view's filter shape matches the system-default shape. User-created
-- views that happen to share the name (e.g., a custom "Tonight" reminder
-- list) are left alone.
-- ============================================

-- Short List (was 'Tonight')
UPDATE views
SET name = 'Short List'
WHERE name = 'Tonight'
  AND is_default = true
  AND EXISTS (
    SELECT 1 FROM view_filters vf
    WHERE vf.view_id = views.id
      AND vf.dimension = 'urgency'
      AND 'today' = ANY(vf.values)
  );

-- Medium List (was 'This week')
UPDATE views
SET name = 'Medium List'
WHERE name = 'This week'
  AND is_default = true
  AND EXISTS (
    SELECT 1 FROM view_filters vf
    WHERE vf.view_id = views.id
      AND vf.dimension = 'urgency'
      AND 'this-week' = ANY(vf.values)
  );

-- Long List (was 'All needs') — identified by status=need filter AND no urgency filter
UPDATE views
SET name = 'Long List'
WHERE name = 'All needs'
  AND is_default = true
  AND EXISTS (
    SELECT 1 FROM view_filters vf
    WHERE vf.view_id = views.id
      AND vf.dimension = 'status'
      AND 'need' = ANY(vf.values)
  )
  AND NOT EXISTS (
    SELECT 1 FROM view_filters vf
    WHERE vf.view_id = views.id
      AND vf.dimension = 'urgency'
  );

-- In Cart (was 'In cart' lowercase c) — capitalization normalize
UPDATE views
SET name = 'In Cart'
WHERE name = 'In cart'
  AND is_default = true;
