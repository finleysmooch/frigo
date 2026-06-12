-- CP-spaces (GATED; pre-approved to author 2026-06-12, matrix ratified as-is).
-- Fixes the two shared-pantries prod bugs exposed by the CP9 spouse-case harness:
--
-- Bug A: public.check_space_permission NEVER EXISTED (0 hits in the CP1
--   baseline; spaceService.checkPermission called it, swallowed the PGRST202,
--   returned false) -> every permission-gated space operation failed closed
--   (invite/remove/role-change/settings/delete).
-- Bug B: two space_members policies ("Owners remove members" DELETE, "Owners
--   update memberships" UPDATE) inlined SELF-REFERENCING subqueries on
--   space_members -> 42P17 infinite recursion on ANY authenticated
--   UPDATE/DELETE of the table (accepting an invitation was impossible).
--
-- Policy sweep (rider 3): space_members policies exist ONLY in the baseline
-- (no later migration touches them); of the 7, exactly these two self-reference.
-- The SELECT/INSERT policies already use the SECURITY DEFINER helper pattern
-- (get_user_space_ids) -- this migration extends that same pattern.

-- ============================================================================
-- 1. Owner-spaces definer helper (same shape as get_user_space_ids)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_owner_space_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT space_id FROM space_members
  WHERE user_id = p_user_id AND role = 'owner' AND status = 'accepted';
$$;

COMMENT ON FUNCTION public.get_user_owner_space_ids(uuid) IS
  'CP-spaces: definer helper for space_members owner policies (breaks the RLS self-reference that caused 42P17). Mirrors get_user_space_ids but owner-only.';

REVOKE ALL ON FUNCTION public.get_user_owner_space_ids(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_owner_space_ids(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_owner_space_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_owner_space_ids(uuid) TO service_role;

-- ============================================================================
-- 2. Recreate the two recursive policies — SAME INTENT, definer mechanism
--    (rider 3: same-intent recreate confirmed at pre-review)
-- ============================================================================

DROP POLICY IF EXISTS "Owners remove members" ON public.space_members;
CREATE POLICY "Owners remove members" ON public.space_members
  FOR DELETE
  USING (space_id IN (SELECT public.get_user_owner_space_ids(auth.uid())));

DROP POLICY IF EXISTS "Owners update memberships" ON public.space_members;
CREATE POLICY "Owners update memberships" ON public.space_members
  FOR UPDATE
  USING (space_id IN (SELECT public.get_user_owner_space_ids(auth.uid())));

-- ============================================================================
-- 3. check_space_permission — the server-truth permission matrix
--    (RATIFIED AS-IS 2026-06-12, mirrors lib/types/space.ts getSpacePermissions:
--     owner -> all; member -> view/add_item/delete_item/invite_guest;
--     guest -> view/add_item. Owner-only canInviteMembers STANDS; "should
--     members invite members?" banked as a DEFERRED product question.)
--    Plus the ratified last-owner-can't-leave guard as action 'leave'.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_space_permission(
  p_space_id uuid,
  p_user_id uuid,
  p_action text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_owner_count integer;
BEGIN
  -- D-ON-18 self-or-service guard (post-review rider): an AUTHENTICATED caller
  -- may only check their own permissions — p_user_id must be auth.uid().
  -- service_role / internal callers have no uid (auth.uid() IS NULL) and may
  -- check anyone. Fail closed, no error: a cross-user probe just gets false.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN false;
  END IF;

  SELECT role INTO v_role
    FROM space_members
   WHERE space_id = p_space_id
     AND user_id = p_user_id
     AND status = 'accepted';

  IF v_role IS NULL THEN
    RETURN false;  -- non-members can do nothing
  END IF;

  CASE p_action
    WHEN 'view', 'add_item' THEN
      RETURN true;
    WHEN 'delete_item', 'invite_guest' THEN
      RETURN v_role IN ('owner', 'member');
    WHEN 'edit_settings', 'invite_member', 'remove_member', 'delete_space' THEN
      RETURN v_role = 'owner';
    WHEN 'leave' THEN
      -- Last-owner guard: the sole owner of a space cannot leave it.
      IF v_role <> 'owner' THEN
        RETURN true;
      END IF;
      SELECT count(*) INTO v_owner_count
        FROM space_members
       WHERE space_id = p_space_id AND role = 'owner' AND status = 'accepted';
      RETURN v_owner_count > 1;
    ELSE
      RETURN false;  -- unknown action: fail closed
  END CASE;
END;
$$;

COMMENT ON FUNCTION public.check_space_permission(uuid, uuid, text) IS
  'CP-spaces: server-truth space permission matrix (ratified 2026-06-12, D-ON-18; mirrors lib/types/space.ts getSpacePermissions) + last-owner-cannot-leave guard. SELF-OR-SERVICE: authenticated callers can only check themselves (auth.uid() = p_user_id); service/internal (no uid) can check anyone. Unknown actions and cross-user probes fail closed.';

REVOKE ALL ON FUNCTION public.check_space_permission(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_space_permission(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_space_permission(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_space_permission(uuid, uuid, text) TO service_role;
