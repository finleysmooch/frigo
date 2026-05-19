# CP6e-Lots Doc Addition — DRAFT for Tom's review

**Status:** Draft 2026-05-06. To merge into `PHASE_8R_UNIFIED_NEEDS_2026-04-30.md` once approved. Versions the doc to v0.6.

**What's here:**
- 18 new design decisions (D8R-Q43 through D8R-Q60)
- 1 superseded decision (D8R-Q4 → reopened by Q43)
- 5 new deferred items (P8R-D22 through P8R-D26)
- 1 new CP (CP6e-Lots) split into 4 sub-checkpoints
- Architectural-concept additions (3 new subsections)
- Scope changes (in-scope additions; nothing removed)
- F&F target update (mid-July → late-August)

---

## Section additions

### Add to "Architectural concept" (after `### Multi-store membership`, line 111-114)

#### Lot tracking (D8R-Q43-Q60)

**Two supply tracking modes.** Every supply has a `tracks_lots BOOLEAN` flag. Default `false` — most supplies (olive oil, salt, lemonade, eggs in the simple case) work as today: `usage_level` 5-circle indicator + manual cycle. When `true`, the supply tracks individual physical instances ("lots") with quantities, storage locations, and expirations.

**Lots are inventory facts; status is user judgment.** The two are decoupled. A user with 2 sealed bags of coffee can still mark the supply `Low` — meaning "we should buy more before we run out" — without that contradicting the qty. The only mechanical coupling: when total lot qty across all lots reaches 0, status auto-flips to `out` (D8R-Q44). When a lot is added to a supply currently in low/critical/out, status auto-flips to `in_stock` (D8R-Q45).

**One supply per ingredient; lots distinguish variants.** Fresh and frozen blueberries are ONE supply with TWO lots (different `storage_location`). Bone-in and boneless chicken thighs are ONE supply with multiple lots distinguished by `variant_label` (D8R-Q49). Search "blueberries" or "chicken" → finds the single supply, expanding to show relevant lots. The escape hatch — making them separate supplies — is available for power users who want different stores/tracking-modes per variant, but is not the default model.

**Variant grouping inside the supply row's expand panel.** When a supply has 2+ distinct `variant_label` values, lots render in collapsible variant sub-groups inside the lots list (D8R-Q50). Single-variant supplies show a flat list. Search-within-lots affordance surfaces when 4+ lots present (D8R-Q51).

**Cook depletion against lots.** When a recipe is cooked, the depletion plan draws qty from the oldest-expiring compatible lot first, with cross-lot decrement when needed (D8R-Q52). User can override per-ingredient via a lot picker. Lots that hit qty=0 auto-archive (`consumed_at = NOW()`).

**Cook depletion does NOT auto-demote status** for either lots or non-lots supplies (D8R-Q53). This reverses prior 8R behavior (one-step demotion in_stock → low → critical → out per cook). Users manage status manually; cooks decrement lot qty (lots supplies) or do nothing (non-lots supplies). The previous behavior was too aggressive — 5 cooks of olive oil per week would have it marked "out" by Sunday.

#### Search across supply + lot dimensions (D8R-Q56)

**Multi-token AND across all dimensions.** Search input "frozen gluten free pizza" tokenizes into 3 tokens; each token must match at least one searchable dimension on the result. Match dimensions:
- `ingredient.name`, `ingredient.plural_name`, `ingredient.family`, `ingredient.ingredient_type`
- `supply.custom_name`, `supply.brands`
- supply tags (joined via `tags.value`: stores, dietary, custom)
- `supply_lots.variant_label`, `supply_lots.brand`, `supply_lots.notes`
- `supply_lots.storage_location` (matched via storage synonym map: "frozen" → freezer; "fridge"/"refrigerated"/"cold" → fridge; "shelf"/"cupboard" → pantry; "room temp" → counter)
- `for_user_ids` (search "Mary" matches lots/supplies for Mary)

**Server-side full-text search via tsvector.** Per D8R-Q57: F&F ships server-side search (RPC `search_supplies(query_text, space_id)` returning ranked matches), not client-side filter. Reasoning: "build it correctly" directive; data churns constantly via cooks/acquires; durability over speed-to-F&F. Adds ~5-7 days to CP6e budget. Trade-off explicitly accepted.

**Lot-level match highlighting.** When some lots match all tokens but not all do, the matching lots render with highlighted background; non-matching lots in the same supply are dimmed but visible. Match pills next to results indicate which dimensions matched.

#### Catalog pluralization audit (D8R-Q58)

Existing catalog has algorithmic `name + 's'` pluralization which is wrong for mass nouns (dill, garlic, tarragon, cilantro, salt, sugar, milk, yogurt, etc.) and uncountables. Workstream A (parallel to CP6e build) sets `plural_name = NULL` for these. Display logic (`plural_name && qty > 1 ? plural_name : name`) handles NULL gracefully.

Bundles with the broader catalog data audit (P8R-D20 from CP5 smoke test).

---

### Add to "Decisions log" → new subsection after Q35-Q37 (line 232)

#### Decisions from lot tracking iteration (Q43-Q60, 2026-05-05 → 2026-05-06 wireframe sessions v1+v2)

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
| D8R-Q53 | 2026-05-06 | Cook does NOT auto-demote status (REVERSES prior 8R-CP3 rule) | Previous 8R cook depletion logic (`cookTransition` in `cookDepletionService`) demoted supply status one step per cook regardless of recipe scale. New rule: tracks_lots supplies decrement lot qty only (status auto-flips to `out` only when total qty=0 per Q44). Non-tracks_lots supplies do nothing on cook — user manages status manually. Rationale: previous rule too aggressive ("5 cooks of olive oil per week marked it out by Sunday"). Per-supply auto-demote toggle deferred to P8R-D24 (post-F&F). |
| D8R-Q54 | 2026-05-06 | Status cycle preserved on lot supply badges | Tap on the lot-aware badge (number + unit icon) cycles `supply.status` exactly like tap on the 5-circle dots cycles a non-lot supply. Number doesn't change; color and label do. The two badge types are visually distinct (5-circle dots vs numeric badge) but interactively identical. |
| D8R-Q55 | 2026-05-06 | Accent color always mirrors status | The supply row's left-bar accent color is driven by `supply.status` only, not by lot expiration urgency. Soonest-expiring lot urgency surfaces via the lot row's own warn-border + "exp in Xd" text (visible when expanded). Decoupled — prevents accent flicker when a single lot crosses an expiration threshold. The pantry's "Attention" section is the right place to surface "berries expiring soon" via expiration flag (post-F&F enhancement; tracked as P8R-D26). |
| D8R-Q56 | 2026-05-06 | Search dimensions across supply + lot | Multi-token AND across: ingredient.name/plural_name/family/ingredient_type, supply.custom_name/brands, supply tags (stores/dietary/custom), lot.variant_label/brand/notes, lot.storage_location (via synonym map), for_user_ids. Tokens AND across results — every token must match at least one dimension on the surfaced supply (or one of its lots). |
| D8R-Q57 | 2026-05-06 | Search infrastructure: server-side tsvector | Server-side full-text search via PostgreSQL tsvector + GIN index, exposed through RPC `search_supplies(query_text, space_id)`. Triggers maintain tsvector on supply + lot writes. Storage synonym map applied at RPC level (query expansion: token "frozen" → token list "frozen | freezer"). Adds ~5-7 days to CP6e budget vs client-side filter alternative; explicitly accepted per "build it correctly" directive. F&F target slips ~1 week. |
| D8R-Q58 | 2026-05-06 | Storage synonym map | Static client-side const + server-side equivalent: "frozen" → freezer; "fridge"/"refrigerated"/"cold" → fridge; "shelf"/"cupboard"/"pantry" → pantry; "room temp"/"counter" → counter. Applied as query expansion at search time. |
| D8R-Q59 | 2026-05-06 | Catalog plural_name audit (CONFIRMS P8R-D20 within CP6e scope) | Set `plural_name = NULL` for mass nouns and uncountables. Display logic already handles NULL gracefully via `plural_name && qty > 1 ? plural_name : name`. Bundles with broader catalog data audit (P8R-D20). Run as parallel CC workstream during CP6e build. |
| D8R-Q60 | 2026-05-06 | tracks_lots toggle hidden when lots exist | When user opens SupplyDetail and the supply has 1+ active (non-archived) lots, the "Track quantity / lots" toggle is hidden. To toggle off, user must first archive all lots (overflow menu → "Archive all lots"). Avoids destructive confirmation modal; makes the destructive action discoverable through the menu rather than an accidental toggle flip. |

---

### Update "Deferred decision points" — supersede + add (line 240+)

Mark D8R-Q4 reopened-by-Q43:

| ID | Topic | Why deferred |
|----|-------|--------------|
| P8R-D4 | ~~Quantitative supply tracking~~ | **REOPENED 2026-05-06 by D8R-Q43.** Lot tracking opt-in via `tracks_lots` flag — selective, per-supply. Status enum remains sufficient for non-lots cases. |

Add new entries:

| P8R-D22 | **Receipt scan → bulk lot create.** Take photo of grocery receipt → Claude Vision extracts line items → bulk-create supplies + lots in one flow with per-line edit affordance. Architectural slot reserved (D8R-Q46 + Q-V14). | 🚀 | 🟡 | Post-F&F priority. Reuses existing `claudeVisionAPI.ts` recipe-extraction infrastructure. UPC/PLU mapping schema decided when receipt scan data flows. |
| P8R-D23 | **Per-lot fill_level.** "Open coffee bag is at 30%" partial-fill tracking on individual lots. Decided against for F&F (D8R-Q53 path keeps status manual; users tap status badge to signal Low). Worth reconsidering if testers manage open-bag fill manually and find it tedious. | 🚀 | 🟢 | Post-F&F polish. |
| P8R-D24 | **Per-supply auto-demote toggle.** Restore the pre-CP6e cook auto-demotion behavior as an opt-in per-supply setting ("Decrement status on cook"). Some users may want it, especially for non-tracks_lots supplies that they don't want to manage manually. | 🔧 | 🟢 | Post-F&F. Default off. UI surfaced in SupplyDetail tracking section. |
| P8R-D25 | **Multi-supply variant migration.** Tooling to split one ingredient's supplies (e.g., "chicken thighs" with bone-in + boneless variants) into multiple supplies under the same ingredient_id. F&F doesn't need this — variant_label on lots covers the case. | 🔧 | 🟢 | Post-F&F. Reactive to tester demand. |
| P8R-D26 | **Expiration flag in pantry "Attention" section.** Lots expiring within N days surfaced as their own attention sub-category, alongside Low/Out. F&F just shows expiration on the expanded row + via accent color of warn lots. The dedicated attention surfacing makes proactive triage stronger. | 🚀 | 🟡 | Post-F&F. Threshold likely user-configurable (3 days default for fresh items, 7 days for staples). |

---

### Update "Scope" → "In scope" (line 133)

Add bullet:
- **Lot tracking foundation.** `tracks_lots` opt-in flag. New `supply_lots` table. Lot-aware SupplyRow rendering (status-colored numeric badge + unit icon). Lot editor in SupplyDetail. Lot create inline in SupplyCreateSheet. Lot-aware cook depletion (oldest-first + manual override). Lot-aware grocery acquire (default-create with toast + edit). Server-side multi-dimension search via tsvector. Catalog plural_name audit.

### Update "Scope" → "Out of scope" (line 143)

Add bullets (pulled from D22-D26 above):
- Receipt scan to bulk-create lots
- Per-lot fill_level (partial-bag tracking)
- Per-supply auto-demote-on-cook toggle
- Multi-supply variant migration tooling
- Dedicated expiration flag in pantry Attention section

---

### Update "Build plan" table (line 254)

Add row after CP6c:

| 8R-CP6e | Lots schema + service layer + UI rebuild + search RPC + catalog audit | 4-6 | 🔲 Planning (depends on CP6c). Heaviest CP of 8R series. Split into a/b/c/d sub-checkpoints. |

Update F&F target estimate at line 265:
- **Estimated total:** 4-6 weeks → **8-10 weeks of focused work.**

---

### Add "CP6e detailed scope" section after CP6c (line 333)

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

### Update Changelog (line 339)

| 2026-05-06 | v0.6 | **Lots model added (CP6e). 18 new design decisions (Q43-Q60).** Reopens P8R-D4 (quantitative tracking) as opt-in `tracks_lots` flag. Reverses prior 8R cook auto-demote rule (Q53). Adds server-side tsvector search (Q57). New CP6e split into Schema → Services → PantryUI → FlowsUI sub-checkpoints + catalog audit parallel workstream. Wireframes at `docs/wireframes/phase_8r/phase_8r_lots_wireframes_v2.html`. F&F target slips from mid-July to late-August (~3 weeks total addition: lots schema + services + tsvector + UI rebuild). 5 new deferred items (D22-D26). 0 decisions superseded; 1 reopened. |

---

## Cross-document updates needed

### FF_LAUNCH_MASTER_PLAN.md

Update Phase 8 scope description to reference CP6e. Update F&F target date in the changelog. Add a one-paragraph Risk Register entry: "Lots model is the largest single CP of the 8R sequence; mid-CP slip risk material. Escape hatch: ship CP6e-Schema + Services without UI rewrite (revert to today's UI on the new schema) if execution slips significantly past late-August target."

### DEFERRED_WORK.md

Add 5 entries (P8R-D22 through P8R-D26 — text matches Decisions section above) under the existing 8R section.

Mark P8R-D4 as ~~strikethrough~~ with note: "REOPENED 2026-05-06 by D8R-Q43 as opt-in per-supply flag."

### PHASE_8_PANTRY_INTELLIGENCE_2026-04-29.md

This doc was superseded by 8R on 2026-04-29. No update needed — historical record only.

---

## Open questions before merging

None blocking. Two minor calls to make at merge time:

**M1.** Wireframe file canonical name + location. Currently `/home/claude/wireframes/phase_8r_lots_wireframes_v2.html`. Should land at `docs/wireframes/phase_8r/phase_8r_lots_wireframes_v2.html` to mirror v3 placement. Confirm or pick alternate path.

**M2.** This doc addition is a clean insertion into PHASE_8R_UNIFIED_NEEDS.md, which keeps the 8R doc as a single canonical source. Alternative: spin out a separate `PHASE_8R_CP6E_LOTS.md` for clarity at the cost of doc fragmentation. Lean: keep in PHASE_8R_UNIFIED_NEEDS.md per repo-as-canonical workflow (one doc per phase).

---

## What this addition is NOT yet

- **A schema migration file.** That's the deliverable from CP6e-Schema. Generated via CC prompt after this doc lands.
- **An updated FRIGO_ARCHITECTURE.md.** New service modules + tables haven't been added yet; FRIGO_ARCHITECTURE update happens after CP6e-Schema lands.
- **Wireframe-to-spec mapping.** Wireframe v2 is illustrative; CP6e-PantryUI/FlowsUI build prompts will reference specific tabs as canonical.
