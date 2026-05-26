# 8R Gap Audit Report — v0.2

**Updated:** 2026-05-04
**Author:** Claude.ai (audit instance, multi-session walkthrough with Tom)
**Status:** Audit complete. Decisions locked. Ready for CP grouping → CC prompt drafting.
**Predecessor:** v0.1 (2026-05-04 morning)

---

## Changelog from v0.1

- **All ❓-items resolved.** 5 confirmed missing (now 🔧), 2 confirmed shipped (now ✅).
- **All Q-CHECK / Q-NEW questions answered** through 5 rounds of walkthrough with Tom.
- **~12 new gap rows added** from the discussion: perishable taxonomy, status icon system, dual-listing pattern, schema additions, the olive-oil createNeed bug.
- **🪦 register collapsed** — most items resolved (kept cuts, with replacements designed in). Two items revived as new gaps (storage_location, +/- buttons).
- **Reorganized by CP grouping** instead of by-domain. The matrix is the same; the navigation reflects how execution will run.
- **Open questions block reduced** from 22 to 3 — only smoke-pending and brainstorm-deferred items remain.

---

## TL;DR — final shape

**~52 gaps surfaced. After walkthrough:**

- **6 CP6d sub-checkpoints** identified (Schema → Pantry → ViewDetail → Sheets → Recipe → SupplyDetail)
- **2 parallel workstreams** (catalog audit, 8D matching brought forward)
- **~15 items deferred post-F&F** with explicit confirmation
- **~8 items confirmed lost-from-pre-R, intentional, not coming back** (quantity, expiration, +/- on grocery rows kept as Gap-G7)

F&F target unchanged (late June) but CP6d is heavier than originally framed. **Realistic estimate: 3-4 weeks of focused work for CP6d-Schema through CP6d-SupplyDetail, plus 0.5-1 week for parallel catalog + 8D-CP1-2.**

---

## Status legend

| Symbol | Meaning |
|---|---|
| ✅ | Works as designed |
| 🔧 | Functional gap — broken, missing, or stub |
| 🎨 | UX gap — works but feels worse than intent |
| 🔲 | Not built — wireframed/specified but never shipped |
| 🪦 | Lost from pre-R — intentional cut, replacement designed |
| ⏸️ | Defer post-F&F |
| 📈 | Polish post-F&F |

---

# Decisions locked

**Bulk Acquire (LR8):** auto-promote prompt — "N items aren't tracked supplies, track them?" multi-select. Implementation lives in CP6d-Schema (createNeed flow modification).

**Cart progress bar (G14 metric):** flip from `acquired-only` to `in_cart-or-acquired`. Reflects "what's in the cart while shopping." 3-line guard flip.

**Cart-as-section (G14 layout):** Option A — items physically move from main body into cart section on cycle to in_cart. Cycle back → reappear in original alphabetical position. Apply to ALL views, not conditional.

**Quantity (LR1):** stays cut. Status enum only. Revisit only if 8D matching surfaces friction.

**Cross-list checkoff (LR9 / Q9):** unified-needs model handles your "small now + bulk later" use case once **createNeed dedup is softened (Gap-G41)** to match merge predicate. No CrossListPrompt resurrection needed.

**Tap-zones on need rows (G6/G7):** Split. Status dot = cycle. Name area = inline edit (light modal or EditNeedSheet). Inline +/- buttons on right side for quantity. Apply to every list.

**Perishable taxonomy:** schema-level `tracking_mode` field (`restock` / `track_only`). Inferred from `ingredient.shelf_life_days_*` + storage_location at create time. User-overridable on SupplyDetail. Spawn-on-out gates on `tracking_mode === 'restock'`.

**Storage location:** first-class column on supplies. Inferred from `ingredient.default_storage_location`. User-editable. Storage transitions only affect staleness threshold, never tracking_mode.

**Track-only `out` lifecycle:** Option (c) — auto-archive (`archived_at` timestamp). Pantry stops showing them. Re-creation flow detects archived row → "reactivate?" prompt.

**Priority flag:** included for F&F. Boolean `is_priority` on supplies. Priority items spawn on `low` (not just out) with `urgency=today`. Star icon on supply rows.

**Status icons:** 5-circle visual progression mapped to logical status enum.
- Cycle order: 100% → 60% → 40% → 20% → 0% → 100% (skipping 80%; reachable only via inline slider or SupplyDetail)
- Color: in_stock=green / low=yellow / critical=orange / out=red / unknown=grey
- Icons (using `noun-progress-bar-3318XXX-YY` naming, with XXX as ID and YY as %): 901-100, 928-80, 907-60, 903-40, 905-20, 896-0, 919-unknown

**Pantry organization:** new section split.
- Attention (always visible if non-empty, includes both modes)
- Regulars (`tracking_mode=restock`) — sub-grouped by category, accordion
- On Hand (`tracking_mode=track_only`) — sub-grouped by category, accordion
- One sub-section open at a time. Attention also collapses when sub-section opens (count badge updates with subtle highlight).
- Items in attention are ALSO listed in their original sub-section (dual-listing) — both fully interactive.

**Recipe-add modal:** rebuild. Dual CTAs on RecipeDetailScreen ("Add N missing" + "Add all N"). Modal has list-picker dropdown (Today / This Week / pick another), forced urgency choice.

**Header pattern:** consistent across Pantry + Lists. "My Pantry" / "Lists" top-left, space switcher top-right. Replace emojis with icons (`noun-home-2-outline-6460302.svg`, `noun-profile-1-filled-8147335.svg`).

**ManageSuppliesScreen:** delete after SupplyDetailScreen ships. SuppliesSection covers list-and-cycle, SupplyDetail covers per-supply edit, SupplyCreateSheet covers create.

**Spawn toast Edit (P12):** defer. Undo/long-press fallback workable for F&F.

**Recipe ↔ Pantry CTA (Q-NEW-26):** Supply Detail "Find recipes" CTA navigates to RecipeListScreen with new `initialIngredient` route param pre-populating heroIngredients filter.

**Cross-list cross-checkoff (LR9):** purely architectural win. Unified bag means no duplicates exist. Confirmed.

---

# CP grouping — execution plan

Six CPs in dependency order. The first two are foundational; the rest can ship in parallel pairs once schema lands.

## CP6d-Schema (FOUNDATIONAL — must ship first)

**Cost:** L. Schema migration + service updates. ~400-600 lines net. Dedicated session.

### Schema additions to `supplies`

| Column | Type | Default | Backfill |
|---|---|---|---|
| `tracking_mode` | TEXT NOT NULL | `'restock'` | inferred from ingredient.shelf_life + default_storage_location |
| `storage_location` | TEXT NULL | NULL | from `ingredient.default_storage_location` |
| `archived_at` | TIMESTAMPTZ NULL | NULL | NULL (no existing archived data) |
| `is_priority` | BOOLEAN NOT NULL | `false` | `false` for all |
| `usage_level` | SMALLINT NOT NULL | `5` | from current status (in_stock=5, low=2, critical=1, out=0) |

CHECK constraints: `tracking_mode IN ('restock', 'track_only')`, `storage_location IN ('fridge','freezer','pantry','counter')`, `usage_level BETWEEN 0 AND 5`.

### Inference logic at create time

```
storage_location = ingredient.default_storage_location ?? 'pantry'
shelf_life = ingredient[`shelf_life_days_${storage_location}`] ?? null
tracking_mode = (shelf_life !== null && shelf_life < 14) ? 'track_only' : 'restock'
```

User-overridable on SupplyDetail (Tab 8).

### Service updates

**`needsService.createNeed`** (Gap-G41):
- Soften dedup. Current: `(supply_id, status IN [need|in_cart])`. New: `(supply_id, unit, store_tags, for_user_ids, status IN [need|in_cart])`.
- Allows your olive-oil "small now + bulk later" scenario.
- ~15 lines.

**`suppliesService.setSupplyStatus`** (Q-NEW-17, NEED-1):
- Spawn-on-out gates on `tracking_mode === 'restock'`. track_only items going to out auto-archive (`archived_at = NOW()`).
- Spawn-on-low for priority items: when `is_priority = true` AND new status = `low`, spawn need with `urgency: today` tag. Only fires on transition into low (not on subsequent updates while already low).
- Update `usage_level` derived from new status (in_stock=5/4/3, low=2, critical=1, out=0).

**`suppliesService.createSupply`**:
- Accept new params: `tracking_mode?`, `storage_location?`, `is_priority?`.
- Apply inference defaults if not provided.
- Q35 status restriction (in_stock/low/out only) preserved.

**Resurrection path** (T1 in SupplyCreateSheet):
- `getSuppliesForSpace` already returns archived rows? **VERIFY** in source — if not, add `includeArchived` param.
- T1 search detects archived match → "Reactivate this supply?" confirmation → `archived_at = NULL` + status reset.

### Bulk Acquire promotion prompt (Gap-LR8)

In ViewDetailScreen `handleBulkAcquire`:
- After cart needs identified, partition into `with_supply` vs `without_supply`.
- If `without_supply.length > 0`, show modal: "N items aren't tracked supplies. Track them?" with multi-select (default all checked).
- For checked items: createSupply (inferred tracking_mode + storage_location) → setNeedStatus('acquired') → setSupplyStatus('in_stock').
- For unchecked items: setNeedStatus('acquired') only (current behavior, vanish after acquire).
- For `with_supply` items: existing behavior unchanged.

---

## CP6d-Pantry — Pantry-side UX overhaul

**Depends on:** CP6d-Schema (tracking_mode for two-section split, usage_level for icons).
**Cost:** L. ~800-1100 lines.

### Header redesign
- "My Pantry" top-left, space-switcher top-right corner
- Icon swap: `noun-home-2-outline-6460302.svg` for home tab, `noun-profile-1-filled-8147335.svg` for person
- Search/add bar immediately below

### Search bar (multi-purpose) — Gap-P1, Q-NEW-8
- TextInput at top of SuppliesSection (above Attention)
- Type → live filter visible supplies (client-side `displayName.toLowerCase().includes(query)`)
- No match → "+ Add '{query}' as supply" affordance at top of results (T3-style, opens SupplyCreateSheet pre-populated)
- Tap a result → expand-row inline (see below)

### Section structure — Gap-P2, P3, NEED-3, NEED-4
```
Attention (collapsible, always-on if non-empty)
  Out (sub-section label) → out items
  Low (sub-section label) → critical+low items
  [Items also dual-listed in their Regulars/On Hand sub-category]

Regulars (collapsible, default-open)
  Spices (sub-category, collapsible)
  Dairy (sub-category, collapsible)
  Pantry items (sub-category, collapsible)
  ...

On Hand (collapsible, default-collapsed)
  Mushrooms (e.g.)
  Cilantro (e.g.)
  ...
  [Sub-grouped by category OR sorted by staleness — TBD post-build feedback]
```

**Accordion behavior:** opening one sub-section collapses the others (within Regulars + On Hand). Attention also collapses when sub-section opens, BUT count badge stays visible with brief highlight animation when items get added.

**Dual-listing:** items in Attention also appear in their original sub-category with status styling. Both rows fully interactive (cycle from either).

### Status icon system — Gap-NEW-2

Replace current dots with 5-circle progression icons:

| Visual level | Icon | Status |
|---|---|---|
| 5/5 (full) | `noun-progress-bar-3318901-100` | in_stock |
| 4/5 | `noun-progress-bar-3318928-80` | in_stock (used some) |
| 3/5 | `noun-progress-bar-3318907-60` | in_stock (around half) |
| 2/5 | `noun-progress-bar-3318903-40` | low |
| 1/5 | `noun-progress-bar-3318905-20` | critical |
| 0/5 | `noun-progress-bar-3318896-0` | out |
| ? | `noun-progress-bar-3318919-unknown` | unknown |

**Tap-cycle order:** 5 → 3 → 2 → 1 → 0 → 5 (skips 4, "used some" reachable only via slider/detail)
**Colors:** green (in_stock 5/3) / yellow (low 2) / orange (critical 1) / red (out 0) / grey (unknown)

### Pluralization — Gap-NEED-7

Display logic: `ingredient.plural_name && quantity > 1 ? plural_name : ingredient.name`. Catalog audit (parallel workstream X6) populates `plural_name` correctly across catalog.

### Tap interactions
- **Tap status dot** → cycle (existing behavior, new icon visual)
- **Tap supply name** → expand row inline with status slider (replaces current long-press → ActionSheet)
  - Inline expansion shows: name, current status (large), 5-segment slider, "Open detail ›" link to SupplyDetail
- **Long-press** (post-CP6d): keep as power-user shortcut OR remove entirely. Decide post-smoke based on Tab 8 discoverability.

### Stale items banner (Gap-NEED-5)
- Surfaces above Attention when any `tracking_mode=track_only` items haven't been touched in >14 days
- Format: `🍂 N items haven't been used in a while`
- Tap → expands list of stale items inline (NOT a separate screen for F&F per Q6)
- Each item: name, days since last touched, quick actions (Find recipes / Toss / Snooze)
- "Find recipes" → SupplyDetail's Q-NEW-26 CTA

---

## CP6d-ViewDetail — Grocery-side UX

**Depends on:** CP6d-Schema (createNeed dedup softening for inline-add behavior).
**Cost:** M-L. ~600-900 lines.
**Can ship parallel to CP6d-Pantry once Schema lands.**

### Inline type-and-add (Gap-G5)
- TextInput row at top of ViewDetail body (sibling to Regulars strip)
- Submit-on-return → createNeed with view's filter-context inheritance
- Default qty: 1, default unit: empty (user types if needed)
- Match-existing-supply UX: if typed name matches a supply, show 🏠 hint → tap creates need with supply_id link
- "More options" tap → opens AddNeedSheet pre-populated (full configure path)

### Tap-zones split (Gap-G6, G7)
- **Status dot tap-zone:** cycles status (need → in_cart → acquired)
- **Name area tap:** opens EditNeedSheet (or lighter inline edit — TBD during build)
- **Quantity area:** small −/+ buttons inline on right side (0.5 increments per pre-R precedent, or 1 — TBD)
- **Long-press:** keep as alternative path to EditNeedSheet (defensive, hidden affordance)

### Cart-as-section all views (Gap-G14)
- Replace current global cart footer with per-section cart at bottom of every view
- Items cycle to `in_cart` → physically move from main body into cart section
- Items cycle back to `need` → reappear in original alphabetical position
- Default-collapsed cart section (`🛒 N in cart ▸`) when populated
- Bulk acquire button on In Cart view (existing behavior, now triggers promotion prompt from CP6d-Schema)

### Cart progress bar metric flip
- Increment guard: `=== 'in_cart' || === 'acquired'` instead of `=== 'acquired'` only
- 3-line change

### Merged-row expand-children (Gap-O8)
- Merged groups (same identity + unit + store_tags + for_user_ids from multiple recipes) get `▾` expand
- Expanded shows child rows: `8 oz · Cheesecake` / `4 oz · Cinnamon rolls`
- Each child row gets its own check-zone (cycle state propagates to merged parent)

---

## CP6d-Sheets — Existing-sheet polish

**Independent. Can ship anytime.**
**Cost:** S-M. ~150-250 lines.

### UnitPicker swap (Gap-G24, G35)
- Replace TextInput in AddNeedSheet + EditNeedSheet with UnitPicker (from CP4.5)
- Drop-in component swap. ~120 lines net.

### ExpandedRegularsSheet search bar (Gap-G27)
- TextInput at top, client-side filter on supplies in current view's matching set
- ~30 lines

### "+ N more in [Category]" expand-in-place (Gap-G28)
- Sub-category sections in ExpandedRegularsSheet collapse by default (show ~5 items)
- Tap "+ N more" expands inline
- ~50 lines

---

## CP6d-Recipe — Recipe-add flow rebuild

**Independent. Can ship anytime.**
**Cost:** M. ~250-350 lines.

### RecipeDetailScreen dual CTAs (Gap-G38 partial)
- Replace current single "Add to needs" button with two:
  - **Primary:** "Add N missing →" (where N = ingredients not in supplies as in_stock or low)
  - **Secondary:** "Add all N"
- Tapping either opens AddRecipeToNeedsModal pre-filtered to that ingredient set

### AddRecipeToNeedsModal rebuild (Gap-G38 main)
- Title: "Add to..." with ingredient count subtitle
- **List picker dropdown** (forced choice — no default):
  - "Today" → urgency=today tag inheritance
  - "This Week" → urgency=this-week
  - "Pick another list..." → opens secondary picker showing custom views
- **Add button disabled until list selected**
- Iterates `addNeedFromRecipe` per ingredient with selected urgency tag applied

---

## CP6d-SupplyDetail — Tab 8 build + cross-cutting wire-ups

**Depends on:** CP6d-Schema (storage_location, is_priority, tracking_mode toggles).
**Cost:** L. ~700-1000 lines.

### SupplyDetailScreen.tsx (Gap-P7 — main build)

Routed from PantryScreen `handleSupplyNameTap` (replaces current Alert) and ExpandedRegularsSheet long-press.

Layout (per Tab 8 wireframe Variant A + audit additions):
- **Header:** `← {name} ⋯` (overflow menu has Archive / Delete)
- **Hero state cycle:** 4-segment strip (in_stock / low / critical / out) — tap-to-set per Q30. Plus inline 5-circle visual using usage_level.
- **Two CTAs:** `+ Add to needs` (creates need linked to this supply) + `Restock` (cycles to in_stock + bumps usage_level to 5)
- **Star toggle:** is_priority on/off with subtle hint text
- **Tracking mode toggle:** "Restock automatically when out" / "Just track in pantry" — with hint about default inferred from ingredient
- **Storage location field:** segmented picker (fridge / freezer / pantry / counter) — defaults from ingredient
- **Stores section:** multi-select chip picker (existing tagsService)
- **Brands section:** free-form list
- **For-user row:** stub as "Everyone (default)" hint per P8R-D13 — no sub-sheet for F&F
- **"Find recipes with {name}" CTA** (Gap-Q-NEW-26): navigates to RecipeListScreen with `initialIngredient: name` param
- **Activity log:** simplest version — "Last cycled {timestamp}, last acquired {timestamp}" two-line summary

### T1 inversion wire-up (Gap-P9)
- SupplyCreateSheet T1 path currently shows Alert "already in pantry"
- Update: navigate to SupplyDetailScreen directly. Pass supply_id route param.

### ManageSuppliesScreen deletion (Gap-P14)
- Delete file, remove route registration, remove stack reference in App.tsx
- Verify no remaining navigations target this route

### RecipeListScreen `initialIngredient` param (Gap-Q-NEW-26)
- Add `initialIngredient?: string` to `RecipesStackParamList.RecipeList`
- In `useEffect` route-params handler: if `initialIngredient` set, push to `advancedFilters.heroIngredients`
- Clear param after applied (existing pattern)
- ~10 lines

---

## Parallel workstreams (F&F-prereqs, not in CP6d sequence)

### Workstream A — Catalog audit (Gap-X6, P8R-D20)

**Cost:** S. ~30-min CC pass.
**Independent of all CPs.**

- Populate `plural_name` for all countable nouns (bananas, avocados, eggs, etc.)
- Leave NULL for mass nouns (coriander, protein powder)
- Add ~30-50 missing common ingredients (coffee, coffee beans, eggs variants, milk variants, etc.)
- Single SQL UPDATE + INSERT pass

### Workstream B — 8D recipe-pantry matching upgrade (Gap-O3)

**Cost:** M-L. Brought forward from Phase 8D per Tom's call.
**Independent of CP6d.**

- Base-ingredient normalization (extra-virgin olive oil → olive oil)
- Staple exclusion (don't penalize for missing salt/pepper/oil)
- Update `availableIngredientIds` logic in RecipeDetailScreen + IngredientsSection
- 8D-CP1 + CP2 scope folded into pre-F&F

---

# The matrix (full row-by-row, organized by CP)

## CP6d-Schema items

| ID | Item | Status | Cost |
|---|---|---|---|
| Schema-1 | tracking_mode column on supplies | 🔲 New | S (within L total) |
| Schema-2 | storage_location column on supplies | 🔲 New | S |
| Schema-3 | archived_at column on supplies | 🔲 New | S |
| Schema-4 | is_priority column on supplies | 🔲 New | S |
| Schema-5 | usage_level column on supplies | 🔲 New | S |
| Schema-6 | Inference logic at createSupply | 🔲 New | S |
| G41 | createNeed dedup softening (olive-oil bug) | 🔧 New gap | S |
| NEED-1 | track_only auto-archive on out | 🔲 New | S |
| NEED-1b | Priority spawn-on-low | 🔲 New | S |
| LR8 | Bulk Acquire promotion prompt | 🔧 Schema-coupled | M |

## CP6d-Pantry items

| ID | Item | Status | Cost |
|---|---|---|---|
| NEED-3 | Pantry header redesign + icons | 🔲 New | S |
| P1 | Pantry search bar (multi-purpose) | 🔧 → addressing | M |
| NEED-4 | Two-section split (Regulars / On Hand) | 🔲 New | M |
| P2 | Attention sub-section labels (Out / Low) | 🎨 → addressing | S |
| P3 | Per-category sub-sections | 🔲 → addressing | M |
| NEED-6 | Dual-listing for Attention | 🔲 New | S |
| NEED-8 | Accordion behavior (one section open) | 🔲 New | S |
| NEED-2 | 5-icon status visual system | 🔲 New | M |
| NEED-9 | Tap-row → expand inline + slider | 🔲 New | S |
| NEED-7 | Pluralization at display | 🔲 New | S |
| NEED-5 | Stale items banner | 🔲 New | M |

## CP6d-ViewDetail items

| ID | Item | Status | Cost |
|---|---|---|---|
| G5 | Inline type-and-add | 🔧 → addressing | M |
| G6 | Tap-zones split (dot=cycle, name=edit) | 🔧 → addressing | S |
| G7 | Inline +/- quantity buttons | 🔧 → addressing | S |
| G14 | Cart-as-section all views | 🎨 → addressing | M |
| G14b | Cart progress bar metric flip | ✅ → tweak | XS |
| O8 | Merged-row expand-children | 🔧 → addressing | S |

## CP6d-Sheets items

| ID | Item | Status | Cost |
|---|---|---|---|
| G24 | UnitPicker swap (AddNeedSheet) | 🔧 confirmed | S |
| G35 | UnitPicker swap (EditNeedSheet) | 🔧 confirmed | S |
| G27 | ExpandedRegulars search bar | 🔧 confirmed | S |
| G28 | "+ N more in Category" expand | 🔧 confirmed | S |

## CP6d-Recipe items

| ID | Item | Status | Cost |
|---|---|---|---|
| G38 | Recipe-add modal rebuild (list picker) | 🔧 confirmed | M |
| G38b | RecipeDetailScreen dual CTAs | 🔧 confirmed | S |

## CP6d-SupplyDetail items

| ID | Item | Status | Cost |
|---|---|---|---|
| P7 | SupplyDetailScreen new build | 🔲 main blocker | L |
| P9 | T1 inversion → SupplyDetail wire | 🎨 → addressing | XS |
| P14 | ManageSuppliesScreen deletion | 🎨 → addressing | XS |
| Q-NEW-26 | "Find recipes" CTA + initialIngredient param | 🔲 → addressing | S |

## Parallel workstream items

| ID | Item | Status | Cost |
|---|---|---|---|
| X6 | Catalog audit (plural + missing items) | 🔧 prereq | S |
| O3 | 8D matching upgrade (normalization + staples) | 🔲 brought forward | M-L |

## Items confirmed shipped (from verify pass)

| ID | Item | Status |
|---|---|---|
| G1 | View-card filter-rule subtitle | ✅ confirmed in source |
| G19 | Status default Need-only in creator | ✅ confirmed in source |
| Most CP5/CP6a/b/c items | Per existing audit doc | ✅ unchanged |

## Items deferred post-F&F (explicit confirmation)

| ID | Item | Reason |
|---|---|---|
| P4 | Brand inline in supply row | Defer; revisit if smoke surfaces |
| P5 | 3-col grid view alternative | List view scales fine |
| P6 | Grid/List toggle | Coupled to P5 |
| P10 | For-user picker in SupplyCreateSheet | P8R-D13 — household-wide default fine pre-F&F |
| P12 | Spawn toast Edit action | Undo + long-press fallback workable |
| G17 | Filter editing on default views | P8R-D12 reversible 3-line flip |
| G25 | For-user picker in AddNeedSheet | P8R-D13 |
| G34 | For-user picker in EditNeedSheet | P8R-D13 |
| G40 | Auto-urgency from meal calendar | P8R-D9 |
| LR3 | Storage as render mode in Pantry | Implicit via On Hand grouping |
| LR4 | Family-grouped + Storage-grouped views | Replaced by category sub-sections |
| O1 | Ingredient Detail screen full | 8D-CP1 post-8R |
| O2 | Freezer Cleanout full screen | Replaced by stale-items banner |
| O5 | Natural-language search | 8E-CP2 post-launch |
| O6 | Locked filter chips | 8E-CP3 post-launch |
| O7 | Inline tap-sheet on recipe rows | 8D scope post-8R |
| Subgroup hierarchy | P8R-D8 | Post-F&F |
| Cold-start polish | P8R-D11 | Post-F&F |

## 🪦 register — final disposition

| ID | Item | Disposition |
|---|---|---|
| LR1 | Quantity-on-supplies | KEPT CUT. Status enum + usage_level richer than pre-R quantity. Revisit only if 8D matching needs it. |
| LR2 | Expiration tracking | KEPT CUT. Replaced by `tracking_mode` + storage-aware staleness. |
| LR3 | Storage location | REVIVED as first-class column. Better than tag dimension for inference. |
| LR4 | Family/Storage view modes | REPLACED by Regulars/On Hand split + per-category sub-sections. |
| LR5 | Expiring items banner | REPLACED by stale-items banner (NEED-5). |
| LR6 | +/- quantity buttons (grocery) | REVIVED as Gap-G7. |
| LR7 | ✕ inline delete (grocery) | DEFER. Long-press → modal works for F&F. Could add swipe-to-delete post-F&F. |
| LR8 | Place in Pantry bulk button | REPLACED by Bulk Acquire + promotion prompt (decision Q1 b). |
| LR9 | Cross-list cross-checkoff | KEPT CUT. Architecturally unnecessary in unified-needs model. Olive-oil case handled by G41 dedup softening. |

---

# Open questions remaining

Just three. All low-stakes, post-CP6d-Schema.

**OPEN-1:** Inline +/- buttons on quantity — increment by 0.5 (pre-R precedent) or 1 (simpler)? **Lean: 1, with optional 0.5 if we want pre-R parity.** Decide during CP6d-ViewDetail build.

**OPEN-2:** "On Hand" sub-grouping — by category (mirrors Regulars) or by staleness desc? **Lean: by category** — consistent with Regulars, predictable. Staleness signal lives in the banner. Decide during CP6d-Pantry build.

**OPEN-3:** Long-press on supply rows post-Tab 8 ship — keep as power-user shortcut or remove? **Lean: keep** — defensive, hidden affordance, costs nothing. Decide post-smoke.

---

# Recommended execution order

**Sequential (dependency chain):**

1. **CP6d-Schema** (1 session, ~3-5 days)
2. **CP6d-Pantry** + **CP6d-ViewDetail** in parallel (2 sessions overlap, ~1-1.5 weeks each)
3. **CP6d-Sheets** + **CP6d-Recipe** in parallel (2 sessions, ~3-5 days each)
4. **CP6d-SupplyDetail** (1 session, ~1 week)

**Parallel workstreams:**
- Workstream A (catalog audit) — anytime; CC prompt
- Workstream B (8D matching upgrade) — anytime; CC prompt

**Smoke testing:**
- Mid-stack smoke after CP6d-Pantry + ViewDetail land (catches integration bugs early)
- Full-surface smoke after CP6d-SupplyDetail lands
- Final F&F smoke after parallel workstreams complete

**Total estimated CP6d duration:** 3-4 weeks of focused work.

**F&F target:** late June 2026 — achievable if CP6d kicks off this week.

---

# What I need from Tom to start CC prompt drafting

1. **Confirm the CP grouping** — or push back on splits (e.g., "merge Sheets into Recipe" or "split Pantry into Pantry-A/B").
2. **Confirm starting CP** — recommend CP6d-Schema first (everything else depends on it).
3. **Pick a smoke checkpoint cadence** — mid-stack (after Pantry+ViewDetail) vs full-stack only?
4. **Authorize doc updates** — once CP grouping is locked, update PHASE_8R, FF_LAUNCH_MASTER_PLAN, DEFERRED_WORK to reflect CP6d scope and 8D-pull-forward.

Once those are answered, I can draft the first CC prompt for CP6d-Schema in the next exchange.

---

# Changelog

| Date | Version | Change |
|---|---|---|
| 2026-05-04 | 0.2 | Walkthrough complete (5 rounds with Tom). All ❓ resolved. ~12 new gaps added. CP grouping organized. Ready for execution. |
| 2026-05-04 | 0.1 | Initial draft. ~50 gaps surfaced; matrix in by-domain organization. 10 open questions. |
