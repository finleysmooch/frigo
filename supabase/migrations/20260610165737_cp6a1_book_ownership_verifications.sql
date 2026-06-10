-- CP6a-1 — Ownership verification: capture + private storage + submit (ADDITIVE half).
--
-- Verify-first cookbook delivery (v0.3.2 §4.3 / ONBOARDING_AND_COLDSTART_SCOPING O1).
-- This is the USER-FACING, additive half: a user submits proof (book + handwritten dated note)
-- and can read their OWN status. It AUTHORIZES NOTHING and DELIVERS NOTHING — no approval, no admin,
-- no allowlist, no recipe access. The approval/admin/allowlist half (writing verified/rejected,
-- verified_at, reviewed_by, auto_granted, delivered_at, review_note) is CP6a-2's SECURITY DEFINER
-- RPCs. Pending rows from CP6a-1 simply sit until CP6a-2 exists — an intended inert seam.
--
-- Checkpoint tier (additive, no privileged paths) → CC authors AND pushes (after --dry-run).
--
-- SOURCE OF TRUTH: this table is the SOLE verification-status source. The legacy
-- public.user_books.ownership_claimed / ownership_proof_image_url columns are NOT touched and are NOT
-- read as truth (their consolidation is tracked in DEFERRED_WORK).

-- ───────────────────────────────────────────────────────────────────────────────────────────────
-- 1. Table
-- ───────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "public"."book_ownership_verifications" (
  "id"               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"          uuid        NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
  "book_id"          uuid        NOT NULL REFERENCES "public"."books"("id") ON DELETE CASCADE,
  "status"           text        NOT NULL DEFAULT 'pending'
                                 CHECK ("status" IN ('pending', 'verified', 'rejected')),
  "proof_image_path" text,
  "submitted_at"     timestamptz NOT NULL DEFAULT now(),
  -- The following are written ONLY by CP6a-2's privileged RPCs (never by a user under RLS):
  "verified_at"      timestamptz,                                   -- set on approval (CP6a-2)
  "reviewed_by"      uuid        REFERENCES "auth"."users"("id"),   -- reviewer (CP6a-2)
  "auto_granted"     boolean     NOT NULL DEFAULT false,            -- trusted-allowlist auto-grant (CP6a-2)
  "review_note"      text,                                          -- rejection/flag note (CP6a-2)
  "delivered_at"     timestamptz,                                   -- CP6b copy-on-verify seam (untouched here)
  UNIQUE ("user_id", "book_id")                                     -- re-submit updates the row, never duplicates
);

ALTER TABLE "public"."book_ownership_verifications" OWNER TO "postgres";

COMMENT ON TABLE "public"."book_ownership_verifications" IS
  'O1 ownership-verification records (CP6a). SOLE source of verification status — supersedes the legacy user_books.ownership_* columns (not yet consolidated; see DEFERRED_WORK). CP6a-1 = user submit + own-read; CP6a-2 = privileged approve/reject/allowlist via SECURITY DEFINER RPCs.';
COMMENT ON COLUMN "public"."book_ownership_verifications"."proof_image_path" IS
  'Path within the PRIVATE verification-images storage bucket (folder-scoped by user id). Not a public URL.';
COMMENT ON COLUMN "public"."book_ownership_verifications"."delivered_at" IS
  'CP6b copy-on-verify seam — stamped when the verified book''s recipes are delivered. Untouched in CP6a.';

-- Read-path index for getMyVerifications (a user listing their own submissions).
CREATE INDEX IF NOT EXISTS "book_ownership_verifications_user_id_idx"
  ON "public"."book_ownership_verifications" ("user_id");

-- ───────────────────────────────────────────────────────────────────────────────────────────────
-- 2. RLS — user submits + reads OWN rows; self-verify is IMPOSSIBLE.
--    RLS cannot restrict WHICH columns are written, so each writable policy pins the resulting row
--    to status='pending' with every privileged field at its empty default. The UPDATE USING clause
--    further restricts writes to CURRENTLY-pending rows, so once CP6a-2 sets verified/rejected the
--    record becomes immutable to the user. Privileged writes are CP6a-2 definer RPCs (owner bypasses
--    RLS) — there is intentionally NO user/anon path to set status, verified_at, reviewed_by,
--    auto_granted, review_note, or delivered_at.
-- ───────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE "public"."book_ownership_verifications" ENABLE ROW LEVEL SECURITY;

-- SELECT: a user sees only their own rows.
CREATE POLICY "bov_select_own"
  ON "public"."book_ownership_verifications"
  FOR SELECT TO "authenticated"
  USING ("user_id" = "auth"."uid"());

-- INSERT: a user creates only their own row, and ONLY in the pending state with privileged fields
-- empty. This is what blocks self-verify-via-insert (status='verified' fails WITH CHECK).
CREATE POLICY "bov_insert_own_pending"
  ON "public"."book_ownership_verifications"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    "user_id" = "auth"."uid"()
    AND "status" = 'pending'
    AND "verified_at" IS NULL
    AND "reviewed_by" IS NULL
    AND "auto_granted" = false
    AND "review_note" IS NULL
    AND "delivered_at" IS NULL
  );

-- UPDATE: re-submit only. USING limits the target to the user's still-pending rows; WITH CHECK keeps
-- the result pending with privileged fields empty. So a user can swap proof_image_path / re-stamp a
-- pending row, but can NEVER flip status to verified/rejected, nor edit a row CP6a-2 has already
-- reviewed (those fail USING). This blocks self-verify-via-update.
CREATE POLICY "bov_update_own_pending"
  ON "public"."book_ownership_verifications"
  FOR UPDATE TO "authenticated"
  USING (
    "user_id" = "auth"."uid"()
    AND "status" = 'pending'
  )
  WITH CHECK (
    "user_id" = "auth"."uid"()
    AND "status" = 'pending'
    AND "verified_at" IS NULL
    AND "reviewed_by" IS NULL
    AND "auto_granted" = false
    AND "review_note" IS NULL
    AND "delivered_at" IS NULL
  );

-- No user DELETE policy: verification records are not user-deletable (preserves the audit/flag trail).
-- No service_role/admin policies here — CP6a-2's SECURITY DEFINER RPCs run as owner and bypass RLS.

-- ───────────────────────────────────────────────────────────────────────────────────────────────
-- 3. Private storage bucket for proof images.
--    Verification images NEVER route through recipe-images / post-images. The bucket is PRIVATE
--    (public = false): no anon/public read. A user reads ONLY their own proofs, path-scoped by the
--    first folder segment = their user id (uploadImage writes folder = userId). Admin-read-all is
--    CP6a-2.
-- ───────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO "storage"."buckets" ("id", "name", "public")
VALUES ('verification-images', 'verification-images', false)
ON CONFLICT ("id") DO NOTHING;

-- storage.objects already has RLS enabled by Supabase; we only add this bucket's policies.
CREATE POLICY "verification_images_insert_own"
  ON "storage"."objects"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    "bucket_id" = 'verification-images'
    AND ("storage"."foldername"("name"))[1] = "auth"."uid"()::text
  );

CREATE POLICY "verification_images_select_own"
  ON "storage"."objects"
  FOR SELECT TO "authenticated"
  USING (
    "bucket_id" = 'verification-images'
    AND ("storage"."foldername"("name"))[1] = "auth"."uid"()::text
  );

-- No public/anon read policy and no user update/delete policy: proofs are write-once + owner-read for
-- the F&F window. Admin-read-all + any cleanup are CP6a-2 / a later cleanup pass (see DEFERRED_WORK).
