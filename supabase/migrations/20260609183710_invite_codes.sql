-- CP2 (#69) — Invite codes: table + redemptions + validate/redeem RPCs + RLS lockdown.
--
-- Onboarding T2 gates entry on an invite code entered BEFORE account creation.
-- Pre-auth validation cannot go through RLS, so it is exposed via an anon-callable
-- SECURITY DEFINER RPC that returns a status string only (never the row). Redemption
-- is authenticated-only and atomic/race-safe/idempotent-per-user. The tables are NOT
-- directly reachable by anon/authenticated — only through the two RPCs.
--
-- Tiered push policy: CP2 is mechanical/low-risk -> CC authors AND pushes (see docs/MIGRATIONS.md).

-- ============================================================================
-- Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."invite_codes" (
    "id"         uuid        NOT NULL DEFAULT gen_random_uuid(),
    "code"       text        NOT NULL,
    "max_uses"   integer     NULL,                       -- NULL = unlimited
    "uses_count" integer     NOT NULL DEFAULT 0,
    "expires_at" timestamptz NULL,                       -- NULL = never expires
    "is_active"  boolean     NOT NULL DEFAULT true,
    "note"       text        NULL,
    "created_by" uuid        NULL REFERENCES "auth"."users"("id") ON DELETE SET NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invite_codes_code_key" UNIQUE ("code"),
    CONSTRAINT "invite_codes_uses_count_nonneg" CHECK ("uses_count" >= 0),
    CONSTRAINT "invite_codes_max_uses_positive" CHECK ("max_uses" IS NULL OR "max_uses" > 0)
);

COMMENT ON TABLE "public"."invite_codes" IS
  'F&F invite codes. Reached only via validate_invite_code (anon) / redeem_invite_code (authenticated) RPCs; no direct anon/authenticated table access. Code stored normalized (upper+trim) by trigger. Minting: see docs/INVITE_CODES.md.';

CREATE TABLE IF NOT EXISTS "public"."invite_code_redemptions" (
    "id"          uuid        NOT NULL DEFAULT gen_random_uuid(),
    "code_id"     uuid        NOT NULL REFERENCES "public"."invite_codes"("id") ON DELETE CASCADE,
    "user_id"     uuid        NOT NULL REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    "redeemed_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "invite_code_redemptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invite_code_redemptions_code_user_key" UNIQUE ("code_id", "user_id")
);

COMMENT ON TABLE "public"."invite_code_redemptions" IS
  'Lean attribution: which invite code a tester redeemed on. One row per (code, user). Used by CP7 seeded-graph. May be cut by oversight.';

-- ============================================================================
-- Normalize stored code (upper + trim) so matching is storage-independent
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."invite_codes_normalize_code"()
RETURNS "trigger"
LANGUAGE "plpgsql"
AS $$
BEGIN
  NEW.code := upper(btrim(NEW.code));
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."invite_codes_normalize_code"() OWNER TO "postgres";

CREATE TRIGGER "invite_codes_normalize_code_trg"
  BEFORE INSERT OR UPDATE OF "code" ON "public"."invite_codes"
  FOR EACH ROW EXECUTE FUNCTION "public"."invite_codes_normalize_code"();

-- ============================================================================
-- RPC: validate_invite_code (anon-callable, read-only, status only)
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."validate_invite_code"("p_code" text)
RETURNS text
LANGUAGE "plpgsql"
STABLE
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_code text := upper(btrim(p_code));
  v_row  "public"."invite_codes"%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM "public"."invite_codes" WHERE "code" = v_code;

  IF NOT FOUND OR NOT v_row.is_active THEN
    RETURN 'invalid';
  ELSIF v_row.expires_at IS NOT NULL AND v_row.expires_at < now() THEN
    RETURN 'expired';
  ELSIF v_row.max_uses IS NOT NULL AND v_row.uses_count >= v_row.max_uses THEN
    RETURN 'redeemed';
  ELSE
    RETURN 'valid';
  END IF;
END;
$$;

ALTER FUNCTION "public"."validate_invite_code"("p_code" text) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."validate_invite_code"("p_code" text) IS
  'Pre-auth invite-code check. Returns status only: invalid | expired | redeemed | valid. Never returns the row. anon-callable by design (see DEFERRED_WORK prod-security note).';

-- ============================================================================
-- RPC: redeem_invite_code (authenticated only; atomic, race-safe, idempotent/user)
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."redeem_invite_code"("p_code" text)
RETURNS boolean
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
  v_code          text := upper(btrim(p_code));
  v_user          uuid := auth.uid();
  v_code_id       uuid;
  v_redemption_id uuid;
  v_burned        uuid;
BEGIN
  -- Authenticated only. (Function is also REVOKEd from anon, but guard defensively.)
  IF v_user IS NULL THEN
    RETURN false;
  END IF;

  -- Resolve an active, non-expired code. Cap is re-checked atomically at burn time.
  SELECT "id" INTO v_code_id
  FROM "public"."invite_codes"
  WHERE "code" = v_code
    AND "is_active"
    AND ("expires_at" IS NULL OR "expires_at" > now());

  IF v_code_id IS NULL THEN
    RETURN false;  -- invalid / inactive / expired
  END IF;

  -- Claim this user's redemption slot first. The UNIQUE (code_id, user_id) makes this
  -- the idempotency gate: a repeat call by the same user conflicts -> no new row ->
  -- we return true WITHOUT burning a second use.
  INSERT INTO "public"."invite_code_redemptions" ("code_id", "user_id")
  VALUES (v_code_id, v_user)
  ON CONFLICT ("code_id", "user_id") DO NOTHING
  RETURNING "id" INTO v_redemption_id;

  IF v_redemption_id IS NULL THEN
    RETURN true;  -- already redeemed by this user -> idempotent success, no burn
  END IF;

  -- New redemption for this user: burn exactly one use, race-safe against the cap.
  -- The row lock taken by UPDATE serializes concurrent redeemers; the WHERE re-checks
  -- everything so a code that filled up (or was disabled) between resolve and burn fails.
  UPDATE "public"."invite_codes"
  SET "uses_count" = "uses_count" + 1
  WHERE "id" = v_code_id
    AND "is_active"
    AND ("expires_at" IS NULL OR "expires_at" > now())
    AND ("max_uses" IS NULL OR "uses_count" < "max_uses")
  RETURNING "id" INTO v_burned;

  IF v_burned IS NULL THEN
    -- Cap reached (or code disabled) after we claimed the slot -> undo the claim.
    DELETE FROM "public"."invite_code_redemptions" WHERE "id" = v_redemption_id;
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

ALTER FUNCTION "public"."redeem_invite_code"("p_code" text) OWNER TO "postgres";

COMMENT ON FUNCTION "public"."redeem_invite_code"("p_code" text) IS
  'Authenticated invite-code redemption. Atomic, race-safe, idempotent per user (same user re-calling returns true without burning a second use). Returns true on (new or existing) redemption, false if invalid/expired/capped.';

-- ============================================================================
-- RLS + privilege lockdown
-- ============================================================================
-- Both tables are reached ONLY through the two SECURITY DEFINER RPCs. Enable RLS
-- with NO policies (deny-all to non-bypass roles) AND revoke table privileges that
-- Supabase's default grants would otherwise hand anon/authenticated. Any future
-- in-app listing needs the deferred admin gate (see DEFERRED_WORK).

ALTER TABLE "public"."invite_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."invite_code_redemptions" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."invite_codes"            FROM "anon", "authenticated";
REVOKE ALL ON TABLE "public"."invite_code_redemptions" FROM "anon", "authenticated";

-- Functions default to EXECUTE for PUBLIC; lock that down, then grant explicitly.
REVOKE ALL ON FUNCTION "public"."validate_invite_code"("p_code" text) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."redeem_invite_code"("p_code" text)   FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."validate_invite_code"("p_code" text) TO "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."redeem_invite_code"("p_code" text)   TO "authenticated";
