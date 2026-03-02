#!/usr/bin/env python3
"""
Phase 3A - Recipe Classification Test Script
Tests Haiku vs Sonnet on ingredient-level and recipe-level tagging.

Loads credentials from .env file (same as gold-standards test).

Usage:
  pip install anthropic supabase --break-system-packages
  python3 recipe_classification_test.py
"""

import os
import json
import time
import re
from pathlib import Path

# --- Load .env file (same pattern as gold-standards.ps1) ---
def load_env(filepath=".env"):
    """Load environment variables from .env file."""
    env_path = Path(filepath)
    if not env_path.exists():
        # Try parent directories
        for parent in [Path.cwd(), Path.cwd().parent, Path.home()]:
            candidate = parent / ".env"
            if candidate.exists():
                env_path = candidate
                break
    
    if env_path.exists():
        print(f"Loading environment from {env_path}")
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                match = re.match(r'^([^#][^=]+)=(.*)$', line)
                if match:
                    key = match.group(1).strip()
                    value = match.group(2).strip().strip('"').strip("'")
                    os.environ[key] = value
    else:
        print("No .env file found — using existing environment variables")

load_env()

# --- Now import after env is loaded ---
from anthropic import Anthropic
from supabase import create_client

# --- Config ---
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_KEY")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")

HAIKU_MODEL = "claude-haiku-4-5-20251001"
SONNET_MODEL = "claude-sonnet-4-5-20250929"

# --- Test Recipes (verified UUIDs from DB) ---
TEST_RECIPE_IDS = [
    # Plenty (Ottolenghi)
    ("7795b363-6395-4ff0-baaa-4bedbd8515a5", "Surprise Tatin"),
    ("057f25b9-5cde-4ee7-b261-942c0ff691db", "Tamara's Ratatouille"),
    ("4b23d19d-8e50-4919-bfcf-488cedb67299", "Mixed Grill with Parsley Oil"),
    ("e007f86d-bfbe-4a32-8a02-c431f4d6a4df", "Shakshuka"),
    ("af450496-66d5-469a-8e36-78379a0668e2", "Sweet Winter Slaw"),
    # Cook This Book (Molly Baz)
    ("93109a77-4356-43c3-afd3-475efa2fadee", "Crispy McCrisperson Chicken Thighs"),
    ("062fbde9-ee1d-4842-84f1-5e07f64b122c", "Minty Lamb Meatballs"),
    ("2e63cbeb-d072-4410-90f6-2353f9997471", "Marinated Lentils with Spiced Walnuts"),
    ("b43aa571-2fe6-4ba8-a97f-badd2edafb22", "One-Pot Chicken & Schmaltzy Rice"),
    ("518dab76-6c86-4f80-8052-88e0f9b5daf4", "The Cae Sal"),
]

# --- Classification Config ---
VIBE_TAG_OPTIONS = [
    "comfort",         # Warm, cozy, soul food
    "fresh_light",     # Bright, crisp, salad-y
    "impressive",      # Date night, dinner party worthy
    "weeknight_quick", # Low effort, fast, reliable
    "meal_prep",       # Makes good leftovers, stores/reheats well
    "budget",          # Mostly pantry staples, inexpensive proteins
    "crowd_pleaser",   # Universally liked, not polarizing
    "adventurous",     # Unusual ingredients or techniques
    "one_pot",         # Minimal cleanup
    "project",         # Weekend cooking, multi-step, rewarding process
]

FLAVOR_CATEGORIES = ["sweet", "salty", "bitter", "umami", "fatty", "spicy", "sour"]

INGREDIENT_ROLES = ["hero", "primary", "secondary"]

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

- **flavor_tags** — Which of these 7 flavor categories does this ingredient contribute? An ingredient can have 0-3 tags. Categories: sweet, salty, bitter, umami, fatty, spicy, sour.
  - Some ingredients are "neutral" (flour, water, pasta, rice) — give them an empty array [].
  - Some span multiple categories: Parmesan = ["salty", "umami"], kimchi = ["umami", "sour"], bacon = ["salty", "fatty", "umami"].
  - Think about the FLAVOR the ingredient contributes to the dish, not just what it is.

### 2. RECIPE LEVEL
- **hero_ingredients**: Array of 1-3 ingredient names (the "hero" tier items from above)
- **vibe_tags**: Pick 1-4 from: {vibe_options}
- **serving_temp**: One of: hot, warm, room_temp, cold
- **dominant_flavors**: The 2-3 most prominent flavor categories for the overall dish (from the 7: sweet, salty, bitter, umami, fatty, spicy, sour)

## Output Format
Respond ONLY with valid JSON, no markdown backticks, no explanation:
{{
  "ingredients": [
    {{
      "original_text": "the exact original ingredient text from above",
      "role": "hero",
      "flavor_tags": ["salty", "umami"]
    }},
    {{
      "original_text": "2 tablespoons olive oil",
      "role": "secondary",
      "flavor_tags": ["fatty"]
    }}
  ],
  "recipe": {{
    "hero_ingredients": ["lamb", "tahini"],
    "vibe_tags": ["comfort", "impressive"],
    "serving_temp": "hot",
    "dominant_flavors": ["umami", "salty", "sour"]
  }}
}}

IMPORTANT: Return one entry per ingredient in the EXACT order listed above. The "original_text" must match exactly."""


def get_recipe_ingredients(supabase, recipe_id):
    """Fetch ingredients for a recipe."""
    result = supabase.from_("recipe_ingredients").select(
        "original_text, ingredient_id, sequence_order, ingredient_role, "
        "quantity_amount, quantity_unit, preparation"
    ).eq("recipe_id", recipe_id).order("sequence_order").execute()
    
    return result.data or []


def format_ingredients_text(ingredients):
    """Format ingredients list for the prompt."""
    lines = []
    for i, ing in enumerate(ingredients, 1):
        text = ing.get("original_text", "unknown")
        lines.append(f"{i}. {text}")
    return "\n".join(lines)


def classify_recipe(client, model, recipe, ingredients):
    """Send recipe to Claude for classification."""
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
        vibe_options=", ".join(VIBE_TAG_OPTIONS),
    )
    
    start = time.time()
    response = client.messages.create(
        model=model,
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}],
    )
    elapsed = time.time() - start
    
    text = response.content[0].text.strip()
    # Clean markdown fencing
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    
    try:
        result = json.loads(text)
    except json.JSONDecodeError as e:
        print(f"  ⚠️  JSON parse error ({model}): {e}")
        print(f"  Raw (first 500): {text[:500]}")
        result = None
    
    tokens_in = response.usage.input_tokens
    tokens_out = response.usage.output_tokens
    
    # Cost calculation (per million tokens)
    if "haiku" in model:
        cost = (tokens_in * 0.80 + tokens_out * 4.00) / 1_000_000
    else:  # sonnet
        cost = (tokens_in * 3.00 + tokens_out * 15.00) / 1_000_000
    
    return {
        "result": result,
        "elapsed": elapsed,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "cost": cost,
    }


def print_comparison(recipe, ingredients, haiku_data, sonnet_data):
    """Print side-by-side comparison."""
    title = recipe.get("title", "Unknown")
    print(f"\n{'='*90}")
    print(f"📖 {title}")
    print(f"   Cuisine: {', '.join(recipe.get('cuisine_types') or ['?'])}")
    print(f"   {len(ingredients)} ingredients | {recipe.get('prep_time_min', '?')}+{recipe.get('cook_time_min', '?')} min")
    print(f"{'='*90}")
    
    h = haiku_data.get("result")
    s = sonnet_data.get("result")
    
    if not h or not s:
        print("  ⚠️  One or both models failed to return valid JSON")
        return
    
    h_recipe = h.get("recipe", {})
    s_recipe = s.get("recipe", {})
    
    # --- Recipe Level ---
    print(f"\n  {'RECIPE LEVEL':<22} {'HAIKU':<35} {'SONNET':<35}")
    print(f"  {'-'*22} {'-'*35} {'-'*35}")
    
    h_heroes = ", ".join(h_recipe.get("hero_ingredients", []))
    s_heroes = ", ".join(s_recipe.get("hero_ingredients", []))
    print(f"  {'Hero ingredients':<22} {h_heroes:<35} {s_heroes:<35}")
    
    h_vibes = ", ".join(h_recipe.get("vibe_tags", []))
    s_vibes = ", ".join(s_recipe.get("vibe_tags", []))
    print(f"  {'Vibe tags':<22} {h_vibes:<35} {s_vibes:<35}")
    
    h_temp = h_recipe.get("serving_temp", "?")
    s_temp = s_recipe.get("serving_temp", "?")
    print(f"  {'Serving temp':<22} {h_temp:<35} {s_temp:<35}")
    
    h_dom = ", ".join(h_recipe.get("dominant_flavors", []))
    s_dom = ", ".join(s_recipe.get("dominant_flavors", []))
    print(f"  {'Dominant flavors':<22} {h_dom:<35} {s_dom:<35}")
    
    # --- Ingredient Level ---
    print(f"\n  INGREDIENT CLASSIFICATION")
    print(f"  {'Ingredient':<35} {'H Role':<10} {'S Role':<10} {'Haiku Flavors':<22} {'Sonnet Flavors':<22} {'Agree?'}")
    print(f"  {'-'*35} {'-'*10} {'-'*10} {'-'*22} {'-'*22} {'-'*6}")
    
    h_ings = {}
    for item in h.get("ingredients", []):
        h_ings[item.get("original_text", "")] = item
    
    s_ings = {}
    for item in s.get("ingredients", []):
        s_ings[item.get("original_text", "")] = item
    
    role_agree_count = 0
    flavor_agree_count = 0
    total = len(ingredients)
    
    for ing in ingredients:
        text = ing.get("original_text", "?")
        short = text[:33] + ".." if len(text) > 35 else text
        
        h_i = h_ings.get(text, {})
        s_i = s_ings.get(text, {})
        
        h_role = h_i.get("role", "?")
        s_role = s_i.get("role", "?")
        
        # Role symbols
        role_sym = {"hero": "⭐", "primary": "🔶", "secondary": "·"}
        h_role_disp = f"{role_sym.get(h_role, '?')} {h_role}"
        s_role_disp = f"{role_sym.get(s_role, '?')} {s_role}"
        
        h_flavors = ", ".join(h_i.get("flavor_tags", []))
        s_flavors = ", ".join(s_i.get("flavor_tags", []))
        
        role_match = h_role == s_role
        flavor_match = set(h_i.get("flavor_tags", [])) == set(s_i.get("flavor_tags", []))
        
        if role_match:
            role_agree_count += 1
        if flavor_match:
            flavor_agree_count += 1
        
        agree = ""
        if role_match and flavor_match:
            agree = "✓✓"
        elif role_match or flavor_match:
            agree = "~"
        else:
            agree = "✗✗"
        
        print(f"  {short:<35} {h_role_disp:<10} {s_role_disp:<10} {h_flavors:<22} {s_flavors:<22} {agree}")
    
    # --- Performance ---
    print(f"\n  PERFORMANCE & AGREEMENT")
    print(f"  {'Metric':<25} {'Haiku':<20} {'Sonnet':<20}")
    print(f"  {'-'*25} {'-'*20} {'-'*20}")
    print(f"  {'Time':<25} {haiku_data['elapsed']:.1f}s{'':<15} {sonnet_data['elapsed']:.1f}s")
    print(f"  {'Tokens (in/out)':<25} {haiku_data['tokens_in']}/{haiku_data['tokens_out']:<13} {sonnet_data['tokens_in']}/{sonnet_data['tokens_out']}")
    print(f"  {'Cost':<25} ${haiku_data['cost']:.4f}{'':<15} ${sonnet_data['cost']:.4f}")
    print(f"  {'─'*65}")
    
    # Agreement
    h_heroes_set = set(h_recipe.get("hero_ingredients", []))
    s_heroes_set = set(s_recipe.get("hero_ingredients", []))
    hero_overlap = h_heroes_set & s_heroes_set
    
    h_vibes_set = set(h_recipe.get("vibe_tags", []))
    s_vibes_set = set(s_recipe.get("vibe_tags", []))
    vibe_overlap = h_vibes_set & s_vibes_set
    
    print(f"  Recipe hero overlap:    {len(hero_overlap)}/{max(len(h_heroes_set), len(s_heroes_set))} ({', '.join(hero_overlap) if hero_overlap else 'none'})")
    print(f"  Recipe vibe overlap:    {len(vibe_overlap)}/{max(len(h_vibes_set), len(s_vibes_set))} ({', '.join(vibe_overlap) if vibe_overlap else 'none'})")
    print(f"  Serving temp agree:     {'✓' if h_temp == s_temp else '✗'}")
    print(f"  Ingredient role agree:  {role_agree_count}/{total} ({100*role_agree_count/max(total,1):.0f}%)")
    print(f"  Ingredient flavor agree:{flavor_agree_count}/{total} ({100*flavor_agree_count/max(total,1):.0f}%)")
    
    return {
        "role_agree_pct": 100 * role_agree_count / max(total, 1),
        "flavor_agree_pct": 100 * flavor_agree_count / max(total, 1),
        "hero_overlap": len(hero_overlap),
        "vibe_overlap": len(vibe_overlap),
        "temp_agree": h_temp == s_temp,
    }


def main():
    # Validate
    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_KEY:
        missing.append("SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY")
    if not ANTHROPIC_API_KEY:
        missing.append("ANTHROPIC_API_KEY")
    if missing:
        print(f"\nERROR: Missing: {', '.join(missing)}")
        print("Check your .env file or set environment variables.")
        return
    
    print(f"\nSupabase: {SUPABASE_URL[:40]}...")
    print(f"Anthropic key: ...{ANTHROPIC_API_KEY[-8:]}")
    print(f"Models: {HAIKU_MODEL} vs {SONNET_MODEL}\n")
    
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    
    # Fetch recipes by verified IDs
    print("🔍 Fetching test recipes by ID...")
    recipes = []
    for recipe_id, label in TEST_RECIPE_IDS:
        result = supabase.from_("recipes").select(
            "id, title, description, cuisine_types, difficulty_level, "
            "prep_time_min, cook_time_min, servings, cooking_methods"
        ).eq("id", recipe_id).execute()
        if result.data:
            recipes.append(result.data[0])
            print(f"  ✓ {result.data[0]['title']}")
        else:
            print(f"  ✗ {label} ({recipe_id}) — NOT FOUND")
    
    if not recipes:
        print("ERROR: No recipes found. Exiting.")
        return
    
    print(f"\n📋 Testing {len(recipes)} recipes with both Haiku and Sonnet\n")
    
    total_haiku_cost = 0
    total_sonnet_cost = 0
    all_results = []
    all_agreements = []
    
    for i, recipe in enumerate(recipes):
        recipe_id = recipe["id"]
        title = recipe.get("title", "Unknown")
        print(f"\n[{i+1}/{len(recipes)}] {title}")
        
        ingredients = get_recipe_ingredients(supabase, recipe_id)
        print(f"   {len(ingredients)} ingredients")
        
        if not ingredients:
            print("   ⚠️ No ingredients, skipping")
            continue
        
        # Haiku
        print(f"   🟣 Haiku...", end="", flush=True)
        haiku_data = classify_recipe(client, HAIKU_MODEL, recipe, ingredients)
        print(f" {haiku_data['elapsed']:.1f}s ${haiku_data['cost']:.4f}")
        
        time.sleep(0.5)
        
        # Sonnet
        print(f"   🔵 Sonnet...", end="", flush=True)
        sonnet_data = classify_recipe(client, SONNET_MODEL, recipe, ingredients)
        print(f" {sonnet_data['elapsed']:.1f}s ${sonnet_data['cost']:.4f}")
        
        total_haiku_cost += haiku_data["cost"]
        total_sonnet_cost += sonnet_data["cost"]
        
        # Save raw
        all_results.append({
            "recipe_id": recipe_id,
            "recipe_title": title,
            "ingredient_count": len(ingredients),
            "ingredients_raw": [ing.get("original_text") for ing in ingredients],
            "haiku": {
                "classification": haiku_data["result"],
                "elapsed_s": round(haiku_data["elapsed"], 2),
                "tokens_in": haiku_data["tokens_in"],
                "tokens_out": haiku_data["tokens_out"],
                "cost_usd": round(haiku_data["cost"], 5),
            },
            "sonnet": {
                "classification": sonnet_data["result"],
                "elapsed_s": round(sonnet_data["elapsed"], 2),
                "tokens_in": sonnet_data["tokens_in"],
                "tokens_out": sonnet_data["tokens_out"],
                "cost_usd": round(sonnet_data["cost"], 5),
            },
        })
        
        # Print comparison
        agreement = print_comparison(recipe, ingredients, haiku_data, sonnet_data)
        if agreement:
            all_agreements.append({"title": title, **agreement})
        
        # Pause between recipes
        if i < len(recipes) - 1:
            time.sleep(1)
    
    # ================================================================
    # FINAL SUMMARY
    # ================================================================
    print(f"\n{'='*90}")
    print(f"FINAL SUMMARY — {len(recipes)} recipes tested")
    print(f"{'='*90}")
    
    print(f"\n  COST PROJECTIONS")
    print(f"  {'Model':<12} {'Test (10)':<15} {'Full 483':<15} {'Per Recipe':<15}")
    print(f"  {'-'*12} {'-'*15} {'-'*15} {'-'*15}")
    n = max(len(recipes), 1)
    print(f"  {'Haiku':<12} ${total_haiku_cost:.4f}{'':<10} ${total_haiku_cost/n*483:.2f}{'':<10} ${total_haiku_cost/n:.4f}")
    print(f"  {'Sonnet':<12} ${total_sonnet_cost:.4f}{'':<10} ${total_sonnet_cost/n*483:.2f}{'':<10} ${total_sonnet_cost/n:.4f}")
    
    if all_agreements:
        avg_role = sum(a["role_agree_pct"] for a in all_agreements) / len(all_agreements)
        avg_flavor = sum(a["flavor_agree_pct"] for a in all_agreements) / len(all_agreements)
        temp_agree = sum(1 for a in all_agreements if a["temp_agree"])
        
        print(f"\n  AGREEMENT RATES (Haiku vs Sonnet)")
        print(f"  Ingredient role agreement:  {avg_role:.0f}% avg")
        print(f"  Ingredient flavor agreement: {avg_flavor:.0f}% avg")
        print(f"  Serving temp agreement:      {temp_agree}/{len(all_agreements)}")
        
        print(f"\n  PER-RECIPE BREAKDOWN")
        print(f"  {'Recipe':<50} {'Role%':<8} {'Flavor%':<8} {'Temp'}")
        print(f"  {'-'*50} {'-'*8} {'-'*8} {'-'*5}")
        for a in all_agreements:
            short = a["title"][:48] + ".." if len(a["title"]) > 50 else a["title"]
            print(f"  {short:<50} {a['role_agree_pct']:.0f}%{'':<4} {a['flavor_agree_pct']:.0f}%{'':<4} {'✓' if a['temp_agree'] else '✗'}")
    
    # Save JSON
    output_path = "recipe_classification_test_results.json"
    with open(output_path, "w") as f:
        json.dump(all_results, f, indent=2, default=str)
    print(f"\n💾 Raw results saved to {output_path}")
    print(f"   Review this file to judge classification quality per-ingredient.\n")


if __name__ == "__main__":
    main()