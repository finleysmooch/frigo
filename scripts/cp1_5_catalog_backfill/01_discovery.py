#!/usr/bin/env python3
"""
8D-CP1.5 Part 1 — Catalog orphan discovery.

Enumerates the post-Part-0 catalog: orphan ingredients (is_base_ingredient=false
AND base_ingredient_id IS NULL) and the base set (is_base_ingredient=true).
Writes two CSVs that the Haiku classifier (Part 2) consumes.

Run Part 0 (docs/CC_PROMPTS/8D_CP1.5_base_set_corrections.sql) in Supabase FIRST.

Usage:
  python 01_discovery.py            # live — reads Supabase
  python 01_discovery.py --mock     # no DB — writes a small fixture dataset

Env (live mode): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  Service role needed: the ingredients catalog is RLS-restricted for writes;
  reads work with anon too, but we mirror the write-capable key for consistency.

Outputs (git-ignored):
  output/orphans.csv  — id, name, family, ingredient_type, ingredient_subtype, form, plural_name
  output/bases.csv    — id, name, family, ingredient_type
"""

import os
import re
import csv
import sys
import argparse
from pathlib import Path

# Windows console (cp1252) chokes on non-ASCII output — emit UTF-8 instead of crashing.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

OUTPUT_DIR = Path(__file__).parent / "output"
ORPHAN_COLS = ["id", "name", "family", "ingredient_type", "ingredient_subtype", "form", "plural_name"]
BASE_COLS = ["id", "name", "family", "ingredient_type"]


def load_env(filepath=".env"):
    """Mirror of scripts/recipe_classification_backfill.py — finds + loads .env."""
    for candidate in [Path(filepath), Path.cwd() / ".env", Path.cwd().parent / ".env",
                      Path(__file__).resolve().parents[2] / ".env", Path.home() / ".env"]:
        if candidate.exists():
            with open(candidate) as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    m = re.match(r'^([^#][^=]+)=(.*)$', line)
                    if m:
                        os.environ[m.group(1).strip()] = m.group(2).strip().strip('"').strip("'")
            print(f"Loaded env from {candidate}")
            return
    print("No .env file found — using existing environment variables")


# ---- Mock fixtures (used by --mock; representative of real catalog rows) ----
MOCK_ORPHANS = [
    {"id": "o1", "name": "extra-virgin olive oil", "family": "Pantry", "ingredient_type": "oil", "ingredient_subtype": None, "form": "liquid", "plural_name": None},
    {"id": "o2", "name": "canola oil", "family": "Pantry", "ingredient_type": "oil", "ingredient_subtype": None, "form": "liquid", "plural_name": None},
    {"id": "o3", "name": "toasted sesame oil", "family": "Pantry", "ingredient_type": "oil", "ingredient_subtype": None, "form": "liquid", "plural_name": None},
    {"id": "o4", "name": "kosher salt", "family": "Pantry", "ingredient_type": "seasoning", "ingredient_subtype": None, "form": None, "plural_name": None},
    {"id": "o5", "name": "Maldon salt", "family": "Pantry", "ingredient_type": "seasoning", "ingredient_subtype": None, "form": None, "plural_name": None},
    {"id": "o6", "name": "chicken breast", "family": "Proteins", "ingredient_type": "meat", "ingredient_subtype": None, "form": None, "plural_name": "chicken breasts"},
    {"id": "o7", "name": "white wine vinegar", "family": "Pantry", "ingredient_type": "vinegar", "ingredient_subtype": None, "form": "liquid", "plural_name": None},
    {"id": "o8", "name": "garlic powder", "family": "Pantry", "ingredient_type": "spice", "ingredient_subtype": None, "form": "ground", "plural_name": None},
]
MOCK_BASES = [
    {"id": "b1", "name": "olive oil", "family": "Pantry", "ingredient_type": "oil"},
    {"id": "b2", "name": "oil", "family": "Pantry", "ingredient_type": "oil"},
    {"id": "b3", "name": "salt", "family": "Pantry", "ingredient_type": "seasoning"},
    {"id": "b4", "name": "vinegar", "family": "Pantry", "ingredient_type": "vinegar"},
    {"id": "b5", "name": "chicken", "family": "Proteins", "ingredient_type": "meat"},
    {"id": "b6", "name": "garlic powder", "family": "Pantry", "ingredient_type": "spice"},
]


def fetch_all(supabase, select_cols, apply_filters):
    """Paginated fetch — supabase-py caps a single response at 1000 rows."""
    rows, offset, page = [], 0, 1000
    while True:
        q = supabase.from_("ingredients").select(select_cols)
        q = apply_filters(q)
        result = q.range(offset, offset + page - 1).execute()
        batch = result.data or []
        rows.extend(batch)
        if len(batch) < page:
            break
        offset += page
    return rows


def discover_live():
    from supabase import create_client
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON) required for live mode.")
        sys.exit(1)
    supabase = create_client(url, key)

    orphans = fetch_all(
        supabase,
        "id, name, family, ingredient_type, ingredient_subtype, form, plural_name",
        lambda q: q.eq("is_base_ingredient", False).is_("base_ingredient_id", "null"),
    )
    bases = fetch_all(
        supabase,
        "id, name, family, ingredient_type",
        lambda q: q.eq("is_base_ingredient", True),
    )
    return orphans, bases


def write_csv(path, cols, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c) for c in cols})


def main():
    parser = argparse.ArgumentParser(description="CP1.5 Part 1 — orphan discovery")
    parser.add_argument("--mock", action="store_true", help="No DB — write fixture dataset")
    args = parser.parse_args()

    print("=" * 70)
    print("CP1.5 PART 1 — CATALOG ORPHAN DISCOVERY")
    print(f"Mode: {'MOCK (fixtures)' if args.mock else 'LIVE (Supabase)'}")
    print("=" * 70)

    if args.mock:
        orphans, bases = MOCK_ORPHANS, MOCK_BASES
    else:
        load_env()
        orphans, bases = discover_live()

    write_csv(OUTPUT_DIR / "orphans.csv", ORPHAN_COLS, orphans)
    write_csv(OUTPUT_DIR / "bases.csv", BASE_COLS, bases)

    # Console summary: orphan count by family.
    by_family = {}
    for o in orphans:
        by_family[o.get("family") or "(none)"] = by_family.get(o.get("family") or "(none)", 0) + 1

    print(f"\nOrphans:  {len(orphans)}  -> {OUTPUT_DIR / 'orphans.csv'}")
    print(f"Bases:    {len(bases)}  -> {OUTPUT_DIR / 'bases.csv'}")
    print("\nOrphan count by family:")
    for fam in sorted(by_family):
        print(f"  {fam:14} {by_family[fam]}")
    print("\nNext: python 02_classify_with_haiku.py [--sample N] [--mock]")


if __name__ == "__main__":
    main()
