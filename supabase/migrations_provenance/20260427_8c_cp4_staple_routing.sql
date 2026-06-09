-- Phase 8C-CP4: Staple → grocery auto-routing.
-- (1) Adds back-pointer on grocery_list_items to the staple that triggered the route,
--     enabling Stage-1 dedup and reverse-direction restoration on checkoff.
-- (2) Extends the added_from CHECK to recognize 'staple' as a fifth source semantic,
--     distinct from 'pantry' (which means "user added manually from the pantry tab").

ALTER TABLE grocery_list_items
  ADD COLUMN source_staple_id UUID NULL
    REFERENCES pantry_staples(id) ON DELETE SET NULL;

CREATE INDEX idx_gli_source_staple_id
  ON grocery_list_items(source_staple_id)
  WHERE source_staple_id IS NOT NULL;

COMMENT ON COLUMN grocery_list_items.source_staple_id IS
  'Phase 8C-CP4: when set, this row was created or last-updated by a staple-out auto-route. Checking this item off restores the linked staple to state=good.';

-- Drop and re-add added_from CHECK with 'staple' included.
ALTER TABLE grocery_list_items
  DROP CONSTRAINT grocery_list_items_added_from_check;

ALTER TABLE grocery_list_items
  ADD CONSTRAINT grocery_list_items_added_from_check
  CHECK (added_from = ANY (ARRAY['recipe'::text, 'pantry'::text, 'manual'::text, 'regular'::text, 'staple'::text]));
