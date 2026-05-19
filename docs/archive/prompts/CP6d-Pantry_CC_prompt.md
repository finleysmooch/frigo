# CC PROMPT — Phase 8R-CP6d-Pantry

**Phase:** 8R-CP6d-Pantry (Pantry-side UX overhaul)
**Estimated cost:** L. ~800-1100 lines net.
**Prerequisite:** CP6d-Schema (service layer) shipped. Tom has confirmed `tracking_mode`, `storage_location`, `archived_at`, `is_priority`, `usage_level` columns are populated and supplies/needs services consume them correctly.

---

## Context

Per the audit doc (`8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md`, section "CP6d-Pantry"), this CP overhauls the Pantry surface from the current flat Attention + In-stock list to a three-section split (Attention / Regulars / On Hand) with category sub-sections, multi-purpose search bar, dual-listing pattern, accordion behavior, new 5-circle status icon system, tap-row-expand-inline interaction, and a stale-items banner.

This CP can ship in parallel with CP6d-ViewDetail once Schema is in. Both depend on Schema; neither depends on each other.

---

## Inputs to read

1. `docs/8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md` — sections "Decisions Locked", "CP6d-Pantry", and the gap rows P1, P2, P3, NEED-2 through NEED-9.
2. `screens/PantryScreen.tsx` — current shell. Header section is what's getting redesigned.
3. `components/pantry/SuppliesSection.tsx` — main component being restructured.
4. `components/pantry/SupplyRow.tsx` — row interaction model changing.
5. `lib/services/suppliesService.ts` — for `getSuppliesForSpace` shape (post-CP6d-Schema includes new fields).
6. `lib/types/supplies.ts` — Supply/SupplyWithTags now has tracking_mode, storage_location, is_priority, usage_level.
7. `components/SupplyCreateSheet.tsx` — wire from search bar's "+ Add" path; do NOT modify the sheet itself.
8. `contexts/SpaceContext.tsx` and `components/SpaceSwitcher.tsx` — for header-right space switcher placement.

Asset prerequisite: Tom has added these icon files to the repo at `assets/icons/` (or `public/icons/`, check existing pattern):
- `noun-progress-bar-3318901-100.svg` (5/5 full)
- `noun-progress-bar-3318928-80.svg`
- `noun-progress-bar-3318907-60.svg`
- `noun-progress-bar-3318903-40.svg`
- `noun-progress-bar-3318905-20.svg`
- `noun-progress-bar-3318896-0.svg`
- `noun-progress-bar-3318919-unknown.svg`
- `noun-home-2-outline-6460302.svg`
- `noun-profile-1-filled-8147335.svg`

If any of these are missing, list them in SESSION_LOG and stub with placeholder symbols rather than blocking the build.

---

## Tasks

### Task 1 — Header redesign on PantryScreen.tsx

Current header uses emoji + space switcher inline. Replace with:

```
[ My Pantry                    {home-icon}{profile-icon} ]
[ Search/Add bar (full width) ]
[ PendingSpaceInvitations ]
[ ScrollView of SuppliesSection ]
```

- Title "My Pantry" top-left, large bold (use `typography.sizes.xxl` or equivalent)
- Top-right: small icon group — home-icon shows current space label as muted text on tap (or just a tooltip), profile-icon opens space switcher modal. Use the SpaceSwitcher component but render it visually subtle (no big card, just the current-space label inline next to the icon).
- Search bar moves OUT of the SuppliesSection up into the screen header level — see Task 2.
- Remove emoji icons. Replace with imported SVG components.

### Task 2 — Multi-purpose search/add bar (Gap-P1)

NEW component: `components/pantry/PantrySearchBar.tsx` (~100 lines).

Behavior:
- TextInput with placeholder "Search or add..."
- As user types, filter the visible supplies list in SuppliesSection (pass the query as prop down)
- If no exact match exists in supplies AND query length ≥ 2: show inline "+ Add '{query}' as supply" affordance directly under the input. Tap → opens SupplyCreateSheet pre-populated with the query as the supply name (T2 catalog match preferred, T3 custom-name fallback).
- Clear button (×) when query non-empty
- Submit-on-return: opens SupplyCreateSheet with query

This bar is the single entry point for both filter and add. Long-form configure (tags, brands, etc.) still happens in SupplyCreateSheet.

### Task 3 — New `StatusIcon` component

NEW component: `components/pantry/StatusIcon.tsx` (~60 lines).

Renders a single circle-progression icon from the 5-icon set. Props:
- `usageLevel: 0 | 1 | 2 | 3 | 4 | 5` (maps to specific SVG)
- `status: SupplyStatus | 'unknown'` (drives color)
- `size?: number` (default 24)
- `unknown?: boolean` (renders the unknown-state icon regardless of usageLevel)

Color mapping (from theme tokens — add if not present):
- in_stock → green (`functionalColors.success` or define)
- low → yellow (`functionalColors.warning` or define)
- critical → orange/amber (define new token if needed)
- out → red (`functionalColors.error` or define)
- unknown → grey (`colors.text.tertiary`)

Icon mapping:
| usage_level | SVG file |
|---|---|
| 5 | noun-progress-bar-3318901-100.svg |
| 4 | noun-progress-bar-3318928-80.svg |
| 3 | noun-progress-bar-3318907-60.svg |
| 2 | noun-progress-bar-3318903-40.svg |
| 1 | noun-progress-bar-3318905-20.svg |
| 0 | noun-progress-bar-3318896-0.svg |

Implement via `react-native-svg` SVG imports. Follow the existing icon-component pattern from `components/icons/` (look at `BookIcon`, `AgainIcon`, etc.).

### Task 4 — SupplyRow refactor (Gap-NEED-9)

Replace long-press → ActionSheet with tap-row-expand-inline.

Current behavior: tap status dot = cycle, long-press row = ActionSheet.

New behavior:
- **Tap status icon area:** cycle through visible status states. Cycle order: 5 → 3 → 2 → 1 → 0 → 5 (skips 4). Updates both `usage_level` (via setSupplyStatus implicitly) and visual.
- **Tap supply name area:** expand row inline. Expanded view shows:
  - Name + current status label
  - 5-segment slider/buttons (one per usage_level, 0-5) for jump-set. Tapping a segment calls setSupplyStatus to that level (level 4 reachable only via slider — never via the cycle-tap).
  - "Open detail ›" link/button → navigates to SupplyDetailScreen (route: `SupplyDetail` with `supplyId` param). Until CP6d-SupplyDetail ships, route may not exist — handle with try/catch and fallback Alert "Detail screen coming soon."
  - Star toggle (is_priority) — small star icon, tap to toggle. Calls a service helper `setSupplyPriority(supplyId, isPriority)` — add this to suppliesService if not present (tiny, ~10 lines).
- **REMOVE long-press handler entirely.** Per audit OPEN-3 reframe: tap-row-expand replaces it; long-press becomes redundant.

When collapsed, row shows: status icon (left) + supply name (center, with priority star if true) + brand summary if any (right, muted).

When expanded, row content height grows; other rows in the section don't re-render.

Pluralization (Gap-NEED-7):
- Display name: `qty > 1 && ingredient.plural_name ? plural_name : ingredient.name`
- Note: supplies don't have a quantity, so this is moot for SupplyRow — but the SAME logic needs to apply on need rows in ViewDetail (handled in CP6d-ViewDetail). Mention it here just so you know the catalog `plural_name` field is the canonical source.

### Task 5 — SuppliesSection restructure (Gaps-P2, P3, NEED-3, NEED-4, NEED-6, NEED-8)

Major rewrite. Section structure:

```
[ PantrySearchBar ] (Task 2 — actually rendered in PantryScreen, search query passed down via prop)

[ StaleItemsBanner ] (Task 7 — rendered above Attention if stale items exist)

[ Attention (count) ▾ ]   ← collapsible, default OPEN if non-empty, hidden if empty
   [ Out (n) ]                ← sub-section label
     supply rows (status=out)
   [ Low (n) ]                ← sub-section label  
     supply rows (status=critical or low)
   [ ----- divider ----- ]
   [ Note: items here are ALSO in their original sub-category below ]

[ Regulars (count) ▾ ]    ← collapsible, default OPEN
   [ Spices (n) ▸ ]            ← category sub-section, default COLLAPSED except largest
     supply rows when expanded
   [ Dairy (n) ▸ ]
     supply rows when expanded
   [ Pantry items (n) ▸ ]
     ...
   ...

[ On Hand (count) ▾ ]    ← collapsible, default COLLAPSED
   [ Produce (n) ▸ ]
     supply rows when expanded
   ...
```

Section logic:
- **Attention:** all supplies with status IN ('out', 'critical', 'low'), regardless of tracking_mode. Sub-divided into Out (status='out') and Low (status='critical' OR 'low').
- **Regulars:** supplies with `tracking_mode='restock' AND archived_at IS NULL` and status='in_stock'. Sub-grouped by `ingredient.category` (or "Other" for custom_name supplies).
- **On Hand:** supplies with `tracking_mode='track_only' AND archived_at IS NULL` and status='in_stock'. Sub-grouped same way.

Filter pipeline (when search query active): filter source supplies array to those matching query (`displayName.includes(query.toLowerCase())`), THEN apply section-classification. Empty sections hide.

**Dual-listing (Gap-NEED-6):** items in Attention's Out/Low sub-sections are ALSO rendered in their original Regulars/On Hand sub-category. The same `supply` object renders in both places. Both rows are FULLY interactive (cycling status from either updates the underlying supply, both rows reflect the new state on next render). Implement by NOT excluding attention items from the regulars/on-hand sections — let them appear twice.

**Accordion behavior (Gap-NEED-8):** at most one sub-category open at a time WITHIN Regulars and On Hand. (Top-level Attention/Regulars/On Hand sections collapse independently — one of THOSE can be open without forcing others closed.) When a sub-category opens, close the previously-open one.

Per Tom's note in the audit: when an Attention item moves to a sub-category section that's currently collapsed, the count badge on the collapsed section should briefly highlight (subtle animation — `Animated.View` with opacity flash or scale bounce, ~400ms). Don't auto-open the section. Implementation can be as simple as `useEffect` watching the section's count and triggering the animation when it increases.

Per-section state management — likely cleanest with a small reducer or context, but plain `useState` arrays of expanded section IDs is fine at F&F scale.

### Task 6 — Pluralization at display

This task spans the codebase but lives in this CP for the Pantry side. Add a tiny helper:

NEW: `lib/utils/pluralize.ts` (~15 lines)
```ts
export function pluralize(singular: string, plural: string | null | undefined, qty: number): string {
  if (qty > 1 && plural) return plural;
  return singular;
}
```

Used by SupplyRow (Task 4) and by NeedRow (CP6d-ViewDetail). For supplies without quantities, just always show singular — call with qty=1.

### Task 7 — Stale items banner (Gap-NEED-5)

NEW component: `components/pantry/StaleItemsBanner.tsx` (~150 lines).

Shows above the Attention section when any `track_only` supplies haven't been touched in >14 days.

Detection logic — add helper to suppliesService:
```ts
export async function getStaleTrackOnlySupplies(spaceId: string): Promise<SupplyWithTags[]> {
  // Query supplies where tracking_mode='track_only' AND archived_at IS NULL
  // AND last_confirmed_at < NOW() - INTERVAL '14 days'
  // (last_confirmed_at should already exist on supplies — check; if not, use updated_at)
}
```

Banner format:
```
🍂 N items haven't been used in a while  ▾
```

Tap → expands inline (NOT a separate screen). Expanded shows list of stale items, each with:
- Name + days-since-touched
- Two quick-action buttons:
  - "Find recipes" → navigates to RecipeListScreen with `initialIngredient: name` param. **NOTE:** this param is added to RecipeList in CP6d-SupplyDetail. Until then, fallback to navigating to RecipeList with no filter (graceful degradation).
  - "Toss" → cycles supply to `out` (auto-archives via setSupplyStatus + tracking_mode logic from CP6d-Schema). Removes from list optimistically.

When all stale items are tossed/dismissed, banner hides. Banner state (expanded/collapsed) does NOT need to persist — collapsed by default each render.

### Task 8 — Wire it all up in PantryScreen.tsx

PantryScreen becomes:
```
<View>
  <Header /> (Task 1)
  <PantrySearchBar /> (Task 2 — receives setSearchQuery)
  <PendingSpaceInvitations />
  <ScrollView refreshControl=...>
    <StaleItemsBanner spaceId={...} /> (Task 7)
    <SuppliesSection
      spaceId={...}
      searchQuery={searchQuery}
      onSupplyNameTap={handleSupplyNameTap}
    />
  </ScrollView>
  <SupplyCreateSheet ... /> (existing)
</View>
```

`handleSupplyNameTap` previously navigated to ManageSupplies. Now it should navigate to `SupplyDetail` route (created in CP6d-SupplyDetail). For now, until that route exists, it's the tap-row-expand-inline that handles primary interaction; the "Open detail ›" link in the expanded row is what navigates externally. PantryScreen-level handler can be a no-op or fallback Alert.

---

## Constraints

- **DO NOT** modify suppliesService logic that touches spawn-on-out, tracking_mode gating, or createNeed (CP6d-Schema territory). Add the small `setSupplyPriority` helper and `getStaleTrackOnlySupplies` helper only.
- **DO NOT** change SupplyCreateSheet. The T1 inversion wire-up is CP6d-SupplyDetail.
- **DO NOT** change ViewDetailScreen, AddNeedSheet, EditNeedSheet, ExpandedRegularsSheet, RecipeDetailScreen — those are other CPs.
- **DO NOT** delete ManageSuppliesScreen yet — that's CP6d-SupplyDetail.
- **DO NOT** break the cookDepletionService integration. The depletion banner should still appear after a cook flow.
- **DO** preserve the SpawnOnOutToast wiring in SuppliesSection's `handleCycleComplete` — toast continues to fire on out transitions for restock-mode supplies.
- **DO** ensure dual-listing rows visually look identical to single-listing rows (no special "duplicate" badge or styling). The behavior is just "this supply happens to surface in two places."
- **PRESERVE all existing exports.** Other modules may still import these.

---

## Verification

1. **Header renders correctly.** "My Pantry" top-left, icons top-right. Tap home-icon shows space label; tap profile-icon opens space switcher.
2. **Search bar filters.** Type "olive" — only olive-related supplies remain visible across all sections. Empty sections hide.
3. **Add via search bar.** Type "newitem" with no match → "+ Add 'newitem'" appears → tapping opens SupplyCreateSheet pre-populated.
4. **Three-section split.** Attention / Regulars / On Hand all render with correct counts. A track_only supply (e.g., the eggs/cucumber/strawberry from your test data) appears under On Hand. A restock supply appears under Regulars.
5. **Sub-categories within Regulars and On Hand.** Categories from `ingredient.category` show as sub-headers. Counts are correct.
6. **Accordion within sections.** Expanding "Spices" closes "Dairy" if Dairy was open. Top-level Attention can stay open while Regulars expanded.
7. **Dual-listing.** Cycle a supply (currently in Regulars > Spices, status in_stock) to status=low. It now appears in BOTH Attention > Low AND Spices sub-section. Cycling either row updates the other.
8. **Status icon + cycle order.** Tap the status icon on an in_stock supply → goes to usage_level=3 (60% icon). Tap again → 2 (40%, status flips to low). Tap again → 1 (20%, critical). Tap again → 0 (0%, out). Tap once more → 5 (100%, in_stock).
9. **Tap supply name → expands.** Slider lets you jump to any usage_level (including 4, which cycle skips). Star toggle changes is_priority.
10. **Long-press does nothing.** Confirm long-press handler removed; no ActionSheet appears.
11. **Stale banner.** With test data including 1 track_only item from before today, banner shows "1 item hasn't been used in a while". Tap-expand reveals the item + actions. Tap "Toss" → item gone from banner, supply archived.
12. **Pluralization.** A supply for "banana" with `plural_name='bananas'` displays as "banana" (qty=1, supplies have no qty). On a NEED row in ViewDetail with qty=3, it would display as "bananas" — but that's CP6d-ViewDetail's verification, just confirm the helper exists.

---

## SESSION_LOG entry format

Append to `docs/SESSION_LOG.md` under `## 2026-XX-XX — 8R-CP6d-Pantry — Pantry UX overhaul`:

```
**Phase:** 8R-CP6d-Pantry
**Prompt from:** docs/cc_prompts/CP6d-Pantry_prompt.md
**Status:** ✅ Complete

**Files created:**
- components/pantry/PantrySearchBar.tsx (~lines)
- components/pantry/StatusIcon.tsx (~lines)
- components/pantry/StaleItemsBanner.tsx (~lines)
- lib/utils/pluralize.ts (~lines)

**Files modified:**
- screens/PantryScreen.tsx (was X → now Y)
- components/pantry/SuppliesSection.tsx (was X → now Y, major rewrite)
- components/pantry/SupplyRow.tsx (was X → now Y, removed long-press, added tap-expand)
- lib/services/suppliesService.ts (was X → now Y, added setSupplyPriority + getStaleTrackOnlySupplies helpers)

**Notes for Claude.ai:**
- [Asset gaps if any icon files were missing]
- [Any deviations from the prompt or judgment calls]
- [Anything Tom should manually verify in next session]

**Tracker rows:** [generate per docs/TRACKER_SPEC.md]

**Open questions for Claude.ai / Tom:**
1. [Any decisions that came up during build that need resolution before next CP]
```

Drop SESSION_LOG.md and any updated living docs in `_pk_sync/` for Tom's manual upload.
