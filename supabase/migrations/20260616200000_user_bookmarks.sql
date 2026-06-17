-- Custom recipe bookmarks — definitions table (ADDITIVE, own table).
--
-- Generalizes recipe bookmarking. Per-recipe ASSIGNMENTS stay in the existing
-- `user_recipe_tags` (tag = a bookmark KEY). This table stores only the user's
-- CUSTOM bookmark definitions (name + color); the two built-in defaults
-- ("Favorite" → key 'favorite', "Make Soon" → key 'cook_soon') are code
-- constants (lib/services/bookmarkService.ts), not rows — they are locked
-- (no rename/recolor/delete), so they need no storage or seeding.
--
-- Join is by the stable `key` string (NOT name): renaming a custom bookmark is
-- a one-row name update and never rewrites the assignment rows in
-- user_recipe_tags. Deleting one removes its user_recipe_tags rows (tag = key)
-- + this row, in the service (no DB FK since tag is free-text).
--
-- Checkpoint/additive tier (own table, own-rows RLS, no privileged paths) →
-- CC authors + pushes after --dry-run.

CREATE TABLE IF NOT EXISTS "public"."user_bookmarks" (
  "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    uuid        NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "key"        text        NOT NULL,   -- stable join key into user_recipe_tags.tag (lowercase slug)
  "name"       text        NOT NULL,   -- display label (editable; rename = name only)
  "color"      text        NOT NULL CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$'),
  "sort_order" integer     NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("user_id", "key"),
  UNIQUE ("user_id", "name")
);

ALTER TABLE "public"."user_bookmarks" OWNER TO "postgres";

COMMENT ON TABLE "public"."user_bookmarks" IS
  'Custom recipe-bookmark definitions (name + color). Per-recipe assignments live in user_recipe_tags (tag = this row''s key). Built-in defaults Favorite/Make Soon are locked code constants, NOT rows. Join by key so rename never rewrites assignments.';
COMMENT ON COLUMN "public"."user_bookmarks"."key" IS
  'Stable lowercase slug used as user_recipe_tags.tag. Never changes on rename. Generated as slug+short-uuid at create time.';

CREATE INDEX IF NOT EXISTS "user_bookmarks_user_sort_idx"
  ON "public"."user_bookmarks" ("user_id", "sort_order");

-- RLS — own-rows for all four verbs (mirrors user_recipe_tags).
ALTER TABLE "public"."user_bookmarks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_bookmarks_select_own"
  ON "public"."user_bookmarks" FOR SELECT TO "authenticated"
  USING ("user_id" = "auth"."uid"());

CREATE POLICY "user_bookmarks_insert_own"
  ON "public"."user_bookmarks" FOR INSERT TO "authenticated"
  WITH CHECK ("user_id" = "auth"."uid"());

CREATE POLICY "user_bookmarks_update_own"
  ON "public"."user_bookmarks" FOR UPDATE TO "authenticated"
  USING ("user_id" = "auth"."uid"())
  WITH CHECK ("user_id" = "auth"."uid"());

CREATE POLICY "user_bookmarks_delete_own"
  ON "public"."user_bookmarks" FOR DELETE TO "authenticated"
  USING ("user_id" = "auth"."uid"());

GRANT ALL ON TABLE "public"."user_bookmarks" TO "anon", "authenticated", "service_role";
