"""
Phase 5D: Haiku Batch Classification of Unmatched Ingredients
=============================================================
Sends unmatched ingredient names to Claude Haiku in batches,
asking it to either match to an existing ingredient or propose
a new one with family/type/preparation.

Outputs a CSV for Tom to review before applying to the database.

Usage:
  cd scripts/
  python classify_unmatched_ingredients.py

Expects:
  - ../.env with ANTHROPIC_API_KEY
  - ../docs/unmatched_ingredients.csv (485 rows from Supabase export)
  - ../docs/current_ingredients.csv (496 rows: id, name, family, ingredient_type)

Outputs:
  - ../docs/haiku_classification_results.csv
"""

import os
import json
import csv
import sys
import time
import re

try:
    import httpx
except ImportError:
    print("Installing httpx...")
    os.system("pip install httpx")
    import httpx

# --- Load .env from parent directory ---
env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
if os.path.exists(env_file):
    print(f"Loading environment from {env_file}")
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                value = value.strip().strip("'\"")
                os.environ.setdefault(key.strip(), value)

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("EXPO_PUBLIC_ANTHROPIC_API_KEY")
if not ANTHROPIC_API_KEY:
    print("ERROR: No ANTHROPIC_API_KEY or EXPO_PUBLIC_ANTHROPIC_API_KEY found in .env")
    sys.exit(1)

HEADERS_CLAUDE = {
    "x-api-key": ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
}

# --- Paths ---
DOCS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs")
UNMATCHED_CSV = os.path.join(DOCS_DIR, "unmatched_ingredients.csv")
CURRENT_INGREDIENTS_CSV = os.path.join(DOCS_DIR, "current_ingredients.csv")
OUTPUT_CSV = os.path.join(DOCS_DIR, "haiku_classification_results.csv")

# --- Config ---
BATCH_SIZE = 20
MODEL = "claude-haiku-4-5-20251001"
MAX_RETRIES = 3
RETRY_DELAY = 5

CANONICAL_TAXONOMY = """
Families and their valid types:
- Produce: Vegetables, Leafy Greens, Root Vegetables, Alliums, Citrus, Fruits, Gourds, Fresh Herbs, Mushrooms
- Proteins: Red Meat, Poultry, Seafood, Plant-Based Proteins
- Dairy: Fresh Dairy, Cultured Dairy, Cheese, Butter, Eggs
- Pantry: Grains, Baking, Oils & Fats, Vinegars, Condiments & Sauces, Spices & Dried Herbs, Nuts & Seeds, Dried Fruit, Canned/Jarred Goods, Legumes, Stocks & Broths, Wines & Spirits
"""


def load_unmatched(path):
    """Load unmatched ingredients, extract cleaned names, deduplicate."""
    rows = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    seen = {}
    for row in rows:
        match_notes = row.get("match_notes", "")
        original_text = row.get("original_text", "")
        title = row.get("title", "")

        if match_notes.startswith("Unmatched: "):
            cleaned = match_notes[len("Unmatched: "):]
        elif match_notes.startswith("Multi-match: "):
            cleaned = match_notes[len("Multi-match: "):]
        else:
            cleaned = original_text

        cleaned = cleaned.strip()
        if not cleaned:
            continue

        if cleaned not in seen:
            seen[cleaned] = {
                "cleaned_name": cleaned,
                "original_text": original_text,
                "recipe_examples": [title],
            }
        else:
            if title not in seen[cleaned]["recipe_examples"]:
                seen[cleaned]["recipe_examples"].append(title)

    print(f"  Loaded {len(rows)} unmatched rows -> {len(seen)} unique names")
    return list(seen.values())


def load_current_ingredients(path):
    """Load current ingredients table as context for Haiku."""
    ingredients = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            ingredients.append({
                "id": row["id"],
                "name": row["name"],
                "family": row["family"],
                "ingredient_type": row["ingredient_type"],
            })
    print(f"  Loaded {len(ingredients)} current ingredients")
    return ingredients


def build_ingredient_list_text(ingredients):
    """Format current ingredients as compact text for the prompt."""
    lines = []
    for ing in ingredients:
        itype = ing["ingredient_type"] if ing["ingredient_type"] != "null" else "—"
        lines.append(f"  {ing['name']} | {ing['family']} > {itype} | {ing['id']}")
    return "\n".join(lines)


def build_batch_prompt(batch, ingredient_list_text):
    """Build the prompt for a batch of unmatched names."""
    names_block = ""
    for i, item in enumerate(batch, 1):
        recipes = ", ".join(item["recipe_examples"][:3])
        names_block += f'{i}. "{item["cleaned_name"]}" (from: {item["original_text"][:100]}; recipes: {recipes})\n'

    return f"""You are classifying unmatched recipe ingredient entries for a cooking app database.

For each ingredient name below, decide:
1. Does it match an EXISTING ingredient in our database? (e.g., "chilled heavy cream" -> "heavy cream", "French green lentils" -> "green lentils")
2. Or should we CREATE a new ingredient entry? (e.g., "haricots verts" is genuinely missing)

IMPORTANT RULES:
- Be aggressive about matching to existing ingredients. Descriptors like "chilled", "packed", "fresh", "chopped", "frozen", "jarred" are preparation notes, not different ingredients.
- For OR patterns like "spinach or kale", identify the PRIMARY ingredient (first one) and note the alternatives.
- If the name is a specific variety of something we have (e.g., "French green lentils" and we have "green lentils"), MATCH to the existing one.
- If it's a genuinely different ingredient not in our list (e.g., "haricots verts", "palm sugar", "ancho chile"), recommend CREATE.
- For new ingredients, assign family and type from the canonical taxonomy.
- Extract preparation/packaging notes (frozen, jarred, chopped, etc.) into the preparation field.
- The "cleaned_name" has already had quantities stripped. Focus on the ingredient identity.

CANONICAL TAXONOMY:
{CANONICAL_TAXONOMY}

CURRENT INGREDIENTS IN DATABASE (name | family > type | id):
{ingredient_list_text}

UNMATCHED NAMES TO CLASSIFY:
{names_block}

Respond with ONLY a JSON array. Each element must have these fields:
- "index": the number from the list above
- "cleaned_name": the input name exactly as given
- "action": "match_existing" or "create_new"
- "matched_id": existing ingredient UUID if matching (null if creating)
- "matched_name": existing ingredient name if matching (null if creating)
- "new_name": canonical name for new ingredient if creating (null if matching). Lowercase, no descriptors.
- "family": family for new ingredient (null if matching)
- "ingredient_type": type for new ingredient (null if matching)
- "preparation": extracted prep/packaging notes (e.g., "frozen", "chopped", "jarred roasted"). Can be null.
- "or_alternatives": if OR pattern, list alternative ingredient names as array. Null otherwise.
- "confidence": "high", "medium", or "low"
- "notes": brief explanation of your reasoning

Return ONLY the JSON array, no markdown fences, no other text."""


def call_haiku(prompt):
    """Call the Anthropic API with retries."""
    body = {
        "model": MODEL,
        "max_tokens": 8192,
        "messages": [{"role": "user", "content": prompt}],
    }

    for attempt in range(MAX_RETRIES):
        try:
            resp = httpx.post(
                "https://api.anthropic.com/v1/messages",
                headers=HEADERS_CLAUDE,
                json=body,
                timeout=120,
            )
            resp.raise_for_status()
            result = resp.json()

            usage = result.get("usage", {})
            cost = (usage.get("input_tokens", 0) * 0.25 + usage.get("output_tokens", 0) * 1.25) / 1_000_000

            text = ""
            for block in result.get("content", []):
                if block.get("type") == "text":
                    text += block["text"]
            return text, cost

        except httpx.HTTPStatusError as e:
            if e.response.status_code in (429, 529):
                wait = RETRY_DELAY * (attempt + 1)
                print(f"    Rate limited ({e.response.status_code}), waiting {wait}s... (attempt {attempt+1}/{MAX_RETRIES})")
                time.sleep(wait)
            else:
                print(f"    HTTP {e.response.status_code}: {e.response.text[:200]}")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY)
                else:
                    raise
        except Exception as e:
            print(f"    Error: {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY)
            else:
                raise

    return None, 0.0


def parse_haiku_response(response_text):
    """Parse JSON from Haiku response, handling common formatting issues."""
    text = response_text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    text = text.strip()
    if text.startswith("json"):
        text = text[4:].strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\[[\s\S]*\]", text)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        print(f"    JSON parse error")
        print(f"    First 200 chars: {text[:200]}")
        return None


def main():
    print("=" * 60)
    print("Phase 5D: Haiku Batch Classification")
    print("=" * 60)

    for path, label in [(UNMATCHED_CSV, "Unmatched CSV"), (CURRENT_INGREDIENTS_CSV, "Current ingredients CSV")]:
        if not os.path.exists(path):
            print(f"ERROR: {label} not found at {path}")
            sys.exit(1)

    print("\n1. Loading data...")
    unmatched = load_unmatched(UNMATCHED_CSV)
    ingredients = load_current_ingredients(CURRENT_INGREDIENTS_CSV)
    ingredient_list_text = build_ingredient_list_text(ingredients)

    print(f"\n2. Processing {len(unmatched)} unique names in batches of {BATCH_SIZE}...")
    all_results = []
    total_batches = (len(unmatched) + BATCH_SIZE - 1) // BATCH_SIZE
    total_cost = 0.0

    for batch_idx in range(0, len(unmatched), BATCH_SIZE):
        batch = unmatched[batch_idx : batch_idx + BATCH_SIZE]
        batch_num = batch_idx // BATCH_SIZE + 1
        print(f"\n  Batch {batch_num}/{total_batches} ({len(batch)} items)...")

        prompt = build_batch_prompt(batch, ingredient_list_text)
        response, cost = call_haiku(prompt)
        total_cost += cost

        if response is None:
            print(f"    FAILED - skipping batch {batch_num}")
            for item in batch:
                all_results.append({
                    "cleaned_name": item["cleaned_name"],
                    "original_text": item["original_text"],
                    "action": "ERROR",
                    "matched_id": None,
                    "matched_name": None,
                    "new_name": None,
                    "family": None,
                    "ingredient_type": None,
                    "preparation": None,
                    "or_alternatives": None,
                    "confidence": None,
                    "notes": "API call failed",
                    "recipe_examples": "; ".join(item["recipe_examples"][:3]),
                })
            continue

        parsed = parse_haiku_response(response)
        if parsed is None:
            raw_path = os.path.join(DOCS_DIR, f"haiku_raw_batch_{batch_num}.txt")
            print(f"    PARSE FAILED - saving raw response to {raw_path}")
            with open(raw_path, "w") as f:
                f.write(response)
            for item in batch:
                all_results.append({
                    "cleaned_name": item["cleaned_name"],
                    "original_text": item["original_text"],
                    "action": "PARSE_ERROR",
                    "matched_id": None,
                    "matched_name": None,
                    "new_name": None,
                    "family": None,
                    "ingredient_type": None,
                    "preparation": None,
                    "or_alternatives": None,
                    "confidence": None,
                    "notes": f"See haiku_raw_batch_{batch_num}.txt",
                    "recipe_examples": "; ".join(item["recipe_examples"][:3]),
                })
            continue

        for result in parsed:
            idx = result.get("index", 0) - 1
            if 0 <= idx < len(batch):
                item = batch[idx]
            else:
                item = {"cleaned_name": result.get("cleaned_name", "?"), "original_text": "?", "recipe_examples": []}

            or_alt = result.get("or_alternatives")
            if isinstance(or_alt, list):
                or_alt = "; ".join(or_alt)

            all_results.append({
                "cleaned_name": result.get("cleaned_name", item["cleaned_name"]),
                "original_text": item["original_text"],
                "action": result.get("action", "unknown"),
                "matched_id": result.get("matched_id"),
                "matched_name": result.get("matched_name"),
                "new_name": result.get("new_name"),
                "family": result.get("family"),
                "ingredient_type": result.get("ingredient_type"),
                "preparation": result.get("preparation"),
                "or_alternatives": or_alt,
                "confidence": result.get("confidence"),
                "notes": result.get("notes"),
                "recipe_examples": "; ".join(item["recipe_examples"][:3]),
            })

        match_count = sum(1 for r in parsed if r.get("action") == "match_existing")
        create_count = sum(1 for r in parsed if r.get("action") == "create_new")
        print(f"    OK: {match_count} matches, {create_count} new | Cost: ${cost:.4f}")

        if batch_idx + BATCH_SIZE < len(unmatched):
            time.sleep(1)

    # Write output
    print(f"\n3. Writing results to {OUTPUT_CSV}...")
    fieldnames = [
        "cleaned_name", "original_text", "action", "matched_id", "matched_name",
        "new_name", "family", "ingredient_type", "preparation",
        "or_alternatives", "confidence", "notes", "recipe_examples",
    ]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_results)

    # Summary
    actions = {}
    confidences = {}
    for r in all_results:
        actions[r["action"]] = actions.get(r["action"], 0) + 1
        c = r.get("confidence", "unknown")
        confidences[c] = confidences.get(c, 0) + 1

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total classified: {len(all_results)}")
    for action, count in sorted(actions.items()):
        print(f"  {action}: {count}")
    print(f"\nConfidence distribution:")
    for conf, count in sorted(confidences.items()):
        print(f"  {conf}: {count}")
    print(f"\nTotal API cost: ${total_cost:.4f}")
    print(f"\nResults saved to: {OUTPUT_CSV}")
    print("Review the CSV, then bring it back to Claude for SQL generation.")


if __name__ == "__main__":
    main()
