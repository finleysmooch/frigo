# Phase 8R — Unified Household Needs

**Version:** 0.6  
**Last updated:** 2026-05-06  
**Status:** 🔲 Planning — wireframe dev ✅ COMPLETE 2026-04-29 (v3 with audit pass + follow-up resolution); CP6e-Lots wireframes v2 added 2026-05-06; CP6e-Schema + catalog plural audit migrations shipped 2026-05-06  
**Estimated:** 8-10 weeks of focused work (replaces ~3-4 weeks of remaining Phase 8 scope; CP6e adds ~3-4 weeks)

---

## Why this phase exists

Phase 8C-Shared shipped CP1 + CP2 + CP2b + CP2b.1 on 2026-04-28 within a "lists-as-containers" model. End-to-end smoke test (Tom + Mary) passed all paths. During CP3 design pass on 2026-04-29, Tom raised the question of how recipe ingredients route to lists and whether the underlying lists-as-containers model is the right architecture going forward.

After deep walkthrough, the conclusion was that **the model should be re-architected to filter-views over a unified "needs" bag**, with pantry staples generalized to "supplies" within the same model. The existing lists-as-containers concept doesn't cleanly express:
- Items belonging to multiple shopping contexts simultaneously (olive oil on Costco AND Groceries)
- The supply-vs-transient-need distinction Tom and Mary already operate on (Costco list = supplies that toggle in stock/out of stock; Groceries list = transient needs that lifecycle)
- Future store-aware reordering ("I'm at Fred Meyer, reorder by that store's aisle layout")
- Status as a first-class data dimension (urgency, storage location)

The core architectural insight that emerged: **pantry and grocery are unified surfaces in the user's mental model**. A supply low → spawns a need. A need acquired → replenishes a supply. They are the same lifecycle viewed from different sides. Today's separate `pantry_staples` + `grocery_lists` schemas treat them as separate domains; the unified model collapses them.

8R commits to this reframe. Tom signed off on 2026-04-29 with explicit acceptance of:
- F&F target slipping from early-to-mid June to **late July or August**
- 8C-Shared work shipped 2026-04-28 becoming throwaway (schema + RLS + service + UI all nuked)
- All existing pantry + grocery user data nuked (no migration path; fresh start)
- A 6-CP refactor sequence with wireframe dev as a planning prerequisite (✅ completed 2026-04-29 through 3 iteration rounds + audit pass + follow-up resolution)

---

## Architectural concept

### The model

The application has three primary entities replacing the current grocery-lists / pantry-staples model:

**Supplies** — household items kept in ongoing stock. Cycle through `in_stock → low → critical → out → in_stock` over time. Examples: olive oil, toilet paper, basmati rice. Supplies have:
- Identity (`ingredient_id` for cooking ingredients OR `custom_name` for non-ingredient items like toilet paper)
- Status (the 4-state enum) — but **initial state on supply-create is restricted to `in_stock`, `low`, or `out`** (per Q35). Critical only reachable via state-cycling after creation; it's a transitional state, not a valid initial state.
- Tags (store, storage location, brand preferences, etc.)
- Optional `for_user_ids UUID[]` field — supplies can be marked as belonging to a subset of household members. Empty array = household-shared, all current and future members (forward-compatible for membership changes per Q37). (Per D8R-Q27 / Q37, supersedes Q17's single-UUID model. Multi-user array supports "Tom + Mary's yogurt vs Charlie's" use cases.)

**Needs** — transient household needs. Cycle through `need → in_cart → acquired` and disappear (or archive). Examples: a one-off bottle of olive oil for tonight's recipe; bread; lemonade for the BBQ. Needs have:
- Identity (same flexibility as supplies)
- Status (the 3-state enum)
- Quantity + unit
- Tags (store, urgency, recipe-attribution, etc.)
- Recipe attribution via `needs_recipes` junction (replaces current `grocery_list_item_recipes`)

**Tags** — properties attached to supplies and needs. Hybrid taxonomy: predefined dimensions (`store`, `urgency`, `recipe`, `event`, `storage`) with user-created values within them. Tag values are scoped to space. (Aisle is NOT a tag dimension — see Q29; it's a render mode computed from `ingredients.typical_store_section`.)

**Views** — saved filter expressions. Combine tag predicates (multi-value within dimension; AND across dimensions) with status filters. Examples:
- "Costco" view = `WHERE status='need' AND tag store='costco'`
- "Tonight" view = `WHERE status='need' AND tag urgency='today'`
- "All needs" view = `WHERE status='need'`

Views are presented in the UI as "lists" — the familiar grocery-app affordance — while the underlying data is the unified bag.

### Status as field, not tag

Status updates frequently (every check-off). Storing status in a tag-membership table would mean INSERT/DELETE on every state change. Decision: **status is an enum column on the supply/need row**. Tags handle the slower-changing dimensions.

### Time-window views with derived hierarchy

Time-window tags (today, this-week, this-month) have logical containment: today ⊂ this-week ⊂ this-month. Stored hierarchy would mean writing 3 tags every time something is "today." Derived hierarchy at query time means views know that "this-week view" matches anything tagged today OR this-week OR no-time-tag-but-this-week-derived.

Decision: **derived hierarchy at query time** for time-window tags. Stored membership for store/recipe tags (no parent-child relationships there).

### Supply-spawn-need

When a supply transitions to `out`, the system **auto-creates a need** tagged with the supply's tags (store, etc.) plus default urgency. Need lives until acquired. Acquire restocks the supply.

Critical/low statuses are warnings, not action triggers — UI-only. (See D8R-Q10 for the deferred "configurable threshold" enhancement.)

### Configure-once-and-done (D8R-Q21)

A core operating principle that emerged from wireframe iteration: **the supply IS the configuration.** Once a user creates a supply for "olive oil" with quantity 2L, store=Costco, brand=Kirkland — every subsequent path to a need (Regulars-zone tap, recipe-add, auto-spawn-on-out, autocomplete from add-to-needs sheet) inherits those defaults. The full add-to-needs ceremony only happens for genuine first-time configurations or one-offs.

This collapses a recurring pain point in today's UX where users re-enter the same data (quantity, store, brand) every time they add olive oil to a list. After the first save-as-regular, all subsequent adds are essentially one tap.

### Regulars zone (D8R-Q20)

On every view detail screen, supplies whose tags match the view surface as a "Regulars" zone — Tom's iPhone Notes "click-to-add usuals" pattern. **Default state: collapsed strip** with one-line status summary ("Regulars · 3 out · 4 low · 16 in stock · Open ▸"). Tap → expanded multi-select interface, sorted out → low → in_stock with categories collapsing for in-stock items. Out items pre-selected on open (you're definitionally going to buy these).

Architecturally this is the same primitive as auto-spawn-on-out (D8R-Q10), but user-triggered for any supply at any status. Bridges pantry data → grocery action without a context switch.

### Recipe combine UX (D8R-Q28 + Q36)

When adding recipe ingredients to needs and an overlapping ingredient already has a need, the **needs stay separate** (preserving recipe attribution) BUT views render display-merged when the merge predicate matches: same `ingredient_id` + same `unit` + same store tags (as set) + same `for_user_ids` (as set). Different stores → stay separate (intentional separate purchases like "1 bottle from each store"). Different `for_user_ids` → stay separate (different intended owners). Recipe attribution and urgency tags do NOT block merge.

CP1 schema needs efficient indexing on `(ingredient_id, unit, store_tags, for_user_ids)` for merge-query performance — likely a composite index or derived hash. See Q36 for CP1 schema flag.

### Personal / household-subset supplies (D8R-Q27 + Q37 — supersedes Q17 + Q31)

Supplies and needs can be marked with a subset of household members via `for_user_ids UUID[]`.

**Write semantics (Q37):**
- "Everyone" selection in UI → writes **empty array**. Means "household-shared, all current AND future members." Forward-compatible: when household composition changes, an empty-array supply automatically applies to new members.
- Explicit subset selection (e.g., "Tom + Mary" in a 5-member household) → writes the array verbatim. Frozen even if household composition changes later.

**Render semantics (Q31, refined by Q37):**
- Empty array → "Everyone"
- Explicit-all-current-members array → "Everyone" (UI collapses; treats as if explicit-all)
- Explicit subset → "Tom + Mary"-style summary

**Schema (Q27):** Postgres array preferred over junction table for F&F (small cardinality, no per-user metadata). NO synthetic "everyone" flag column.

**Inheritance:** spawned needs inherit `for_user_ids` from parent supply (preserves user-intent through the spawn).

Q17's single-UUID model proved insufficient when Tom flagged the "family of 5" use case. Multi-user requires moving to Postgres array. Q31's render-only definition was completed by Q37 with the write-path rule.

### Multi-store membership

A supply can be tagged with multiple `store` values. Olive oil tagged `store:costco` AND `store:fred-meyer-fallback` shows up in either view. The "duplicate" problem the current model handles via cross-list prompts evaporates.

### Lot tracking (D8R-Q43-Q60)

**Two supply tracking modes.** Every supply has a `tracks_lots BOOLEAN` flag. Default `false` — most supplies (olive oil, salt, lemonade, eggs in the simple case) work as today: `usage_level` 5-circle indicator + manual cycle. When `true`, the supply tracks individual physical instances ("lots") with quantities, storage locations, and expirations.

**Lots are inventory facts; status is user judgment.** The two are decoupled. A user with 2 sealed bags of coffee can still mark the supply `Low` — meaning "we should buy more before we run out" — without that contradicting the qty. The only mechanical coupling: when total lot qty across all lots reaches 0, status auto-flips to `out` (D8R-Q44). When a lot is added to a supply currently in low/critical/out, status auto-flips to `in_stock` (D8R-Q45).

**One supply per ingredient; lots distinguish variants.** Fresh and frozen blueberries are ONE supply with TWO lots (different `storage_location`). Bone-in and boneless chicken thighs are ONE supply with multiple lots distinguished by `variant_label` (D8R-Q49). Search "blueberries" or "chicken" → finds the single supply, expanding to show relevant lots. The escape hatch — making them separate supplies — is available for power users who want different stores/tracking-modes per variant, but is not the default model.

**Variant grouping inside the supply row's expand panel.** When a supply has 2+ distinct `variant_label` values, lots render in collapsible variant sub-groups inside the lots list (D8R-Q50). Single-variant supplies show a flat list. Search-within-lots affordance surfaces when 4+ lots present (D8R-Q51).

**Cook depletion against lots.** When a recipe is cooked, the depletion plan draws qty from the oldest-expiring compatible lot first, with cross-lot decrement when needed (D8R-Q52). User can override per-ingredient via a lot picker. Lots that hit qty=0 auto-archive (`consumed_at = NOW()`).

**Cook depletion does NOT auto-demote status** for either lots or non-lots supplies (D8R-Q53). This reverses prior 8R behavior (one-step demotion in_stock → low → critical → out per cook). Users manage status manually; cooks decrement lot qty (lots supplies) or do nothing (non-lots supplies). The previous behavior was too aggressive — 5 cooks of olive oil per week would have it marked "out" by Sunday.

### Search across supply + lot dimensions (D8R-Q56)

**Multi-token AND across all dimensions.** Search input "frozen gluten free pizza" tokenizes into 3 tokens; each token must match at least one searchable dimension on the result. Match dimensions:
- `ingredient.name`, `ingredient.plural_name`, `ingredient.family`, `ingredient.ingredient_type`
- `supply.custom_name`, `supply.brands`
- supply tags (joined via `tags.value`: stores, dietary, custom)
- `supply_lots.variant_label`, `supply_lots.brand`, `supply_lots.notes`
- `supply_lots.storage_location` (matched via storage synonym map: "frozen" → freezer; "fridge"/"refrigerated"/"cold" → fridge; "shelf"/"cupboard" → pantry; "room temp" → counter)
- `for_user_ids` (search "Mary" matches lots/supplies for Mary)

**Server-side full-text search via tsvector.** Per D8R-Q57: F&F ships server-side search (RPC `search_supplies(query_text, space_id)` returning ranked matches), not client-side filter. Reasoning: "build it correctly" directive; data churns constantly via cooks/acquires; durability over speed-to-F&F. Adds ~5-7 days to CP6e budget. Trade-off explicitly accepted.

**Lot-level match highlighting.** When some lots match all tokens but not all do, the matching lots render with highlighted background; non-matching lots in the same supply are dimmed but visible. Match pills next to results indicate which dimensions matched.

### Catalog pluralization audit (D8R-Q58)

Existing catalog has algorithmic `name + 's'` pluralization which is wrong for mass nouns (dill, garlic, tarragon, cilantro, salt, sugar, milk, yogurt, etc.) and uncountables. Workstream A (parallel to CP6e build) sets `plural_name = NULL` for these. Display logic (`plural_name && qty > 1 ? plural_name : name`) handles NULL gracefully.

Bundles with the broader catalog data audit (P8R-D20 from CP5 smoke test).

### Edit-routing pattern (D8R-Q23)

When the user edits a spawned need's tags (via toast Edit action), they get an optional "Update default routing" toggle. ON → the supply's tags update too. So next time olive oil hits out, it routes to the new tags automatically. This is the "system is learning" payoff — configure once, edit once when it shifts, never manual-tag again.

The toggle is **conditionally hidden** when the need has no parent supply (e.g., manually-created one-off without save-as-regular). See Q34.

### State-cycle UI pattern split (D8R-Q30)

Two state-cycle interaction patterns coexist intentionally:
- **List-view dot tap** (Supplies grid) = tap-to-cycle. One tap advances state (in_stock → low → critical → out → in_stock). Compact, fast — for "I just used some" updates.
- **Detail-view 4-step strip** (Supply detail) = tap-to-set. Tap any step to set state directly. Precise — for "I want to mark this exactly."

Different mental models for different contexts. The UI affordance teaches each pattern via visual difference (single dot vs. 4-segment strip).

---

## Scope

### In scope

- New schema: `supplies`, `needs`, `tags`, `tag_memberships`, `views`, `view_filters`, `needs_recipes` (the junction). Composite index on needs `(ingredient_id, unit, store_tags, for_user_ids)` per Q36.
- Drop existing schema: `grocery_lists`, `grocery_list_items`, `grocery_list_item_recipes`, `pantry_staples`, `pantry_items`
- New service layer: `suppliesService`, `needsService`, `tagsService`, `viewsService`. Old services `groceryListsService` + `pantryStaplesService` deleted; `groceryService` (legacy) reviewed.
- Recipe-flow integration: `addItemFromRecipe` rewrites against needs; combine-prompt logic (D8R-Q28 / Q36); auto-tagging from current view context.
- Cook-flow integration: depletion routes to `setSupplyState`; on `out` transition, spawn-need fires.
- UX: replace `GroceryListsScreen` + `GroceryListDetailScreen` with `ViewsScreen` + `ViewDetailScreen`. 4 default views ship pre-baked. Custom-view creator (checkbox form). Supplies grid replaces staples grid (with search bar + Out/Low visual sub-labels + "+ N more" expand pattern). State cycle UI for supplies (list = tap-to-cycle; detail = tap-to-set). Regulars zone (collapsed default + expanded multi-select). Configure-once add-to-needs sheet. Edit-routing modal on spawn toast. Supply-create flow (Tab 12 — for "track this without needing it now"; initial-state restricted to in_stock/low/out per Q35).
- Cross-user smoke test: Tom + Mary household interaction across new model.
- **Lot tracking foundation.** `tracks_lots` opt-in flag. New `supply_lots` table. Lot-aware SupplyRow rendering (status-colored numeric badge + unit icon). Lot editor in SupplyDetail. Lot create inline in SupplyCreateSheet. Lot-aware cook depletion (oldest-first + manual override). Lot-aware grocery acquire (default-create with toast + edit). Server-side multi-dimension search via tsvector. Catalog plural_name audit.

### Out of scope (deferred to post-F&F or later phase)

- Configurable spawn-thresholds per supply (D8R-Q10 γ): F&F ships β (auto-spawn on `out` only)
- Quantitative supply tracking (battery scale): F&F ships status enum only
- OR-filter views: F&F ships AND-only filter expressions (multi-value within dimension is supported per D8R-Q16; cross-dimension OR is deferred)
- Combine-prompts at add-time: F&F renders display-merged at view-time only
- Sales/brand integration: Phase 9+
- Store-aware reordering: Phase 9
- Per-store brand preferences: see P8-2 (Phase 8 deferred). Brands surface as a free-form list on supplies for F&F.
- Subgroup-within-category hierarchy (P8R-D8)
- Auto-select urgency from meal calendar in recipe-add (P8R-D9)
- Cold-start / empty-state polish (P8R-D11) — wireframes deferred post-F&F per Tom 2026-04-29; F&F ships reasonable defaults
- Onboarding flow for new accounts: Phase 12
- Receipt scan to bulk-create lots
- Per-lot fill_level (partial-bag tracking)
- Per-supply auto-demote-on-cook toggle
- Multi-supply variant migration tooling
- Dedicated expiration flag in pantry Attention section

### Stays separate (NOT absorbed by 8R)

- **8A schema foundation** ✅ — already shipped. The schema concepts generalize cleanly to 8R's model.
- **8B staples & depletion** ✅ — already shipped. The "staples" concept becomes "supplies" but the data and UX patterns transfer.
- **8D recipe-pantry matching upgrade** — pushed to after 8R. 8D rewrites against the new substrate.
- **8E discovery polish + natural search** — pushed to after 8R. 8E filter/search rewrites against new substrate.

### Phase 8 sequence after 8R

```
8A ✅ → 8B ✅ → 8R (this phase) → 8D → 8E → F&F
```

---

## Decisions log

Captured during the 2026-04-29 design walkthrough + 3 wireframe iteration rounds + audit pass + audit follow-up.

### Foundational decisions (Q1-Q18, 2026-04-29 walkthrough)

| ID | Date | Topic | Decision |
|----|------|-------|----------|
| D8R-Q1 | 2026-04-29 | Tag taxonomy | Hybrid: predefined dimensions (`store`, `urgency`, `recipe`, `event`, `storage`) with user-created values within them. Free-form values give per-household specificity (e.g., "fred-meyer-hawthorne" as a store value). Aisle removed from this list per Q29. |
| D8R-Q2 | 2026-04-29 | Default views as "lists" | UI presents default + custom views as "lists" using familiar list terminology. Internally they're filter expressions. |
| D8R-Q3 | 2026-04-29 | Custom view UX | Form-style picker for F&F (checkbox-grouped per dimension; multi-select within dimension; AND across dimensions). Tag-chip include/exclude (Option B) deferred post-F&F. **Refined in Q19/Q25/Q29 wireframe iteration.** |
| D8R-Q4 | 2026-04-29 | Status as field vs tag | Field (enum column on supply/need row). Tags reserved for slower-changing dimensions. |
| D8R-Q5 | 2026-04-29 | Bulk vs immediate | Two distinct entities: bulk = supply, immediate = need. They coexist; recipe-combine UX renders display-merged at view time. |
| D8R-Q6 | 2026-04-29 | Recipe attribution | Junction table `needs_recipes` (analog of `grocery_list_item_recipes`); preserves attribution metadata + author. |
| D8R-Q7 | 2026-04-29 | Supply status cycles | Supplies cycle `in_stock → low → critical → out → in_stock`. Needs cycle `need → in_cart → acquired`. Independent state machines. |
| D8R-Q8 | 2026-04-29 | Migration | None. Nuke existing pantry + grocery data. Fresh start. |
| D8R-Q9 | 2026-04-29 | RLS / sharing | Tags scoped to space; views scoped to space. Supplies + needs scoped to space (with optional `for_user_ids UUID[]` field — see Q27/Q37). |
| D8R-Q10 | 2026-04-29 | Spawn semantics | β — Auto-create need when supply transitions to `out`. `low` and `critical` are warnings only. (γ configurable thresholds deferred — see P8R-D1.) |
| D8R-Q11 | 2026-04-29 | Recipe auto-tagging | Adding recipe ingredients to needs auto-applies the tags of the current view (when added from within a view). User can edit tags before submit. Time-window tags use derived hierarchy at query time. **Refined in Q24.** |
| D8R-Q12 | 2026-04-29 | Combine UX | Needs stay separate at add-time. Views render display-merged when merge predicate matches (predicate explicit in Q28 / confirmed by Q36). |
| D8R-Q13 | 2026-04-29 | Are pantry staples always supplies | Supplies broader category; pantry staples are cooking-ingredient subset. |
| D8R-Q14 | 2026-04-29 | Supply identity flexibility | Same as needs: `ingredient_id` (cooking) OR `custom_name` (custom). NOT NULL CHECK constraint for one-or-the-other. |
| D8R-Q15 | 2026-04-29 | Quantity on supplies | Status enum only for F&F. Quantitative scale deferred. |
| D8R-Q16 | 2026-04-29 | Composable views | AND-composable across dimensions for F&F. Multi-value within dimension supported. Cross-dimension OR deferred. |
| D8R-Q17 | 2026-04-29 | Personal supplies | ~~θ — Optional `for_user UUID NULL` field on supplies + needs.~~ **SUPERSEDED by Q27** (multi-user array). |
| D8R-Q18 | 2026-04-29 | Migration of existing pantry data | Nuke. No backfill. |

### Design decisions from wireframe iteration (Q19-Q27, 2026-04-29 wireframe rounds 1-3)

| ID | Date | Topic | Decision |
|----|------|-------|----------|
| D8R-Q19 | 2026-04-29 | Default view set | 4 default views ship pre-baked: **Tonight** (urgency=today), **This week** (urgency=this-week, includes today via derived hierarchy), **All needs** (status=need), **In cart** (status=in_cart). Defaults non-deletable but hidable from Lists home. Filter rule visible as small subtitle on view card (settles P8R-D6). |
| D8R-Q20 | 2026-04-29 | Regulars zone | View detail screens show a "Regulars" zone — supplies whose tags match the view's filter, sorted out → low → in_stock. **Collapsed default** = one-line status summary. **Expanded** = full-screen multi-select list; out items pre-selected on open. "+ Add new supply" routes to Tab 12 supply-create flow (per Q33). |
| D8R-Q21 | 2026-04-29 | Configure-once-and-done | The supply IS the configuration. Add-to-needs sheet is context-aware: existing supply → fast path; new item → full configure with optional "Save as regular" toggle. |
| D8R-Q22 | 2026-04-29 | Supply detail structure | First-class sections: **Stores**, **Brands**, other Tags. For-user demoted to settings row + multi-select sub-sheet. Two CTAs: Add to needs + Restock. State cycle strip (tap-to-set per Q30). Activity log. |
| D8R-Q23 | 2026-04-29 | Edit-routing on spawn toast | Toast on supply→out spawn has Edit + Undo. Edit modal: quantity, tag chips, "Update default routing" toggle. Toggle ON updates supply's tags. (Toggle hidden conditionally per Q34.) |
| D8R-Q24 | 2026-04-29 | Recipe-add UX simplified | Inline buttons + popup modal with urgency picker only. No store/list picker. |
| D8R-Q25 | 2026-04-29 | View detail render modes | Three render modes: **Tier** / **Aisle** / **Flat**. Per-view persisted preference. (Aisle is render mode, NOT tag dimension — see Q29.) |
| D8R-Q26 | 2026-04-29 | Supplies grid render | Two render modes: **List view** (default) and **3-col grid**. Out + Low pulled to combined attention section with visual sub-section labels. Search bar (per P8R-D7 RESOLVED). |
| D8R-Q27 | 2026-04-29 | Multi-user `for_user` (REOPENS Q17) | `for_user UUID NULL` → **`for_user_ids UUID[]`**. Empty array = household-shared. Multi-select sub-sheet UI. Inheritance: needs inherit from parent supply on spawn. (Write-path semantics refined by Q37.) |

### Design decisions from audit pass (Q28-Q34, 2026-04-29 audit review)

| ID | Date | Topic | Decision |
|----|------|-------|----------|
| D8R-Q28 | 2026-04-29 | Recipe combine merge predicate | Two needs render display-merged when ALL match: same identity + same unit + same store tags as set + same `for_user_ids` as set. Recipe attribution does NOT block merge. Urgency tags don't block merge. **Confirmed and rationalized by Q36.** |
| D8R-Q29 | 2026-04-29 | Aisle as render-only | Aisle is a render mode (Q25), NOT a user tag dimension. Computed at query time from `ingredients.typical_store_section`. Dropped from Q1 dimensions. |
| D8R-Q30 | 2026-04-29 | State-cycle UI pattern split | List = tap-to-cycle (speed). Detail = tap-to-set (precision). Intentional. |
| D8R-Q31 | 2026-04-29 | "Everyone" rendering | ~~UI synthetic. Empty array AND explicit-all-current-members both render as "Everyone."~~ **SUPERSEDED by Q37** (which adds the write-path rule that completes the semantics). |
| D8R-Q32 | 2026-04-29 | Status filter default | List creator's Status section defaults to **Need only**. Multi-status views permitted but advanced. Footnote in creator clarifies. |
| D8R-Q33 | 2026-04-29 | "+ Add new supply" routing | "+ Add new supply" on Expanded Regulars routes to **supply-create flow (Tab 12)**, NOT add-to-needs. Captures "track without needing now." Exception: state=Out picked → need auto-spawns on save (consistent with Q10). |
| D8R-Q34 | 2026-04-29 | Edit modal toggle visibility | "Update default routing" toggle hidden when need has no parent supply. Footnote: "No update-default toggle — this need has no parent supply." |

### Decisions from audit follow-up (Q35-Q37, 2026-04-29 audit reply)

| ID | Date | Topic | Decision |
|----|------|-------|----------|
| D8R-Q35 | 2026-04-29 | Supply create initial state restriction | Supply-create surface (Tab 12) restricts initial state picker to **In stock / Low / Out only**. Critical state OMITTED from initial picker — it's a transitional state that only emerges via state-cycling after first registration, not a valid initial state. Document at CP5 implementation that the omission is deliberate. Wireframe (v3 Tab 12) is consistent with this rule. |
| D8R-Q36 | 2026-04-29 | Recipe combine predicate (audit confirmation) | **Confirms Q28** with explicit rationale: store-distinct needs represent intentional separate purchases ("1 bottle from each store"); user-distinct needs represent different intended owners. Merging either would erase user intent. **CP1 schema flag:** the merge query needs efficient indexing on `(ingredient_id, unit, store_tags, for_user_ids)`. Likely a composite index or derived hash for query performance — designed at CP1. |
| D8R-Q37 | 2026-04-29 | `for_user_ids` write-path semantics (SUPERSEDES Q31) | **Write rule:** "Everyone" UI selection → writes **empty array** (means "household-shared, all current and future members" — forward-compatible). Explicit subset → writes the array verbatim (frozen subset; immune to membership changes). NEVER auto-populate empty selection with current member UUIDs. **Render rule** (unchanged from Q31): empty array OR explicit-all-current-members both render as "Everyone"; explicit subset renders as "Tom + Mary"-style summary. **Schema unchanged:** `for_user_ids UUID[]`, no flag column. The empty-vs-explicit semantic distinction matters when household composition changes. |

### Decisions from lot tracking iteration (Q43-Q60, 2026-05-05 → 2026-05-06 wireframe sessions v1+v2)

| ID | Date | Topic | Decision |
|----|------|-------|----------|
| D8R-Q43 | 2026-05-06 | Lot tracking opt-in (REOPENS Q4 / P8R-D4) | Add `supplies.tracks_lots BOOLEAN DEFAULT false`. When true, supply tracks individual lots (`supply_lots` table) with qty, storage, expiration. When false, today's status-only behavior preserved. **Reverses P8R-D4** ("status enum sufficient") for opt-in cases driven by Tom's real-life cases: chicken pack inventory, fresh-vs-frozen variants, multi-bag staples, eventual receipt scan. Status enum still sufficient for the 80% case (olive oil, lemonade, eggs in simple use). |
| D8R-Q44 | 2026-05-06 | Lot qty=0 auto-flips status to out | When all lots on a tracks_lots supply reach qty=0 (whether via cook depletion, manual edit, or explicit consume), supply.status auto-flips to `out`. This is the only mechanical coupling between lots and status. |
| D8R-Q45 | 2026-05-06 | Lot add auto-restocks status | When a lot is added to a tracks_lots supply currently in low/critical/out status, supply.status auto-flips to `in_stock`. Edge case (small lot added but supply still genuinely low): toast shows "Status updated to In stock — undo?" with 5s auto-dismiss. |
| D8R-Q46 | 2026-05-06 | Lot fields | `supply_lots`: id, supply_id (FK), quantity NUMERIC, quantity_unit TEXT, storage_location TEXT, acquired_at TIMESTAMPTZ DEFAULT NOW, expires_at TIMESTAMPTZ NULL (computed default = acquired_at + ingredient.shelf_life_days_<storage>; user-overridable), variant_label TEXT NULL, brand TEXT NULL, notes TEXT NULL, consumed_at TIMESTAMPTZ NULL (soft-delete), search_vector tsvector. |
| D8R-Q47 | 2026-05-06 | Storage move recomputes expiration | When a lot's `storage_location` changes (e.g., fresh→freezer to extend shelf life), `expires_at` recomputes from current date + new-storage shelf-life — UNLESS user has previously overridden expires_at, in which case the override is preserved. Toast: "Expiration updated: now Feb 6 (was May 9)" for affordance discoverability. |
| D8R-Q48 | 2026-05-06 | Lot consume → auto-archive | When lot qty reaches 0 (via cook depletion or manual edit), set `consumed_at = NOW()`. Manual "mark consumed" available on lot row in SupplyDetail for cases where depletion didn't fire (ate raw, gave away, threw out). Archived lots excluded from active aggregations; remain queryable for activity history. |
| D8R-Q49 | 2026-05-06 | Variant model — variant_label vs separate supplies | Default: ONE supply per ingredient with `variant_label` per lot for sub-types ("bone-in skin-on" / "boneless skinless" / "fresh" / "frozen"). Fresh/frozen specifically is implicit from storage_location, not variant_label. variant_label is the escape hatch for catalog-imperfection cases. Power users can opt to model variants as separate supplies (different ingredient_id parents or different supply rows under same ingredient_id) when they want store/tracking-mode distinctions per variant. F&F doesn't need bulk migration tooling for variant-to-supply splits. |
| D8R-Q50 | 2026-05-06 | Variant sub-headers in lots list | When a supply has 2+ distinct variant_label values, lots list inside the expand panel renders variant sub-groups: each with collapsible header (variant name + count + summary stats), independently expandable. Single-variant supplies show flat list, no headers. |
| D8R-Q51 | 2026-05-06 | Search-within-lots affordance | Search input inside the lots list when a supply has 4+ lots. Filters lots by all the same dimensions as global search (variant_label, brand, storage, notes, for_user_ids, expiration window). Below the global threshold, scanning works fine. |
| D8R-Q52 | 2026-05-06 | Cook depletion default = oldest-first across lots | Depletion plan draws from oldest-expiring compatible lot first. When no single lot has enough, draws from oldest-first then next-oldest until quota met (cross-lot decrement). Lots that hit qty=0 auto-archive (Q48). User can override per-ingredient via lot picker (multi-select) in the depletion banner. Existing rollback / spawn-on-out semantics preserved. |
| D8R-Q53 | 2026-05-06 | Cook does NOT auto-demote status (REVERSES prior 8R-CP3 rule) | Previous 8R cook depletion logic (`cookTransition` in `cookDepletionService`) demoted supply status one step per cook regardless of recipe scale. New rule: tracks_lots supplies decrement lot qty only (status auto-flips to `out` only when total qty=0 per Q44). Non-tracks_lots supplies do nothing on cook — user manages status manually. Rationale: previous rule too aggressive ("5 cooks of olive oil per week marked it out by Sunday"). Per-supply auto-demote toggle deferred to P8R-D31 (post-F&F). |
| D8R-Q54 | 2026-05-06 | Status cycle preserved on lot supply badges | Tap on the lot-aware badge (number + unit icon) cycles `supply.status` exactly like tap on the 5-circle dots cycles a non-lot supply. Number doesn't change; color and label do. The two badge types are visually distinct (5-circle dots vs numeric badge) but interactively identical. |
| D8R-Q55 | 2026-05-06 | Accent color always mirrors status | The supply row's left-bar accent color is driven by `supply.status` only, not by lot expiration urgency. Soonest-expiring lot urgency surfaces via the lot row's own warn-border + "exp in Xd" text (visible when expanded). Decoupled — prevents accent flicker when a single lot crosses an expiration threshold. The pantry's "Attention" section is the right place to surface "berries expiring soon" via expiration flag (post-F&F enhancement; tracked as P8R-D33). |
| D8R-Q56 | 2026-05-06 | Search dimensions across supply + lot | Multi-token AND across: ingredient.name/plural_name/family/ingredient_type, supply.custom_name/brands, supply tags (stores/dietary/custom), lot.variant_label/brand/notes, lot.storage_location (via synonym map), for_user_ids. Tokens AND across results — every token must match at least one dimension on the surfaced supply (or one of its lots). |
| D8R-Q57 | 2026-05-06 | Search infrastructure: server-side tsvector | Server-side full-text search via PostgreSQL tsvector + GIN index, exposed through RPC `search_supplies(query_text, space_id)`. Triggers maintain tsvector on supply + lot writes. Storage synonym map applied at RPC level (query expansion: token "frozen" → token list "frozen | freezer"). Adds ~5-7 days to CP6e budget vs client-side filter alternative; explicitly accepted per "build it correctly" directive. F&F target slips ~1 week. |
| D8R-Q58 | 2026-05-06 | Storage synonym map | Static client-side const + server-side equivalent: "frozen" → freezer; "fridge"/"refrigerated"/"cold" → fridge; "shelf"/"cupboard"/"pantry" → pantry; "room temp"/"counter" → counter. Applied as query expansion at search time. |
| D8R-Q59 | 2026-05-06 | Catalog plural_name audit (CONFIRMS P8R-D20 within CP6e scope) | Set `plural_name = NULL` for mass nouns and uncountables. Display logic already handles NULL gracefully via `plural_name && qty > 1 ? plural_name : name`. Bundles with broader catalog data audit (P8R-D20). Run as parallel CC workstream during CP6e build. |
| D8R-Q60 | 2026-05-06 | tracks_lots toggle hidden when lots exist | When user opens SupplyDetail and the supply has 1+ active (non-archived) lots, the "Track quantity / lots" toggle is hidden. To toggle off, user must first archive all lots (overflow menu → "Archive all lots"). Avoids destructive confirmation modal; makes the destructive action discoverable through the menu rather than an accidental toggle flip. |

### Deferred decision points (P8R-D series)

| ID | Topic | Why deferred |
|----|-------|--------------|
| P8R-D1 | Configurable spawn thresholds (γ enhancement of Q10) | F&F ships β; tester usage will inform. |
| P8R-D2 | OR-filter views (Q16 enhancement) | F&F ships AND-only; complexity not justified pre-F&F. |
| P8R-D3 | Add-time combine prompts (Q12 enhancement) | View-level merge sufficient for F&F. |
| P8R-D4 | ~~Quantitative supply tracking~~ (Q15 enhancement) | **REOPENED 2026-05-06 by D8R-Q43.** Lot tracking opt-in via `tracks_lots` flag — selective, per-supply. Status enum remains sufficient for non-lots cases. |
| P8R-D5 | Hierarchy storage strategy beyond F&F | Currently derived-at-query. |
| P8R-D6 | ~~View-rule visibility UX~~ | **RESOLVED 2026-04-29** by Q19/Q22. Rules visible in 3 places. |
| P8R-D7 | ~~Search bar on Supplies grid + Expanded Regulars~~ | **RESOLVED 2026-04-29** as F&F-prereq. Wireframed in v3 Tab 7 + Tab 10. |
| P8R-D8 | Subgroup-within-category hierarchy | F&F category-level grouping should carry. |
| P8R-D9 | Auto-select urgency from meal calendar | Polish; not blocking. |
| P8R-D10 | Pre-select-out-items default in expanded Regulars | F&F ships pre-selected; per-user setting if testers prefer otherwise. |
| P8R-D11 | Cold-start / empty-state polish | F&F ships reasonable defaults. Per Tom 2026-04-29: be thoughtful with the design but not where we focus pre-F&F. Dedicated wireframes for first-launch UX deferred post-F&F. |
| P8R-D22 | **Receipt scan → bulk lot create.** Take photo of grocery receipt → Claude Vision extracts line items → bulk-create supplies + lots in one flow with per-line edit affordance. Architectural slot reserved (D8R-Q46 + Q-V14). | Post-F&F priority. Reuses existing `claudeVisionAPI.ts` recipe-extraction infrastructure. UPC/PLU mapping schema decided when receipt scan data flows. |
| P8R-D23 | **Per-lot fill_level.** "Open coffee bag is at 30%" partial-fill tracking on individual lots. Decided against for F&F (D8R-Q53 path keeps status manual; users tap status badge to signal Low). Worth reconsidering if testers manage open-bag fill manually and find it tedious. | Post-F&F polish. |
| P8R-D31 | **Per-supply auto-demote toggle.** Restore the pre-CP6e cook auto-demotion behavior as an opt-in per-supply setting ("Decrement status on cook"). Some users may want it, especially for non-tracks_lots supplies that they don't want to manage manually. | Post-F&F. Default off. UI surfaced in SupplyDetail tracking section. |
| P8R-D32 | **Multi-supply variant migration.** Tooling to split one ingredient's supplies (e.g., "chicken thighs" with bone-in + boneless variants) into multiple supplies under the same ingredient_id. F&F doesn't need this — variant_label on lots covers the case. | Post-F&F. Reactive to tester demand. |
| P8R-D33 | **Expiration flag in pantry "Attention" section.** Lots expiring within N days surfaced as their own attention sub-category, alongside Low/Out. F&F just shows expiration on the expanded row + via accent color of warn lots. The dedicated attention surfacing makes proactive triage stronger. | Post-F&F. Threshold likely user-configurable (3 days default for fresh items, 7 days for staples). |

---

## Build plan

| Sub-phase | Checkpoints | Sessions | Status |
|-----------|-------------|----------|--------|
| Wireframe dev | (no CP — planning prerequisite) | 2 sessions + audit pass + follow-up | ✅ COMPLETE 2026-04-29 (v3 final at `docs/wireframes/phase_8r/`) |
| 8R-CP1 | Schema foundation | 1 | 🔲 Drops + creates schema, RLS, indexes; nukes existing pantry + grocery data. **Includes `for_user_ids UUID[]` per Q27/Q37.** Aisle is computed not stored (per Q29). **Composite index on `(ingredient_id, unit, store_tags, for_user_ids)` for merge queries per Q36.** |
| 8R-CP2 | Service layer foundation | 1-2 | 🔲 New services; supply→need spawn function; "Save as regular" service hook. Recipe combine predicate per Q28/Q36. for_user_ids write-path implements Q37 (Everyone → empty array; explicit → verbatim). |
| 8R-CP3 | Recipe + cook flow integration | 1-2 | 🔲 Rewires `addItemFromRecipe` + cook-depletion against new model; recipe-add popup modal (Q24); auto-spawn-on-out toast (Q23) with conditional toggle visibility (Q34). |
| 8R-CP5a | View infrastructure (ViewsScreen + ViewDetailScreen + ViewCreatorModal + render modes Tier/Aisle/Flat + last pantry-era import closed) | 1 | ✅ Shipped 2026-04-30 |
| 8R-CP5b | Add-Need Sheet (configure-once-and-done, 3-tier autocomplete) + Expanded Regulars (Out/Low/In stock multi-select with idempotency) + getNeedsForView recipe-hydration (Part 0) + final orphan purge | 1 | ✅ Shipped 2026-04-30 |
| 8R-CP6a | Service fixes + small UX polish (createNeed dedup hoist, RecipeDetailScreen pantry-match fix, UnitPicker swap, AddNeedSheet T3 always-visible, PantryScreen long-press status jump-set) | 1 | 🔲 Planning |
| 8R-CP6b | Tab 12 supply create + Tab 9 spawn-on-out toast + Tab 9 edit-need modal | 1-2 | 🔲 Planning (depends on CP6a) |
| 8R-CP6c | Cart visibility (collapsible footer + progress bar) + bulk acquire on In Cart view + filename rename + lib/types/grocery.ts deletion + PK_CODE_SNAPSHOTS reconciliation | 1 | 🔲 Planning (depends on CP6b) |
| 8R-CP6e | Lots schema + service layer + UI rebuild + search RPC + catalog audit | 4-6 | 🔲 Planning (depends on CP6c). Heaviest CP of 8R series. Split into a/b/c/d sub-checkpoints. |

**Estimated total:** 8-10 weeks of focused work.

---

## Wireframe development

✅ **COMPLETE 2026-04-29.** Three iteration rounds with Tom + audit pass + audit follow-up settled the 8R UX.

**Final wireframes live at:** `docs/wireframes/phase_8r/`

- `phase_8r_wireframes_v3.html` — single consolidated file, 12 surfaces, 1660 lines. v3 incorporates 8 substantive audit fixes inlined as blue callouts. Visual is consistent with all 30+ decisions including Q35-Q37 from audit follow-up (Q35 already shown via Tab 12's 3-state picker; Q36 confirms wireframed merge logic; Q37 is a write-path rule not visualizable, captured in PHASE_8R only).
- `phase_8r_lots_wireframes_v2.html` — CP6e-Lots wireframes, 10 surfaces, ~1950 lines. Adds variant supply rendering (lots-aware badge, collapsible variant sub-headers, search-within-lots), supply detail with lots editor, supply create with lots toggle, multi-dimension search demo, cook depletion against lots, grocery acquire → lot create. Visual language matches actual app screenshots from 2026-05-06; supersedes 8R wireframe v3 aesthetic for CP6e-touched surfaces.
- `phase_8r_wireframes_README.md` — reference guide for execution.

**12 surfaces, 30+ variants, 19 new design decisions captured (Q19-Q37).**

The wireframes are the canonical reference for CC during 8R-CP3 through CP6 execution. Schema design (CP1) references decisions in this doc; execution prompts during CP3-CP6 will paste tab-and-variant references for visual specificity.

---

## Prerequisites for CP1

- ✅ Wireframe dev complete (2026-04-29 v3 with audit pass + follow-up)
- Tom and Mary have backed up any data they want to preserve OUTSIDE Frigo (the nuke is destructive)
- 8C-Shared schema present in DB (will be dropped by CP1)

---

## Cross-references

- **`FF_LAUNCH_MASTER_PLAN.md` updates needed:** Phase 8 sequence revised — 8R inserted between 8B and 8D. F&F target shifted late July or August. Suggest v6.2 changelog row.
- **`PROJECT_CONTEXT.md` updates needed:** Active phase shifts to Phase 8R. v10.2.
- **`DEFERRED_WORK.md` updates needed:** P8R-D1 through P8R-D11 added. P8-24 ✅ Resolved by 8C-Shared-CP2b. 8C-Shared-related items reviewed. v5.17.
- **`PHASE_8_PANTRY_INTELLIGENCE.md` updates needed:** v2.15 — mark 8C-Shared sub-phase superseded; add 8R row; reflect wireframe completion (12 surfaces, 19 new decisions Q19-Q37).

---

## CP6 detailed scope (planning, 2026-04-30)

CP6 splits into three sub-checkpoints based on dependency order and risk profile. CP6a is small + prerequisite (createNeed dedup before CP6c's bulk acquire builds on it; pantry-match fix unblocks F&F testing of any cooking flow). CP6b is the heavy structural build (Tab 12 + Tab 9 are both modal/sheet additions sharing patterns). CP6c is polish + cleanup, ships last when everything else is stable.

### CP6a — Service fixes + small UX polish

Risk: low. Prerequisite for CP6b (Tab 12 builds on createNeed dedup) and CP6c (bulk acquire builds on createNeed dedup).

1. **createNeed supply_id dedup hoisting.** Service-layer fix to `needsService.createNeed`. Currently AddNeedSheet T1 fast path can create duplicate active needs for an existing supply (smoke test confirmed gap; only ExpandedRegularsSheet has inline dedup). Hoist to service layer so all consumers benefit (AddNeedSheet T1, ExpandedRegularsSheet, future bulk-acquire flow, addNeedFromRecipe). When `supply_id` is set and an active need (`status IN ('need','in_cart')`) already exists for that supply in the same space, return the existing need ID rather than create a duplicate.
2. **RecipeDetailScreen pantry-match fix.** Currently reads from deleted `pantry_items` table (smoke test: basmati rice in supplies still shows as "needed" on recipe detail). Re-point to `supplies` table. Likely a single service file (`lib/services/ingredientService.ts` or similar pantry-match helper) + the consumer screen. Estimated ~30-50 line change.
3. **UnitPicker swap in AddNeedSheet.** Currently plain TextInput with `typical_unit` default; smoke test surfaced free-text units as a dirty-data risk. Swap to existing `UnitPicker` component (from CP4.5; ~120 lines drop-in) for controlled vocabulary.
4. **AddNeedSheet T3 always-visible custom row.** Smoke test feedback: "Add custom: '{query}'" should always be visible at 2+ chars rather than conditional on no T1/T2 match. One row, persistent in autocomplete results.
5. **Long-press on PantryScreen StaplesGrid → status jump-set.** Long-press a supply tile → action sheet with In stock / Low / Critical / Out. Direct jump-set, bypasses the cycle-tap. Mirrors PantryScreen's existing supply-tile interaction model.

### CP6b — Tab 12 + Tab 9 build-out

Risk: medium-high. Heaviest CP of the 8R series. Three new modal/sheet surfaces; shares autocomplete + tag-picker patterns from CP5b's AddNeedSheet (no new shared primitives unless multiple consumers emerge — see DEFERRED_WORK P8R-D14).

1. **Supply create flow (Tab 12).** Wired from current "+ Add new supply" stubs (PantryScreen FAB; ExpandedRegularsSheet footer). 3-tier autocomplete mirrors AddNeedSheet but with Tier 1 inverted ("this already exists, edit it instead" path). Initial state restricted to In stock / Low / Out per Q35. "Add custom" affordance always-visible per smoke-test feedback.
2. **Spawn-on-out toast (Tab 9 — ephemeral toast).** Surfaces when supply transitions to `out` (cook-flow depletion or manual cycle). Toast shows "Olive oil out → added to needs" with Edit + Undo actions. Edit opens edit-need modal (CP6b item 3). Undo reverts both supply state and the spawned need.
3. **Edit-need modal (Tab 9 — long-press on need row).** Replaces the current tap-to-cycle as the only need-edit affordance. Long-press a need row in ViewDetail → modal with quantity, tag chips, "Update default routing" toggle. Toggle ON updates supply's tags per Q23/Q34 conditional visibility rules.

### CP6c — Cart visibility + bulk acquire + final cleanup

Risk: low-medium. Polish + cleanup. Several items are independent and can be reordered if any blocker surfaces.

1. **Collapsible cart footer section on need-only views.** Smoke test: user wants visibility into cart contents when looking at "Tonight" (which filters to status=need only). Per Tom's option B selection: collapsed default reads `🛒 5 in cart ▸`; tap → expands to show in_cart rows scoped to the same view filter. Sticky at bottom of ViewDetail. NOT shown on views that already include `in_cart` in their status filter (e.g., the In Cart default view itself).
2. **Cart progress bar.** Horizontal bar at top of ViewDetail (below render-mode toggle). Format: `5/12 (42%)` — show numerator, denominator, and percentage. Numerator = acquired count for the view's session; denominator = total (need + in_cart + acquired) for the view; percentage rounded to nearest integer. Resets per-view (not per-session — think of it as "how far through this list"). Reuses gamification pattern Tom liked from prior app version.
3. **Bulk acquire on In Cart view.** Footer action bar on the In Cart default view: "Acquire all (N) → restocks N supplies". Bulk transitions all in_cart needs to acquired. For needs with `supply_id` set, restocks the parent supply via existing cookDepletion-equivalent path. Uses CP6a's createNeed dedup pattern (idempotent — re-tap doesn't double-restock).
4. **Filename rename.** `screens/GroceryListsScreen.tsx` → `screens/ViewsScreen.tsx`; `screens/GroceryListDetailScreen.tsx` → `screens/ViewDetailScreen.tsx`. Update all navigation refs (App.tsx ParamList + Screen registration + any inter-screen navigate calls). Held back from CP5a/b to avoid touching nav refs in two CPs; CP6c does both renames + nav refs in one pass.
5. **`lib/types/grocery.ts` deletion.** CP5b verified zero `groceryListsService`/`groceryService`/`pantryStaplesService` imports across project. Type file may have lingering consumers — verify via grep before delete; clean any holdouts.
6. **PK_CODE_SNAPSHOTS reconciliation.** ViewsScreen + ViewDetailScreen snapshots stale (HIGH-tier rewrites in CP5a). New components need tier assignment: ViewCreatorModal (Tier 3 by analogy), AddNeedSheet (Tier 3), ExpandedRegularsSheet (Tier 3). Removed component rows: AddGroceryItemModal, QuickAddSection, InlineQuantityPicker.

---

## CP6e detailed scope (planning, 2026-05-06)

CP6e is the lots model implementation. Scope is large enough to split into 4 sub-checkpoints by dependency order. CP6e-Schema must land before any UI; CP6e-Services builds the layer all UI consumes; CP6e-PantryUI rebuilds the pantry-side surfaces; CP6e-FlowsUI rebuilds cook + grocery flows. Search RPC and catalog audit run as parallel workstreams.

### CP6e-Schema — Lots schema + tsvector

Risk: medium. Schema additions only; no behavior change yet. F&F-blocking — all subsequent CPs build on this.

1. **`supplies.tracks_lots BOOLEAN DEFAULT false`.** New column. Existing supplies all default to `false` (status-only) — zero-disruption default.
2. **`supply_lots` table.** Per D8R-Q46. Includes `consumed_at` for soft-delete pattern. RLS policy mirrors supplies table (space-scoped, household-shared).
3. **`supplies.search_vector tsvector` + trigger.** Maintained from supply.custom_name + supply.brands + ingredient.name + ingredient.plural_name + ingredient.family + ingredient.ingredient_type + supply tag values.
4. **`supply_lots.search_vector tsvector` + trigger.** Maintained from variant_label + brand + notes + storage_location + for_user_ids (joined to space_members for first names).
5. **GIN indexes** on both search_vectors.
6. **RPC `search_supplies(query_text TEXT, space_id UUID)` → returns ranked supply IDs + match dimensions array.** Tokenizes query, applies storage synonym map (D8R-Q58), runs `to_tsquery` AND across tokens against unioned supply + lot vectors.
7. **Updated `getSuppliesForSpace`** signature to optionally include lots (`includeLots?: boolean`). When true, hydrates `supply_lots` array per supply. Maintains backward-compat for non-lots consumers.
8. **Catalog plural_name pre-audit query.** Read-only query to verify P8R-D20 / D8R-Q59 catalog audit safety: identify which `ingredients` rows would be affected. CC reports back; Tom approves the change set; CP6e-Services executes the UPDATEs as part of the catalog audit workstream.

### CP6e-Services — Lots service layer

Risk: medium-high. New service module + cookDepletion rewrite + grocery acquire rewrite. Behavior changes are substantive — testing before any UI lands is the gate.

1. **`lib/services/lotsService.ts`.** New module. CRUD for supply_lots (createLot, updateLot, archiveLot, getLotsForSupply). Aggregation helpers (getLotAggregate: total qty, soonest expiration, lot count, distinct variant count). Storage move with expiration recompute (D8R-Q47).
2. **suppliesService extensions.** `setSupplyTracksLots(supplyId, value)` — when flipping ON, create initial lot from current state if status is in_stock (or empty if low/out). When flipping OFF, archive all lots (only callable when no active lots — D8R-Q60). `setSupplyStatus` extension: auto-flip to `out` when total qty=0 (D8R-Q44); auto-flip to `in_stock` on lot add when prior status was low/critical/out (D8R-Q45).
3. **`cookDepletionService` rewrite.** Replace `cookTransition` per-cook demote with lot-decrement. For tracks_lots ingredients in the recipe, call `lotsService.deductFromOldest(supplyId, qty, qtyUnit)` returning the lots affected. Cross-lot decrement when needed. Auto-archive lots that hit qty=0. For non-tracks_lots ingredients in the recipe, no-op (D8R-Q53). Existing rollback (revert lot qty + un-archive) still works.
4. **Grocery acquire path → lot create.** When a need linked to a tracks_lots supply transitions need → in_cart → acquired (or directly need → acquired in bulk-acquire flow), default-create a lot via `lotsService.createLot` with: qty + unit from need, storage from supply default, acquired_at = NOW, expires_at computed. Auto-flip supply.status if applicable (Q45). Toast affordance to edit lot (handled in CP6e-FlowsUI).
5. **Catalog audit execution.** Per CP6e-Schema item 8: CC executes the approved UPDATE statements on `ingredients.plural_name` for mass nouns. Reports row count + spot-check sample.

### CP6e-PantryUI — Pantry-side surfaces

Risk: medium. Heaviest UI work. Components touched: SupplyRow, SuppliesSection, SupplyDetailScreen, SupplyCreateSheet, ExpandedRegularsSheet (lot-aware peek). Wireframes in `phase_8r_lots_wireframes_v2.html` are authoritative.

1. **SupplyRow lot-aware badge.** Numeric value + unit icon (count/bag/bottle/jar/pack/bunch/container/weight). Status-colored background. Tap-cycle on badge mirrors 5-circle tap-cycle. Auto-derived from `ingredient.typical_unit` at create time, user-editable.
2. **Inline expand panel — lots-collapser default closed.** Summary line "N lots · M total · oldest exp Date" + chevron. Tap opens lots list inline.
3. **Lots list with variant sub-headers.** Sub-headers shown only when 2+ distinct variant_labels (D8R-Q50). Each variant block independently collapsible. Lot rows show: storage badge, qty, variant (text), expires (with warn coloring inside threshold).
4. **Search-within-lots.** Inline search bar inside expand panel when 4+ lots (D8R-Q51).
5. **SupplyDetail lots section.** Replaces the usage_level slider for tracks_lots supplies. Lot rows tappable → lot edit modal. "+ Add lot" affordance. Tracking section gets second toggle: "Track quantity / lots." Default storage section adds help text "New lots default to this storage. Existing lots unaffected."
6. **SupplyCreateSheet lots toggle.** Off by default. When on, expands to show First Lot inline inputs (qty/unit, storage, optional variant_label, computed expiration). "+ Add another lot" for multi-lot create at registration (the chicken case: 4 lots at once).
7. **Lot edit modal (sheet).** Fields: storage (segmented), qty + unit, variant_label, brand, acquired_at (date picker), expires_at (computed default + override), notes, "Mark consumed" destructive action.
8. **Pantry overview rendering.** Mixed lot/non-lot rows side by side. Aggregate meta line on lot rows ("freezer · 8.75 lb"). Lot count cap on row (collapsed shows count; expanded shows full list).

### CP6e-FlowsUI — Cook depletion + grocery acquire surfaces

Risk: low-medium. Surface updates that consume CP6e-Services rewrites.

1. **CookDepletionBanner lot-aware.** Per-row: ingredient name + qty + drawn-from lot. "Change ▾" affordance opens lot picker (multi-select) for manual override. Default = oldest-first auto-pick. Lot picker confirms total qty meets recipe requirement.
2. **Grocery acquire toast.** Post-acquire toast for tracks_lots supplies: "Acquired: eggs · 12 ct · added to fridge · expires May 22 (auto)." Edit lot / Undo affordances. 5s auto-dismiss.
3. **Lot edit sheet from acquire toast.** Reuses CP6e-PantryUI's lot edit modal.
4. **Search results UI.** Multi-supply rendering. Match pills next to row name showing matched dimension (name / family / storage / tag / brand / variant). Lot-level highlighting when only some lots match — matching lots get yellow background, non-matching dim. For-user mini-badges (initials) on lots/supplies with non-empty for_user_ids.

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-06 | v0.6 | **Lots model added (CP6e). 18 new design decisions (Q43-Q60).** Reopens P8R-D4 (quantitative tracking) as opt-in `tracks_lots` flag. Reverses prior 8R cook auto-demote rule (Q53). Adds server-side tsvector search (Q57). New CP6e split into Schema → Services → PantryUI → FlowsUI sub-checkpoints + catalog audit parallel workstream. Wireframes at `docs/wireframes/phase_8r/phase_8r_lots_wireframes_v2.html`. F&F target slips from late July/August to late August/early September (~3 weeks total addition: lots schema + services + tsvector + UI rebuild). 5 new deferred items (D22, D23, D31, D32, D33 — D24-D26 already taken by CP6d entries; renumbered at merge time). 0 decisions superseded; 1 reopened. |
| 2026-04-30 | v0.5 | CP5a + CP5b shipped; CP6 split into a/b/c. Pantry/grocery-era purge milestone reached (zero deleted-service imports across project). Smoke test (2026-04-30) confirmed CP5 surface working; surfaced 5 UX additions + 1 regression (RecipeDetailScreen pantry-match) + 1 soft regression (PantryScreen blank on first launch — resolved by restart, not reproducible). CP6a (services + polish) → CP6b (Tab 12 + Tab 9) → CP6c (cart visibility + bulk acquire + cleanup). |
| 2026-04-29 | **0.4** | **Audit follow-up resolution — 3 new decisions (Q35-Q37).** Audit instance reviewed v3 wireframes + v0.3 PHASE_8R; raised 3 follow-up questions; Tom resolved all three. **Q35** Supply-create initial state restricted to in_stock/low/out (Critical only via state-cycling; not a valid initial state). **Q36** Confirms Q28 recipe combine predicate with explicit rationale (store-distinct = intentional separate purchases; user-distinct = different intended owners) + flags CP1 schema indexing on `(ingredient_id, unit, store_tags, for_user_ids)`. **Q37** Refines Q31 with write-path semantics: "Everyone" UI selection always writes empty array (= household-shared, all current AND future members; forward-compatible); explicit subset writes verbatim (frozen). **Q31 SUPERSEDED by Q37.** Architectural-concept and build-plan sections updated. Wireframes unchanged visually (Q35 already shown; Q36 confirmed; Q37 not visualizable). |
| 2026-04-29 | 0.3 | **Audit pass + wireframe v3 completed.** Async audit instance reviewed v1 consolidated wireframes; flagged 8 substantive issues + 1 gap. All addressed in v3. **7 new design decisions captured (Q28-Q34):** Q28 recipe combine merge predicate; Q29 aisle as render-only; Q30 state-cycle UI pattern split; Q31 "Everyone" rendering semantics; Q32 status filter default Need-only; Q33 "+ Add new supply" routes to Tab 12; Q34 edit modal toggle conditionally hidden. P8R-D7 RESOLVED. P8R-D11 added. New Tab 12 supply-create flow. Final wireframes consolidated to single file at `docs/wireframes/phase_8r/phase_8r_wireframes_v3.html`. |
| 2026-04-29 | 0.2 | **Wireframe iteration complete — 9 new design decisions added (Q19-Q27).** 11 surfaces wireframed across two HTML chunks with 3 iteration rounds. Q19 default view set; Q20 Regulars zone; Q21 configure-once-and-done; Q22 supply detail structure; Q23 edit-routing on spawn toast; Q24 recipe-add simplified; Q25 view detail render modes; Q26 supplies grid render; Q27 reopens Q17 with multi-user `for_user_ids UUID[]`. P8R-D6 RESOLVED. P8R-D7-D10 added. |
| 2026-04-29 | 0.1 | Initial draft. Captures 2026-04-29 design walkthrough decisions (D8R-Q1 through Q18) and 6-CP build plan. F&F target slips to late July or August. |
