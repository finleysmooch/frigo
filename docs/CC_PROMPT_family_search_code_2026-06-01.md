# CC Prompt — Ingredient Family Search (code half) — 2026-06-01

**Precondition met:** reclassification SQL applied (64 rows split into Pasta/Rice/Fish/Shellfish/Noodles; `Seafood` is now an empty type by design; 10 bread rows intentionally left as `Grains`).
**This prompt ships the code so the data change becomes a feature instead of a regression.** Do NOT touch the 4 `family` values or the classifier prompt (`ingredientSuggestionService`) — that's a separate post-launch fast-follow.

---

## DECISION RECORD DELTA — append to PHASE_11_RECIPE_POLISH.md
- `Noodles` added as a dedicated `ingredient_type` under Pantry (6 Asian-noodle rows). "egg noodles" + "lasagna noodles" intentionally Pasta (European), name-match still surfaces them under "noodles".
- `Seafood` type intentionally emptied → **emptied-parent umbrella principle:** any fully-emptied parent type is restored in the search layer via a one-to-many synonym (`seafood → [fish, shellfish]`), never by re-typing data. Seafood is the only emptied parent this round (`Grains` retains real grains).
- "Bread" type **deferred** post-launch; 10 bread rows kept as `Grains` (the classifier wanted a bakery type that doesn't exist and over-reached to `Baking` — signal logged).
- Stats: natural `Fish`/`Shellfish` pills; combined "Seafood" pill deferred.
- Formal `ingredientTaxonomy.ts` constant deferred to the classifier fast-follow (its only consumer).

---

## Read first
- `lib/searchService.ts` → `searchRecipesByIngredient` and the call chain above it (`searchRecipes` → `searchRecipesByMixedTerms`).
- `constants/pantry.ts` → `INGREDIENT_TYPE_ICONS` (~L39) + `INGREDIENT_TYPE_ICON_COMPONENTS` (~L201).
- `lib/services/statsService.ts` → `getTopIngredients` (~L1213) and wherever its filter-pill **options** are built.

## Step 0 — inline recon (report in log, then proceed)
1. Confirm the single chokepoint for term expansion. Expectation: inside `searchRecipesByIngredient`, since every ingredient search routes through it (BookView and Recipes both go through `searchRecipesByMixedTerms → searchRecipes → searchRecipesByIngredient`). If that's correct, expand there. If not, report the better chokepoint and use it.
2. Are `getTopIngredients` filter-pill **options** HARDCODED (a literal list) or DERIVED (distinct values from data)? Determines whether task 4 is needed.

## Task 1 — Path C + synonym expansion (in `searchRecipesByIngredient`)
Replace the single Step-1 ingredient query so it (a) expands the term via the synonym map, and (b) matches `ingredient_type` as well as `name`/`plural_name`, unioning ingredient ids across all expanded terms.

- Per expanded term, match `name.ilike.%t%,plural_name.ilike.%t%,ingredient_type.ilike.%t%`. **Type-only — do NOT add `family`.**
- Union the resulting ingredient ids (dedupe), then proceed to the existing recipe_ingredients lookup unchanged.
- Expected/acceptable quirk to note in log: "shellfish" contains "fish", so `fish` matches both Fish + Shellfish types; `shellfish` matches Shellfish only. Leave as-is.

## Task 2 — synonym map
Add a small directed expansion map + helper, colocated with the search code:
```ts
// query term (lowercased) -> additional terms to also match
const SEARCH_SYNONYMS: Record<string, string[]> = {
  seafood: ['fish', 'shellfish'],          // emptied-parent umbrella — RESTORES "seafood" search
  noodle: ['pasta'], noodles: ['pasta'], pasta: ['noodle'],
  scallion: ['green onion'], 'green onion': ['scallion'],
  cilantro: ['coriander'], coriander: ['cilantro'],
  shrimp: ['prawn'], prawn: ['shrimp'],
  garbanzo: ['chickpea'], chickpea: ['garbanzo'],
  aubergine: ['eggplant'], eggplant: ['aubergine'],
  courgette: ['zucchini'], zucchini: ['courgette'],
};
const expandTerm = (t: string): string[] => {
  const k = t.toLowerCase().trim();
  return [k, ...(SEARCH_SYNONYMS[k] ?? [])];
};
```
Curated, not exhaustive. Keep it obvious.

## Task 3 — icons (`constants/pantry.ts`)
Add entries to BOTH `INGREDIENT_TYPE_ICONS` and `INGREDIENT_TYPE_ICON_COMPONENTS` for:
- New types: **Pasta, Rice, Fish, Shellfish, Noodles**
- Orphans currently falling back to 📦: **Wines & Spirits, Coffee & Tea, Stocks & Broths, Beverages**
(Leave the existing `Seafood` and `Grains` icons in place — harmless even though Seafood is now empty.)

## Task 4 — stats pills (only if Step-0 says HARDCODED)
Add `Pasta, Rice, Fish, Shellfish, Noodles` to the pill options. If DERIVED, do nothing (they appear automatically; empty `Seafood` simply drops out).

## Constraints
- Services own all Supabase calls; components never hit the DB.
- Don't touch `family` values or the classifier prompt.
- Don't remove existing functionality (other search paths, name-matching, etc. stay intact).

## Verification (in-app)
- Search `pasta`, `fish`, `rice`, `noodles`, **`seafood`** — both inside a cookbook (BookView) and on the main Recipes screen. Each returns the expected recipes; `seafood` returns fish + shellfish recipes (regression fixed).
- Pantry (`SuppliesSection`) groups correctly; new + orphan types show real icons, no 📦.
- Stats filter pills show `Fish`/`Shellfish` (+ Pasta/Rice/Noodles); no empty `Seafood` pill.

## SESSION_LOG entry
```
## EXEC — Ingredient family search code (2026-06-01)
- Chokepoint: <file:fn> — term expansion added here
- Path C: .or() extended to ingredient_type (type-only); ids unioned across expanded terms
- Synonym map: <n> entries incl. seafood umbrella
- Icons added: Pasta, Rice, Fish, Shellfish, Noodles + 4 orphans
- Stats pills: HARDCODED→added 5 / DERIVED→auto
- Verification: pasta/fish/rice/noodles/seafood (BookView + Recipes); pantry icons; stats pills
- Staged for PK: searchService.ts, constants/pantry.ts in _pk_sync/
```
Then stage `searchService.ts` + `constants/pantry.ts` (+ statsService.ts if edited) into `_pk_sync/` for Tom's PK upload.
