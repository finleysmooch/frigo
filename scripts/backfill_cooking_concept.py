"""
Backfill cooking_concept for all recipes.
Uses Haiku to classify dish type from title + hero_ingredients + course_type.

Usage:
  export SUPABASE_URL=...
  export SUPABASE_SERVICE_ROLE_KEY=...
  export ANTHROPIC_API_KEY=...
  python backfill_cooking_concept.py

Estimated cost: $0.30-0.50 for 475 recipes
"""

import os
import json
import time
import re

try:
    import httpx
except ImportError:
    print("Installing httpx...")
    os.system("pip install httpx")
    import httpx

# Load from .env file if environment variables aren't set
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

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]

HEADERS_SB = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

HEADERS_CLAUDE = {
    "x-api-key": ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
}

CONCEPT_VOCABULARY = """
COOKING CONCEPT VOCABULARY (use these when they fit, or invent if needed):

Soups & Stews: soup, stew, chowder, chili, congee, porridge, gazpacho
Braises & Curries: braise, curry, tagine, dal, goulash
Pasta & Noodles: pasta, noodles, ramen, pho
Grains & Rice: risotto, pilaf, grain_bowl, fried_rice, paella, biryani, polenta, couscous
Salads & Raw: salad, slaw, ceviche, carpaccio, tartare, poke
Roasted / Baked: roast, gratin, casserole, sheet_pan, bake
Savory Pastry: tart, galette, quiche, pie, pastry, empanada
Fried / Crispy: fritter, croquette, tempura, falafel, pancake, latke
Eggs: frittata, omelette, souffle, shakshuka, scramble
Grilled / Skewered: grill, skewer, kebab
Steamed / Wrapped: dumpling, steam, tamale
Flatbreads & Pizza: flatbread, pizza, focaccia, pita
Sandwiches & Wraps: sandwich, wrap, taco, burger
Stir-Fry & Sauté: stir_fry, saute, wok
Composed / Plated: composed_plate, mezze, platter
Stuffed: stuffed, roll, roulade
Condiments: sauce, dip, spread, dressing, chutney, relish, pickle, pesto, marinade, salsa, jam, compound_butter
Baking & Sweets: cake, cookie, pudding, mousse, crumble, crisp, compote, custard, ice_cream, bread, muffin, scone
Drinks: smoothie, drink, cocktail
Small Bites: crostini, bruschetta, canape, toast
"""

# Fetch all recipes
print("Fetching recipes...")
resp = httpx.get(
    f"{SUPABASE_URL}/rest/v1/recipes",
    params={
        "select": "id,title,hero_ingredients,course_type,cooking_methods,cuisine_types",
        "order": "created_at.asc",
    },
    headers=HEADERS_SB,
    timeout=30,
)
resp.raise_for_status()
recipes = resp.json()
print(f"Found {len(recipes)} recipes")

# Process in batches
BATCH_SIZE = 40
total_cost = 0.0
total_classified = 0
all_concepts = {}

for batch_start in range(0, len(recipes), BATCH_SIZE):
    batch = recipes[batch_start : batch_start + BATCH_SIZE]
    batch_num = batch_start // BATCH_SIZE + 1
    total_batches = (len(recipes) + BATCH_SIZE - 1) // BATCH_SIZE

    print(f"\n--- Batch {batch_num}/{total_batches} ({len(batch)} recipes) ---")

    # Build prompt
    recipe_lines = []
    for r in batch:
        hero = ", ".join(r.get("hero_ingredients") or [])
        course = r.get("course_type") or "unknown"
        methods = ", ".join(r.get("cooking_methods") or [])
        cuisine = ", ".join(r.get("cuisine_types") or [])
        recipe_lines.append(
            f'- id: "{r["id"]}" | title: "{r["title"]}" | heroes: [{hero}] | course: {course} | methods: [{methods}] | cuisine: [{cuisine}]'
        )

    prompt = f"""Classify each recipe by its primary cooking concept (dish type / format).

{CONCEPT_VOCABULARY}

Rules:
- Pick ONE concept that best describes what this dish IS. Use lowercase with underscores.
- Use the most SPECIFIC concept. "mushroom risotto" → risotto, not "rice_dish".
- "composed_plate" is for dishes that are assembled from multiple cooked components (common in Ottolenghi — roasted veg + sauce + topping + garnish).
- For condiments/sauces, be specific: sauce, dip, spread, dressing, chutney, relish, pickle.
- If nothing in the vocabulary fits, use a short descriptive term.
- DO NOT use the cooking method as the concept unless the dish IS that method (e.g., "stir_fry" is both a method and a dish type, but "roast" as a concept means a roasted main — not just "something that was roasted").

Recipes:
{chr(10).join(recipe_lines)}

Return ONLY a JSON array:
[{{"id": "...", "cooking_concept": "..."}}]
"""

    body = {
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 4000,
        "messages": [{"role": "user", "content": prompt}],
    }

    try:
        resp = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers=HEADERS_CLAUDE,
            json=body,
            timeout=60,
        )
        resp.raise_for_status()
        result = resp.json()
    except Exception as e:
        print(f"  ERROR: API call failed: {e}")
        time.sleep(5)
        continue

    # Cost
    usage = result["usage"]
    cost = (usage["input_tokens"] * 0.25 + usage["output_tokens"] * 1.25) / 1_000_000
    total_cost += cost

    # Parse
    content = result["content"][0]["text"]
    try:
        classifications = json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\[[\s\S]*\]", content)
        if match:
            classifications = json.loads(match.group())
        else:
            print(f"  ERROR: Could not parse response")
            print(f"  Response: {content[:300]}")
            continue

    # Update each recipe
    batch_classified = 0
    for item in classifications:
        recipe_id = item["id"]
        concept = item["cooking_concept"]

        # Track distribution
        all_concepts[concept] = all_concepts.get(concept, 0) + 1

        update_resp = httpx.patch(
            f"{SUPABASE_URL}/rest/v1/recipes",
            params={"id": f"eq.{recipe_id}"},
            headers={**HEADERS_SB, "Prefer": "return=minimal"},
            json={"cooking_concept": concept},
            timeout=10,
        )
        if update_resp.status_code < 300:
            total_classified += 1
            batch_classified += 1
        else:
            print(f"  WARN: Failed to update {recipe_id}: {update_resp.status_code}")

    print(f"  Classified {batch_classified}/{len(batch)} | Cost: ${cost:.4f}")

    time.sleep(1)

# Summary
print(f"\n{'='*60}")
print(f"BACKFILL COMPLETE")
print(f"{'='*60}")
print(f"Total classified: {total_classified}/{len(recipes)}")
print(f"Total cost: ${total_cost:.4f}")
print(f"Unique concepts: {len(all_concepts)}")
print(f"\nDistribution (top 30):")
for concept, count in sorted(all_concepts.items(), key=lambda x: -x[1])[:30]:
    bar = "█" * min(count, 40)
    print(f"  {concept:<25} {count:>4}  {bar}")

print(f"\nVerification query:")
print("""
SELECT cooking_concept, COUNT(*) as cnt 
FROM recipes 
WHERE cooking_concept IS NOT NULL 
GROUP BY cooking_concept 
ORDER BY cnt DESC;
""")