-- CP6a-2 — Ownership verification: admin gate + review portal backend + trusted allowlist + CP6b seam.
--
-- GATED. The PRIVILEGED half of O1 ownership verification, on top of CP6a-1 (473d6cd: the
-- book_ownership_verifications table + private verification-images bucket + submit/getMy service).
-- This migration adds: two locked allowlist tables, an is_admin() helper, the server-side trusted
-- auto-grant submit RPC, the admin review RPCs, and the admin bucket-read-all storage policy.
--
-- DELIVERS NO RECIPES. Approval sets status='verified' and leaves delivered_at NULL; CP6b (NOT built)
-- processes status='verified' AND delivered_at IS NULL and delivers. The approve action is inert until
-- CP6b exists — intended.
--
-- Authored by CC; de-risked rollback-wrapped + dry-run. **CC does NOT push — Tom pushes after oversight
-- post-review** (gated chain). Public + storage schema only; no auth.users trigger touched; no
-- user_books / book / recipe rows touched.
--
-- anon-EXECUTE standing rule (docs/MIGRATIONS.md) applied to EVERY function below: a new public function
-- is anon-callable from two sources (the PUBLIC grant + Supabase default privileges), so each function
-- REVOKEs EXECUTE FROM PUBLIC and FROM anon, then GRANTs only to authenticated.

-- ═════════════════════════════════════════════════════════════════════════════════════════════════
-- 1. Allowlist tables — FULLY LOCKED (no client read/write; populated only by service-role SQL).
--    RLS ON with ZERO policies ⇒ default-deny for client roles; client GRANTs additionally revoked so
--    even a SELECT is "permission denied" (no roster leak). The definer functions below read these as
--    owner (postgres), bypassing both RLS and GRANTs.
-- ═════════════════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "public"."app_admins" (
  "user_id"  uuid PRIMARY KEY REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "added_at" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "public"."app_admins" OWNER TO "postgres";
COMMENT ON TABLE "public"."app_admins" IS
  'Who may review ownership verifications (CP6a-2). Fully locked: no client read/write — populated by manual service-role SQL only (see docs/COOKBOOK_VERIFICATION.md). Read only via public.is_admin().';

CREATE TABLE IF NOT EXISTS "public"."trusted_verification_users" (
  "user_id"  uuid PRIMARY KEY REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "added_at" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "public"."trusted_verification_users" OWNER TO "postgres";
COMMENT ON TABLE "public"."trusted_verification_users" IS
  'Trusted users whose ownership submissions auto-grant to verified, skipping manual review (CP6a-2). Fully locked: no client read/write — manual service-role SQL only. Evaluated server-side inside public.submit_verification().';

-- Lock down: revoke client grants (defense in depth on top of RLS-with-no-policy) + enable RLS.
REVOKE ALL ON TABLE "public"."app_admins" FROM "anon", "authenticated";
REVOKE ALL ON TABLE "public"."trusted_verification_users" FROM "anon", "authenticated";
ALTER TABLE "public"."app_admins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."trusted_verification_users" ENABLE ROW LEVEL SECURITY;
-- (No policies created on purpose — default-deny for every client role.)

-- ═════════════════════════════════════════════════════════════════════════════════════════════════
-- 2. is_admin() — single admin predicate used by EVERY admin check (storage policy + all RPCs), so the
--    allowlist tables never need to be client-readable. SECURITY DEFINER reads app_admins as owner;
--    auth.uid() still resolves to the CALLING user (it reads the request JWT GUC, not the role).
-- ═════════════════════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION "public"."is_admin"()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid());
$$;
ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."is_admin"() FROM "anon";
GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO "authenticated";

-- ═════════════════════════════════════════════════════════════════════════════════════════════════
-- 3. submit_verification() — server-evaluated trusted auto-grant. This is the ONLY path that may write
--    status='verified' on submit; CP6a-1's RLS (insert/update pinned to status='pending') correctly
--    blocks a client from claiming verified directly, so trust MUST be decided here, server-side.
--    Non-trusted → pending. Trusted → verified + auto_granted=true + verified_at=now(), reviewed_by NULL
--    (audit trail = auto_granted). Re-submit on a still-pending row swaps the proof; a row already
--    reviewed (verified/rejected) is NOT re-opened by a non-trusted re-submit (preserves the flag).
-- ═════════════════════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION "public"."submit_verification"(
  "p_book_id"    uuid,
  "p_proof_path" text
)
RETURNS "public"."book_ownership_verifications"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_trusted  boolean;
  v_existing public.book_ownership_verifications;
  v_row      public.book_ownership_verifications;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_trusted := EXISTS (SELECT 1 FROM public.trusted_verification_users WHERE user_id = v_uid);

  SELECT * INTO v_existing
  FROM public.book_ownership_verifications
  WHERE user_id = v_uid AND book_id = p_book_id;

  -- A non-trusted user cannot re-open an already-reviewed row (verified/rejected). Return it unchanged
  -- so a rejected ("flagged") user can't silently reset themselves to pending. (Trusted users always
  -- resolve to verified below — trust overrides.)
  IF v_existing.id IS NOT NULL AND v_existing.status IN ('verified', 'rejected') AND NOT v_trusted THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.book_ownership_verifications AS bov
    ("user_id", "book_id", "proof_image_path", "status", "submitted_at", "verified_at", "auto_granted", "reviewed_by")
  VALUES (
    v_uid,
    p_book_id,
    p_proof_path,
    CASE WHEN v_trusted THEN 'verified' ELSE 'pending' END,
    now(),
    CASE WHEN v_trusted THEN now() ELSE NULL END,
    v_trusted,
    NULL
  )
  ON CONFLICT ("user_id", "book_id") DO UPDATE SET
    "proof_image_path" = EXCLUDED."proof_image_path",
    "submitted_at"     = now(),
    "status"           = CASE WHEN v_trusted THEN 'verified' ELSE 'pending' END,
    "verified_at"      = CASE WHEN v_trusted THEN now() ELSE bov."verified_at" END,
    "auto_granted"     = CASE WHEN v_trusted THEN true ELSE bov."auto_granted" END
  RETURNING bov.* INTO v_row;

  RETURN v_row;
END;
$$;
ALTER FUNCTION "public"."submit_verification"(uuid, text) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."submit_verification"(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."submit_verification"(uuid, text) FROM "anon";
GRANT EXECUTE ON FUNCTION "public"."submit_verification"(uuid, text) TO "authenticated";

-- ═════════════════════════════════════════════════════════════════════════════════════════════════
-- 4. Admin review RPCs (both self-check is_admin() and RAISE otherwise — the real boundary).
--    list_pending_verifications() returns rows + the proof PATH (a plpgsql function cannot mint a
--    Storage-signed URL; the service mints short-TTL signed URLs in JS, authorized by the admin
--    bucket-read-all policy in section 5).
-- ═════════════════════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION "public"."list_pending_verifications"()
RETURNS TABLE (
  "id"                uuid,
  "user_id"           uuid,
  "user_email"        text,
  "user_display_name" text,
  "book_id"           uuid,
  "book_title"        text,
  "book_author"       text,
  "proof_image_path"  text,
  "submitted_at"      timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
STABLE
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privilege required';
  END IF;

  RETURN QUERY
    SELECT
      v.id, v.user_id, up.email, up.display_name,
      v.book_id, b.title, b.author,
      v.proof_image_path, v.submitted_at
    FROM public.book_ownership_verifications v
    JOIN public.books b ON b.id = v.book_id
    LEFT JOIN public.user_profiles up ON up.id = v.user_id
    WHERE v.status = 'pending'
    ORDER BY v.submitted_at ASC;
END;
$$;
ALTER FUNCTION "public"."list_pending_verifications"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."list_pending_verifications"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."list_pending_verifications"() FROM "anon";
GRANT EXECUTE ON FUNCTION "public"."list_pending_verifications"() TO "authenticated";

-- review_verification(): approve/reject. On 'verified' leaves delivered_at NULL (CP6b delivers); on
-- 're-approve' preserves the original verified_at. Re-review guard: never alter a row already delivered
-- (delivered_at NOT NULL) — that's CP6b territory and would strand delivered copies.
CREATE OR REPLACE FUNCTION "public"."review_verification"(
  "p_id"       uuid,
  "p_decision" text,
  "p_note"     text DEFAULT NULL
)
RETURNS "public"."book_ownership_verifications"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing public.book_ownership_verifications;
  v_row      public.book_ownership_verifications;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privilege required';
  END IF;
  IF p_decision NOT IN ('verified', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision: % (expected verified|rejected)', p_decision;
  END IF;

  SELECT * INTO v_existing FROM public.book_ownership_verifications WHERE id = p_id;
  IF v_existing.id IS NULL THEN
    RAISE EXCEPTION 'Verification % not found', p_id;
  END IF;

  -- Re-review guard: a delivered row (CP6b stamped delivered_at) is immutable here.
  IF v_existing.delivered_at IS NOT NULL THEN
    RAISE EXCEPTION 'Verification % already delivered; cannot re-review', p_id;
  END IF;

  UPDATE public.book_ownership_verifications SET
    "status"      = p_decision,
    "verified_at" = CASE
                      WHEN p_decision = 'verified' THEN COALESCE(v_existing.verified_at, now())
                      ELSE NULL
                    END,
    "reviewed_by" = auth.uid(),
    "review_note" = p_note
  WHERE id = p_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
ALTER FUNCTION "public"."review_verification"(uuid, text, text) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."review_verification"(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."review_verification"(uuid, text, text) FROM "anon";
GRANT EXECUTE ON FUNCTION "public"."review_verification"(uuid, text, text) TO "authenticated";

-- ═════════════════════════════════════════════════════════════════════════════════════════════════
-- 5. Storage — admin bucket-read-all for verification-images (so the service can mint signed URLs for
--    any user's proof). Users still read only their own (CP6a-1's verification_images_select_own).
--    Permissive SELECT policies are OR'd: admin matches via is_admin(); owner matches via own folder.
-- ═════════════════════════════════════════════════════════════════════════════════════════════════
CREATE POLICY "verification_images_select_admin"
  ON "storage"."objects"
  FOR SELECT TO "authenticated"
  USING (
    "bucket_id" = 'verification-images'
    AND public.is_admin()
  );

-- ═════════════════════════════════════════════════════════════════════════════════════════════════
-- 6. Approve → CP6b seam (DEFINED here, BUILT in CP6b). CP6b's work queue is:
--      status = 'verified' AND delivered_at IS NULL
--    For each, CP6b will create the user_books link via the EXISTING createUserBookOwnership and copy
--    the catalog book's recipes with book_id = the catalog book id (books.is_catalog stays true), then
--    stamp delivered_at. No delivery/deep-copy/provenance/linkage is built here. See
--    docs/COOKBOOK_VERIFICATION.md.
-- ═════════════════════════════════════════════════════════════════════════════════════════════════
