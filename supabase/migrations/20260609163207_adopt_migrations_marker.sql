-- CP1 (P7-23): forward-loop proof migration.
-- Inert + reversible: sets a comment on the public schema to prove the
-- author -> db push -> tracked-in-remote-history cycle works end to end.
-- Mutates no schema structure (a schema COMMENT only). Safe to keep.
-- To revert: COMMENT ON SCHEMA "public" IS 'standard public schema';
COMMENT ON SCHEMA "public" IS 'migrations adopted 2026-06-09 (P7-23 baseline 20260609155555)';
