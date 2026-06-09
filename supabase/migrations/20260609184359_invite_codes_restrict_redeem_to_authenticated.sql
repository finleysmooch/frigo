-- CP2 follow-up — lock redeem_invite_code() to authenticated only.
--
-- Supabase configures default privileges that auto-GRANT EXECUTE on newly created
-- public functions to anon, authenticated, and service_role. The base invite_codes
-- migration revoked EXECUTE from PUBLIC but not the explicit `anon` grant from those
-- default privileges, so anon could still execute redeem_invite_code. Redemption must
-- be authenticated-only (it relies on auth.uid()); revoke the anon grant.
--
-- validate_invite_code() intentionally remains anon-executable (pre-account check).

REVOKE EXECUTE ON FUNCTION "public"."redeem_invite_code"("p_code" text) FROM "anon";

-- Re-assert the intended grant (idempotent; documents intent in the file).
GRANT EXECUTE ON FUNCTION "public"."redeem_invite_code"("p_code" text) TO "authenticated";
