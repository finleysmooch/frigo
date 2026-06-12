-- Dup-Home hardening (2026-06-12): one default space per creator, DB-level.
--
-- The service bug (ensureDefaultSpace's membership check matched a JOINED
-- partner's default space, errored on .single(), discarded the error, and
-- minted a fresh Home on every spaces load for the D-ON-16 spouse cohort) is
-- fixed in spaceService same-slice; this index makes the invariant structural
-- so no future caller can recreate the damage.
--
-- Pre-scan (2026-06-12, live): 3 default spaces, zero creators with >1 —
-- the index applies cleanly. spaces is not a copied table (anchor §4.3
-- deny-list rule: no copy-set classification needed).

CREATE UNIQUE INDEX IF NOT EXISTS uniq_default_space_per_creator
  ON public.spaces (created_by)
  WHERE is_default;

COMMENT ON INDEX public.uniq_default_space_per_creator IS
  'Dup-Home guard (2026-06-12): a user may own at most one is_default space. Backstops ensureDefaultSpace / create_default_home_space against re-creation races and check-logic regressions.';
