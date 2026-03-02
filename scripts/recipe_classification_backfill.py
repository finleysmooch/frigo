#!/usr/bin/env python3
"""
Phase 3A - Recipe Classification Backfill
Classifies all recipes using Haiku: ingredient roles, flavor tags, recipe-level attributes.
Writes results back to Supabase.

Usage:
  python scripts/recipe_classification_backfill.py           # Full run
  python scripts/recipe_classification_backfill.py --dry-run  # Preview, no DB writes
  python scripts/recipe_classification_backfill.py --resume   # Skip already-classified recipes
  python scripts/recipe_classification_backfill.py --limit 5  # Process only N recipes
"""

import os
import sys
import json
import time
import re
import argparse
from pathlib import Path
from datetime import datetime

# --- Load .env ---
def load_env(filepath=".env"):
    for candidate in [Path(filepath), Path.cwd() / ".env", Path.cwd().parent / ".env", Path.home() / ".env"]:
        if candidate.exists():
            with open(candidate) as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    match = re.match(r'^([^#][^=]+)=(.*)$', line)
                    if match:
                        key = match.group(1).strip()
                        value = match.group(2).strip().strip('"').strip("'")
                        os.environ[key] = value
            print(f"Loaded env from {candidate}")
            return
    print("No .env file found — using existing environment variables")

load_env()

from anthropic import Anthropic
from supabase import create_client

# --- Config ---
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
HAIKU_MODEL = "claude-haiku-4-5-20251001"

# --- Prompt (original from test, plus course_type and make_ahead_score) ---
VIBE_TAG_OPTIONS = "comfort, fresh_light, impressive, weeknight_quick, meal_prep, budget, crowd_pleaser, adventurous, one_pot, project"

CLASSIFICATION_PROMPT = """You are classifying a recipe and its ingredients for a cooking app.

## Recipe Info
Title: {title}
Description: {description}
Cuisine: {cuisine}
Difficulty: {difficulty}
Prep time: {prep_time} min | Cook time: {cook_time} min
Servings: {servings}
Cooking methods: {cooking_methods}

## Ingredients
{ingredients_text}

## Task

Classify this recipe at TWO levels:

### 1. INGREDIENT LEVEL
For EACH ingredient listed above, provide:

- **role** — One of three tiers:
  - "hero": The 1-3 ingredients that DEFINE the dish. What you'd say if someone asked "what is this?" For "Minty Lamb Meatballs with Tahini Sauce" the heroes are lamb and tahini. NOT staples (oil, salt, pepper, garlic, onion, butter) unless they truly star — e.g., garlic in a 40-clove garlic chicken, or butter in a beurre blanc.
  - "primary": Important supporting ingredients that significantly shape the dish's character. Remove one and the dish is noticeably different. The mint in minty lamb meatballs, the cabbage in crispy cabbage, the fennel in herby peas and fennel.
  - "secondary": Background — oils, salt, spices in small amounts, garnishes, water, stock. Important for flavor but not identity.

- **flavor_tags** — Which of these 7 flavor categories does this ingredient primarily contribute? An ingredient can have 0-3 tags. Categories: sweet, salty, bitter, umami, fatty, spicy, sour.
  - Some ingredients are "neutral" (flour, water, pasta, rice) — give them an empty array [].
  - Some span multiple categories: Parmesan = ["salty", "umami"], kimchi = ["umami", "sour"], bacon = ["salty", "fatty", "umami"].
  - Think about the FLAVOR the ingredient contributes to the dish, not just what it is.

### 2. RECIPE LEVEL
- **hero_ingredients**: Array of 1-3 ingredient names (the "hero" tier items from above)
- **vibe_tags**: Pick 1-4 from: {vibe_options}
- **serving_temp**: One of: hot, warm, room_temp, cold
- **dominant_flavors**: The 2-3 most prominent flavor categories for the overall dish (from the 7: sweet, salty, bitter, umami, fatty, spicy, sour)
- **course_type**: One of: appetizer, side, main, dessert, snack, condiment, breakfast
- **make_ahead_score**: Integer 1-4:
  - 1 = Serve immediately (soufflés, fried items, tempura — quality degrades fast)
  - 2 = Serve within 30 min (most hot plated dishes, crispy elements)
  - 3 = Stores fine (reheats well, good leftovers)
  - 4 = Better next day (stews, marinated salads, braises, flavors develop over time)

## Output Format
Respond ONLY with valid JSON, no markdown backticks, no explanation:
{{
  "ingredients": [
    {{
      "original_text": "the exact original ingredient text from above",
      "role": "hero",
      "flavor_tags": ["salty", "umami"]
    }}
  ],
  "recipe": {{
    "hero_ingredients": ["lamb", "tahini"],
    "vibe_tags": ["comfort", "impressive"],
    "serving_temp": "hot",
    "dominant_flavors": ["umami", "salty", "sour"],
    "course_type": "main",
    "make_ahead_score": 3
  }}
}}

IMPORTANT: Return one entry per ingredient in the EXACT order listed above. The "original_text" must match exactly."""


def fetch_all_recipes(supabase, skip_classified=False):
    """Fetch all recipes that have ingredients."""
    query = supabase.from_("recipes").select(
        "id, title, description, cuisine_types, difficulty_level, "
        "prep_time_min, cook_time_min, servings, cooking_methods, "
        "hero_ingredients, vibe_tags, serving_temp"
    )

    result = query.order("title").execute()

    if not result.data:
        return []

    recipes = result.data

    if skip_classified:
        # Skip recipes that already have hero_ingredients set
        recipes = [r for r in recipes if not r.get("hero_ingredients") or len(r.get("hero_ingredients", [])) == 0]

    return recipes


def fetch_ingredients(supabase, recipe_id):
    """Fetch ingredients for a recipe."""
    result = supabase.from_("recipe_ingredients").select(
        "id, original_text, sequence_order, ingredient_role"
    ).eq("recipe_id", recipe_id).order("sequence_order").execute()
    return result.data or []


def format_ingredients_text(ingredients):
    lines = []
    for i, ing in enumerate(ingredients, 1):
        text = ing.get("original_text", "unknown")
        lines.append(f"{i}. {text}")
    return "\n".join(lines)


def classify_recipe(client, recipe, ingredients):
    """Call Haiku to classify a recipe."""
    ingredients_text = format_ingredients_text(ingredients)

    prompt = CLASSIFICATION_PROMPT.format(
        title=recipe.get("title", "Unknown"),
        description=recipe.get("description") or "No description",
        cuisine=", ".join(recipe.get("cuisine_types") or ["Unknown"]),
        difficulty=recipe.get("difficulty_level", "Unknown"),
        prep_time=recipe.get("prep_time_min") or "?",
        cook_time=recipe.get("cook_time_min") or "?",
        servings=recipe.get("servings") or "?",
        cooking_methods=", ".join(recipe.get("cooking_methods") or ["Unknown"]),
        ingredients_text=ingredients_text,
        vibe_options=VIBE_TAG_OPTIONS,
    )

    response = client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    result = json.loads(text)

    cost = (response.usage.input_tokens * 0.80 + response.usage.output_tokens * 4.00) / 1_000_000

    return result, cost


def write_results(supabase, recipe_id, classification, ingredients_db, dry_run=False):
    """Write classification results back to Supabase."""
    recipe_data = classification.get("recipe", {})
    ingredient_data = classification.get("ingredients", [])

    # --- Recipe-level update ---
    recipe_update = {
        "hero_ingredients": recipe_data.get("hero_ingredients", []),
        "vibe_tags": recipe_data.get("vibe_tags", []),
        "serving_temp": recipe_data.get("serving_temp"),
        "course_type": recipe_data.get("course_type"),
        "make_ahead_score": recipe_data.get("make_ahead_score"),
    }

    if dry_run:
        print(f"    [DRY RUN] Would update recipe: {json.dumps(recipe_update, indent=2)}")
    else:
        supabase.from_("recipes").update(recipe_update).eq("id", recipe_id).execute()

    # --- Ingredient-level updates ---
    # Match by original_text
    ai_map = {item["original_text"]: item for item in ingredient_data}

    matched = 0
    unmatched = 0

    for db_ing in ingredients_db:
        text = db_ing.get("original_text", "")
        ai_ing = ai_map.get(text)

        if ai_ing:
            ing_update = {
                "ingredient_classification": ai_ing.get("role", "secondary"),
                "flavor_tags": ai_ing.get("flavor_tags", []),
            }

            if dry_run:
                role = ai_ing.get("role", "?")
                flavors = ", ".join(ai_ing.get("flavor_tags", []))
                print(f"    [DRY RUN] {text[:50]:50} → {role:10} [{flavors}]")
            else:
                supabase.from_("recipe_ingredients").update(ing_update).eq("id", db_ing["id"]).execute()

            matched += 1
        else:
            unmatched += 1

    return matched, unmatched


def main():
    parser = argparse.ArgumentParser(description="Recipe Classification Backfill")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
    parser.add_argument("--resume", action="store_true", help="Skip already-classified recipes")
    parser.add_argument("--limit", type=int, default=0, help="Process only N recipes (0=all)")
    args = parser.parse_args()

    # Validate env
    missing = []
    if not SUPABASE_URL: missing.append("SUPABASE_URL")
    if not SUPABASE_KEY: missing.append("SUPABASE_KEY")
    if not ANTHROPIC_API_KEY: missing.append("ANTHROPIC_API_KEY")
    if missing:
        print(f"ERROR: Missing: {', '.join(missing)}")
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    client = Anthropic(api_key=ANTHROPIC_API_KEY)

    print("=" * 70)
    print("RECIPE CLASSIFICATION BACKFILL")
    print(f"Model: {HAIKU_MODEL}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"Resume: {args.resume}")
    print(f"Limit: {args.limit or 'all'}")
    print("=" * 70)

    # Fetch recipes
    print("\nFetching recipes...")
    recipes = fetch_all_recipes(supabase, skip_classified=args.resume)
    print(f"Found {len(recipes)} recipes to process")

    if args.limit > 0:
        recipes = recipes[:args.limit]
        print(f"Limited to {len(recipes)}")

    # Filter to only those with ingredients
    recipes_with_ings = []
    for r in recipes:
        ings = fetch_ingredients(supabase, r["id"])
        if ings:
            recipes_with_ings.append((r, ings))
        else:
            pass  # skip silently

    print(f"{len(recipes_with_ings)} recipes have ingredients\n")

    total_cost = 0
    total_matched = 0
    total_unmatched = 0
    errors = []
    results_log = []
    start_time = time.time()

    for i, (recipe, ingredients) in enumerate(recipes_with_ings):
        title = recipe.get("title", "Unknown")
        recipe_id = recipe["id"]
        n_ings = len(ingredients)

        print(f"[{i+1}/{len(recipes_with_ings)}] {title} ({n_ings} ings)...", end="", flush=True)

        try:
            # Retry up to 3 times on failure
            classification = None
            cost = 0
            for attempt in range(3):
                try:
                    classification, cost = classify_recipe(client, recipe, ingredients)
                    break
                except json.JSONDecodeError as e:
                    if attempt < 2:
                        print(f" retry {attempt+1}...", end="", flush=True)
                        time.sleep(2)
                    else:
                        raise
                except Exception as e:
                    if attempt < 2 and ("rate" in str(e).lower() or "overloaded" in str(e).lower() or "529" in str(e) or "500" in str(e)):
                        wait = (attempt + 1) * 5
                        print(f" rate limited, waiting {wait}s...", end="", flush=True)
                        time.sleep(wait)
                    else:
                        raise
            total_cost += cost

            # Validate
            ai_ings = classification.get("ingredients", [])
            recipe_level = classification.get("recipe", {})

            if len(ai_ings) != n_ings:
                print(f" ⚠️ ingredient count mismatch (AI:{len(ai_ings)} vs DB:{n_ings})", end="")

            # Write to DB
            matched, unmatched = write_results(supabase, recipe_id, classification, ingredients, dry_run=args.dry_run)
            total_matched += matched
            total_unmatched += unmatched

            heroes = ", ".join(recipe_level.get("hero_ingredients", []))
            vibes = ", ".join(recipe_level.get("vibe_tags", []))
            course = recipe_level.get("course_type", "?")
            make_ahead = recipe_level.get("make_ahead_score", "?")

            print(f" ✓ [{heroes}] {vibes} | {course} | MA:{make_ahead} | ${cost:.4f}")

            results_log.append({
                "recipe_id": recipe_id,
                "title": title,
                "heroes": recipe_level.get("hero_ingredients", []),
                "vibes": recipe_level.get("vibe_tags", []),
                "serving_temp": recipe_level.get("serving_temp"),
                "course_type": course,
                "make_ahead_score": make_ahead,
                "dominant_flavors": recipe_level.get("dominant_flavors", []),
                "ingredient_count": n_ings,
                "matched": matched,
                "unmatched": unmatched,
                "cost": round(cost, 5),
            })

        except json.JSONDecodeError as e:
            print(f" ✗ JSON error: {e}")
            errors.append({"recipe_id": recipe_id, "title": title, "error": f"JSON: {e}"})
        except Exception as e:
            print(f" ✗ Error: {e}")
            errors.append({"recipe_id": recipe_id, "title": title, "error": str(e)})

        # Rate limit: ~0.5s between calls
        if i < len(recipes_with_ings) - 1:
            time.sleep(0.5)

    elapsed = time.time() - start_time

    # --- Summary ---
    print(f"\n{'='*70}")
    print("BACKFILL COMPLETE")
    print(f"{'='*70}")
    print(f"Recipes processed: {len(recipes_with_ings)}")
    print(f"Errors:            {len(errors)}")
    print(f"Ingredients matched:   {total_matched}")
    print(f"Ingredients unmatched: {total_unmatched}")
    print(f"Total cost:        ${total_cost:.4f}")
    print(f"Time:              {elapsed/60:.1f} min")
    print(f"Avg per recipe:    {elapsed/max(len(recipes_with_ings),1):.1f}s / ${total_cost/max(len(recipes_with_ings),1):.4f}")

    if errors:
        print(f"\nERRORS ({len(errors)}):")
        for e in errors:
            print(f"  {e['title']}: {e['error']}")

    # Save log
    log_path = f"recipe_classification_backfill_{datetime.now().strftime('%Y%m%d_%H%M')}.json"
    with open(log_path, "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "model": HAIKU_MODEL,
            "dry_run": args.dry_run,
            "recipes_processed": len(recipes_with_ings),
            "errors": len(errors),
            "total_cost": round(total_cost, 4),
            "elapsed_seconds": round(elapsed, 1),
            "results": results_log,
            "error_details": errors,
        }, f, indent=2, default=str)
    print(f"\n💾 Log saved to {log_path}")


if __name__ == "__main__":
    main()