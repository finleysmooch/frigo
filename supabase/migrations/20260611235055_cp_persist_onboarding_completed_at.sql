-- CP-persist (D-ON-10): onboarding completion persistence.
--
-- Adds user_profiles.onboarding_completed_at (timestamptz, NULLABLE) and
-- backfills now() on ALL existing profiles, so pre-existing users never see
-- the (not-yet-built) onboarding flow. New profiles are created by
-- handle_new_user without this column -> NULL; the stamp is written at T12
-- completion (CP9e). Gate semantics (D-ON-10, binary, no mid-spine resume):
--   session AND completed     -> main tabs
--   session AND NOT completed -> onboarding stack
--
-- EXPLICITLY OUT of this CP (oversight ruling): the App.tsx gate change.
-- It ships with CP9a -- there is no onboarding stack to route to yet.
--
-- Copy-set deny-list note (anchor section 4.3 standing rule): user_profiles is
-- NOT public.recipes nor any copied child table, so this column needs no
-- delivery copy-set classification.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

COMMENT ON COLUMN public.user_profiles.onboarding_completed_at IS
  'D-ON-10: when the user completed onboarding (stamped at T12). NULL = onboarding not completed -> the app gate routes to the onboarding stack. Backfilled to the CP-persist migration time for all profiles that pre-date onboarding.';

-- Backfill: every profile existing at migration time is treated as having
-- completed onboarding. Guarded so an accidental re-run cannot re-stamp.
UPDATE public.user_profiles
   SET onboarding_completed_at = now()
 WHERE onboarding_completed_at IS NULL;
