-- CP5 (S1) — handle_new_user: no auto-username + OAuth-ready profile population.
--
-- GATED / HIGH-RISK. handle_new_user fires on EVERY auth.users INSERT; a broken function blocks all
-- new signups on the shared production DB. Authored by CC; **Tom pushes ONLY after oversight clears
-- the live-body diff + proven rollback** (see docs/SESSION_LOG.md + supabase/rollbacks/).
--
-- Public schema only. Does NOT touch/recreate the auth.users trigger binding (correct as captured in
-- docs/MIGRATIONS.md; CP1 left the auth schema untracked).
--
-- The new function is the EXACT live body (pg_get_functiondef, 2026-06-09) with ONLY the username +
-- metadata lines changed:
--   * username   : no longer set → left NULL (column made nullable in step 1). [S1]
--   * display_name : OAuth metadata wins when present (OAuth-ready); email-prefix
--                  (`split_part(email,'@',1)`) fallback for email/password — NEVER NULL (Tom's ruling).
--   * avatar_url   : from NEW.raw_user_meta_data when present; NULL for email/password.
-- HEADER HARDENING (CP-required, not a body-logic change): SECURITY DEFINER now pins
--   `SET search_path TO 'public'`; the live body had none.
-- DEFAULT SPACE: the live body creates NO default Space (single user_profiles upsert) — nothing to
--   preserve (this also closes CP3's space-timing question: spaces are created lazily by app code via
--   the create_default_space_for_user RPC, not by this trigger).

-- 1. Make username nullable (do NOT drop the column). Safe per the dependency sweep:
--    UNIQUE(username) tolerates multiple NULLs; no CHECK/generated/FK depends on username; the
--    pending_space_invitations / pending_participant_approvals *_username columns are join-computed
--    VIEW columns (nullable) — no stored denormalized username exists.
ALTER TABLE "public"."user_profiles" ALTER COLUMN "username" DROP NOT NULL;

-- 2. Replace the trigger function (public schema only; auth.users binding untouched).
CREATE OR REPLACE FUNCTION "public"."handle_new_user"()
RETURNS "trigger"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    -- display_name: OAuth metadata wins when present; email-prefix fallback for email/password.
    -- Never NULL for any signup path (Tom's ruling). username still stays absent/NULL per S1.
    COALESCE(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    -- avatar_url: from OAuth metadata when present; NULL for email/password.
    COALESCE(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(user_profiles.display_name, EXCLUDED.display_name),
    avatar_url = COALESCE(user_profiles.avatar_url, EXCLUDED.avatar_url);
  RETURN new;
END;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

-- No GRANT changes: handle_new_user is a trigger function (not client-callable). Per the anon-EXECUTE
-- standing rule (docs/MIGRATIONS.md), no client-callable function is added and no EXECUTE grant is made.
