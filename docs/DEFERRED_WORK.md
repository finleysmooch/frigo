# FRIGO — Deferred Work & Action Items

**Last Updated:** May 27, 2026  
**Version:** 5.29  
**Canonical location:** Repo `docs/DEFERRED_WORK.md` (copy in Claude.ai project knowledge)

---

## How This Document Works

Items land here at **phase completion** after a reconciliation review. During active phase work, deferred items live in the active phase doc. When a phase completes, Claude.ai reviews those items: resolved items are dropped, items still relevant move here under a "From: Phase N" section, items not worth tracking are discarded.

This is the master backlog — the accumulated deferred work from all completed phases plus cross-cutting tech debt and roadmap ideas.

**Priority levels:** 🔴 High (affects accuracy/UX significantly), 🟡 Medium (would improve quality), 🟢 Low (nice to have), ⚪ By design (accepted tradeoff)

**Types:** 🐛 Bug/Gap, 💡 Idea, 🔧 Technical debt, 📊 Data quality, 🚀 Feature, 🧪 Testing

---

## From: Phase 8 — Pantry Intelligence Planning (April 23, 2026)

**Context:** Phase 8 planning wireframe session + first audit surfaced 11 post-F&F items and 2 tech debt items. Phase 8 execution in-scope items live in `PHASE_8_PANTRY_INTELLIGENCE.md`; items below are explicitly out-of-scope for v1 and parked here so they don't get lost.

### Open Action Items (post-F&F)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P8-1 | Full accessibility audit across Phase 8 surfaces | 🔧 | 🟡 | Per-prompt verification covers tap target size (≥44×44pt) and accessibilityLabel presence during Phase 8 build. Full pass needs: VoiceOver focus order across StaplesGrid + Ingredient Detail + Freezer cleanout + recipe tap-sheet; screen reader announcements for state changes; color contrast audit for soft-tint state backgrounds; reduced motion support for re-sort animations; keyboard navigation where applicable. ~1-2 sessions post-launch. Surfaced 2026-04-23 first audit. |
| P8-2 | Brand discovery full UI (Ingredient Detail Brands tab v2) | 🚀 | 🟡 | F&F ships read-only Brands tab pulling from existing `grocery_list_items.brand_preference` + `size_preference` (user's own history + space members' history). Full community-scale discovery UI post-F&F: seek-out vs settle markers, how-long-preferred metrics, brand ratings, friends-first visibility, cross-space aggregation. 3-5 sessions. |
| P8-3 | Path B tracked-item staleness UI | 🚀 | 🟡 | Data foundation in 8A-CP1 (`last_confirmed_at` on pantry_items, `staleness_threshold_days` JSONB). UI post-F&F: stale-item surfacing pattern for tracked items (parallel to staples unknown-state), per-category threshold tuning UI. ~1 session. |
| P8-4 | Per-store grocery aisle overrides | 🚀 | 🟢 | v1 uses global `ingredients.typical_store_section` for aisle grouping. Post-F&F: per-store aisle layouts + "where you found it last time" memory. Depends on per-store data model (which grocery list = which store). |
| P8-5 | Smart (silent-automatic) cook-post depletion | 🚀 | 🟡 | Opt-in banner-after pattern in v1 (8B-CP4). Silent-automatic depletion post-F&F once matching confidence proven (probably 6-8 weeks of F&F data). |
| P8-6 | Category-level pantry matching | 🚀 | 🟢 | "Any cheese" / "any dried pasta" matching deferred to post-F&F user-configurable setting. |
| P8-7 | Quantity-aware pantry matching | 🚀 | 🟢 | "Recipe needs 4 eggs, I have 2" smart subtraction. v2 work. |
| P8-8 | Smart thaw-time calculation | 💡 | 🟢 | "4 lb chicken = 24h thaw time" helper on Thaw & plan flow (8C-CP7). v1 is manual. |
| P8-9 | Auto-schedule thawed items onto meal calendar | 🚀 | 🟢 | Phase 9 work — depends on meal calendar from Phase 9. |
| P8-10 | Conversational search refinement | 🚀 | 🟢 | Natural-language search (8E-CP2) is single-turn v1. Multi-turn ("actually make it under 30 min" as follow-up) post-F&F. |
| P8-11 | App-level voice recording for search | 💡 | 🟢 | v1 uses OS dictation (iOS/Android). In-app recording for custom processing post-F&F. |
| P8-12 | ManageStaples section headers | 🟢 | post-F&F | Current-staples list on ManageStaplesScreen is flat — at 20+ staples it'll get hard to scan. Add section dividers — grouping by first-letter OR state (good/low/out/unknown) OR ingredient.category TBD. Post-F&F polish; not blocking pantry loop. Surfaced by Tom during 8B-CP3a smoke test. |
| P8-13 | Cross-unit reconciliation in cook-post depletion | 🚀 | 🟡 | v1 (`reconcileDecrement` in `cookDepletionService.ts`) matches recipe↔pantry units by exact string only (case-insensitive). Any mismatch (e.g., recipe "1 cup" vs pantry "pieces" or "2 oz") falls through to `touch_only` — item gets `last_confirmed_at` bumped but quantity stays unchanged. Real recipes frequently call "cups/tbsp/tsp" while pantry tracks "pieces/oz/lb", so many decrements will show as "marked as used" rather than quantity reductions. Post-F&F enhancement: extend reconcile path to use `unitConverter.ts`'s metric-bridge (convert both sides to metric, compute factor, apply back in pantry's unit). Surfaced during 8B-CP4 smoke test 2026-04-23. |
| P8-14 | Soft-delete on zero-quantity depletion | 🚀 | 🟡 | When a decrement in `reconcileDecrement` would produce `quantity_display <= 0`, v1 falls through to `touch_only` to avoid DB check constraint `pantry_items_quantity_display_check`. Semantically the pantry item is "used up" at that point, but it stays in the pantry list with its old quantity. Post-F&F: when decrement would hit 0, set `discarded_at = NOW()` + `discarded_reason = 'used_up'` (uses 8A-CP1's soft-delete schema). Matches real-cooking mental model ("I finished the bag") and removes the item from active list cleanly. Surfaced during 8B-CP4 smoke test 2026-04-23 (via 23514 constraint violation on first live cook with fully-depleting ingredients). |
| P8-15 | ✅ Resolved 2026-04-27 by 8C-CP1b (heuristic-SQL backfill via `(family, ingredient_type)`). 314 rows backfilled; 2 capitalized anomalies normalized to lowercase. Mapping: Dairy→dairy, Produce→produce, Proteins+Seafood→seafood, Proteins (other)→meat (incl. plant-based proteins, see P8-17 for UX enhancement), Pantry+Baking→baking, Pantry (other)→pantry. |
| P8-16 | ~~CreateGroceryListParams shape unification (service local vs canonical)~~ | 🔧 | ⚪ | **RESOLVED 2026-04-28 by 8C-Shared-CP2 (P8-16 consolidation thread).** Service-internal `CreateGroceryListParams` deleted from `lib/groceryListsService.ts`; canonical interface from `lib/types/grocery.ts` now imported. `createGroceryList` resolves `user_id` via `supabase.auth.getUser()` rather than taking it as a param; insert body widened to write all canonical fields (`emoji`/`isActive`/`isTemplate`/`sortOrder`/`storeName`/`spaceId`). 4 call sites updated (was 2 expected: `addIngredientsToDefaultList`, `routeStapleToGroceryList` in pantryStaplesService, `screens/GroceryListsScreen.tsx` modal handler, `components/AddRecipeToListModal.tsx` create-new-list flow) — all dropped the explicit `user_id` arg. CP1's `space_id?` field renamed to `spaceId?` for camelCase consistency. |
| P8-17 | Plant-based protein subclass UX in grocery sections | 🚀 | 🟢 | 8C-CP1b lumps plant-based proteins (tofu, tempeh, seitan, 6 rows) with `meat` because they physically live in the refrigerated case at the meat section in typical US chain grocers — `typical_store_section` answers a physical "where do I walk" question. Subclass distinction (e.g., a small "plant-based" tag on the row, or an inline subsection within the Meat header) is a UI-layer enhancement on top of the aisle data, not a replacement for it. ~1 session post-F&F. Surfaced 2026-04-27 during 8C-CP1b backfill design when the question of subclassing emerged. |
| P8-18 | Cross-list auto-dismissal on item check-off — design pending | 🚀 | 🟢 | The original phase-doc 8C-CP2 spec included "checkoff on one list dismisses same-ingredient copies on other lists within recent window (default 4 hours)." Cut from CP2 entirely per Tom's reasoning during 2026-04-27 design pass: same item on different lists often represents *different* purchase intents (bulk Costco vs immediate Fred Meyer for olive oil; specialty New Seasons vs everyday Safeway for produce; etc.). Auto-dismissal would erase that distinction. If we revisit, it likely needs explicit per-item user opt-in ("dismiss equivalents on other lists when I check this") rather than time-window default — a checkbox or toggle on the item itself, surfaced only when cross-list overlap exists. Surfaced 2026-04-27 during 8C-CP2 design redirect. |
| P8-19 | ~~`addIngredientsToDefaultList` recipeId-pass-through gap~~ | 🔧 | ⚪ | **RESOLVED 2026-04-27 by 8C-CP4 (Task 1 inline fold-in).** `addIngredientsToDefaultList` in `lib/groceryListsService.ts` now forwards `recipeId`, `recipeQuantityAmount`, and `recipeQuantityUnit` to each inner `addItemToList` call. Junction rows (`grocery_list_item_recipes`) now write on the recipe→default-list path. |
| P8-20 | ~~CP3 pill render: switch from substring-match to `source_staple_id IS NOT NULL`~~ | 🔧 | ⚪ | **RESOLVED 2026-04-27 by 8C-CP4a (P8-20 fold-in).** `components/GroceryListItem.tsx` boolean check switched from `priority_reason.toLowerCase().includes('staple')` (D8-41 substring brittleness) to `item.source_staple_id !== null` structural check. Variant logic stays substring-based on `priority_reason` (service-controlled, never user-modified for staple-routed rows; cheaper than JOIN to `pantry_staples.state`). Smoke Test 5 verified: a non-staple-routed item with `priority_reason='manual note about staple shelf'` does NOT render a phantom staple pill. |
| P8-21 | cookDepletion undo path: clean up staple-routed grocery items | 🔧 | 🟢 | The cookDepletion undo path (`lib/cookDepletionService.ts:362`) reverts a staple's state via `setStapleState(s.staple_id, s.old_state)` but does NOT clean up grocery items routed to the user's primary list during the corresponding `applyDepletion` call. If a cook depletes a staple to `'out'` (auto-routes a list item) and the user undoes the cook, the staple goes back to `s.old_state` but the routed item lingers on the grocery list. Recoverable manually (user can delete from list); rare in practice (undo within session). Cleanup logic should fetch any `grocery_list_items WHERE source_staple_id = stapleId AND is_in_cart = false` and either delete or mark them — TBD which UX is right. Surfaced 2026-04-27 during 8C-CP4 design pass. |
| P8-22 | State cycling missing on ManageStaplesScreen — F&F-prerequisite-candidate | 🚀 | 🟡 | StaplesGrid on PantryScreen supports tap-to-cycle (`'good' → 'low' → 'out' → 'good'`) for staples shown in the grid (max 8). ManageStaplesScreen (8B-CP3) supports search/add/edit-custom-name/delete but NOT state cycling. Users with >8 staples have bottom-N items behind the "+N more" overflow → ManageStaplesScreen, where state can't be cycled from anywhere except cook-depletion (only fires when the staple is consumed in a recipe). F&F testers with bigger staple lists will hit this. Small UI addition (~1 hr CP) — add state-cycle dot to each row in ManageStaplesScreen using the same `cycleStapleState` service call. Flagged F&F-prerequisite-candidate; Tom's call whether to ship pre-launch or post-launch. Surfaced 2026-04-27 during 8C-CP4 Test 1 smoke-test execution. |
| P8-23 | ~~Manual cycle 'out' → 'good' cleanup of routed grocery items~~ | 🔧 | ⚪ | **RESOLVED 2026-04-27 by D8C-CP4b-1 design (CP4b paused; ships when CP4b ships).** Cleanup fires on any transition to `'good'` AND `is_in_cart=false` — symmetric with CP4's check-off-restores logic. Generalized rule: trigger on new state = good, regardless of prior state. Carve-out preserves user's "already in cart" record (`is_in_cart=true` → skip cleanup). Immediate (no delay) — misclick recovery via re-cycle re-routes via E3 sticky list. Execution paused pending 8C-Shared (cleanup semantics differ on shared lists). |
| P8-24 | ~~Add to list F&F-blocker~~ — RESOLVED 2026-04-28 by 8C-Shared-CP2b. AddRecipeToListModal shipped; closes the F&F-blocker. Note: surface itself will be rebuilt under 8R-CP4 but the data path concern is resolved. | 🐛 | ⚪ | ✅ Resolved 2026-04-28 by 8C-Shared-CP2b. |
| P8-25 | **Create-list modal: keyboard doesn't dismiss on tap-outside.** When user types list name, then taps elsewhere within modal (not Return key), keyboard stays up. Standard mobile pattern is `TouchableWithoutFeedback` wrapping modal content with `Keyboard.dismiss()` on press. Likely affects other modals too — worth a small audit when batching UX polish. Surfaced during CP2 smoke test. | 🔧 | 🟡 | Polish. Not F&F-blocking but rough edge. Audit other modals during fix. 🟡 LIKELY SUPERSEDED by 8R (2026-04-29) — the create-list modal disappears; concerns may not apply to new ViewsScreen create flow. Don't close yet — implementation at 8R-CP4 confirms whether issues recur. |
| P8-26 | **Create-list modal: share toggle doesn't read as toggleable.** Current implementation is `TouchableOpacity` with conditional styling — looks like a button, not a switch. Should use React Native `Switch` primitive for clearer affordance. CP2's modal work explicitly avoided introducing new UI primitives; this is the cleanup pass. Surfaced during CP2 smoke test. | 🔧 | 🟡 | Polish. Visual affordance fix; no functional change. 🟡 LIKELY SUPERSEDED by 8R (2026-04-29) — the create-list modal disappears; concerns may not apply to new ViewsScreen create flow. Don't close yet — implementation at 8R-CP4 confirms whether issues recur. |

### Tech Debt surfaced by Phase 8 planning

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P8-T1 | CLAUDE.md references `lib/theme.ts` as single file, but theme is a folder `lib/theme/` | 🔧 | 🟢 | Discovered during first audit of Phase 8 prompts. Low urgency — doesn't affect runtime, just doc accuracy. ~5 min fix. |
| P8-T2 | `P5-1 base_ingredient_id` audit pass (scheduled for 8D-CP1) may surface a larger data backfill need | 📊 | 🟡 | 8D-CP1 runs query-and-report; if gap is large (protein cuts, cheese dupes, salt variants per P5-1 deferred item), spawns separate data-backfill CC prompt. Track here so the potential scope doesn't vanish. |

---

## From: Phase 8R — Unified Needs Planning + Wireframes (April 29, 2026)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P8R-D1 | **Configurable spawn thresholds.** Per-supply user-settable threshold for auto-spawn (currently fires only on `out`). γ option from D8R-Q10. | 🔧 | 🟡 | Post-F&F based on tester usage. |
| P8R-D2 | **Cross-dimension OR-filter views.** AND-only across dimensions for F&F (multi-value within dim supported per Q16). | 🔧 | 🟡 | Post-F&F. |
| P8R-D3 | **Add-time combine prompts.** F&F renders display-merged at view-time only (Q12/Q28/Q36). | 🔧 | 🟡 | Post-F&F. |
| P8R-D4 | ~~**Quantitative supply tracking.**~~ Battery-scale or numeric quantity-on-hand for supplies. | 🔧 | ⚪ | ✅ **RESOLVED 2026-05-13 by CP6e ship.** `tracks_lots` opt-in flag shipped in CP6e-Schema; `supply_lots` table + lotsService + UI consume it. Lot-based quantitative tracking now available per-supply. |
| P8R-D5 | **Hierarchy storage strategy.** Time-window tags currently use derived hierarchy at query time. | 🔧 | 🟢 | Watch in F&F. |
| P8R-D6 | ~~View-rule visibility UX~~ | 🔧 | ⚪ | **RESOLVED 2026-04-29 by D8R-Q19/Q22.** Filter rules visible in 3 places (view-card subtitle on Lists home; Add-need hint; View settings). NOT permanent header chips. |
| P8R-D7 | ~~Search bar on Supplies grid + Expanded Regulars~~ | 🔧 | ⚪ | **RESOLVED 2026-04-29 as F&F-prereq.** Tom confirmed: at 50+ supplies search becomes valuable; ship at CP5. Wireframed in v3 Tab 7 + Tab 10. |
| P8R-D8 | **Subgroup-within-category hierarchy.** E.g., Pantry → Oils / Grains / Spices. F&F ships category-level only. | 🔧 | 🟢 | Post-F&F. |
| P8R-D9 | **Auto-select urgency from meal calendar in recipe-add modal.** If recipe is on tonight's calendar, default Tonight. | 🚀 | 🟢 | Polish; depends on meal calendar maturity. |
| P8R-D10 | **Pre-select-out-items default in expanded Regulars.** F&F ships pre-selected (opinionated). Per-user setting if testers prefer fully-unchecked default. | 🔧 | 🟢 | Post-F&F based on tester preference. |
| P8R-D11 | **Cold-start / empty-state polish.** Day-1 first-launch UX: empty Lists home, empty Pantry, empty view detail, first-time add-to-needs sheet. | 🎨 | 🟡 | Post-F&F per Tom 2026-04-29: be thoughtful with the design but not where we focus pre-F&F. F&F ships reasonable defaults. Dedicated wireframes deferred. |

### From: 8R-CP5a/b smoke test (April 30, 2026)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P8R-D12 | **Filter editing relaxation on default views.** CP5a Q1 — implementation locked filter editing on default views (strict read of D8R-Q19's "non-deletable but hidable"). Filter sections in ViewCreatorModal show display-only chips with "Filter locked on default lists" hint. If smoke testing shows users want to expand defaults' filters (e.g., "Tonight" + early morning), 3-line guard flip in ViewCreatorModal save path. | 🔧 | 🟢 | Post-F&F based on tester feedback. Reversible in a 5-minute change. |
| P8R-D13 | **For-user multi-select picker in AddNeedSheet.** CP5b Q4 — currently inheritance-only (T1 inherits from supply; T2/T3 default to empty array = "Everyone" per Q37). Wireframe Tab 11 includes a for-user field; deferred to keep CP5b scope manageable. Adding picker = ~80-120 lines + space-members loader + multi-select sub-sheet. | 🔧 | 🟡 | Add when smoke-test surfaces multi-user-household friction. Tom + Mary likely fine with inheritance defaults pre-F&F. |
| P8R-D14 | **TagDimensionPicker shared component.** CP5b Q3 — same chip+inline-add pattern in 2 consumers (AddNeedSheet + ViewCreatorModal). When CP6 introduces a 3rd consumer (likely supply-create flow's tag picker), promote to shared `<TagDimensionPicker>`. Estimated 200-line extraction. | 🔧 | 🟢 | Triggered by CP6b — supply-create flow will be the 3rd consumer. Bundle the extraction with that CP if scope permits. |
| P8R-D15 | **Server-side `search_supplies` RPC (trigram).** CP5b T1 fast path uses client-side `String.includes` filter on loaded supplies array. Fine at F&F scale (50-100 supplies typical). Won't scale to 500+ supplies; trigram-search RPC mirroring `search_ingredients` would close the gap. | 🔧 | 🟢 | Post-launch. F&F testers won't hit the scale limit. |
| P8R-D16 | **Race-condition idempotency for shared-space concurrent submits.** CP5b ExpandedRegularsSheet's inline dedup uses an `activeNeedSupplyIds` Set hydrated on sheet open. If Tom and Mary both open ExpandedRegularsSheet simultaneously and submit, race conditions could create duplicate needs (sheet-1 hydrates before sheet-2's submit completes). F&F tolerable; CP6a's service-layer dedup partially closes the gap (atomic per-supply check at write time) but a unique constraint on `(space_id, supply_id) WHERE status IN ('need','in_cart')` would be the durable fix. | 🔧 | 🟡 | Resolved partially by CP6a. Schema-level fix candidate for post-launch. |
| P8R-D17 | **`supplyMatchesView` + `expandUrgencyValues` helpers promotion.** CP5a Q3 — replicated client-side in ViewDetailScreen and ExpandedRegularsSheet (~25 lines each). The same logic exists inside `needsService.getNeedsForView` but isn't exposed as a pure helper. When a 3rd consumer arises (likely Tab 12's supply create flow needs to compute "which views match this supply's tags?"), promote to exported helpers in needsService. | 🔧 | 🟢 | CP6b candidate. Bundle with supply-create flow if CP6b needs the predicate. |
| P8R-D18 | **`getNeedsForView` count aggregate RPC.** Lists home is N+1 — one `getNeedsForView` query per view × 4-7 default + custom views = 4-7 sequential-but-parallelized queries every focus. Negligible at F&F scale (~50ms total). If view count grows to 20+, an aggregate `getViewCountsForSpace(spaceId)` RPC returning `[{viewId, count}]` becomes worthwhile. | 🔧 | 🟢 | Post-launch monitoring. F&F tolerable. CC flagged inline as TODO comment in ViewsScreen. |
| P8R-D19 | **PantryScreen blank on first launch post-CP5b.** Observed once during 2026-04-30 smoke test; resolved by app restart. Could be SpaceContext propagation timing race (PantryScreen mounts before activeSpaceId hydrates) or stale RN cache. Not reproducible after restart. Monitor; if recurs in F&F, investigate via diagnostic logging on SpaceContext + getSuppliesForSpace call timing. | 🐛 | 🟡 | Watch list. Single observation, not reproducible — don't fix blindly. F&F testers will surface if structural. |
| P8R-D20 | **Catalog data audit.** Smoke test surfaced multiple data gaps: "banana" should be plural "bananas" (per project naming convention?); commonly-cooked-with items missing (coffee, coffee beans, plus likely more). One-off SQL UPDATE for pluralization + INSERT for missing items. Better: an audit pass that checks pluralization across the whole `ingredients` table + adds ~30-50 missing common items (eggs, milk, butter, sugar, flour, salt/pepper variants, herb variants). Pre-F&F priority — testers will hit "where's coffee?" repeatedly. | 📊 | 🔴 | F&F-prereq. Run as parallel workstream to CP6a/b — separate CC prompt that operates only on the catalog table. ~30-min audit. |
| P8R-D21 | **SQL migration file move into `supabase/migrations/`.** CP1's schema migration ran from `docs/phase_8r_cp1_schema_migration.sql` at repo root. Canonical Supabase convention is `supabase/migrations/YYYYMMDDHHMMSS_description.sql`. Move at CP6c or post-launch. | 🔧 | 🟢 | Cleanup. Doesn't affect runtime. CP6c bundles with type cleanup + filename renames. |
| P8R-D25 | **Per-child cycling on merged-row children (post-F&F).** Currently the merged parent's tap cycles all children together (group-cycle, landed in CP6d-ViewDetail follow-up 2026-05-04). True per-child independent cycling — where each child row's dot is its own cycle target and the parent dot reflects a "mixed" aggregate state when children diverge — requires a design pass on mixed-state UX. Defer to post-F&F when tester feedback clarifies the actual use case. The wiring itself is trivial (~30 lines); the open question is the mixed-state visual semantics (some children at need, some at in_cart → what does the parent dot show?). | 🎨 | 🟢 | Post-F&F. Triggered if testers report wanting to acquire children individually. |
| P8R-D26 | ~~InlineAddNeedRow submit-on-return T1/T2/T3 priority order.~~ | 🐛 | ⚪ | **RESOLVED 2026-05-04 in CP6d-ViewDetail follow-up.** Reordered submit-on-return priority to T1 (exact-name supply hit) → T2 (exact-name catalog hit) → T3 (custom_name fallback). Pre-fix, T2 was skipped entirely — typing "olive oil" when both supply and catalog had it created a custom_name need, losing ingredient_id linkage that downstream features (recipe matching, supply spawning) depend on. Logged here for traceability since flagged in CP6d-ViewDetail's SESSION_LOG open questions. |
| P8R-D24 | ~~`setSupplyStatus.usage_level` patch only on transitions.~~ | 🐛 | ⚪ | **RESOLVED 2026-05-04 in CP6d-SmokeFix-1.** Originally surfaced in CP6d-Pantry's slider work — `setSupplyStatus` only patched `usage_level` when the row's status actually changed, so tapping slider position 4 from level=5 (both in_stock) was a no-op. New `setSupplyUsageLevel(supplyId, level)` helper closes the gap: routes through `setSupplyStatus` when the level change implies a status change (preserves spawn-on-out + tracking_mode + archived_at gating), otherwise patches `usage_level` directly. SupplyControls' slider + SupplyRow's cycle-tap both consume the new helper. |
| P8R-D27 | **UnitPicker no-ingredient mode for T3 custom-name needs (post-F&F).** Currently UnitPicker (consumed by AddNeedSheet + EditNeedSheet after CP6d-Sheets) renders only when an ingredient_id is available; T3 custom-name needs and T1-without-ingredient fall back to TextInput for unit entry. UnitPicker requires `ingredientId: string` (non-nullable) to load common units, AND its "Other units…" affordance only renders when `commonUnits.length > 0`. This is correct for F&F — no downstream consumer of `unit_display` on custom needs. If post-F&F testers surface dirty unit data on custom needs as friction, extend UnitPicker with a no-ingredient mode that loads `measurement_units` directly (~10 lines inside UnitPicker). **Decision lock:** stay with conditional render unless friction surfaces. | 🎨 | 🟢 | 🟢 **PARTIALLY RESOLVED 2026-05-14 in CP6e-SmokeFix-SF1.** UnitPicker null-ingredient mode shipped and is consumed by LotInputRowView. AddNeedSheet / EditNeedSheet adoption is the post-F&F follow-up (now tracked as P8R-D34). |
| P8R-D28 | ~~setSupplyStatus(in_stock) clears archived_at.~~ | 🐛 | ⚪ | **RESOLVED 2026-05-04 in CP6d-SupplyDetail follow-up.** The Restock CTA on an archived (track_only) supply was previously a no-op for the archived state. Fix: 1-line addition inside setSupplyStatus's patch construction — when newStatus is 'in_stock' AND the transition is real (oldStatus !== newStatus), also patch `archived_at = null`. Closes the resurrection-flow loop (SupplyCreateSheet T1 inversion → SupplyDetail → Restock un-archives + restocks in one action). |
| P8R-D30 | **User-customizable category placement for custom-name supplies (post-F&F).** Custom-name supplies (no `ingredient_id`, hence no `ingredient.family`) automatically appear under the "Other" sub-category in Pantry's Regulars and On Hand sections. Tester feedback may surface a desire to manually assign these to a specific category — e.g., "I added a custom 'Maple syrup' supply, want it under Pantry items not Other." Possible implementation: add `supplies.custom_category TEXT NULL`; pantry section logic uses `custom_category ?? ingredient.family ?? 'Other'`. UI: a dropdown on SupplyDetail under Storage location. Defer to post-F&F until tester demand surfaces. | 🚀 | 🟢 | Post-F&F. Triggered by tester reports. |
| P8R-D29 | **Per-supply shelf-life override schema + UI wiring.** SupplyDetailScreen has a stub "Shelf life override" section (CP6d-SmokeFix-3 P38) that fires an Alert "coming soon" — the schema column doesn't exist yet. Migration needed: add `supplies.shelf_life_days_override INT NULL` (default NULL = use catalog). Service additions: `setSupplyShelfLifeOverride(supplyId, days \| null)` helper; `getStaleTrackOnlySupplies` updated to honor the override (compute the freshness threshold per supply rather than the fixed 14 days). UI: replace the stub button with a number scroll/slider 0–365 days, default `supply.shelf_life_days_override ?? ingredient.shelf_life_days_<storage>`. ~120 lines net (migration + service + UI). | 🚀 | 🟡 | F&F-eligible if testers want per-supply tuning; otherwise post-launch. Stub UI ships in CP6d-SmokeFix-3 to claim the screen real-estate. |

### From: CP6e-Lots planning (May 6, 2026)

> **Numbering note:** Draft assumed sequential D22-D26, but D24-D30 already taken by CP6d entries above. D22 and D23 used as drafted; what would have been D24-D26 renumbered to D31-D33 to avoid collision. See FF_LAUNCH_MASTER_PLAN.md v6.3 / PHASE_8R_UNIFIED_NEEDS.md v0.6 changelogs.

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P8R-D22 | **Receipt scan → bulk lot create.** Take photo of grocery receipt → Claude Vision extracts line items → bulk-create supplies + lots in one flow with per-line edit affordance. Architectural slot reserved (D8R-Q46 + Q-V14). | 🚀 | 🟡 | Post-F&F priority. Reuses existing `claudeVisionAPI.ts` recipe-extraction infrastructure. UPC/PLU mapping schema decided when receipt scan data flows. |
| P8R-D23 | **Per-lot fill_level.** "Open coffee bag is at 30%" partial-fill tracking on individual lots. Decided against for F&F (D8R-Q53 path keeps status manual; users tap status badge to signal Low). Worth reconsidering if testers manage open-bag fill manually and find it tedious. | 🚀 | 🟢 | Post-F&F polish. |
| P8R-D31 | **Per-supply auto-demote toggle.** Restore the pre-CP6e cook auto-demotion behavior as an opt-in per-supply setting ("Decrement status on cook"). Some users may want it, especially for non-tracks_lots supplies that they don't want to manage manually. | 🔧 | 🟢 | Post-F&F. Default off. UI surfaced in SupplyDetail tracking section. |
| P8R-D32 | **Multi-supply variant migration.** Tooling to split one ingredient's supplies (e.g., "chicken thighs" with bone-in + boneless variants) into multiple supplies under the same ingredient_id. F&F doesn't need this — variant_label on lots covers the case. | 🔧 | 🟢 | Post-F&F. Reactive to tester demand. |
| P8R-D33 | **Expiration flag in pantry "Attention" section.** Lots expiring within N days surfaced as their own attention sub-category, alongside Low/Out. F&F just shows expiration on the expanded row + via accent color of warn lots. The dedicated attention surfacing makes proactive triage stronger. | 🚀 | 🟡 | Post-F&F. Threshold likely user-configurable (3 days default for fresh items, 7 days for staples). |

### From: 8D-CP4 — Catalog hygiene pass (2026-05-27)

**Context:** Surgical fix of ~95 misclassified recipe_ingredients rows + 11
catalog additions + 6 catalog data-quality fixes. Surfaced multiple structural
issues with recipe extraction quality that need a dedicated CP post-F&F.

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P8D-CP4-1 | **Recipe extraction quality CP.** Three convergent problems: (a) Claude Vision in `claudeVisionAPI.ts` extracts `ingredient_name` separately from `original_text` and can mis-extract (e.g., visual misread of "sumac" as "cumin"); (b) `unifiedParser.ts` uses Claude Haiku 3 which is markedly less accurate than Sonnet for nuanced parsing; (c) `matchToDatabase` in `ingredientsParser.ts` uses `.find()` for partial matches with no scoring — first DB row in iteration order wins, producing pomegranate-molasses→honey kind of failures when intended target isn't an exact match. Proposed structural fix: (1) upgrade unifiedParser to Sonnet 4; (2) add a scoring step to partial match (token overlap, edit distance, subtype hint matching); (3) when confidence < 0.8, flag with `needs_review=true` AND surface a review-and-fix UI on RecipeReviewScreen. | 🔧 | 🟡 | Post-F&F. Blocks new batch imports being clean. |
| P8D-CP4-2 | **RecipeReviewScreen review-and-fix UI.** Currently shows a ⚠️ "needs review" badge but provides no UI to correct the mapping. User reviews the recipe, sees the warning, saves anyway — review is purely informational. Add: tap on flagged ingredient → modal/sheet showing top 5 candidate catalog rows by score, with a "create new" option. Required for the post-F&F extraction CP to be useful. | 🔧 | 🟡 | Post-F&F. |
| P8D-CP4-3 | **Audit step for Claude.ai-extracted recipes (manual workflow).** All ~95 misclassifications fixed in this CP came from Claude.ai-driven extractions (previous chat sessions extracted recipes via copy-paste workflows, not the function path). For Tom's planned pre-F&F additional recipe imports: either (a) run all new recipes through the function-path with the quality improvements from P8D-CP4-1, or (b) run a post-import audit query similar to the Q1 scan and fix-as-you-go. Document the workflow either way. | 📋 | 🟡 | Process change, pre-F&F if doing more imports. |
| P8D-CP4-4 | **Fresh_cheese form normalization.** Subtype currently has mixed form values (feta=null, ricotta=null, halloumi=null, paneer=null, mozzarella=null, manouri=null, sheep's milk=null vs goat cheese='fresh', cottage cheese='fresh', cream cheese='fresh', mascarpone='fresh' — moved out in CP4). Produces spurious L2 form_variant suggestions across these. Decide on normalization (all null OR all 'fresh') and apply. Same fix shape as the cultured_dairy normalization in this CP. | 🔧 | 🟢 | Post-F&F catalog hygiene. |
| P8D-CP4-5 | **Cured_pork_sliced form normalization.** Bacon='fresh', pancetta=null. Chorizo='fresh', kielbasa=null. Produces L2 form_variant instead of L3 substitute on these pairs. Domain decision needed: are bacon-pancetta and chorizo-kielbasa really fresh items? (Cured items are technically not "fresh".) Normalize to a consistent value. | 🔧 | 🟢 | Post-F&F catalog hygiene. |
| P8D-CP4-6 | **Syrup subtype refinement.** Currently lumps honey, maple syrup, pomegranate molasses, molasses, agave, corn syrup, date molasses together. Honey ↔ pomegranate molasses substitution is questionable (sweet vs sweet-tart with distinctive flavor). After F&F testing, audit which pairs produce bad suggestions and either split the subtype or add a substitution rationale layer. | 🔧 | 🟢 | Post-F&F substitution intelligence work. Builds on existing SUBSTITUTION_INTELLIGENCE_ROADMAP. |
| P8D-CP4-7 | **Specific pasta shape catalog additions.** Recipes use specific pasta shapes (linguine, fettuccine, rigatoni, fusilli, orecchiette, etc.) — current catalog has only a subset. The `pasta` subtype is whitelisted so substitution works at L3, but L1 ✓ for exact matches requires the specific row. Audit pasta names in `recipe_ingredients.original_text` to identify missing shapes; add as needed. ~15-20 shapes likely. | 📊 | 🟢 | Post-F&F catalog hygiene. |
| P8D-CP4-8 | **Preparation axis on canned tomatoes.** Current matcher uses `(subtype, form)` for L1/L2/L3 routing. Recipe wants "whole peeled tomatoes" + user has "diced tomatoes" → L3 substitute (≈ amber) which is the desired UX. But the "you have a different prep" distinction isn't surfaced in the copy. A future enhancement: add a `preparation` axis to ingredients (whole, diced, crushed, puree, paste) and matcher logic for prep-mismatch surfacing. Would also help for "whole vs ground" (spices), "fresh vs frozen" (produce), etc. Architectural change, scope to a dedicated CP post-F&F. | 🔧 | 🟢 | Post-F&F architecture. |

---

### From: 8D-CP3.1 — Null-form wildcard removed (May 26, 2026)

**Context:** Matcher's null-form wildcard removed. Generic-recipe-meets-specific-supply pairs (e.g., recipe "vinegar" + supply "rice vinegar") now surface as ≈ amber substitute instead of silent ✓ — honest but slightly verbose. The fix is catalog-side base/variant linkage for flat subtypes.

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P8D-CP3.1-1 | **Catalog restructure: link variants to canonical generic bases for flat subtypes.** 9 whitelisted "flat" subtypes have all rows as independent base ingredients (no variant linkages). With the wildcard gone, generic-recipe-meets-specific-supply (recipe "vinegar" + supply "rice vinegar") surfaces as ≈ amber. Correct semantic is L1 base linkage — encode at the catalog level. Audit (2026-05-26): vinegar 10 bases / 0 variants; sugar 7/0; salt 9/0; rice 9/0; pasta 16/0; soy_sauce 4/0; mustard 6 bases / 1 variant; butter 1/1/1 orphan; cream 2/2. **Clear generics:** vinegar, sugar, salt, soy_sauce, mustard, butter, cream — designate one base row, link others as variants. **Ambiguous:** rice (each variety distinct), pasta (penne ≠ fettuccine). Per-subtype process: pick canonical, `UPDATE ingredients SET is_base_ingredient=false, base_ingredient_id=<canonical>` for non-generic rows, verify CHECK constraint, smoke-test. ~2-3 sessions of catalog audit + SQL. Prioritize clear-generic subtypes; defer rice/pasta until tester feedback informs whether verbose amber UX is bothersome. | 🔧 | 🟡 | Post-F&F catalog work. Restores ✓ for generic-meets-specific via L1. |

---

### From: 8D-CP3 — Cheese + protein subtype split (May 26, 2026)

**Context:** Catalog migration split four overloaded subtypes into 13 substitution-meaningful sub-subtypes; matcher whitelist expanded accordingly. Follow-on items below — items left out of CP3 scope on purpose.

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P8D-CP3-1 | **Generic "cheese" ingredient row** (`8fbe2d77-3f3e-4b01-abec-f82d176fa45d`) is a generic placeholder (1 hero, 1 recipe) left in legacy `cheese` subtype. Recipe extraction landed an under-specified ingredient; auditing the source recipe and relinking to a specific cheese row would be the right fix. | 📊 | 🟢 | Catalog hygiene; revisit when other generic placeholders surface. |
| P8D-CP3-2 | **Categorical recipe ingredients modeling.** Some recipe ingredients are categorical placeholders rather than specific items ("young sheep's milk cheese," "blue cheese" as generic, hypothetical "any white wine," "any neutral oil"). Currently stored as concrete ingredient rows; substitution falls back to subtype-based L3 whitelist. Within-subtype categoricals (e.g., young sheep's milk cheese → fresh_cheese) work acceptably. Cross-subtype categoricals ("any cheese", "any leafy green") need explicit modeling. Options: (a) `is_categorical` boolean column + matcher rule that surfaces any same-subtype supply as L3, (b) recipe-side preprocessing to expand categoricals into OR'd lists, (c) accept the imperfection. | 💡 | 🟢 | Post-F&F if recurring pattern shows in tester data. |
| P8D-CP3-3 | **Protein catalog expansion.** `pork`, `lamb`, `turkey`, and `game` subtypes were left unsplit due to thin catalogs (5–6 rows each). Post-F&F, expand catalogs (e.g., add pork butt, pork belly, lamb leg, lamb breast, game birds beyond quail) then revisit splits. Pork shoulder ↔ pork butt is the most obvious missing whitelist pair. | 🔧 | 🟢 | Catalog growth needed first. |
| P8D-CP3-4 | **Manchego subtype reconsideration.** Manchego currently placed in `semi_hard_cheese` per CP3 default. Aged manchego is closer to `hard_cheese` (grating-cheese behavior). If tester data shows manchego often used in parmesan-substitution contexts (Italian pasta, grating applications), move to `hard_cheese`. Currently behaves correctly for fresh-application uses (salad, charcuterie) at `semi_hard_cheese`. | 📊 | ⚪ | Tester-driven tuning. |

---

### From: 8R-UX6 — Cleanup batch (May 26, 2026)

**Context:** Seven-item cleanup batch. One follow-on item — the archived-supply restore path in `createSupply` was deliberately out of scope.

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P8R-UX6-1 | **createSupply archived-supply restore path.** Service-layer dedup in `createSupply` (added 2026-05-26) matches against non-archived supplies. If a user tries to add a supply that matches an archived one, the existing insert path runs and creates a duplicate. Acceptable for F&F since archived-supply restore is a separate UX flow (resurrection via SupplyCreateSheet's T1 → SupplyDetail path). Worth revisiting if testers report duplicate clutter after deleting + re-adding supplies. | 🔧 | 🟢 | Service-layer; cleanest as a `params.allowResurrectArchived?: boolean` opt-in flag. |

---

### From: 8R-UX5 — Hero ingredient marker + filter pill (May 26, 2026)

**Context:** Hero ingredient signal shipped (computed from `recipe_ingredients.ingredient_classification = 'hero'`). Drives the inline ⚡ marker on Use Soon rows and the `⚡ Heroes N` pill in the inner family-pill strip on Everything + Use Soon tabs. Thresholds are best-guess for F&F.

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P8R-UX5-1 | **Hero ingredient thresholds — tune after F&F.** `USER_HERO_THRESHOLD = 2`, `GLOBAL_MIN_APPEARANCES = 3`, `GLOBAL_HERO_RATE_THRESHOLD = 0.5` are best-guesses. Use AdminScreen → "Dump Hero Frequency Audit" to see what each threshold actually surfaces post-F&F. Likely needs tuning once real cooking data is available from testers. | 📊 | 🟡 | Audit dump → console JSON; tune the three `export const` values in `lib/services/heroIngredientService.ts`. |
| P8R-UX5-2 | **Hero marker visibility — currently Use Soon only.** ⚡ row marker is scoped to the Use Soon outer tab per intentional UX scoping. May want to surface on Everything and Low / out tabs later if testers report wanting that visibility. | 🎨 | 🟢 | One-line change in SuppliesSection's `renderRow` (drop the `activeOuterTab === 'use_soon'` gate). |
| P8R-UX5-3 | **Hero/family orthogonal filtering.** The Heroes pill and family pills are currently mutually exclusive (single-axis selection in `ActiveInnerFilter` discriminated union). If user testing shows demand for combined filters (e.g., "Pantry-family heroes"), refactor the inner filter to support orthogonal dimensions — likely two independent state pieces (`activeFamily: string \| null` + `heroOnly: boolean`) replacing the union. Spec'd in May 26 design session. | 💡 | 🟢 | Post-F&F based on tester ask. |

---

### From: 8R-UX4 — supplies.last_confirmed_at (May 26, 2026)

**Context:** Dedicated behavioral-engagement timestamp for Pantry "Sitting Idle" signal shipped (migration + service writes + per-supply shelf-life-aware threshold). The bumpers/non-bumpers split and the 40% threshold are best-guess; flagged for re-assessment after F&F generates real usage data.

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P8R-UX4-1 | **Re-assess `last_confirmed_at` write coverage after F&F.** The canonical confirming-function list in `suppliesService.ts` (CONFIRMING_FUNCTIONS_REFERENCE) is a best-guess of what counts as engagement. Real usage data will surface where it's wrong: false positives in Sitting Idle (supplies that bump when they shouldn't) and false negatives (supplies that don't bump when they should). Review a sample of supplies with suspiciously-old `last_confirmed_at` vs the engagement history reconstructable from logs. Tune the bumpers/non-bumpers split. | 🔧 | 🟢 | Don't touch until ~10–20 testers have ~2 weeks of usage. |
| P8R-UX4-2 | **Extend last_confirmed_at signal to lot-tracked supplies.** Lot-tracked supplies currently use `oldest active lot's acquired_at` as their idle signal — a physical-age signal, semantically distinct from behavioral confirmation. Combining both (idle ≥ threshold = MIN(oldest acquired_at, last_confirmed_at) ≥ threshold) would surface more accurate Sitting Idle for lot-tracked items. Deferred for scope; the dual-signal design needs UX validation before shipping. | 💡 | 🟢 | Post-F&F when tester feedback can validate. |
| P8R-UX4-3 | **Idle threshold tuning — 40% is a guess.** `IDLE_PERCENTAGE = 0.4` in `SuppliesSection.tsx` was chosen without real usage data. With ~10–20 active testers cooking for 2 weeks, we'll have a meaningful signal on whether 40% surfaces the right items or whether it should be 30% / 50%. Also revisit `IDLE_FALLBACK_DAYS = 14` — once catalog shelf-life backfill lands, the fallback should rarely fire and 14d may be wrong by then. | 📊 | 🟡 | Tester-driven tuning. |

---

### From: Phase 8R — CP6e closeout (May 14-15, 2026)

**Context:** CP6e-Lots smoke validation completed clean 2026-05-15 across 19 scenarios. Three SmokeFix patches (SF-1, SF-2, SF-3) shipped 2026-05-14 plus SF-5 catalog adds (90 rows). The items below are post-smoke residuals — items deferred during the closeout pass that don't block 8R completion but need tracking. Items that ARE 8R-closeout-blockers (8D matching status verification, cheese duplicate cleanup) are handled in PROJECT_CONTEXT v10.3 + PHASE_8D_PLANNING.md, not here.

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P8R-D34 | **AddNeedSheet / EditNeedSheet UnitPicker null-mode adoption.** UnitPicker null-ingredient mode shipped 2026-05-14 (CP6e-SmokeFix-SF1) and is now available for AddNeedSheet T3 custom-name needs and EditNeedSheet's free-form unit path. Currently those consumers still use plain TextInput. Migrate ONLY if smoke surfaces friction; otherwise post-F&F. **Status:** UnitPicker supports it; consumers not migrated. | 🚀 | 🟢 | Triggered by tester reports of dirty unit data on custom needs. |
| P8R-D35 | **`'pieces'` hardcoded fallback in SupplyCreateSheet.defaultLotUnit.** `defaultLotUnit(ingredient)` seeds `quantity_unit` from `ingredient.typical_unit` if present, else `'pieces'`. The fallback string matches the only `unit_type='count'` row in `measurement_units` via `display_plural`. Could drift if `measurement_units.unit='piece'` is renamed. CC flagged this during SF-1 implementation. Low-priority defensive: read the actual measurement_units row lazily, or guard with a dev-time assertion. | 🔧 | 🟢 | Won't break F&F. Cleanup candidate. |
| P8R-D36 | **`supplyMatchesQuery` retained as legacy code** in `SuppliesSection.tsx`. Still used by imperative-handle probes. Cleanup gated on a refactor of those probes. | 🔧 | 🟢 | Don't delete prematurely. Post-F&F when the probe pattern is reviewed. |
| P8R-D37 | **D8R-Q54-OVERRIDE traceability marker.** Wireframes (v3 lots) still show the "LotBadge tap cycles status" design from Q54; implementation post-CP6e-SmokeFix-SF2 expands the row instead. The decision IS captured in PHASE_8R_UNIFIED_NEEDS v0.7 decisions log, but if/when wireframes get refreshed (Phase 9 or later), this divergence should be reconciled in the visuals. | 🎨 | 🟢 | Documentation hygiene. Reconcile when wireframes next iterate. |
| P8R-D38 | **CP6e doc artifacts in PK still stale.** 22 files in PK with `_2026-05-13` suffix are stale snapshots from the CP6e batch. Repo is canonical. CC cleanup pass (next session) addresses via PK_CODE_SNAPSHOTS reconciliation. Tracked here for completeness. | 📝 | ⚪ | Workflow tech debt. CC cleanup pass handles. |

---

## From: Phase 7 — Social & Feed Polish (Mar 24 – Apr 17, 2026)

**Context:** Phase 7 shipped 78 items across 13 sub-phases, transforming Frigo into a social cooking app. 42 items deferred during execution. Items reconciled below from `PHASE_7_SOCIAL_FEED.md` deferred items sections. Resolved items dropped, still-relevant items preserved with updated context.

### Infrastructure / cleanup

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P7-2 | `posts.make_again` column cleanup | 🔧 | 🟢 | Column exists but unused after 7B-Rev. Drop when convenient. |
| P7-3 | `PostCookFlow.tsx` file deletion | 🔧 | 🟢 | Deprecated in 7B-Rev, no longer rendered. Delete in cleanup. |
| P7-4 | `LogCookSheet` inline SVG extraction | 🔧 | 🟢 | 7 SVG icons inline. Extract to `components/icons/` if reused. |
| P7-23 | Set up `supabase/migrations/` tracking | 🔧 | 🟡 | At least 8+ direct-in-Supabase migrations run without tracking. DB state non-reproducible for new environments. |
| P7-24 | Silent error swallowing audit | 🔧 | 🟢 | Audit `lib/services/*.ts` for `try/catch { continue }` patterns. Replace with collect-and-report. |
| P7-25 | `addDishesToMeal` 3-representation audit | 🔧 | 🟡 | Three parallel meal↔dish representations (`parent_meal_id`, `dish_courses`, `post_relationships`). Assess whether `post_relationships` can be dropped. |
| P7-72 | Recipe image filename normalization | 🔧 | 🟡 | ~347 storage files with uppercase/double-extension filenames. Rename + update `recipes.image_url`. |
| P7-73 | `posts.photos` jsonb shape normalization | 🔧 | 🟡 | Mix of string-array and object-array forms. CookCardInner handles defensively but data should be normalized. |
| P7-79 | Storage/DB reference integrity audit | 🔧 | 🟡 | 173 recipes with potentially broken URL patterns. Need HEAD-check script. |
| P7-100 | Migrate Meals-tab callers to MealEventDetailScreen | 🔧 | 🟡 | 4 screens still route to legacy `MealDetail`. Once migrated, `MealDetailScreen.tsx` can be deleted. |
| P7-102 | `PostActionMenu.tsx` cleanup | 🔧 | 🟢 | Still referenced by legacy MyPostDetailsScreen + MyPostsScreen. Delete after P7-100. |
| P7G-1 | Cook partner temporal window → cooked_at | 🔧 | 🟡 | `getLinkedCookPartnersForPosts` uses `created_at` — backdated cooks won't match. |
| P7G-2 | Legacy `groupPostsForFeed` dead code | 🔧 | 🟢 | Still has `created_at` sorting. Delete. |
| P7H-1 | CookDetailScreen cross-stack nav audit | 🔧 | 🟡 | StatsStack vs FeedStack internal navigation edge cases. |
| P7H-2 | Legacy MyPostDetailsScreen/MyPostsScreen route cleanup | 🔧 | 🟡 | Orphaned from Stats tab. Cleanup with P7-100/P7-102. |
| P7M-1 | Extract cook partner diff to `postParticipantsService` | 🔧 | 🟢 | Currently inline in EditPostScreen. Was also in CookDetailScreen (removed in 7M CP3). |
| P7M-2 | StarRating PanResponder / ScrollView gesture conflict | 🐛 | 🟡 | On EditPostScreen, touching star rating can accidentally scroll the page. Needs `onMoveShouldSetPanResponder` threshold or `scrollEnabled` toggling. |
| P7-43 | 2026-04-08 doc maintenance backfill | 📝 | 🟢 | Phase 7D/7E Checkpoint 5 closeout was drafted but never fully applied. Phase 7 complete now — lower priority. |

### Detail screen polish

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P7-80 | Cook/prep time split on stats grid | 🚀 | 🟢 | CookDetailScreen Block 8. Requires extending CookCardData. |
| P7-81 | Highlights descriptive paragraph | 🚀 | 🟢 | Extend Highlight data model with longText. |
| P7-82 | Author location line on Block 3 | 🚀 | 🟡 | Needs geo info on posts. |
| P7-83 | CommentsScreen extraction for inline rendering | 🔧 | 🟢 | Extract ~400 lines to reusable `<CommentList>`. |
| P7-84 | Pending cook partner visibility | 🚀 | 🟡 | Author can't see pending sous_chef invitations on their post. |
| P7-86 | EditMedia Strava-style redesign | 🚀 | 🟡 | Drag-to-reorder with hamburger handles, per-photo menu. Current grid layout. |
| P7-89 | CookDetailScreen inline photos layout | 🚀 | 🟢 | Remove separate Block 12, render thumbnails inline after highlights. |
| P7-91 | "Create event" in CookDetail meal picker | 🚀 | 🟢 | Now available on EditPostScreen (7M), but not on CookDetail's now-removed inline picker. Low priority. |
| P7-93 | Half-star eater ratings | 🚀 | 🟢 | DDL alter on eater_ratings.rating. Currently integer only. |
| P7-94 | Eater rating privacy label | 🚀 | 🟢 | "Your rating" with eye-slash icon explaining D43 private-per-eater rule. |
| P7-95 | Shared media thumbnail tap-through | 🚀 | 🟢 | Full-screen viewer for Block 7 shared media thumbnails. |
| P7-96b | Eater rating affordance on CookDetail | 🚀 | 🟡 | For viewers tagged as ate_with. P7-96a (label fix) shipped in 7N. |
| P7-99 | Highlight picker section headers | 🚀 | 🟢 | Split dual-pool grid into "From shared media" / "From dishes" groups. |

### Feed performance

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P7-44 | Feed infinite scroll (pagination) | 🚀 | 🔴 | Hard-capped at 200 dishes. Needs onEndReached pagination. **Scheduled: Phase 7P** (per FF_LAUNCH_MASTER_PLAN v6.0). |
| P7-74 | hydrateEngagement perf | 🔧 | 🟡 | ~1.0s steady-state. Likely N+1 pattern. |
| P7-75 | Batched getMealEventsByIds | 🔧 | 🟢 | N×4 round trips → 2-3 batched. |
| PL-H1 | `highlightsService` batched RPC / materialized view (cold-path bottleneck) | 🔧 | 🟡 | Cold-path `hydrate:highlights` measured at ~2.6s on 200-post batch in 7P-1 testing. Per-post `computeSoloAuthorSignal` fires one `posts`-table query per card. 7P-2 pagination mitigates to ~390ms on 30-post page (D7P-8), but real fix is a single SQL rollup — either a batched RPC or materialized view. Service source already flags this. Deferred to post-launch per D7P-8. |
| DQ-1 | Orphaned `parent_meal_id` on posts | 🐛 | 🟢 | _(Cross-cutting: data-integrity issue surfaced via feed rendering; not strictly a feed-perf item, but filed here since no Phase 7 data-quality subsection exists.)_ Posts reference deleted `meal_events` via `parent_meal_id`. `feedGroupingService.buildFeedGroups` logs `linked_meal_event group without mealEventContext` warnings at render time when an orphaned post is encountered. 3 confirmed orphans hit on page 4 of the 7P-2 pagination device test; count may grow over time. Needs (a) cleanup script nulling `parent_meal_id` where the referenced `meal_events` row no longer exists, (b) optional FK constraint or trigger preventing recurrence. Not F&F-blocking — warnings are log-only; feed rendering degrades gracefully. |

### Future sub-phases (post-launch)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P7-7 | Voice memo on LogCookSheet | 🚀 | 🟡 | Placeholder chip exists. Needs recording + transcription. |
| P7-8 | Photo upload on LogCookSheet | 🚀 | 🟡 | Placeholder buttons exist. Needs image picker wiring. |
| P7-17 | Retroactive external participant claim | 🚀 | 🟢 | Schema supports it. UI is post-launch. |
| P7-21 | User-configurable contextual privacy rules | 🚀 | 🟢 | Hardcoded in v1. Making configurable needs rules-engine UI. |
| P7-32 | `post_participants` schema migration for eater ratings | 🔧 | 🟡 | Add `rating numeric(3,1)` and `notes text` columns. Per D43. |
| P7-33 | Eater rating service + privacy enforcement | 🚀 | 🟡 | Ratings must never surface to the cook. Per D43 ζ. |
| P7-34 | Eater rating UI in meal detail | 🚀 | 🟡 | Per-dish rating with educational banner. Per D43. |
| P7-35 | "Things I've eaten" history in profile | 🚀 | 🟢 | Personal-only. Linked from meal detail eater rating. |
| P7-36 | @-mention parsing in comments | 🚀 | 🟡 | Tokenize, validate, render styled span. Per D42. |
| P7-37 | Comment thread subscriptions | 🔧 | 🟡 | Implicit subscribe on first comment. Mute option. Per D42. |
| P7-38 | Notification batching for meal comments | 🚀 | 🟡 | Aggregate within time window. Per D42. |
| P7-39 | Per-photo dish tag toggle in LogCookSheet | 🚀 | 🟢 | Required for full D46 implementation. |
| P7-40 | Viewer-taste-profile model | 🚀 | 🟢 | Phase 11 territory. Computed from cook history + ratings. |
| P7-41 | Vibe pill personalized selection | 🚀 | 🟢 | Depends on P7-40. Currently static. |
| P7-42 | Flip-card recipe affordance | 💡 | 🟢 | Parked concept from wireframes. |
| P7-46 | Strava-style tag-accept auto-draft flow | 🚀 | 🟡 | Tag cook partner → notification → draft post for them. |
| P7-47 | Duplicate meal event detection | 🐛 | 🟡 | Trust users for F&F. Later: detect + merge. |
| P7-48 | Planned-dish entry flow on MealEventDetail | 💡 | 🟡 | "Add planned dish" for host before attendee posts. |
| P7-49 | "Host recap" post type | 💡 | 🟡 | Host posts about an evening without specific dishes. |
| P7-50 | RSVP flow redesign under meal event model | 🚀 | 🟡 | Move from old MealDetailScreen to MealEventDetailScreen. |
| P7-51 | "Related cooks from friends" on CookDetail | 🚀 | 🟢 | "Mary also cooked this recipe" social hook. |
| P7-52 | Personalized chef page lens | 🚀 | 🟢 | Chef page filtered through user's cook history. |
| P7-53 | Cookbook page number deep-linking | 🚀 | 🟢 | Tap page number → cookbook detail scrolled to section. |
| P7-54 | Collage hero photo for meal event | 🚀 | 🟢 | One photo from each contributor. |
| P7-55 | Per-cook + per-event comments unification | 💡 | 🟢 | May feel artificial — wait for F&F feedback. |
| P7-56 | Shared media notifications | 🚀 | 🟢 | Who gets notified when attendee adds photo. |
| P7-57 | Photo dimensions at upload time | 🔧 | 🟢 | Eliminate aspect ratio flash on first load. |
| P7-63 | Feed card overflow menu (edit/delete from feed) | 🚀 | 🟢 | Deferred from 7M. Only entry point is CookDetail → Edit post. |

### Resolved during Phase 7 (dropped from backlog)

- **P5-4** (Chef name backfill) — Done in 7K. 147 recipes updated.
- **P6-4** (PostCookFlow makeAgain/thoughts data gap) — Fixed in 7A.
- **P6-5** (notes/modifications duplication) — Fixed in 7A.
- **S1** (Visual linking for linked posts) — Superseded by 7I cook-post-centric feed.
- **S2** (Feed grouping for meals) — Superseded by 7I feedGroupingService rewrite.
- **P7-9** (Partner tagging on LogCookSheet) — Done in 7E Checkpoint 3.
- **P7-15** (CreateMealModal entry point audit) — Done in 7D Checkpoint 1.
- **P7-16** (Verify meal post visibility filter) — Done in 7D Checkpoint 2a.
- **P7-29** (GroupedMealCard) — Retired. Replaced by CookCard + CookLinkedGroup.
- **P7-58** (Remove 'meal' from PostType) — Done in 7I Checkpoint 7.
- **P7-60** (AddCookingPartnersModal interface extension) — Done in 7I Checkpoint 5.
- **P7-62** (Derived-stat recalculation on recipe_id change) — Deferred by design. Recipe link is non-editable on EditPostScreen (7M decision).
- **P7-64** (Unsaved-changes pattern) — Done in 7M Checkpoint 2. isDirty + confirmation dialog.
- **P7-65** (Book/friends icon fallback) — Emoji fallback accepted.
- **P7-66** (eater_ratings schema) — Partially addressed. eater_ratings via post_participants exists. Full schema is P7-32.
- **P7-67** (Phase 7I test harness) — Deleted in 7I Checkpoint 7 cleanup.
- **D3** (Cooking method architecture) — Partially addressed. `constants/cookingMethods.ts` created in 7M with canonical list matching DB CHECK constraint. Per-step technique tagging remains as P5-6.
- **P7-88** (Multi-photo select) — Done in 7N Checkpoint 2.
- **P7-85** (CommentsScreen keyboard) — Done in 7N Checkpoint 1.
- **P7-87** (Photo carousel peek) — Done in 7N Checkpoint 1.
- **P7-90** (CookDetail header title) — Done in 7N Checkpoint 1.
- **P7-97** (Star picker stay-open) — Done in 7N Checkpoint 2.
- **P7-98** (Inline engagement bar) — Done in 7N Checkpoint 2.
- **Feed card swipe reliability** — Done in 7N Checkpoint 2 (3-zone Pressable restructure).
- **P7-45** (Pull-to-refresh investigation) — **RESOLVED 2026-04-22 in Phase 7P-2** via P7-44 pagination. 7P-1 instrumentation measured cold load at 5.3s on the 200-post batch (2.6s in `computeHighlightsForFeedBatch` cold path). 7P-2 pagination cut the per-load batch to 30 posts, bringing cold page-1 load to 2888ms and paginated page loads to 1913-2967ms — all under D7P-2's 3s threshold. Original 15s hang report partially unexplained; likely combination of dev-mode StrictMode double-invoke, network variance, and per-device cold-start overhead. Post-launch follow-up tracked as PL-H1 (highlightsService SQL rollup).

---

## Pre-launch deferrals (2026-04-22 — master plan v6.0 scope cuts)

The following items were in or adjacent to pre-launch scope and were explicitly moved to post-launch during the 2026-04-22 FF_LAUNCH_MASTER_PLAN v6.0 refresh. They live here rather than in phase-specific deferred sections because they were cut at the master-plan level, not by any individual phase.

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| DEF-4/22-1 | Edit Mode full redesign | 🚀 | 🟡 | Notebook aesthetic, structural ingredient editing (separate quantity vs ingredient), drag handles for sections, "or" substitution syntax. MVP banner + Exit button from 7B-Rev stands as sufficient pre-F&F. |
| DEF-4/22-2 | NYT Cooking integration | 🚀 | 🔴 | **Top-of-queue post-launch priority.** Tom's annotation: "would be awesome if we could get that shipped at or soon after F&F launch." Scope-first approach retained (1 session to investigate before committing build sessions). |
| DEF-4/22-3 | Receipt scanning | 🚀 | 🟢 | Flagged as "if easy" during 4/22 review; real effort 3-5 sessions (OCR + item parse + pantry matching UX). Revisit post-launch. |
| DEF-4/22-4 | Recipe comments knowledge base system (#30) | 🚀 | 🟢 | Community-shared notes, tips, substitutions per recipe. Needs moderation thinking, display UX, threading. F&F is the right moment to learn what users actually want before building. |

---

## From: Phase 7F Fix Passes 7-9 + Phase 7I Planning Session (Apr 13, 2026)

**Note:** Most items from this section have been reconciled into the "From: Phase 7" section above. Remaining items that weren't covered by Phase 7 execution:

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P7-59 | Migration rollback path | 🔧 | ⚪ | Forward-only by design. Accepted tradeoff. |
| P7-61 | Leave event cascade behavior | 💡 | 🟡 | When user leaves meal event, should linked cook posts keep parent_meal_id? Currently yes. Revisit with F&F feedback. |

---

## From: Phase 6 — Cooking Mode v2 (Mar 19-24, 2026)

### High Priority (F&F blockers or near-term)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P6-1 | **Cooking time data backfill** | 📊 | 🔴 | Only 60/475 recipes have `prep_time_min`/`cook_time_min` data. Need AI-assisted backfill. |
| P6-2 | **CookingScreen simplification** | 🚀 | 🟡 | Too busy. Consider stripping to essentials, ClassicView as default. |
| P6-3 | **Multi-recipe cooking** | 🚀 | 🟡 | Cook dinner = protein + side + salad simultaneously. High-impact. |

### Medium Priority (polish + UX)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P6-6 | Rethink pantry fraction next to INGREDIENTS | 💡 | 🟡 | "4/14 in pantry" may confuse users. |
| P6-7 | Rethink "Add missing to Grocery List" button | 💡 | 🟡 | Current treatment may not be right. |
| P6-8 | Add timer options to step focus mode | 💡 | 🟡 | Start timers without entering cooking mode. |
| P6-10 | Ingredient tap-to-see-steps | 💡 | 🟡 | ✅ **RESOLVED 2026-05-19 by 8D-CP3.** The ingredient tap-sheet's "Which step?" action scrolls the recipe to the first prep step that references the tapped ingredient (best-effort name match). NOTE: the CP3 prompt referenced this item as "D6-18" — no literal `D6-18` ID exists in this doc; P6-10 is the matching item by description. Flagged for Claude.ai reconciliation. |
| P6-11 | Dedicated "Add a Note" modal | 💡 | 🟡 | Simple text area, NYT-style. |
| P6-12 | Read More inline fade effect | 💡 | 🟢 | NYT left-side fade. Current works fine. |
| P6-13 | Bold variance on ingredient names | 🔧 | 🟢 | Hard to fix perfectly. Low impact. |
| P6-14 | ⋮ overflow menu feel | 💡 | 🟢 | Consider native ActionSheet on iOS. |

### Lower Priority (v2 features)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P6-9 | Multi-recipe meal dashboard | 🚀 | 🟢 | Timers unified across recipes. |
| P6-15 | Wearable companion (WatchOS) | 🚀 | 🟢 | react-native-watch-connectivity. |
| P6-16 | Interleaved AI timeline | 💡 | 🟢 | AI merges steps across recipes. Moonshot. |
| P6-17 | Serving size adjuster | 🚀 | 🟢 | Non-linear baking edge cases. |
| P6-18 | Voice commands | 💡 | 🟢 | "Next step" / "Start timer". |
| P6-19 | Offline cooking | 💡 | 🟢 | Cache recipe locally. Significant scope. |
| P6-20 | Ingredient alternatives | 💡 | 🟢 | "Try X instead of Y". Needs data source. |
| P6-21 | Voice note transcription | 💡 | 🟢 | Placeholder exists. Actual transcription v2. |
| P6-22 | Timeline overview view mode | 🚀 | 🟢 | 3rd CookingScreen view option. |
| P6-23 | Post-cook photo upload | 🚀 | 🟢 | Placeholder button. Needs image picker. |
| P6-24 | Post-cook voice memo | 💡 | 🟢 | Placeholder button. Needs recording. |
| P6-25 | Post-cook partner tagging | 🚀 | 🟢 | Should connect to AddCookingPartnersModal. |
| P6-26 | "Mark as Cooked" + Rate on RecipeDetail | 💡 | 🟢 | NYT pattern. Log without cooking mode. |
| P6-27 | Clickable page references in step text | 💡 | 🟢 | Detect "see page 116" via regex. |
| P6-28 | Yield/servings display enhancement | 💡 | 🟢 | Add yield text from description. |
| P6-29 | Step quantities scale in instruction text | 🔧 | 🟢 | Quantities in prose don't update at 2x/3x. |
| P6-30 | RecipeDetail tab toggle | 💡 | 🟢 | INGREDIENTS/PREPARATION tabs. |
| P6-31 | Ingredient alternatives popup | 💡 | 🟢 | Needs data source. |

### Phase 6 Tech Debt

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P6-T1 | PanResponder → gesture handler upgrade | 🔧 | 🟡 | CookingScreen swipe. May conflict with scroll. |
| P6-T2 | Table-only recipes missing step text | 🔧 | 🟡 | 8 recipes with instructions=[] but text in instruction_steps. |
| P6-T3 | Android notification channel config | 🔧 | 🟢 | Not blocking iOS F&F. |
| P6-T4 | Blueberry Cornflake Crisp section name | 📊 | 🟢 | "Main" instead of descriptive. |
| P6-T5 | instruction_sections table redundancy | 🔧 | 🟢 | DB tables vs JSONB canonical. |
| P6-T6 | "Error getting pending count" toast | 🐛 | 🟢 | Not from Phase 6. Investigate separately. |

---

## From: Phase 5 — Ingredient Architecture (Mar 17-19, 2026)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P5-1 | `base_ingredient_id` wiring | 🔧 | 🟡 | Protein cuts, cheese dupes, salt variants. Systematic pass needed. |
| P5-2 | Gardening data (planting/growing months) | 📊 | 🟢 | Columns exist, populate later. |
| P5-3 | Recipe markup/editing review | 🔧 | 🟡 | Still clunky after Phase 6 modularization. |
| P5-5 | Difficulty score backfill | 📊 | 🟢 | Only 11 recipes scored. Haiku batch. |
| P5-6 | Technique tagging (B15) | 🚀 | 🟢 | Per-step technique tags. ~2,400 steps. |

---

## From: Phase 4 / Phase I — Cooking Stats Dashboard (Mar 2026)

### Data Gaps

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| D4-1 | getMicronutrientLevels stubbed | 📊 | 🟡 | Needs USDA data import. |
| D4-2 | getTopNutrientSources for fiber/sugar/sodium | 📊 | 🟡 | Missing view columns. |
| D4-3 | totalTimeHours in getOverviewStats | 📊 | 🟡 | Needs recipe time join. Relates to P6-1. |
| D4-8 | Sparse ai_difficulty_score | 📊 | 🟢 | Only 11 scored. Relates to P5-5. |
| D4-4 | Cookbook recipe_count mismatch | 📊 | 🟢 | "Plenty" shows >100%. |

### Feature Gaps

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| D4-26 | Frontier suggestions v2 | 🚀 | 🟡 | Partner-popular, seasonal, ingredient overlap. |
| D4-12 | Seasonal pattern tile taps | 🚀 | 🟢 | Tap → filtered RecipeList. |
| D4-13 | Diversity breakdown taps | 🚀 | 🟢 | Tap count → sub-section. |
| D4-14 | initialChefId filtering | 🚀 | 🟢 | Param declared, not consumed. |
| D4-15 | initialBookId filtering | 🚀 | 🟢 | Param declared, not consumed. |
| D4-16 | Ingredient drill-down filter | 🚀 | 🟢 | Needs recipe_ingredients join. |
| D4-17 | initialCookingMethod param | 🚀 | 🟢 | Maps to concept (imprecise). |
| D4-18 | StockUpCard grocery integration | 🚀 | 🟢 | Needs groceryService wiring. |
| D4-39 | Friends' stats comparison | 🚀 | 🟢 | Privacy + social design needed. |
| DI-2 | My Posts pagination | 🚀 | 🟢 | Limited to 30. Infinite scroll. |
| DI-3 | ActivityCard menu button wiring | 🚀 | 🟢 | No onPress handler. |
| DI-6 | Chart swipe for time navigation | 🚀 | 🟢 | More intuitive than arrow buttons. |

### Tech Debt

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| D4-10 | Accessibility labels on stats | 🔧 | 🟡 | ~30 components. |
| D4-11 | Legacy MyPostsStackParamList cleanup | 🔧 | 🟢 | Type kept for 4 screens. |
| D4-21 | Entity name in ChefStats/BookStats | 🔧 | 🟢 | Both query name separately. |
| D4-37 | colors.text.quaternary fallback | 🔧 | 🟢 | GatewayCard uses tertiary. |
| DI-1 | Extract ActivityCard to shared component | 🔧 | 🟢 | Duplicated in 2 screens. |
| DI-7 | Avatar URL onError fallback | 🔧 | 🟢 | Transparent on fail. |

### Polish

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| D4-25 | Gateway card sparklines | 💡 | 🟢 | |
| D4-27 | Podium recipe images | 💡 | 🟢 | |
| D4-28 | ConceptBubbleMap manual layout | 💡 | 🟢 | |
| D4-29 | CookingPersonalityCard gradient | 💡 | 🟢 | |
| D4-30 | Animated chart transitions | 💡 | 🟢 | |
| D4-33 | Chart↔calendar scroll-into-view | 💡 | 🟢 | |
| D4-35 | Podium cooking_concept emoji | 💡 | 🟢 | |
| D4-36 | Expand CONCEPT_EMOJI_MAP | 💡 | 🟢 | |
| D4-38 | Personality card loading skeleton | 💡 | 🟢 | |

---

## From: Nutrition Data Foundation Subproject (Feb 2026)

### Open Action Items

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| N1 | ~~Integrate subproject services into codebase~~ | 🔧 | ⚪ | **Phase 5A-3 audit resolved.** Existing `ingredientsParser.ts` is the active pipeline. |
| N2 | Import vitamins & minerals from USDA | 📊 | 🟡 | Only 7 macros imported. Full vitamin/mineral data available. Relates to D4-1. |
| N3 | Fill 10 unmapped USDA ingredients | 📊 | 🟢 | Gochujang, harissa, mirin, pomegranate molasses, za'atar, sumac, urfa pepper, aleppo pepper, silan, barberries. |
| N4 | Tag ~70 "for serving/garnish" ingredient rows | 📊 | 🟢 | ingredient_role = 'garnish' with nutrition_multiplier = 0. |
| N5 | Update extraction pipeline to output ingredient_role | 🔧 | 🟡 | New recipes should have role tagging from extraction. |
| N7 | Fix `form` column data quality | 📊 | 🟢 | "Black pepper" marked as "fresh", defaults unreliable. |

### Known Gaps (Accepted)

| # | Gap | Impact | Priority | Notes |
|---|-----|--------|----------|-------|
| NG1 | Canned goods use gross weight, not drained | ~20 rows overstated by ~60% | 🟡 | Need `drained_weight_ratio`. See Idea I1. |
| NG2 | Raw vs cooked nutrition | Grains/legumes/pasta ~2.5× overstatement | 🔴 | Interim fix: `cooked_ratio` applied. Real fix: extraction captures raw/cooked intent. See I6. |
| NG3 | "Plus more for dusting" quantities | Negligible calories missed | ⚪ | By design — uncapturable, nutritionally negligible. |
| NG4 | Size-range primary selection arbitrary | "5 small or 2 large" picks first option | 🟢 | Could use weight-equivalent midpoint. |
| NG5 | Thick/thin cut weight variance | Same g_per_whole for thick vs regular bacon | 🟢 | Prep text has "thick"/"thin" but not used in estimation. |
| NG6 | Materialized view requires manual refresh | Data not reflected until `SELECT refresh_recipe_nutrition()` | ⚪ | By design (D17). Tradeoff for query performance. |

### Idea Shelf

| # | Idea | Priority | Context |
|---|------|----------|---------|
| I1 | **Canned goods drained weight** — add `drained_weight_ratio` to ingredients. Typical: ~0.60 for beans/legumes. | 🟡 | Affects ~20 rows. Not blocking. |
| I2 | **Nutrition ranges for users** — show "350–420 cal/serving" instead of single number. Variance data already captured. | 🟢 | Would need downstream variance propagation. |
| I3 | **Cooking-method nutrition adjustments** — frying adds fat, boiling leaches nutrients. | 🟢 | Significant research needed for accurate factors. |
| I4 | **Competing nutrition estimates** — "USDA says X, Nutritionix says Y" side by side. | 🟢 | Needs second data source. |
| I5 | **Dual-source embedded metric merge** — embedded grams from quantity normalizer vs unit normalizer. | 🟢 | Resolves itself when pipeline is built. |
| I6 | **Raw vs cooked intent from extraction** — add `ingredient_state` field. | 🔴 | Single largest systematic calorie error source. ~30% of recipes. See NG2. |
| I7 | **Salt variant normalization** — "kosher salt" etc. → all nutritionally identical. | 🟡 | Affects 200+ rows. Relates to P5-1. |
| I9 | **USDA match validation layer** — sanity checks after matching. | 🟡 | Would have caught all 17 bad matches from Session 4. |

---

## From: Recipe Extraction Subproject (Jan 2026)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| E1 | Extraction pipeline upgrade to v10+ | 🔧 | 🟡 | v10-2 deployed. Future upgrades should improve existing pipeline. |
| E2 | Gold standard expansion beyond Plenty | 📊 | 🟢 | All 16 verified recipes are Ottolenghi. Verify against other books. |

---

## From: Phase 3A Smart Recipe Browse (Feb 2026)

### Tier 1: Should Do Next

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| B1 | Flavor profile system (recipe-level aggregation) | 🚀 | 🟡 | Ingredient-level flavor_tags exist, need recipe-level weighted aggregation. Deferred post-F&F. |
| B13 | Recipe rating UX | 🚀 | 🟡 | Without ratings, smart sections empty. Need prominent rating input. |

### Tier 2: Polish & Enhancement

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| B10 | Flavor profile display | 🚀 | 🟡 | Depends on B1. Radar chart. Deferred post-F&F. |
| B5 | "Unknown Chef" cleanup | 🔧 | 🟢 | May be resolved by 7K backfill. Verify. |
| B8 | Click-to-see-friends modal | 🚀 | 🟢 | Needs query: given recipe_id, get posts from followed users. |
| — | Chevron tap target fix | 🐛 | 🟢 | UX issue flagged by Tom. |

### Tier 3: Larger Features

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| B3 | Visual grid browse mode | 🚀 | 🟢 | Photo-first recipe browsing. Requires recipe images. |
| B2 | Personalized/learned recipe tags | 🚀 | 🟡 | Tags that adapt to user over time. Phase 11 territory. |

### Low Priority Data Quality

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| B16 | Cuisine types quality improvement | 📊 | 🟢 | 35 recipes with empty cuisine_types. |
| B17 | Normalize cooking_methods values | 📊 | 🟢 | "mixing", "tossing" non-technique entries. |
| B18 | Cuisine authenticity / fusion tagging | 🚀 | 🟢 | Structured tags. Low priority. |

### B1 Detail: Flavor Profile System

**Reference:** Molly Baz's "Cook This Book" (pp. 46-47) — "Need Some Inspo?" flavor reference chart.

#### 7 Flavor Categories

**SWEET** — Granulated Sugar, Brown Sugar, Molasses, Honey, Maple Syrup, Apples, Pears, Dried Fruits, Cooked Onions, Stone Fruit, Berries, Bananas, Sweet Potatoes, Tropical Fruits, Carrots, Oranges, Ketchup, Hoisin Sauce, Jam or Jelly, Cooked Tomatoes, Winter Squash

**SALTY** — Salt, Anchovies, Olives, Capers, Fish Sauce, Soy Sauce, Miso Paste, Bacon, Parmesan Cheese, Pecorino Cheese, Feta Cheese, Cured Meats, Smoked Salmon, Clam

**BITTER** — Citrus Zest, Chocolate, Coffee, Amaro, Beer, Mustard Greens, Radicchio, Broccoli Rabe, Dandelion Greens

**UMAMI** — Parmesan Cheese, Piave Cheese, Cheddar Cheese, Walnuts, Fish Sauce, Mushrooms, Anchovies, MSG, Kimchi, Sardines, Oysters, Miso Paste, Cured Meats, Soy Sauce, Chicken Broth

**FATTY** — Heavy Cream, Crème Fraîche, Sour Cream, Cream Cheese, Butter, Nuts, Seeds, Avocado, Mortadella, Sausage, Cheese, Tahini, Olive Oil, Neutral Oil, Sesame Oil, Coconut Oil, Coconut Milk, Mayonnaise, Bacon, Lard, Yogurt, Schmaltz

**SPICY** — Fresh Chile Peppers, Ground Dried Chiles, Black Peppercorns, Szechuan Peppercorns, Fresh Ginger, Mustard, Mustard Seeds, Harissa Paste, Gochujang, Sambal Oelek, Chile Oil, Chile Crisp, Sriracha, Horseradish, Hot Sauce, Wasabi

**SOUR** — Vinegar, Lime, Lemon, Grapefruit, Buttermilk, Cottage Cheese, Yogurt, Wine, Pickles, Cornichons, Pickled Onions, Tomato, Sauerkraut, Kimchi

#### Key Design Notes
- Ingredients can have multiple flavor tags. Parmesan = salty + umami. Kimchi = umami + sour.
- Recipe flavor profile = aggregation of ingredient flavors, weighted by role (hero/supporting/garnish).
- Use cases: Browse by flavor, pairing suggestions, balance analysis, substitution guidance.

#### Implementation Path
1. Add `flavor_tags` column to `ingredients` table
2. AI-tag ~480 ingredients with 1-3 flavor categories
3. Compute recipe flavor profile (materialized view or query-time)
4. Add to recipe display (radar chart + filter dimension)
5. Extend Cooking Assistant

**Estimated effort:** 2 sessions

---

## From: SVG Icon Integration (Feb 26, 2026)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| B20 | Counter storage location needs SVG icon | 🔧 | 🟢 | Still uses 🪴 emoji fallback. |
| B21 | Clean up old emoji icon constants | 🔧 | 🟢 | Dual system in constants/pantry.ts. |

---

## From: Data Seeding Session (Feb 26, 2026)

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| D3 | Cooking method/occasion/technique architecture | 🚀 | 🟡 | **Partially addressed in Phase 7M.** `constants/cookingMethods.ts` created with canonical list matching DB CHECK constraint. Per-post cooking method editing works. Per-step technique tagging (P5-6) and meal occasion vs method distinction still open. |

---

## From: Social / Meals Features (Nov-Dec 2025)

*(S1 and S2 resolved — see Phase 7 resolved items above)*

---

## From: Broader Roadmap

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| R1 | User dietary preferences table + settings UI | 🚀 | 🟡 | Needed for stats compliance % and recommendations. |
| R2 | Ingredient source tracking | 🚀 | 🟢 | "From garden" / "farmers market". Feeds stats. |
| R4 | Wearable integration research | 💡 | 🟢 | Apple Health / Fitbit. Future. |
| R5 | Recipe cost per serving | 🚀 | 🟢 | 229 ingredients have cost data. |
| R6 | Personal daily eating log / leftovers | 🚀 | 🟡 | Distinct from social feed. Post-F&F. |
| R7 | Recipe discovery feature | 🚀 | 🟡 | See `PHASE_RECIPE_DISCOVERY.md`. Post-F&F. |
| R8 | External participant retroactive claim | 🚀 | 🟢 | Schema supports it. Onboarding flow. |
| R9 | Concept cooking inline suggestions | 💡 | 🟢 | Phase 11 dependency. |

---

## Cross-Cutting Technical Debt

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| T3 | Schema change propagation discipline | 🔧 | 🟡 | Rule: ALTER TABLE on joined tables → grep sweep for RPCs, inline type logic, TS interfaces, related write paths. |
| T4 | **Relocate stray service files from `lib/` root into `lib/services/`.** FRIGO_ARCHITECTURE v4.0 documents all services under `lib/services/`, but 5 service files currently live at `lib/` root: `groceryListsService.ts` (461 lines), `groceryService.ts` (155), `pantryService.ts` (1,246), `searchService.ts` (455), `storeService.ts` (480). Move them to `lib/services/`, update all imports, confirm no other references. Also review `lib/ingredientsParser.ts` (755 lines) during the same pass — it may warrant a `lib/parsers/` or `lib/matching/` home rather than staying at `lib/` root. ~45 min. Surfaced during PK_CODE_SNAPSHOTS v1.1 tier inventory 2026-04-22. | 🔧 | 🟢 | Low urgency. Affects consistency and FRIGO_ARCHITECTURE accuracy; no runtime impact. Also: update `FRIGO_ARCHITECTURE.md` Directory Structure when files move. |
| T5 | **Delete deprecated `components/cooking/PostCookFlow.tsx`.** 221-line file explicitly marked DEPRECATED (merged into `LogCookSheet` 'full' mode April 2026). Still in repo. Confirm no remaining imports, delete file, commit. ~10 min. Surfaced during PK_CODE_SNAPSHOTS v1.1 tier inventory 2026-04-22. | 🔧 | 🟢 | Low urgency. Housekeeping only. |
| T6 | **Review `lib/oldTheme.ts` for deletion.** 151-line legacy theme constants file, "largely superseded by `lib/theme/`" per its own description but still referenced per the inventory note. Audit import graph; if fully dead, delete. If still referenced, migrate references to `lib/theme/` and then delete. ~20–30 min depending on reference count. Surfaced during PK_CODE_SNAPSHOTS v1.1 tier inventory 2026-04-22. | 🔧 | 🟢 | Low urgency. Code hygiene. |
| T7 | **Resolve `@ts-nocheck` pragma on `components/QuickAddSection.tsx`.** 546-line component carries `@ts-nocheck` at top, suppressing TypeScript errors. Disable the pragma, fix the surfaced type errors, re-enable strict checking. Unknown error count without running the check. Surfaced during PK_CODE_SNAPSHOTS v1.1 tier inventory 2026-04-22. | 🔧 | 🟡 | Type-safety gap. Medium priority — pragma masks real bugs; worth fixing before F&F. |
| T8 | **5 stale `pantry_items` query sites in service files.** The `pantry_items` table was dropped in 8R-CP1, but 5 service-layer queries still reference it: `lib/services/spaceService.ts` (lines 182, 318, 416), `lib/services/statsService.ts` (lines 2033, 2456). Queries return empty silently (Supabase doesn't error on missing tables in a SELECT). Surfaces consuming these may display empty state when they should show real data, or may have been silently degraded since the 8R purge. **Action:** audit each call site — determine whether the calling feature is dead (delete) or live (re-point to `supplies`). Estimated 30-60 min. Surfaced during 8D verification 2026-05-15. | 🔧 | 🟡 | Affects stats + space-related rendering. Worth fixing before F&F to avoid mystery empty states. |
| T9 | **Repo schema-snapshot CSVs.** Supabase schema CSVs (column details, CHECK constraints, indexes) currently live only in Claude.ai project knowledge — not in the repo. CC sessions cannot grep them during prompt execution, which led to schema-claim drift in 8D-CP1 (cheese migration assumed OR-semantics on `supply_has_identity`; actual constraint is XOR). **Action:** snapshot a small set of CSVs into `docs/schema/` and refresh on a cadence (probably at phase boundaries). Snapshots needed: column details, CHECK constraints, indexes, function signatures. ~30 min initial setup + ~10 min per refresh. Surfaced during 8D-CP1 verification 2026-05-18. | 🔧 | 🟢 | Workflow hygiene. Catches schema-claim drift in future prompts before runtime. |
| T10 | **`missingCount` divergence on RecipeDetailScreen.** `IngredientsSection`'s `missingCount` prop now uses `matchResult.missing.length` from the matcher (catalog ingredients only — free-text rows excluded). The screen's separate `missingIngredients` array driving the "Add missing" modal still includes free-text rows. Counts can diverge slightly on recipes with free-text ingredients. **Action:** reconcile in CP3 by routing the modal's source through the matcher's `missing[]` or adding a separate free-text affordance. Surfaced during 8D-CP1 SESSION_LOG triage 2026-05-18. | 🔧 | 🟡 | UX inconsistency. Resolve before F&F if free-text recipes are common in seeded data. |
| T11 | **Bulk match URL-length risk at scale.** `pantryMatchingService.calculateRecipeSupplyMatchBulk` issues an `.or(id.in.(...),base_ingredient_id.in.(...))` query that could approach PostgREST URL limits at N≈475 recipes. Acceptable per D8D-Q10 (caching out of scope at F&F scale). **Action if surfaces:** chunk the bulk call into batches of ~100-150 recipes. Surfaced during 8D-CP1 SESSION_LOG triage 2026-05-18. | 🔧 | 🟢 | Contingency only — no observed failures yet. |
| T12 | **Demoted `cheese` base — 1 recipe_ingredient row.** 1 `recipe_ingredients` row may still point at the demoted `cheese` base (id `8fbe2d77-...`). Run Part 5 Query 5 from `8D_CP1.5_base_set_corrections.sql` to identify it, then redirect or leave per recipe context. [CP1.5 / 8D] | 🔧 | 🟢 | Tech debt. Low priority — unlikely to surface as a real bug; hygiene only. |
| T13 | **Sub-family hierarchy for functional substitutes within a subtype.** E.g. ghee↔butter share `subtype='butter'` currently; a further hierarchy could distinguish a "clarified" form for finer matcher decisions. [CP1.5 / 8D] | 🔧 | 🟢 | Tech debt. Post-F&F if at all. |
| T14 | **Remaining catalog dedup pass.** Scan for any X / X-cheese pairs, unicode/case duplicates not caught in CP1.5, or pre-existing inconsistencies the chunk-by-chunk audit may have missed. Run a duplicate-name fuzzy-match query post-F&F. [CP1.5 / 8D] | 🔧 | 🟢 | Catalog hygiene. Post-F&F. |
| T15 | **Non-dairy milks family classification.** Almond/coconut/oat milks are `family='Dairy'` but technically not dairy. Family reclassification consideration post-F&F; affects browse/filter UI more than the matcher. [CP1.5 / 8D] | 🔧 | 🟢 | Tech debt. Post-F&F. |
| T16 | **No DB constraint on `base_ingredient_id` → base row.** Nothing prevents `base_ingredient_id` pointing at a non-base row. Hand audit (Chunks 0a-3, 0b, A, C, D) found ~11 such cases pre-CP1.5; all fixed in CP1.5. Add trigger-based enforcement to prevent regression. [CP1.5 / 8D] | 🔧 | 🟢 | Catalog hygiene. Pairs with T19. |
| T17 | **Cured meats classified as `Red Meat`.** Bacon, prosciutto, etc. are `ingredient_type='Red Meat'` in the Proteins family but functionally distinct from fresh red meats. Consider a new `ingredient_type='Cured Meats'` post-F&F. [CP1.5 / 8D] | 🔧 | 🟢 | Tech debt. Post-F&F. |
| T18 | **Color/cultivar variant link-policy inconsistency.** New Produce dispositions promoted color variants standalone (red onion, color cabbages, color peppers each own base) while pre-existing links for color bell peppers, potato cultivars, cherry/grape tomato were preserved — then unlinked-and-promoted in Chunk 0a-3 for full (i) consistency. Audit for any remaining color/cultivar links that should also be promoted. [CP1.5 / 8D] | 🔧 | 🟢 | Catalog hygiene. |
| T19 | **Trigger-based enforcement: `base_ingredient_id` target must be `is_base_ingredient=true`.** Currently relies on app-level discipline. Pairs with T16. [CP1.5 / 8D] | 🔧 | 🟢 | Catalog hygiene. |
| T20 | **✅ RESOLVED — 8D-CP2 (2026-05-19).** THE BIG ONE — build the 4-level soft-match feature. Data scaffolding complete (CP1.5 close-out). Matcher refactor + UI changes required. Spec (see CP2 prompt): **L1 Exact** — same row OR linked via `base_ingredient_id` → ✓ "you have it"; **L2 Form variant** — same subtype + different form → ⚠ "you have a different form of this ingredient"; **L3 Substitute** — same subtype + same form → ⚠ "you have a similar ingredient"; **L4 No match** — different subtype → ✗ "you don't have it". Post-F&F engineering work. Estimated CP-scale: matcher service refactor + RecipeDetailScreen UI update + smoke test ≈ 1-2 days CC work. [CP1.5 / 8D] | 🔧 | 🟡 | Feature (post-F&F). The headline 8D-CP2 deliverable — see PHASE_8D_PLANNING.md. |
| T21 | **Rename `date` row to `dates` (plural canonical).** Kept singular because the singular row had 6 recipe refs; the plural was deleted. Convention is plural-canonical (per Tom — bay leaves, etc.). Affects 6 `recipe_ingredients` rows; cosmetic. [CP1.5 / 8D] | 🔧 | 🟢 | Polish. Defer indefinitely. |
| T22 | **✅ RESOLVED — 8D-CP2 (2026-05-19).** Matcher must skip `ingredient_subtype='always_available'` ingredients. Currently 2 rows (water, ice). Affects ~70 recipes — without this skip rule, recipes calling for water show "missing" for users who haven't stocked water. Bundle with T20. [CP1.5 / 8D] | 🔧 | 🟡 | Feature (post-F&F) — CRITICAL for matcher quality; bundle with T20. |
| T23 | **Coconut cream subtype review.** Currently `subtype='coconut_cream'` (standalone). Could group with the `cream` subtype for cross-family soft-match if user feedback shows demand. Pure data UPDATE if pursued. [CP1.5 / 8D] | 🔧 | 🟢 | Tech debt. Post-F&F. |
| T24 | **D8D-Q18 form-column backfill audit + remaining hygiene.** Extend the fresh-vs-spice principle to remaining ambiguous pairs; audit `form` values across all touched rows for consistency; consider renaming `nut_butter` → `seed_butter` / `nut_seed_butter` (more accurate — tahini is in the subtype); clean up the orphaned Python pipeline at `scripts/cp1_5_catalog_backfill/`. [CP1.5 / 8D] | 🔧 | 🟢 | Polish. |
| T25 | **Pantry form-value hygiene.** 10 singleton-subtype Pantry/Spices & Dried Herbs rows still have form=NULL: asafetida, cloves, fenugreek seeds, ginger spice, MSG, pink peppercorns, saffron, sichuan peppercorns, star anise, sumac. All matcher-inert (singleton subtypes, no L2/L3 risk). Cosmetic only. Set form='dried' on most; saffron may warrant form='threads' (new convention value) — judgment call when the row is touched. Post-F&F. [CP2-P0 / 8D] | 🔧 | 🟢 | Polish. |
| T26 | **Subtype-aware supply-fetch IN expansion (matcher perf).** CP2's `calculateRecipeSupplyMatchBulk` (Task 2.5) drops the `ingredient_id IN (...)` filter on the supply query and fetches all active supplies in the space, filtering in memory — required so same-subtype substitutes on separate bases surface. Fine at F&F scale (~200 supplies/space, single ~200-row round-trip). If post-F&F users carry 500+ supplies and the bulk matcher shows a hot path, swap to a subtype-aware `IN` clause. ~1-day refactor. [CP2 / 8D] | 🔧 | 🟢 | Performance contingency — post-F&F, no observed issue. |
| T30 | **Subtype audit + split (post-F&F substitution intelligence).** ~40 `ingredient_subtype`s are currently silent-demoted by the CP2-patch matcher whitelist (`SUBSTITUTABLE_SUBTYPES`). Priority split candidates: cheese (38 rows), leafy_green (21), fish (19), chile (12), tropical_fruit (10), citrus (10), dried_chile (10). Each split needs domain-thoughtful breakdown + smoke validation; adding to the whitelist post-split is a one-line edit. See `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md` G1 for the full backlog (G1-G6). Post-F&F project, ~2-3 sessions. [CP2-patch / 8D] | 🔧 | 🟢 | Feature (post-F&F). Numbered T30 per the authoring prompt (T27-T29 reserved by planning — gap intentional). |
| T27 | **Smoke harness contamination.** The discovery-based smoke harness creates synthetic recipes pointing at real catalog ingredients but the matcher queries Tom's real supplies. Scenarios needing controlled "user doesn't have X" or "user has only the synthetic supply X" states can't isolate when Tom stocks the real ingredient (salt/flour/rice). Fix options: (a) supply-state stubbing in harness, (b) targeted scenarios using intrinsically unstocked singleton-subtype ingredients (asafetida, sumac, etc.), (c) full test-isolation refactor with synthetic catalog rows (blocked by RLS). Post-F&F. [CP3-P0 / 8D] | 🔧 | 🟢 | Tech debt — test reliability. |
| T28 | **Catalog singular/plural and hyphen dedup.** Catalog has two near-identical mustard rows differing only by hyphen — `whole grain mustard` and `whole-grain mustard`, both subtype='mustard' form='paste'. Cosmetic cruft from inconsistent recipe extraction. Likely other variants exist (Fresno/fresno, jalapeño/jalapeno pepper, cheddar/cheddar cheese, eggs/egg, etc.). Bundle with G1 subtype audit when subtypes are split. Post-F&F. [CP3-P0 / 8D] | 🔧 | 🟢 | Catalog hygiene. |
| T29 | **✅ RESOLVED — 8D-CP3.1 (2026-05-26).** Null-form wildcard removed in 8D-CP3.1. The four scenarios (L2a, L3a, L3c, WL8) already had semantically-correct `form_variant`/`substitute` expectations in the harness — runtime now matches. SMOKE-CP2-tie likewise. Smoke harness no longer needs to work around the wildcard. The SMOKE-CATALOG-evoo-linkage drop is a separate cosmetic cleanup; left in place. (Original entry below for history.) **Smoke harness expectation cleanup post-CP2-patch.** Four scenarios have stale expectations: L2a (black pepper vs peppercorns), L3a (basmati/jasmine), L3c (chicken broth/stock), WL8 (pepper form-variant) all expect L2/L3 but now collapse to silent L1 because the null-form wildcard rule fires... Post-F&F polish. [CP3-P0 / 8D] | ✅ | 🟢 | Resolved by 8D-CP3.1. |
| T31 | **Refactor hero_ingredients to structured format.** `recipes.hero_ingredients` is `text[]` of plain name strings. CP4's "ready to cook" gate name-resolves heroes against the recipe's own catalog ingredients at filter time (`readyToCookService.resolveHeroToIngredientId` — case-insensitive name match against the `recipe_ingredients` join, fetched via the new `getRecipeIngredientNames` helper); a permanent `console.warn` on misses surfaces data-quality issues. Once miss-rate data accumulates, decide between (a) JSONB array of `{ingredient_id, name}`, (b) junction table `recipe_hero_ingredients`, or (c) augment with `hero_ingredient_ids: uuid[]`. Touches the AI tagging pipeline, RecipeListScreen filter, FilterDrawer hero chips, and the CP4 ready-to-cook logic. Post-F&F. [CP4-P0 / 8D] | 🔧 | 🟡 | Schema decision — driven by accumulated hero-resolution miss-rate data. |

---

## Process hygiene

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| PH-1 | PROCESS_WATCHPOINTS W1-W8 review pass | 🔧 | 🟢 | All eight watchpoints W1 through W8 are currently Observing; most predate the Phase 7P retrospective and have accumulated limited observations. A ~30-minute walk-through should decide each one's outcome per the new review-trigger outcome discipline rule (PROCESS_WATCHPOINTS §Review cadence, v1.4 2026-04-22): **graduate** (promote the mitigation to a DOC_MAINTENANCE_PROCESS rule), **close** (retire if the concern didn't materialize), or **explicitly extend** the observation window with a new review trigger. Not F&F-blocking; candidate for Phase 8 kickoff housekeeping or a cross-cutting session once Phase 8A is actively in progress. W9 + W10 (added same session) are too new for this pass — they have their own review triggers tied to Phase 8 completion / next diagnostic sub-phase. |

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-19 | 5.28 | **8E → Phase 11 merge (close-out reconciliation).** Phase 8E retired as a standalone sub-phase per Tom's 2026-05-19 close-out call. F&F-relevant CPs (8E-CP1 Browse rebuild, 8E-CP3 Locked filter chips pattern, 8E-CP4 Low stock indicators #31) merged into Phase 11 must-haves; 8E-CP2 Natural-language search stays post-launch. No standalone P# backlog items for 8E-CP1/CP3/CP4 to reclassify — that work is described directly in `FF_LAUNCH_MASTER_PLAN.md` Phase 11 + `PHASE_8_PANTRY_AND_GROCERY.md` 8E section (the latter now contains the merge note). P8-10's "Conversational search refinement" still correctly references 8E-CP2 as the post-launch natural-search baseline. |
| 2026-05-19 | 5.27 | **8D-CP4 Part 0 — T31 added, T29 expanded.** T31 (refactor `hero_ingredients` to a structured format — post-F&F schema decision driven by CP4's runtime name-resolution miss-rate data). T29 description expanded to fold in `SMOKE-CP2-tie` (basmati/jasmine pair — same null-form-wildcard staleness as L3a plus harness contamination). |
| 2026-05-19 | 5.26 | **8D-CP3 close — P6-10 resolved.** P6-10 (Ingredient tap-to-see-steps) marked ✅ RESOLVED by 8D-CP3's tap-sheet "Which step?" action. The CP3 prompt referred to this item as "D6-18"; no literal `D6-18` ID exists — P6-10 is the description match (flagged for Claude.ai reconciliation). CP3 Parts A-G shipped: `IngredientTapSheet.tsx` created, IngredientsSection rows tappable, match % banner (CP5 bundled) on RecipeDetailScreen, `MatchedIngredient.supplyStatus` added. |
| 2026-05-19 | 5.25 | **8D-CP3 Part 0 — T27-T29 added.** T27 (smoke harness contamination), T28 (catalog singular/plural + hyphen dedup), T29 (smoke harness expectation cleanup post-CP2-patch). Pre-flight doc items for CP3; CP3 Parts A-G (the tap-sheet build) deferred to a fresh CC session per context-budget judgment. |
| 2026-05-19 | 5.24 | **8D-CP2 patch — T30 added** (subtype audit + split, post-F&F substitution intelligence). The CP2-patch matcher whitelist silent-demotes ~40 coarse subtypes; T30 tracks the audit/split backlog. Full roadmap in `docs/SUBSTITUTION_INTELLIGENCE_ROADMAP.md` (new doc). Numbering jumps T26→T30 per the authoring prompt. |
| 2026-05-19 | 5.23 | **8D-CP2 close — T20 + T22 resolved.** T20 (4-level soft-match matcher) and T22 (`always_available` skip rule) marked ✅ RESOLVED by 8D-CP2 (`pantryMatchingService.ts` refactor). T25 (residual form-NULL hygiene) was added during CP2 Part 0; T26 added — subtype-aware supply-fetch IN expansion as a post-F&F matcher-perf contingency. |
| 2026-05-19 | 5.22 | **8D-CP1.5 close-out — T12-T24 added** to Cross-Cutting Technical Debt. CP1.5 (catalog variant linkage backfill) shipped 2026-05-19 via interactive SQL. T20 is the headline — build the 4-level soft-match matcher (8D-CP2); T22 (skip `always_available` ingredients) bundles with it. Remainder is catalog hygiene + polish, mostly post-F&F. |
| 2026-05-18 | 5.21 | **8D-CP1 retrospective tech debt.** Added T9 (repo schema-snapshot CSVs — schema-claim drift caught in the cheese migration `supply_has_identity` XOR mismatch), T10 (`missingCount` divergence on RecipeDetailScreen between matcher `missing[]` and the free-text-inclusive `missingIngredients` array), T11 (bulk match URL-length contingency at N≈475). All surfaced during 8D-CP1 verification + SESSION_LOG triage. |
| 2026-05-15 | 5.20 | **8R closeout reconciliation.** New section "From: Phase 8R — CP6e closeout (May 14-15, 2026)" with 5 new deferred items (P8R-D34 through D38) covering smoke-residual items: UnitPicker null-mode AddNeedSheet/EditNeedSheet adoption (D34, lot-entry scope shipped in CP6e-SmokeFix-SF1), 'pieces' hardcoded fallback (D35), legacy `supplyMatchesQuery` (D36), D8R-Q54-OVERRIDE wireframe-implementation divergence (D37), CP6e PK staleness (D38). **Resolutions applied:** P8R-D4 ✅ (tracks_lots shipped CP6e); P8R-D24 ✅ (CP6d-SmokeFix-1); P8R-D27 🟢 partial-resolved (UnitPicker null-mode shipped via SF-1; full adoption post-F&F); P8R-D28 ✅ (CP6d-SupplyDetail follow-up). **New cross-cutting tech debt:** T8 — 5 stale `pantry_items` query sites in `spaceService.ts` + `statsService.ts` discovered during 8D verification (silent dead reads from dropped table). |
| 2026-05-06 | 5.19 | **Phase 8R/CP6e deferred items added (P8R-D22, D23, D31, D32, D33).** Captures decisions deferred during 2026-05-05 → 2026-05-06 lot-tracking iteration. **Numbering note:** draft IDs D22-D26 collided with CP6d's already-shipped D24-D26; D22/D23 used as drafted, what would have been D24-D26 renumbered to D31-D33. P8R-D4 REOPENED 2026-05-06 by D8R-Q43 (tracks_lots opt-in flag). See PHASE_8R_UNIFIED_NEEDS.md v0.6 for full context. |
| 2026-04-30 | 5.18 | **8R-CP5a/b ship + smoke test deferred items added (P8R-D12 through P8R-D21).** 10 new items captured from CP5a/b implementation deviations + 2026-04-30 smoke test findings. Mix of UX polish (D12, D17), tech debt (D14, D15, D17, D18, D21), schema-level robustness (D16), monitoring (D19), and one F&F-prereq data fix (D20 catalog audit). |
| 2026-04-29 | 5.17 | **Phase 8R deferred items added (P8R-D1 through P8R-D11).** Captures decisions deferred during 8R planning (Q1-Q18) + wireframe iteration (Q19-Q27) + audit pass (Q28-Q34) + audit follow-up (Q35-Q37). P8-24 ✅ Resolved by 8C-Shared-CP2b. P8-25/26 marked LIKELY SUPERSEDED pending 8R-CP4 implementation. P8R-D6 RESOLVED by Q19/Q22; P8R-D7 RESOLVED as F&F-prereq per Tom; P8R-D8-D11 deferred. |
| 2026-04-27 | 5.14 | 8C-CP4a doc hygiene + 8C-Shared sub-phase scoping. P8-20 ✅ resolved (folded inline by 8C-CP4a; pill render now structural). P8-23 ✅ resolved-by-design (8C-CP4b-1 captures the cleanup logic; ships when CP4b ships post-8C-Shared). No new deferred items this pass — all chat-session decisions captured directly in PHASE_8 Decisions Log (D8C-CP4a-1..7, D8C-CP4b-1..4, D8C-Shared-1..8). 8C-Shared sub-phase added to PHASE_8 build plan as F&F-prerequisite parallel track within 8C scope. |
| 2026-04-27 | 5.13 | 8C-CP4 doc hygiene. P8-19 ✅ resolved (folded inline as 8C-CP4 Task 1 — `addIngredientsToDefaultList` now forwards `recipeId`/`recipeQuantityAmount`/`recipeQuantityUnit` to `addItemToList`; junction rows write on the recipe→default-list path). Three new items: P8-20 (CP3 pill render switch from substring-match to `source_staple_id IS NOT NULL`), P8-21 (cookDepletion undo path doesn't clean up routed grocery items — recoverable manually, rare in practice), P8-22 (state cycling missing on ManageStaplesScreen — F&F-prerequisite-candidate; users with >8 staples can't cycle bottom-N items from any UI). |
| 2026-04-27 | 5.12 | Added P8-19 (`addIngredientsToDefaultList` recipeId-pass-through gap surfaced during 8C-CP2a execution — service-internal caller doesn't forward its `recipeId` parameter to inner `addItemToList`; small inline fix for CP3 wiring). |
| 2026-04-27 | 5.11 | Added P8-18 (cross-list auto-dismissal opt-in design pending — captures Tom's bulk-vs-immediate purchase-intent reasoning that drove the 8C-CP2 spec redirect). |
| 2026-04-27 | 5.10 | P8-15 ✅ resolved by 8C-CP1b heuristic-SQL backfill (314 nulls + 2 capitalized anomalies). Added P8-17 (plant-based protein subclass UX — surfaced during CP1b's lumping decision). |
| 2026-04-28 | 5.16 | 8C-Shared-CP2 doc-hygiene. Three new deferred items: P8-24 (`GroceryListDetailScreen` add-to-list button is placeholder alert — F&F-blocker, suggested dedicated mini-CP), P8-25 (create-list modal keyboard dismiss-on-tap-outside missing — polish), P8-26 (create-list modal share toggle uses TouchableOpacity not Switch primitive — affordance polish). All three surfaced during CP2 end-to-end smoke test. No items resolved this pass. |
| 2026-04-28 | 5.15 | 8C-Shared-CP2 closure thread. P8-16 ✅ resolved (CreateGroceryListParams duplicate eliminated; `createGroceryList` resolves auth internally; 4 call sites updated; canonical `spaceId?` field renamed for camelCase consistency). No new deferred items this pass — D8C-Shared-CP2-3 (multi-space picker default = first-created accepted space) captured directly in PHASE_8 Decisions Log on next doc-hygiene pass. |
| 2026-04-27 | 5.9 | Added P8-15 (typical_store_section data coverage — 49.5% null per 8C-CP1 smoke-test data check) + P8-16 (CreateGroceryListParams shape unification — only `store_name` → `storeName` aligned in 8C-CP1a; larger refactor pending). |
| 2026-04-23 | 5.8 | Added P8-13 (cross-unit reconciliation) + P8-14 (soft-delete on zero-quantity depletion) — both surfaced during 8B-CP4 smoke test. Zero-quantity path currently falls through to `touch_only` to sidestep `pantry_items_quantity_display_check`; cross-unit path defaults to `touch_only` when recipe unit ≠ pantry unit. |
| 2026-04-23 | 5.7 | Added P8-12 (ManageStaples section headers, post-F&F polish). |
| 2026-04-23 | 5.6 | Phase 8 planning reconciliation. Added 11 post-F&F items surfaced during Phase 8 wireframe session + first audit (P8-1 through P8-11) and 2 tech debt items (P8-T1, P8-T2). Full accessibility audit deferred as P8-1; brand discovery UI scope consolidated as P8-2. New section `## From: Phase 8 — Pantry Intelligence Planning (April 23, 2026)` inserted above the Phase 7 section per reverse-chronological phase order. |
| 2026-04-22 | 5.5 | New row PH-1 tracking PROCESS_WATCHPOINTS W1-W8 review pass (per the new outcome-discipline rule added to PROCESS_WATCHPOINTS v1.4). Placed under new `## Process hygiene` subsection (no prior home for process-hygiene items existed). |
| 2026-04-22 | 5.4 | P7-45 marked resolved (D7P-2 threshold met via Phase 7P-2 pagination). PL-H1 priority 🟢 → 🟡. DQ-1 added tracking orphaned `parent_meal_id` (3 confirmed during 7P-2 Test A). |
| 2026-04-22 | 5.3 | PL-H1 added — highlightsService batched RPC / materialized view (post-launch, per D7P-8 from Phase 7P planning). |
| 2026-04-22 | 5.2 | **Post-v6 master plan reconciliation.** Tagged P7-44 and P7-45 as Phase 7P scheduled targets. Added new "Pre-launch deferrals (2026-04-22)" section with 4 items: Edit Mode full redesign, NYT Cooking (top-of-queue), Receipt scanning, Recipe comments KB. No priority re-tagging; no removals. |
| 2026-04-22 | 5.1 | Added T4 through T7: 4 cross-cutting cleanup items surfaced during PK_CODE_SNAPSHOTS v1.1 tier inventory (service relocation, deprecated-file deletion, legacy-theme audit, ts-nocheck resolution). |
| 2026-04-17 | 5.0 | **Phase 7 completion reconciliation.** Reconciled 42 deferred items from `PHASE_7_SOCIAL_FEED.md` into this doc. Resolved 20+ items (P5-4, P6-4, P6-5, S1, S2, P7-9, P7-15, P7-16, P7-29, P7-58, P7-60, P7-62, P7-64, P7-65, P7-66, P7-67, P7-85, P7-87, P7-88, P7-90, P7-97, P7-98, D3 partial, feed swipe). Added 17 infrastructure items, 13 detail polish items, 4 feed perf items, 30+ future sub-phase items from Phase 7. |
| 2026-04-09 | 4.3 | Phase 7F wireframe cross-references. |
| 2026-04-07 | 4.2 | Cross-cutting T3 added. |
| 2026-04-07 | 4.1 | Phase 7D scoping additions (R6-R9, S1/S2 update). |
| 2026-03-24 | 4.0 | Phase 5 + Phase 6 reconciliation. |
| 2026-03-17 | 3.0 | Phase 5A updates. |
| 2026-03-05 | 2.0 | Phase 4/I reconciliation. |
| 2026-03-02 | 1.0 | Doc overhaul. |