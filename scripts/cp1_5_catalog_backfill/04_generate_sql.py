#!/usr/bin/env python3
"""
8D-CP1.5 Part 4 — SQL migration generator.

Reads the (Tom-reviewed) output/dispositions.csv and overwrites
docs/CC_PROMPTS/8D_CP1.5_variant_linkage_migration.sql with a BEGIN/COMMIT
migration: new-base INSERTs, base promotions, variant links, sanity guards.

CC does NOT run the SQL — Tom runs it in Supabase after reviewing.

Usage:
  python 04_generate_sql.py
"""

import csv
import sys
from pathlib import Path
from datetime import datetime, timezone

# Windows console (cp1252) chokes on non-ASCII output — emit UTF-8 instead of crashing.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

OUTPUT_DIR = Path(__file__).parent / "output"
REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATION_PATH = REPO_ROOT / "docs" / "CC_PROMPTS" / "8D_CP1.5_variant_linkage_migration.sql"
CREATED_BY = "cp1.5_haiku_backfill"


def sql_str(s):
    """Single-quote a SQL string literal, escaping embedded quotes."""
    return "'" + (s or "").replace("'", "''") + "'"


def read_dispositions():
    path = OUTPUT_DIR / "dispositions.csv"
    if not path.exists():
        print(f"ERROR: {path} not found. Run 02_classify_with_haiku.py (+ Tom review) first.")
        sys.exit(1)
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    rows = read_dispositions()

    # Defensive: one disposition per orphan id. A duplicate id with conflicting
    # dispositions would let Phase 2 + Phase 3 both touch the same row and could
    # produce a constraint violation (is_base=true AND base_ingredient_id set).
    seen = {}
    for d in rows:
        rid = d.get("id")
        if rid in seen and seen[rid] != d.get("disposition"):
            print(f"ERROR: id {rid} has conflicting dispositions "
                  f"({seen[rid]} vs {d.get('disposition')}). Fix dispositions.csv.")
            sys.exit(1)
        seen[rid] = d.get("disposition")

    promote = [d for d in rows if d.get("disposition") == "promote_to_base"]
    link_existing = [d for d in rows if d.get("disposition") == "link_to_existing_base"]
    link_new = [d for d in rows if d.get("disposition") == "link_to_new_base"]
    standalone = [d for d in rows if d.get("disposition") == "standalone"]

    # link_to_new_base targets that are NOT also a promote_to_base orphan row
    # need a fresh INSERT (a brand-new base with no existing catalog row).
    promote_names = {(d.get("name") or "").lower() for d in promote}
    new_base_inserts = {}  # name_lc -> (name, family)
    for d in link_new:
        t = (d.get("target_base_name") or "").strip()
        if t and t.lower() not in promote_names:
            new_base_inserts.setdefault(t.lower(), (t, d.get("family") or ""))

    for d in link_existing + link_new:
        if not (d.get("target_base_name") or "").strip():
            print(f"ERROR: {d.get('disposition')} row '{d.get('name')}' has no target_base_name.")
            sys.exit(1)

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    L = []
    L.append("-- 8D-CP1.5 — Catalog variant linkage migration (Haiku-classified)")
    L.append(f"-- Generated {ts} by 04_generate_sql.py from dispositions.csv ({len(rows)} rows)")
    L.append("-- Decisions: D8D-Q14 (cheese demote — shipped in Part 0), Q15 (oil), Q16, Q17, Q18.")
    L.append("--")
    L.append("-- CHECK constraints (verified 2026-05-19 via Supabase Snippet List Public CHECK")
    L.append("-- Constraints CSVs — both versions): NONE present on the ingredients table.")
    L.append("-- The invariant `NOT (is_base_ingredient = true AND base_ingredient_id IS NOT NULL)`")
    L.append("-- is currently unenforced; CP1 cleanup hand-fixed 4 contradictory rows on")
    L.append("-- 2026-05-18 (olive oil, parmesan, mozzarella, cream cheese). Part 0 Sub-op D")
    L.append("-- lifts the invariant into the schema as a CHECK constraint.")
    L.append("--")
    L.append("-- Constraint `ingredients_base_or_variant_not_both` is active as of Part 0")
    L.append("-- Sub-op D. INSERTs and UPDATEs that produce contradictory state will fail")
    L.append("-- mid-transaction. The Phase 4 sanity guards in this file run AFTER all")
    L.append("-- INSERT/UPDATE statements to provide a clean error message if so.")
    L.append("--")
    L.append("-- Idempotent: re-running is safe. INSERTs are WHERE NOT EXISTS-guarded;")
    L.append("-- UPDATEs are idempotent by nature.")
    L.append("--")
    L.append(f"-- Dispositions: promote_to_base={len(promote)}, link_to_existing_base="
             f"{len(link_existing)}, link_to_new_base={len(link_new)}, standalone={len(standalone)}.")
    L.append(f"-- Standalone rows produce NO SQL ({len(standalone)} orphans stay orphan).")
    L.append("-- Run manually in Supabase SQL editor.")
    L.append("")
    L.append("BEGIN;")
    L.append("")

    # ---- Phase 1: INSERT brand-new bases (link_to_new_base targets w/ no row) ----
    L.append("-- ============================================")
    L.append("-- Phase 1: INSERT brand-new bases")
    L.append("-- ============================================")
    L.append("-- link_to_new_base targets that are not themselves a promote_to_base orphan.")
    if new_base_inserts:
        for name, family in new_base_inserts.values():
            L.append(f"INSERT INTO ingredients (name, family, is_base_ingredient, created_by)")
            L.append(f"SELECT {sql_str(name)}, {sql_str(family)}, true, {sql_str(CREATED_BY)}")
            L.append(f"WHERE NOT EXISTS (SELECT 1 FROM ingredients")
            L.append(f"  WHERE LOWER(name) = LOWER({sql_str(name)}) AND is_base_ingredient = true);")
            L.append("-- NOTE: ingredient_type left NULL — backfill if needed.")
            L.append("")
    else:
        L.append("-- (none)")
        L.append("")

    # ---- Phase 2: UPDATE existing orphan rows → base (promote_to_base) ----
    L.append("-- ============================================")
    L.append("-- Phase 2: PROMOTE orphan rows to base (disposition=promote_to_base)")
    L.append("-- ============================================")
    if promote:
        for d in promote:
            L.append(f"UPDATE ingredients SET is_base_ingredient = true, base_ingredient_id = NULL")
            L.append(f"WHERE id = {sql_str(d.get('id'))};  -- {d.get('name')}")
    else:
        L.append("-- (none)")
    L.append("")

    # ---- Phase 3: UPDATE variant links (link_to_existing_base + link_to_new_base) ----
    L.append("-- ============================================")
    L.append("-- Phase 3: LINK variants → base_ingredient_id")
    L.append("-- ============================================")
    L.append("-- target_base_name resolved to an id at runtime, AFTER Phases 1-2 created/")
    L.append("-- promoted every base. A target that resolves to NULL leaves the orphan")
    L.append("-- unlinked (no-op) rather than erroring — surfaced by Phase 4 below.")
    linkers = link_existing + link_new
    if linkers:
        for d in linkers:
            target = d.get("target_base_name")
            L.append(f"UPDATE ingredients SET base_ingredient_id = (")
            L.append(f"  SELECT id FROM ingredients")
            L.append(f"  WHERE LOWER(name) = LOWER({sql_str(target)}) AND is_base_ingredient = true")
            L.append(f"  ORDER BY id LIMIT 1)")
            L.append(f"WHERE id = {sql_str(d.get('id'))}")
            L.append(f"  AND is_base_ingredient = false;  -- {d.get('name')} -> {target}")
    else:
        L.append("-- (none)")
    L.append("")

    # ---- Phase 4: sanity guards ----
    L.append("-- ============================================")
    L.append("-- Phase 4: Sanity guards (review output before COMMIT)")
    L.append("-- ============================================")
    L.append("-- 4a: contradictory rows — must be 0 (Sub-op D constraint also enforces this).")
    L.append("SELECT COUNT(*) AS contradictory_rows FROM ingredients")
    L.append("WHERE is_base_ingredient = true AND base_ingredient_id IS NOT NULL;")
    L.append("")
    L.append("-- 4b: dangling links — must be 0.")
    L.append("SELECT i.id, i.name FROM ingredients i")
    L.append("WHERE i.base_ingredient_id IS NOT NULL")
    L.append("  AND NOT EXISTS (SELECT 1 FROM ingredients b WHERE b.id = i.base_ingredient_id);")
    L.append("")
    L.append("-- 4c: unresolved links — orphans whose target_base_name matched no base.")
    L.append("--     Expect 0; any rows here mean a Haiku target name had no matching base.")
    targets = sorted({(d.get("target_base_name") or "").lower()
                      for d in linkers if d.get("target_base_name")})
    if targets:
        in_list = ", ".join(sql_str(t) for t in targets)
        L.append("SELECT v.id, v.name FROM ingredients v")
        L.append(f"WHERE v.id IN ({', '.join(sql_str(d.get('id')) for d in linkers)})")
        L.append("  AND v.base_ingredient_id IS NULL;")
    else:
        L.append("-- (no link rows — nothing to check)")
    L.append("")
    L.append("COMMIT;")
    L.append("")

    MIGRATION_PATH.write_text("\n".join(L), encoding="utf-8")
    print(f"Wrote migration → {MIGRATION_PATH}")
    print(f"  Phase 1 INSERT new bases:   {len(new_base_inserts)}")
    print(f"  Phase 2 promote_to_base:    {len(promote)}")
    print(f"  Phase 3 variant links:      {len(linkers)}")
    print(f"  standalone (no SQL):        {len(standalone)}")
    print("\nReview the migration, then run it in Supabase, then 05_verify.sql.")


if __name__ == "__main__":
    main()
