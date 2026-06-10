-- CP5 ROLLBACK ARTIFACT — restores public.handle_new_user to its EXACT pre-CP5 live body.
--
-- Body below is verbatim `pg_get_functiondef('public.handle_new_user'::regproc)` captured 2026-06-09
-- (live == CP1 baseline). pg_get_functiondef output round-trips exactly, so re-applying restores the
-- function VERBATIM (proven below in this session's SESSION_LOG).
--
-- NOT a tracked migration: lives outside supabase/migrations/ so `db push` never applies it. Apply
-- manually ONLY if the CP5 function breaks signups:
--     psql "<conn>" -f supabase/rollbacks/20260610003320_cp5_handle_new_user_ROLLBACK.sql
-- Restores the FUNCTION ONLY — does NOT re-add `username NOT NULL` (NULL-username rows may exist from
-- signups during the CP5 window; re-adding NOT NULL would fail). New signups revert to username = email.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.user_profiles (id, email, username, display_name)
  VALUES (
    new.id,
    new.email,
    new.email,
    split_part(new.email, '@', 1)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(user_profiles.username, EXCLUDED.username),
    display_name = COALESCE(user_profiles.display_name, EXCLUDED.display_name);
  RETURN new;
END;
$function$

;
