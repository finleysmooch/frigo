#!/usr/bin/env python3
"""
8D-CP1.5 Part 2 — Haiku variant classification.

Reads output/orphans.csv + output/bases.csv. Batches orphans to Haiku, which
decides how each orphan relates to the base set. Writes output/dispositions.csv.

Usage:
  python 02_classify_with_haiku.py                 # full live run
  python 02_classify_with_haiku.py --sample 20     # first 20 orphans only
  python 02_classify_with_haiku.py --sample 3 --mock  # no API — fixture dispositions

Env (live mode): ANTHROPIC_API_KEY

Output (git-ignored):
  output/dispositions.csv — id, name, family, disposition, target_base_name, confidence, reasoning
"""

import os
import re
import csv
import sys
import json
import time
import argparse
from pathlib import Path

# Windows console (cp1252) chokes on non-ASCII output — emit UTF-8 instead of crashing.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

OUTPUT_DIR = Path(__file__).parent / "output"
DISPOSITION_COLS = ["id", "name", "family", "disposition", "target_base_name", "confidence", "reasoning"]
HAIKU_MODEL = "claude-haiku-4-5-20251001"
BATCH_SIZE = 40
VALID_DISPOSITIONS = {"link_to_existing_base", "promote_to_base", "link_to_new_base", "standalone"}
VALID_CONFIDENCE = {"high", "medium", "low"}


def load_env(filepath=".env"):
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


# ============================================
# HAIKU PROMPTS (embedded inline for grep-ability — not loaded from file)
# ============================================

SYSTEM_MSG = (
    "You are a culinary taxonomy classifier. Given an ingredient name (an "
    "\"orphan\" with no parent in our catalog) and a list of available base "
    "ingredients, decide how the orphan should be related to the base set. The "
    "goal is to enable recipe-pantry matching: if a recipe calls for X and the "
    "cook has Y, the matcher should treat them as interchangeable when X and Y "
    "share a base."
)

USER_TEMPLATE = """## Available base ingredients
Each line is `name (family)`. An orphan may only `link_to_existing_base` to one of these.
{bases_block}

## Orphans to classify ({n} of them)
Each line is `index. name [family] type=<ingredient_type> subtype=<ingredient_subtype> form=<form>`.
{orphans_block}

## Decision options (pick exactly one per orphan)
- `link_to_existing_base` — orphan is a variant of one of the bases above. Return that base's exact name in `target_base_name`.
- `promote_to_base` — orphan should itself become a base; no existing base captures it and it is common enough. `target_base_name` = null.
- `link_to_new_base` — orphan is a variant of a base that does NOT exist yet but SHOULD. Return the proposed new-base name in `target_base_name`; ALSO emit that new-base name as its own orphan row with `promote_to_base` if it appears in this batch.
- `standalone` — orphan stays an orphan; no base relationship makes sense. `target_base_name` = null.

## Decision rules
1. OIL THREE-BUCKET (D8D-Q15):
   - Cooking-fat-substitutable oils (canola, vegetable, sunflower, grapeseed, peanut, corn) -> link_to_existing_base -> `oil`.
   - Olive-oil family (EVOO, extra-virgin, light olive oil, pomace olive oil) -> link_to_existing_base -> `olive oil`.
   - Distinctive-flavor finishing oils (coconut, toasted sesame, walnut, avocado, truffle, chili oil) -> standalone. The recipe is asking for that flavor specifically.
   - Test: would a competent home cook swap this oil for plain canola in a saute without noticeable flavor change? Yes -> link. No -> standalone.
2. BRAND VARIANTS (D8D-Q17): brand-named variants link to the underlying base. Maldon/Diamond Crystal/Morton -> `salt`. Kerrygold/Plugra -> `butter`. When in doubt between brand and variant, lean link.
3. SAME-FAMILY IS NOT INTERCHANGEABLE (D8D-Q1): different cheeses do NOT share a base — cheddar, brie, feta, swiss each get promote_to_base (or link_to_existing_base to their own canonical base if one exists). Apples and oranges do not share a base. Tomatoes and tomatillos do not share a base. Substitutability is the test, not family.
4. FORM-DISTINCT ITEMS: "fresh basil" / "dried basil" / "frozen basil" all link to `basil` — the matcher annotates form mismatch itself. BUT "garlic" (fresh bulb) vs "garlic powder" (ground spice) do NOT link — different culinary roles. "frozen peas" -> link to `peas`.
5. AMBIGUITY BIAS: when confidence is low, prefer `standalone` over any link. A missed link costs an under-match; a wrong link costs a false match (worse — it erodes trust in the percentage). A human re-links later.

## Output format
Respond ONLY with valid JSON, no markdown fences, no commentary:
{{"dispositions": [
  {{"id": "<orphan id>", "name": "<orphan name>", "disposition": "link_to_existing_base", "target_base_name": "salt", "confidence": "high", "reasoning": "<one sentence>"}}
]}}
Return exactly one entry per orphan, in the order listed. `confidence` is one of high/medium/low. `target_base_name` is null for promote_to_base and standalone."""


def build_user_prompt(batch, bases):
    bases_block = "\n".join(f"- {b['name']} ({b.get('family') or '?'})" for b in bases)
    orphans_block = "\n".join(
        f"{i}. {o['name']} [{o.get('family') or '?'}] "
        f"type={o.get('ingredient_type') or '-'} "
        f"subtype={o.get('ingredient_subtype') or '-'} "
        f"form={o.get('form') or '-'}"
        for i, o in enumerate(batch, 1)
    )
    return USER_TEMPLATE.format(bases_block=bases_block, orphans_block=orphans_block, n=len(batch))


def parse_response(text):
    """Strip optional markdown fences, parse JSON, return the dispositions list."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    data = json.loads(text)
    return data["dispositions"] if isinstance(data, dict) else data


def validate_batch(dispositions, batch):
    """Raise ValueError on a schema violation so the caller can retry."""
    if len(dispositions) != len(batch):
        raise ValueError(f"count mismatch: got {len(dispositions)}, expected {len(batch)}")
    for d in dispositions:
        if d.get("disposition") not in VALID_DISPOSITIONS:
            raise ValueError(f"bad disposition: {d.get('disposition')} for {d.get('name')}")
        if d.get("confidence") not in VALID_CONFIDENCE:
            raise ValueError(f"bad confidence: {d.get('confidence')} for {d.get('name')}")
        if d.get("disposition") in ("link_to_existing_base", "link_to_new_base") and not d.get("target_base_name"):
            raise ValueError(f"missing target_base_name for {d.get('name')}")


# ---- Mock Haiku (fixture responses — exercises parse + CSV path without API) ----
def mock_haiku_response(batch):
    """Deterministic keyword rules — returns the same JSON string shape Haiku emits."""
    out = []
    for o in batch:
        n = (o["name"] or "").lower()
        if any(k in n for k in ("toasted sesame", "coconut", "walnut oil", "avocado oil", "truffle", "chili oil")):
            disp, target, conf = "standalone", None, "high"
            reason = "Distinctive-flavor finishing oil; not a cooking-fat swap (D8D-Q15)."
        elif "olive oil" in n:
            disp, target, conf = "link_to_existing_base", "olive oil", "high"
            reason = "Olive-oil family variant (D8D-Q15)."
        elif "oil" in n:
            disp, target, conf = "link_to_existing_base", "oil", "medium"
            reason = "Cooking-fat-substitutable oil (D8D-Q15)."
        elif "salt" in n:
            disp, target, conf = "link_to_existing_base", "salt", "high"
            reason = "Salt variant; cooking-interchangeable (D8D-Q17)."
        elif "vinegar" in n:
            disp, target, conf = "link_to_existing_base", "vinegar", "high"
            reason = "Vinegar-family variant."
        elif "chicken" in n:
            disp, target, conf = "link_to_existing_base", "chicken", "high"
            reason = "Chicken cut; links to chicken base."
        elif "powder" in n:
            disp, target, conf = "standalone", None, "medium"
            reason = "Ground-spice role distinct from the fresh ingredient (D8D-Q1 rule 4)."
        else:
            disp, target, conf = "standalone", None, "low"
            reason = "No clear base; ambiguity bias to standalone (D8D-Q15 rule 5)."
        out.append({"id": o["id"], "name": o["name"], "disposition": disp,
                    "target_base_name": target, "confidence": conf, "reasoning": reason})
    return json.dumps({"dispositions": out})


def classify_batch(batch, bases, client, mock):
    """Returns (dispositions list, cost). Retries once on schema violation."""
    for attempt in range(2):
        try:
            if mock:
                text = mock_haiku_response(batch)
                cost = 0.0
            else:
                resp = client.messages.create(
                    model=HAIKU_MODEL,
                    max_tokens=4000,
                    system=SYSTEM_MSG,
                    messages=[{"role": "user", "content": build_user_prompt(batch, bases)}],
                )
                text = resp.content[0].text
                cost = (resp.usage.input_tokens * 0.80 + resp.usage.output_tokens * 4.00) / 1_000_000
            dispositions = parse_response(text)
            validate_batch(dispositions, batch)
            return dispositions, cost
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            if attempt == 0:
                print(f"  [warn] schema violation ({e}) - retrying once...")
                time.sleep(2)
            else:
                raise RuntimeError(f"SETUP-FAIL: batch failed schema validation twice — {e}")


def read_csv(path):
    if not path.exists():
        print(f"ERROR: {path} not found. Run 01_discovery.py first.")
        sys.exit(1)
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    parser = argparse.ArgumentParser(description="CP1.5 Part 2 — Haiku classification")
    parser.add_argument("--sample", type=int, default=0, help="Classify only first N orphans (0=all)")
    parser.add_argument("--mock", action="store_true", help="No API — deterministic fixture dispositions")
    args = parser.parse_args()

    print("=" * 70)
    print("CP1.5 PART 2 — HAIKU VARIANT CLASSIFICATION")
    print(f"Model: {HAIKU_MODEL}")
    print(f"Mode: {'MOCK (no API)' if args.mock else 'LIVE'}  Sample: {args.sample or 'all'}")
    print("=" * 70)

    orphans = read_csv(OUTPUT_DIR / "orphans.csv")
    bases = read_csv(OUTPUT_DIR / "bases.csv")
    if args.sample > 0:
        orphans = orphans[:args.sample]
    print(f"Orphans to classify: {len(orphans)}   Bases in context: {len(bases)}")

    client = None
    if not args.mock:
        load_env()
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            print("ERROR: ANTHROPIC_API_KEY required for live mode (or use --mock).")
            sys.exit(1)
        from anthropic import Anthropic
        client = Anthropic(api_key=api_key)

    all_dispositions, total_cost = [], 0.0
    for start in range(0, len(orphans), BATCH_SIZE):
        batch = orphans[start:start + BATCH_SIZE]
        print(f"  batch {start // BATCH_SIZE + 1}: orphans {start + 1}-{start + len(batch)}...", flush=True)
        dispositions, cost = classify_batch(batch, bases, client, args.mock)
        # Carry family through from the orphan row (Haiku doesn't echo it).
        fam_by_id = {o["id"]: o.get("family") for o in batch}
        for d in dispositions:
            d["family"] = fam_by_id.get(d["id"], "")
        all_dispositions.extend(dispositions)
        total_cost += cost
        if not args.mock and start + BATCH_SIZE < len(orphans):
            time.sleep(0.5)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / "dispositions.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=DISPOSITION_COLS)
        w.writeheader()
        for d in all_dispositions:
            w.writerow({c: d.get(c) for c in DISPOSITION_COLS})

    by_disp, by_conf = {}, {}
    for d in all_dispositions:
        by_disp[d["disposition"]] = by_disp.get(d["disposition"], 0) + 1
        by_conf[d["confidence"]] = by_conf.get(d["confidence"], 0) + 1

    print(f"\nWrote {len(all_dispositions)} dispositions → {out_path}")
    print("By disposition:")
    for k in sorted(by_disp):
        print(f"  {k:24} {by_disp[k]}")
    print("By confidence:")
    for k in ("high", "medium", "low"):
        print(f"  {k:8} {by_conf.get(k, 0)}")
    print(f"Estimated API cost: ${total_cost:.4f}")
    print("\nNext: python 03_render_review.py")


if __name__ == "__main__":
    main()
