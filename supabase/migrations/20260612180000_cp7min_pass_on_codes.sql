-- CP7-minimal (D-ON-11 as amended + D-ON-17): per-user pass-on invite codes
-- + share-my-pantry intent.
--
-- Adds: invite_codes.owner_user_id (whose pass-on code this is — DISTINCT from
-- created_by, which records the minter incl. admin-minted cluster codes; for
-- pass-on codes the two coincide) + invite_codes.share_default_space (D-ON-17
-- intent flag; meaningful only with owner_user_id; cluster codes unaffected).
-- New RPCs: generate_pass_on_code (authenticated; returns the caller's active
-- pass-on code, minting one if needed) + deactivate_my_pass_on_code.
-- REPLACES redeem_invite_code: same body + the D-ON-17 hook (idempotent pending
-- space_members invitation from the code owner on redemption of a flagged code).
--
-- Deny-list note (anchor §4.3): invite_codes is not a copied table — n/a.
-- Default redemption cap for pass-on codes: 5 (flagged for content review —
-- a config-style choice, changeable by UPDATE, no rebuild).

-- ============================================================================
-- 1. Columns
-- ============================================================================

ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS owner_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS share_default_space boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.invite_codes.owner_user_id IS
  'D-ON-11: the user whose pass-on code this is (attribution tree root: owner -> code -> redemptions). NULL for admin-minted cluster codes. Distinct from created_by (the minter).';
COMMENT ON COLUMN public.invite_codes.share_default_space IS
  'D-ON-17: share-my-pantry intent. On redemption, the redeem RPC creates an idempotent pending space_members invitation (role member) from owner_user_id. Meaningful only with owner_user_id.';

CREATE INDEX IF NOT EXISTS idx_invite_codes_owner ON public.invite_codes (owner_user_id)
  WHERE owner_user_id IS NOT NULL;

-- ============================================================================
-- 2. generate_pass_on_code — authenticated; one active pass-on code per owner
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_pass_on_code(p_share_pantry boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_code text;
  v_try  integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- Existing usable pass-on code? Return it (and update the share intent —
  -- the T5 toggle drives this flag).
  SELECT code INTO v_code
    FROM invite_codes
   WHERE owner_user_id = v_user
     AND is_active
     AND (expires_at IS NULL OR expires_at > now())
     AND (max_uses IS NULL OR uses_count < max_uses)
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_code IS NOT NULL THEN
    UPDATE invite_codes SET share_default_space = p_share_pantry
     WHERE code = v_code AND share_default_space IS DISTINCT FROM p_share_pantry;
    RETURN v_code;
  END IF;

  -- Mint: FRIGO-XXXXX, retrying on the (unlikely) code collision.
  LOOP
    v_try := v_try + 1;
    v_code := 'FRIGO-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    BEGIN
      INSERT INTO invite_codes (code, max_uses, owner_user_id, created_by, share_default_space, note)
      VALUES (v_code, 5, v_user, v_user, p_share_pantry, 'pass-on code (CP7-minimal)');
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      IF v_try >= 5 THEN
        RAISE;
      END IF;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.generate_pass_on_code(boolean) IS
  'CP7-minimal (D-ON-11): returns the caller''s active pass-on code, minting FRIGO-XXXXX (cap 5) if none. Updates the D-ON-17 share-my-pantry intent on the existing code when re-called.';

REVOKE ALL ON FUNCTION public.generate_pass_on_code(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_pass_on_code(boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.generate_pass_on_code(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_pass_on_code(boolean) TO service_role;

-- ============================================================================
-- 3. deactivate_my_pass_on_code
-- ============================================================================

CREATE OR REPLACE FUNCTION public.deactivate_my_pass_on_code()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_n integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN false;
  END IF;
  UPDATE invite_codes SET is_active = false
   WHERE owner_user_id = v_user AND is_active;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;

COMMENT ON FUNCTION public.deactivate_my_pass_on_code() IS
  'CP7-minimal (D-ON-11): deactivates the caller''s active pass-on code(s).';

REVOKE ALL ON FUNCTION public.deactivate_my_pass_on_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deactivate_my_pass_on_code() FROM anon;
GRANT EXECUTE ON FUNCTION public.deactivate_my_pass_on_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_my_pass_on_code() TO service_role;

-- ============================================================================
-- 4. redeem_invite_code — REPLACED: exact CP2 body + the D-ON-17 hook.
--    Existing grants survive CREATE OR REPLACE (authenticated-only since
--    20260609184359); no grant changes here.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.redeem_invite_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code          text := upper(btrim(p_code));
  v_user          uuid := auth.uid();
  v_code_id       uuid;
  v_redemption_id uuid;
  v_burned        uuid;
  v_owner         uuid;
  v_share         boolean;
  v_target        uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN false;
  END IF;

  SELECT id INTO v_code_id
  FROM invite_codes
  WHERE code = v_code
    AND is_active
    AND (expires_at IS NULL OR expires_at > now());

  IF v_code_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO invite_code_redemptions (code_id, user_id)
  VALUES (v_code_id, v_user)
  ON CONFLICT (code_id, user_id) DO NOTHING
  RETURNING id INTO v_redemption_id;

  IF v_redemption_id IS NULL THEN
    -- Already redeemed by this user: idempotent success, no burn. The D-ON-17
    -- hook still runs (WHERE NOT EXISTS makes it idempotent and self-healing
    -- if the first pass couldn't resolve a target space).
    PERFORM 1;
  ELSE
    UPDATE invite_codes
    SET uses_count = uses_count + 1
    WHERE id = v_code_id
      AND is_active
      AND (expires_at IS NULL OR expires_at > now())
      AND (max_uses IS NULL OR uses_count < max_uses)
    RETURNING id INTO v_burned;

    IF v_burned IS NULL THEN
      DELETE FROM invite_code_redemptions WHERE id = v_redemption_id;
      RETURN false;
    END IF;
  END IF;

  -- ========================================================================
  -- D-ON-17 share-my-pantry hook. Target space resolved AT REDEMPTION:
  -- the owner's ACTIVE space IF the owner holds the owner role there
  -- (the model's roles are owner/member/guest — "owner/admin" in the ruling
  -- maps to 'owner'), else the owner's own default space. Pending MEMBER
  -- invitation from the owner; idempotent via WHERE NOT EXISTS (no unique
  -- constraint exists on (space_id, user_id)).
  -- ========================================================================
  SELECT owner_user_id, share_default_space INTO v_owner, v_share
    FROM invite_codes WHERE id = v_code_id;

  IF v_share AND v_owner IS NOT NULL AND v_owner <> v_user THEN
    SELECT uas.active_space_id INTO v_target
      FROM user_active_space uas
      JOIN space_members sm
        ON sm.space_id = uas.active_space_id
       AND sm.user_id = v_owner
       AND sm.role = 'owner'
       AND sm.status = 'accepted'
     WHERE uas.user_id = v_owner;

    IF v_target IS NULL THEN
      SELECT s.id INTO v_target
        FROM spaces s
        JOIN space_members sm
          ON sm.space_id = s.id
         AND sm.user_id = v_owner
         AND sm.role = 'owner'
         AND sm.status = 'accepted'
       WHERE s.is_default
       LIMIT 1;
    END IF;

    IF v_target IS NOT NULL THEN
      INSERT INTO space_members (space_id, user_id, role, invited_by, status)
      SELECT v_target, v_user, 'member', v_owner, 'pending'
      WHERE NOT EXISTS (
        SELECT 1 FROM space_members
        WHERE space_id = v_target AND user_id = v_user
      );
    END IF;
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.redeem_invite_code(p_code text) IS
  'Authenticated invite-code redemption. Atomic, race-safe, idempotent per user. CP7-minimal: on redemption of a share_default_space code, additionally creates an idempotent pending space_members invitation (role member) from the code owner — target = owner''s active space if owner-role there, else owner''s default (D-ON-17).';
