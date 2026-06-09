-- ============================================
-- NYT Import: community notes / comments
-- ============================================
-- Stores the source's community notes (NYT Cooking "Notes") captured during
-- recipe extraction. These are embedded in the page's __NEXT_DATA__ payload
-- (no auth needed) and parsed by the scrape-recipe edge function.
--
-- v1 stores the notes embedded in the first page of the payload (~15 of N).
-- Full pagination ("all 67") is a later follow-up that just appends more rows.
--
-- external_source_id / source_domain are denormalized from the recipe so a
-- future increment can share notes across user copies of the same source
-- recipe (copy-on-import) without a schema change.
-- ============================================

CREATE TABLE IF NOT EXISTS public.recipe_source_notes (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id               uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  external_source_id      text,
  source_domain           text,
  source_note_id          text NOT NULL,          -- the source's own note id (for idempotent re-import)
  note_type               text,                   -- 'comment' | 'userReply'
  author_name             text,
  author_external_id      text,
  message                 text NOT NULL,
  parent_source_note_id   text,                   -- threading: parent note's source id
  is_recommended          boolean DEFAULT false,
  recommendations_count   integer DEFAULT 0,
  replies_count           integer DEFAULT 0,
  source_created_at       timestamptz,            -- when the note was posted on the source
  created_at              timestamptz DEFAULT now(),
  -- Re-importing the same recipe must not duplicate notes.
  UNIQUE (recipe_id, source_note_id)
);

-- Detail-page lookup: all notes for a recipe, helpful/recommended first.
CREATE INDEX IF NOT EXISTS idx_recipe_source_notes_recipe
  ON public.recipe_source_notes (recipe_id, is_recommended DESC, source_created_at DESC);

COMMENT ON TABLE public.recipe_source_notes IS
  'Community notes/comments captured from a recipe source (e.g. NYT Cooking). Populated by saveRecipeToDatabase from the scrape-recipe edge function payload. See lib/services/recipeExtraction/sourceNotesService.ts.';
