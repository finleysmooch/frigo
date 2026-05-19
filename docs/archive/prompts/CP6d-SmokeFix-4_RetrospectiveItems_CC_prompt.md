# CC PROMPT — CP6d Smoke Fixes Group 4: Smoke Retrospective Items

**Phase:** 8R-CP6d-SmokeFix-4 (post-CP6d series, smoke retrospective discoveries)
**Estimated cost:** M-L. ~400-600 lines net spread across 6-8 files.
**Prerequisite:** CP6d-SmokeFix-1 (Pantry visual + structural), CP6d-SmokeFix-2 (header + search), and CP6d-SmokeFix-3 (cross-cutting bugs) shipped and TS-clean.

---

## Notes from CP6d retrospective (read first)

Three things to internalize before executing:

**1. Schema field-name verification before writing code.** Always grep `Supabase_Snippet_Schema_Column_Details_with_PK_FK_Metadata.csv` to confirm column names. If a column doesn't exist, pick the closest existing field and flag in SESSION_LOG.

**2. The audit doc is in the repo.** `docs/8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md` is authoritative when prompts are ambiguous.

**3. Three prior smoke-fix CPs have shipped** (SmokeFix-1, -2, -3). Don't undo any of that work. Particular dependencies for this CP:
- SmokeFix-1's PantrySearchBar/SuppliesSection refactor (search query lifted to PantryScreen, single-source accordion state)
- SmokeFix-1's StaleItemsBanner exists with "Find recipes" buttons present (Toss button missing — Task 1 below)
- SmokeFix-1's bookmark icons + status icon system + cycle order (5→4→3→2→1→0→5)
- SmokeFix-2's home/profile icon header redesign (currently opens existing SpaceSwitcher modal as bottom-sheet — Task 4 below changes this)
- SmokeFix-3's V19 counter fix (Lists home count) — but the V19 reading was ambiguous; may need a parallel fix (Task 5 below)

---

## Context

Tom did a second-pass review of his smoke notes against the SmokeFix-1/2/3 prompts and surfaced six items not addressed in those prompts. This CP closes them out.

The six items split into two categories:

**Bugs / specification corrections (Tasks 1, 4, 5, 6):**
- Toss button missing on StaleItemsBanner
- Home-icon space switcher should anchor near the icon (inline dropdown), not bottom-sheet modal
- V19 counter ambiguity — investigate both Lists home count AND Regulars strip in ViewDetail
- DEFERRED_WORK row for user-customizable category placement

**New feature additions (Tasks 2, 3):**
- Lazy "shadow supply" search surface — catalog ingredients appear as searchable supplies even when no row exists, treated as unknown-status
- Unknown as a real status — supplies can be set to unknown via long-press modal and SupplyDetail (NOT via cycle-tap, per Tom's call)

---

## Inputs to read

1. `docs/8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md` — original CP6d decisions for context.
2. `components/pantry/StaleItemsBanner.tsx` — investigate Toss button (Task 1).
3. `screens/PantryScreen.tsx` — header (post-SmokeFix-2) needs anchor change (Task 4).
4. `components/SpaceSwitcher.tsx` — current bottom-sheet implementation; need inline-dropdown variant.
5. `components/pantry/PantrySearchBar.tsx` — extend to surface shadow supplies (Task 2).
6. `components/pantry/SuppliesSection.tsx` — display logic for shadow supplies and unknown-status supplies (Tasks 2 + 3).
7. `components/pantry/SupplyRow.tsx` — long-press modal needs Unknown option (Task 3).
8. `components/pantry/SupplyQuickEditModal.tsx` (new in SmokeFix-1) — add Unknown option to status picker (Task 3).
9. `screens/SupplyDetailScreen.tsx` — 4-segment status strip becomes 5-segment with Unknown (Task 3).
10. `screens/ViewsScreen.tsx` — Lists home count (Task 5).
11. `screens/ViewDetailScreen.tsx` — Regulars strip count (Task 5).
12. `lib/services/suppliesService.ts` — for any new helpers needed (Task 3).
13. `lib/types/supplies.ts` — `SupplyStatus` enum needs `'unknown'` added (Task 3).
14. `lib/services/searchService.ts` — for understanding existing search patterns; Task 2's shadow-supply search may extend this.
15. `Supabase_Snippet_Schema_Column_Details_with_PK_FK_Metadata.csv` — verify `supplies.status` CHECK constraint accepts `'unknown'` value, OR flag if constraint needs update.

Asset note: SmokeFix-1 specified `noun-progress-bar-3318919.svg` as the "unknown" icon. Confirm it's already in `assets/svg-source/`. If missing, use a placeholder grey circle and flag in SESSION_LOG.

---

## Tasks

### Task 1 — Investigate + fix Toss button on StaleItemsBanner (P39 bug)

Tom's smoke note: *"I don't see a toss button."*

The CP6d-Pantry SESSION_LOG claimed the StaleItemsBanner shipped with both "Find recipes" and "Toss" buttons per stale-item row. Tom reports Toss isn't visible.

**Investigation steps:**

1. Open `components/pantry/StaleItemsBanner.tsx`. Look at the per-item render block.
2. Determine which case applies:
   - **(a)** Toss button JSX never rendered (was scoped out late in the build).
   - **(b)** Toss button is rendered but hidden behind another element / clipped / styled invisibly.
   - **(c)** Toss button is rendered conditionally on a flag that's never true.
3. If (a): add the Toss button matching the layout intent. Per row: small "Toss" button next to or below "Find recipes." On tap → calls `setSupplyStatus(supplyId, 'out')` (which auto-archives via the track_only path from CP6d-Schema). Optimistic local removal of the item from the banner.
4. If (b) or (c): fix the rendering / visibility issue.

Style notes: per SmokeFix-1's teal color palette, the Toss button can use a subtle destructive-style (red or red-orange) to distinguish from "Find recipes" (neutral). Keep both buttons compact.

After fix: when the user taps Toss on the last visible stale item, the banner should hide (existing CP6d-Pantry behavior — verify it still works post-fix).

### Task 2 — Lazy "shadow supply" search surface

Per Tom's smoke note (P5): *"possibly default with every item in everyone's pantry, but as unknown? And hide unknowns from view and from the counts? It's currently a lot of buttons to have to click through to add an item."*

Implement the **lazy version** (per Tom's confirmation): shadow supplies are NOT created in the supplies table. They're surfaced at the search-display layer only. Real supply rows exist only after the user explicitly promotes one (taps to add, or sets a status).

**Implementation:**

In the search-filter pipeline that runs in `SuppliesSection.tsx` (filters supplies by `searchQuery` from PantrySearchBar):

1. Get the existing real-supply matches per the existing logic (filter by name, plural_name, family, ingredient_type — per SmokeFix-2 Task 3).
2. ALSO query the `ingredients` catalog table for matches on the same query: `name ILIKE %query%` OR `plural_name ILIKE %query%`. Limit to ~20 results to keep the surface manageable.
3. Filter out catalog matches that ALREADY have a real supply in the current space (so the same ingredient doesn't appear twice — once as real supply, once as shadow).
4. Render the catalog-only matches as **shadow supply rows** in the search results. Visually identical to a real supply row at status='unknown' (grey unknown icon, no bookmark icons, normal layout).
5. Shadow rows have a special tap behavior: tap → opens SupplyCreateSheet pre-populated with that ingredient (T2 hit). The user then picks initial status (in_stock / low / out per Q35) and confirms, creating a real supply row.

**Display rules:**

- Shadow supplies appear **only when search query is active**. They do NOT appear in the normal Pantry view (unfiltered).
- Shadow supplies do NOT count toward any section's count (e.g., not added to Attention, Regulars, On Hand counts).
- Real supplies with `status='unknown'` (Task 3 below) ALSO do not count toward sections — they're hidden from Attention/Regulars/On Hand entirely. Only visible during search.
- Both shadow and real-unknown supplies appear in a new section: **"Not tracked yet" (count)** — only renders during search. Sub-headers: "Could add" (shadow supplies) and "Unknown status" (real supplies at status='unknown').

If grouping the two under one section is too complex, simpler fallback: just render them under a single "Found in catalog" or "Suggestions" section during search. Flag the choice in SESSION_LOG.

**Service-layer change:**

Add to `lib/services/searchService.ts` (or wherever catalog search lives):

```ts
export async function searchCatalogIngredients(
  query: string,
  spaceId: string,
  limit: number = 20
): Promise<Ingredient[]> {
  // Query ingredients matching query; exclude those already real supplies in spaceId
  // SQL: SELECT i.* FROM ingredients i
  //      WHERE (i.name ILIKE $query OR i.plural_name ILIKE $query)
  //        AND i.id NOT IN (SELECT ingredient_id FROM supplies 
  //                         WHERE space_id = $spaceId AND ingredient_id IS NOT NULL)
  //      LIMIT $limit
}
```

Wire from SuppliesSection's filter pipeline when `searchQuery.length >= 2`.

**Performance:** the NOT-IN subquery runs once per search debounce. At F&F scale (catalog ~500 ingredients, supplies ~50 per space) this is fine. Optimize post-F&F if needed.

### Task 3 — Unknown as a real status

Per Tom's call: unknown is a real `SupplyStatus` enum value. Reachable via long-press modal and SupplyDetail (NOT via cycle-tap — keeps cycle 5→4→3→2→1→0→5 tight, accidental cycling-into-unknown is bad).

**Schema:**

The `supplies.status` CHECK constraint currently allows `'in_stock', 'low', 'critical', 'out'`. Need to add `'unknown'`.

**SQL migration (Tom runs separately):**

```sql
-- Drop and recreate the CHECK constraint with 'unknown' added
ALTER TABLE supplies DROP CONSTRAINT IF EXISTS supplies_status_check;
ALTER TABLE supplies ADD CONSTRAINT supplies_status_check
  CHECK (status IN ('in_stock', 'low', 'critical', 'out', 'unknown'));
```

CC: do NOT run this migration. Generate the SQL file at `_pk_sync/cp6d_smokefix4_unknown_status_migration.sql` for Tom to run in Supabase. Validation queries included.

**TypeScript:**

In `lib/types/supplies.ts`, extend `SupplyStatus`:

```ts
export type SupplyStatus = 'in_stock' | 'low' | 'critical' | 'out' | 'unknown';
```

`SupplyWithTags` and `Supply` types automatically pick up the extended union.

**Service-layer:**

`setSupplyStatus(supplyId, 'unknown')` should:
- Update status to 'unknown'
- Patch usage_level to a sentinel (e.g., -1, OR keep current usage_level — your call). My lean: keep current usage_level unchanged. Unknown is an orthogonal state; the level memory stays for when user re-promotes.
- NOT trigger any spawn logic. Unknown is "I don't know if I have this" — neither out nor in_stock.
- NOT trigger archived_at logic. Unknown is reachable for both restock and track_only supplies; doesn't auto-archive.

Update `setSupplyStatus`'s switch/conditional branches in `suppliesService.ts` to handle the new status:
- Spawn-on-out: still gates on `tracking_mode === 'restock'` AND `newStatus === 'out'`. Unknown is NOT 'out'; no spawn.
- Auto-archive: still gates on `tracking_mode === 'track_only'` AND `newStatus === 'out'`. Unknown is NOT 'out'; no archive.
- Priority-spawn-on-low: still gates on `is_priority` AND `newStatus === 'low'`. Unknown is NOT 'low'; no spawn.
- Archived_at clearing on in_stock transition (P8R-D28 fix): only on `newStatus === 'in_stock'`. Unknown stays archived if was archived (edge case; flag if odd).

**Display:**

`StatusIcon` component (extended in SmokeFix-1):
- Add a new visual case: when `status === 'unknown'`, render the unknown icon (`noun-progress-bar-3318919.svg`) in light grey. Confirmed by Tom.
- The icon ID Tom verbally referenced (`noun-progress-bar-circles-3318901-100`) is actually the FULL/5-out-of-5 icon used for in_stock max — that's a typo, NOT the unknown icon. Use `noun-progress-bar-3318919.svg` per the original CP6d-Pantry asset spec. Flag this in SESSION_LOG so Tom can correct if needed.

`SupplyRow.tsx`:
- When supply.status === 'unknown', render the unknown icon and "Status: Unknown" label.
- Bookmark icons (regular/priority): still render based on `tracking_mode` and `is_priority` (unchanged from SmokeFix-1).
- Cycle-tap on the icon: per Tom's call, unknown is NOT in the cycle. If user taps the status icon while supply is at unknown, cycle to in_stock (level 5) — this returns the supply to a "tracked" state.

`SuppliesSection.tsx`:
- Real supplies at `status='unknown'` are HIDDEN from Attention/Regulars/On Hand sections (don't count, don't render in those sections).
- Visible only in the "Not tracked yet" section during search (per Task 2 display rules).

**Long-press modal (`SupplyQuickEditModal.tsx` from SmokeFix-1):**
- Status picker (currently 4 options: in_stock/low/critical/out) becomes 5 options: + Unknown.
- Visual: 5 circles in a row, current status highlighted. Tap any → calls setSupplyStatus.

**SupplyDetailScreen status strip:**
- 4-segment strip becomes 5-segment: in_stock / low / critical / out / unknown.
- Tap-to-set behavior unchanged. Unknown is just one more option in the strip.
- The 5-circle visual below the strip: when supply is at unknown, show the unknown icon. When supply is at any other status, show the corresponding usage_level circle as before.

**Inline-expand row (SmokeFix-1 Task 6):**
- The 6-position slider (0-5) does NOT include unknown. Unknown is reachable only via:
  - Long-press → SupplyQuickEditModal
  - Tap "Open detail ›" → SupplyDetail status strip
- This is intentional per Tom — keep the inline cycle/slider tight. Unknown is an explicit act, not a casual tap.

### Task 4 — Home-icon space switcher: anchored inline dropdown

Per Tom's smoke note (P3) and clarified in chat: the home-icon tap should open the space switcher as an **inline dropdown anchored near the home icon**, NOT as a bottom-sheet modal.

Currently SmokeFix-2 routed home-icon tap to the existing `SpaceSwitcher` component which renders as bottom-sheet. Replace this with a new inline-dropdown variant.

**Implementation:**

NEW component or new prop on SpaceSwitcher: `components/SpaceSwitcherInline.tsx` (or extend SpaceSwitcher with `variant?: 'bottom-sheet' | 'inline-dropdown'`).

Behavior of inline-dropdown variant:
- Renders below the home icon (anchored to it) as a dropdown panel — small, ~200px wide, shows space list
- Each space shows: emoji + name + checkmark if current
- Tap a space → switches space (existing SpaceContext logic), closes dropdown
- Tap outside the dropdown → closes
- Z-index above the rest of the header but below any other modals

The existing `SpaceSwitcher` (bottom-sheet) stays in place for any other consumers. The home-icon tap in PantryScreen specifically uses the inline-dropdown variant.

**PantryScreen integration:**

State: `homeDropdownOpen: boolean`. Tap home icon → `setHomeDropdownOpen(true)`. Render `<SpaceSwitcherInline visible={homeDropdownOpen} onClose={() => setHomeDropdownOpen(false)} anchorRef={homeIconRef} />` (or similar pattern for anchoring).

If implementing the anchor positioning is non-trivial (React Native Animated + measure layout), simplest fallback: render the dropdown as a fixed-position panel ~50pt below the header on the right side (where the home icon is), without true measure-based anchoring. The visual effect is "popup near the icon, not bottom-sheet" which is what Tom wants.

**Profile icon stays as SmokeFix-2 specified:** navigates to SpaceSettingsScreen, no change.

### Task 5 — V19 counter — investigate both interpretations

Tom's smoke note: *"The regulars counter on tonight doesn't seem to be counting correctly — it says 0 for everything. Counter does seem to be working for all needs, though. Why is counter for this week and tonight not working?"*

The phrase "regulars counter on tonight" is ambiguous:

- **(i) Lists home count.** ViewsScreen.tsx renders view cards with count badges. SmokeFix-3 Task 1 investigated this interpretation.
- **(ii) Regulars strip in ViewDetail.** ViewDetailScreen has a "Regulars" strip near the top showing supply-level counts (`X out · Y low · Z in stock`). This is a different code path entirely.

SmokeFix-3 may have fixed (i). This CP investigates and fixes (ii) if it's also broken.

**Investigation steps:**

1. Open Tonight view. Observe the Regulars strip. Compare to All Needs view's Regulars strip.
2. The Regulars strip computes counts of **supplies that match the view's filter context** (e.g., Tonight = supplies tagged with urgency=today). Find the count-computing function in ViewDetailScreen or a service (likely `getMatchingSuppliesForView` or similar).
3. If the strip shows 0 for Tonight but correct counts for All Needs, the bug is in the matching function's filter logic.
4. Common root causes:
   - Filter applies to ALL supplies in the space (no urgency-tag filter for Tonight) → over-counts. Not Tom's symptom.
   - Filter requires supplies to have urgency tags but supplies don't have urgency tags by default → under-counts to 0. Likely match.
   - Filter logic has a bug for default views vs custom views. Possible.
5. Trace the code path. Fix the root cause.

**Likely fix shape:** the Regulars strip's matching predicate may be checking for direct urgency-tag matches on supplies, but supplies typically don't have urgency tags (urgency is a need-level concept, not a supply-level one). The fix is likely: for default urgency-filtered views like Tonight/This Week, the Regulars strip should show ALL supplies in the space (not filtered by urgency), since urgency-tag matching at the supply level is meaningless.

Confirm hypothesis during investigation. Report root cause in SESSION_LOG.

If SmokeFix-3 already fixed both (i) and (ii) — great, no work needed for Task 5. Verify and document in SESSION_LOG.

### Task 6 — DEFERRED_WORK row for custom category placement

Per Tom's smoke note (P14): *"Would be great if you could customize where the item should be located. Fine in other for now."*

Add a DEFERRED_WORK row:

```
**P8R-D29 — User-customizable category placement for custom-name supplies (post-F&F).**
Currently custom-name supplies (no ingredient_id, hence no `ingredient.family`) automatically appear under the "Other" sub-category in Pantry's Regulars and On Hand sections. Users may want to manually assign these to a specific category (e.g., "I added a custom 'Maple syrup' supply, want it under Pantry items not Other"). Possible implementation: add a `custom_category` text field on supplies; pantry section logic uses `custom_category` ?? `ingredient.family` ?? 'Other'. Schema add + UI in SupplyDetail. Defer to post-F&F until tester demand.
```

That's it. No code changes for Task 6, just a doc update.

---

## Constraints

- **DO NOT** undo any SmokeFix-1, -2, or -3 work. Test for regressions.
- **DO NOT** modify ViewDetail's NeedRow / cart-as-section / merged-row interaction (out of scope).
- **DO NOT** modify Recipe surface (out of scope).
- **DO NOT** modify the CP6d-Schema service-layer logic for spawn-on-out, archived_at, or priority spawn — those gates already correctly handle 'unknown' as a non-trigger status.
- **DO NOT** auto-create real supply rows from shadow supplies during search. Shadow supplies are display-only; real rows only created on user-explicit promote action.
- **DO NOT** trigger any spawn / archive / restock side-effects when supply transitions to unknown.
- **DO** preserve all existing exports.
- **DO** ensure unknown-status supplies (real rows) are HIDDEN from Attention/Regulars/On Hand sections — visible only during search in the "Not tracked yet" section.
- **DO** generate a SQL migration file (don't run it) for the status CHECK constraint update.

---

## Verification

1. **Toss button visible.** Open StaleItemsBanner with stale items. Each item shows both "Find recipes" and "Toss" buttons.
2. **Toss button works.** Tap Toss on a stale item → supply transitions to out (auto-archives via track_only path), item removed from banner. Banner hides if it was the last item.
3. **Shadow supply search.** Type "kale" (assuming kale is in catalog but you don't have a kale supply) → kale appears under "Not tracked yet" with grey unknown icon. Tap → SupplyCreateSheet opens pre-populated with kale.
4. **Shadow supply hidden when no search.** Empty search bar → no shadow supplies render. Pantry shows only real supplies.
5. **Real unknown-status supply.** Long-press a supply → modal status picker shows 5 options including Unknown. Pick Unknown → supply moves out of its current section, only visible via search.
6. **Unknown via SupplyDetail.** Open SupplyDetail → status strip shows 5 segments. Tap "Unknown" → supply transitions to unknown.
7. **Cycle does NOT include unknown.** From in_stock (level 5), cycle-tap → 4 → 3 → 2 → 1 → 0 → 5. Never lands on unknown.
8. **Unknown to in_stock via cycle.** From unknown status, tap status icon → supply transitions to in_stock at level 5.
9. **No spawn on unknown.** Set a restock+priority supply to unknown via long-press → no need spawned.
10. **No archive on unknown.** Set a track_only supply to unknown → archived_at stays null.
11. **Home-icon dropdown.** Tap home icon → space-list dropdown appears anchored near the icon (top of screen), NOT as a bottom-sheet at the bottom. Pick a space → switches space, dropdown closes.
12. **Home-icon dropdown dismiss.** Tap outside the dropdown → dropdown closes.
13. **Profile icon unchanged.** Tap profile icon → still navigates to SpaceSettingsScreen (SmokeFix-2 behavior preserved).
14. **V19 Regulars strip (if broken).** On Tonight view, Regulars strip shows non-zero counts that match the actual supply distribution. Same behavior across Tonight, This Week, and All Needs views.
15. **DEFERRED_WORK row added.** Verify P8R-D29 row exists in `DEFERRED_WORK.md`.
16. **SQL migration file staged.** `_pk_sync/cp6d_smokefix4_unknown_status_migration.sql` exists with ALTER + validation queries.

---

## SESSION_LOG entry format

Standard template. Per-file lines, deviations, schema-gaps surfaced, open questions.

Particular notes for Tom:
- Toss button root cause (a/b/c from Task 1)
- Shadow-supply section naming (single section vs split sub-headers)
- V19 Regulars strip: was it broken (and now fixed) or already working post-SmokeFix-3?
- Confirmation that SQL migration was generated (not run by CC)
- Confirmation of icon file used for unknown (`noun-progress-bar-3318919.svg` per original spec, NOT the typo'd `circles-3318901-100`)

Stage to `_pk_sync/SESSION_LOG_2026-05-04_CP6d-SmokeFix-4.md`.

After this CP ships, the smoke-fix series is complete. Next: full re-smoke pass focused on SmokeFix-1/2/3/4 changes, then Workstream A (catalog audit) and Workstream B (8D matching upgrade).
