# CC PROMPT — CP6d Smoke Fixes Group 1: Pantry Visual + Structural

**Phase:** 8R-CP6d-SmokeFix-1 (post-CP6d series, smoke-discovered fixes)
**Estimated cost:** L. ~600-900 lines net spread across 5 files.
**Prerequisite:** CP6d series complete (Schema, Pantry, ViewDetail, Sheets, Recipe, SupplyDetail all shipped).

---

## Notes from CP6d retrospective (read first)

Three things to internalize before executing:

**1. Schema field-name verification before writing code.** Every CP referenced columns that didn't always match real schema. Always grep `Supabase_Snippet_Schema_Column_Details_with_PK_FK_Metadata.csv` to confirm. If a column doesn't exist, pick the closest existing field and flag in SESSION_LOG.

**2. The audit doc is in the repo.** `docs/8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md` is authoritative when prompts are ambiguous.

**3. Known schema gap from CP6d-Schema/Pantry: `setSupplyStatus` only patches `usage_level` on actual status transitions** (P8R-D24, deferred). Means tapping slider position 4 from level=5 (both in_stock) is currently a no-op. **THIS CP RESOLVES P8R-D24** — see Task 2 below.

---

## Context

Tom completed manual smoke testing of the CP6d series. This prompt addresses the Pantry-surface-specific findings — visual polish, structural fixes, and the long-press quick-edit modal. Other smoke findings (header redesign, search bar overhaul, recipe filter fixes) ship in subsequent smoke-fix prompts.

All items here are tightly scoped to Pantry-surface files: `screens/PantryScreen.tsx`, `components/pantry/SuppliesSection.tsx`, `components/pantry/SupplyRow.tsx`, `components/pantry/StatusIcon.tsx`, `lib/services/suppliesService.ts`, plus 1 new component file.

---

## Inputs to read

1. `docs/8R_GAP_AUDIT_REPORT_2026-05-04_v0.2.md` — reference for the original Pantry decisions.
2. `components/pantry/SuppliesSection.tsx` — the section-classification logic needs re-examination for the dual-listing bug.
3. `components/pantry/SupplyRow.tsx` — major surface for visual + interaction changes.
4. `components/pantry/StatusIcon.tsx` — current 5-circle progression component, needs cycle-order update.
5. `lib/services/suppliesService.ts` — needs new `setSupplyUsageLevel` helper (P8R-D24 resolution).
6. `screens/PantryScreen.tsx` — section ordering swap.
7. `lib/types/supplies.ts` — verify shapes for tracking_mode, storage_location, is_priority.

Asset prerequisite: Tom has added these icons to `assets/svg-source/` (verify):
- `noun-bookmark-4370599.svg` (regular — filled)
- `noun-bookmark-4370707.svg` (regular — unfilled)
- `noun-bookmark-2630180.svg` (priority — filled)
- `noun-bookmark-5772921.svg` (priority — unfilled)

If any are missing, flag in SESSION_LOG and use existing star/dot fallbacks rather than blocking.

---

## Tasks

### Task 1 — Add `setSupplyUsageLevel` service helper (resolves P8R-D24)

In `lib/services/suppliesService.ts`, add a new exported function that updates `usage_level` independently of status. This unblocks the slider's level-4 case where status doesn't change but usage_level should.

```ts
export async function setSupplyUsageLevel(
  supplyId: string,
  newLevel: number  // 0-5 inclusive
): Promise<SupplyWithTags> {
  if (newLevel < 0 || newLevel > 5) {
    throw new Error(`Invalid usage_level: ${newLevel}. Must be 0-5.`);
  }
  
  // Derive status from level. Mirror the existing reverse mapping:
  //   5,4,3 → in_stock
  //   2     → low
  //   1     → critical
  //   0     → out
  const newStatus: SupplyStatus = 
    newLevel >= 3 ? 'in_stock' :
    newLevel === 2 ? 'low' :
    newLevel === 1 ? 'critical' :
    'out';
  
  // Fetch current row to determine if this is a status transition
  const current = await getSupplyById(supplyId);
  if (!current) throw new Error('Supply not found');
  
  // If status would change, route through setSupplyStatus to get spawn-on-out
  // and tracking_mode gating behavior. Otherwise patch usage_level only.
  if (current.status !== newStatus) {
    return setSupplyStatus(supplyId, newStatus, /* preserve newLevel */);
    // NOTE: setSupplyStatus's existing usage_level patch logic uses fixed values
    // (5/2/1/0). For status-changing transitions, that's correct. The level=4 
    // case ONLY hits the no-status-change branch below.
  }
  
  // No status change — patch usage_level only
  const { data, error } = await supabase
    .from('supplies')
    .update({ usage_level: newLevel, updated_at: new Date().toISOString() })
    .eq('id', supplyId)
    .select()
    .single();
  
  if (error) throw error;
  
  // Re-fetch the joined row for SupplyWithTags shape
  const updated = await getSupplyById(supplyId);
  if (!updated) throw new Error('Supply disappeared after update');
  return updated;
}
```

Wire from SupplyRow's slider in Task 6. Mark P8R-D24 as RESOLVED in DEFERRED_WORK.md.

### Task 2 — Status icon cycle order: full progression with no skip (P24/P29/P34 fix)

In `components/pantry/SupplyRow.tsx`, find the cycle-tap handler. Current behavior cycles 5 → 3 → 2 → 1 → 0 → 5 (skips 4).

**New behavior:** 5 → 4 → 3 → 2 → 1 → 0 → 5. Full 6-step progression.

Implementation: the next-level lookup is just `(currentLevel + 5) % 6` if you flip the ordering, OR a simpler explicit map. Use whichever is clearer. The handler should call `setSupplyUsageLevel(supplyId, nextLevel)` (Task 1) instead of the current setSupplyStatus path — this ensures level 4 actually persists.

Status text label should match the simplified format from Tom's smoke notes:
- `usage_level=5` → "Status: In Stock"
- `usage_level=4` → "Status: In Stock"
- `usage_level=3` → "Status: In Stock"
- `usage_level=2` → "Status: Low"
- `usage_level=1` → "Status: Critical"
- `usage_level=0` → "Status: Out"

Drop the "level X/5" suffix entirely.

### Task 3 — SupplyRow visual redesign (P15 layout note)

Reduce row vertical space by ~35%. Current row has color/border around the whole row; change to a colored left bar (4-6px wide vertical accent) + uncolored row body, with status color also applied to text.

Layout from left to right:
```
[colored left bar | StatusIcon | name + brand summary | status pill text | regular/priority bookmark icons (right) ]
```

The color of the left bar matches the status: green/yellow/orange/red/grey. Same color applies to the status label text on the right.

Don't break tap-zones from CP6d-Pantry: status icon tap = cycle, name area tap = expand inline, slider in expand = jump-set.

### Task 4 — Bookmark icons for regular/priority (P15 icon note)

Replace the priority star with a teal bookmark icon. Add a regular-state bookmark icon as well. Both render on the right side of the row when active.

Icon assignments:
- **Regular indicator**: `noun-bookmark-4370599.svg` (active, when `tracking_mode='restock'`) — teal fill
- **Priority indicator**: `noun-bookmark-2630180.svg` (active, when `is_priority=true`) — teal fill
- Both use **teal** (use existing theme `colors.primary` or similar — NOT yellow as the original star was)

Render only the active states. If a supply is `tracking_mode='restock'` AND `is_priority=true`, both bookmark icons render (regular first, then priority). If neither apply (track_only + not priority), no bookmark renders.

These bookmarks are read-only on the COLLAPSED row (visual indicators only). They become interactive in the inline-expanded row (Task 6) and the long-press modal (Task 7).

In `components/pantry/StatusIcon.tsx` or a sibling icon component file, expose two new icons: `RegularBookmarkIcon`, `PriorityBookmarkIcon`. Inline the SVG paths same pattern as `StatusIcon` did.

### Task 5 — Pluralization always-plural in pantry (P43 redesign)

In `components/pantry/SupplyRow.tsx` and any other supply-name-rendering site:

**New rule for pantry display:** if the supply's ingredient has `plural_name` populated, use the plural name regardless of quantity. If `plural_name` is NULL, fall back to singular `ingredient.name`.

Reasoning per Tom's smoke note: "in the pantry, it should always render as the plural name 'strawberries' 'avocados' 'blueberries'." Mass nouns and items with no plural_name (which Workstream A will leave NULL for mass nouns like "olive oil," "salt," "lemon juice") render singular.

Replace the existing `pluralize(name, plural_name, qty)` call site in SupplyRow with the simpler:
```ts
const displayName = supply.ingredient?.plural_name ?? supply.ingredient?.name ?? supply.custom_name ?? '';
```

**Don't change** the pluralize helper itself or its consumers in ViewDetail (need rows). Quantity-based pluralization stays for need rows. This rule is pantry-specific.

### Task 6 — SupplyRow inline-expand row redesign (P12 + P32 expanded controls)

Currently the inline-expand row shows: name, status label, 6-segment slider, priority star, "Open detail ›" link.

**New shape:**
```
┌─────────────────────────────────────────────────────┐
│ {Supply Name}                                        │
│ Status: {label}                                      │
│                                                      │
│ [●●●●● 5/5 visual]   ← real slider, see below       │
│                                                      │
│ [☐ Regular]  [☆ Priority]  [📍 Storage: Pantry ▾]   │
│                                                      │
│ [+ Add to grocery list ▾]                            │
│                                                      │
│ [Search Recipes →]              [Open detail ›]      │
└─────────────────────────────────────────────────────┘
```

**Slider redesign:** replace the current 6-segment-button row with a real slider/picker that mirrors the StarRating component's UX (per Tom's note: "like our stars rating system but inability to do half"). 5 dots horizontally, tappable individually, draggable across. Visual style: same 5-circle progression icons used elsewhere, just bigger.

Actually slider behavior:
- Render 6 dots positioned 0-5 from left to right (or 5 dots representing levels 1-5 plus a "0/empty" leftmost state)
- Tap any dot → sets that level via `setSupplyUsageLevel` (Task 1)
- Drag across → snap to dot positions, fire setSupplyUsageLevel on release

Look at `components/StarRating.tsx` (already in repo) for the interaction pattern. Don't import StarRating directly — its semantics differ — but mimic the gesture handling approach (PanResponder + position-to-dot mapping).

**Regular toggle:** small icon button. When `tracking_mode='restock'`, shows the active regular bookmark; tap → cycles to track_only (call new `setSupplyTrackingMode(supplyId, mode)` if it doesn't exist; CP6d-SupplyDetail added it). Tooltip / label nearby: "Regular" / "On Hand".

**Priority toggle:** small icon button. When `is_priority=true`, shows the active priority bookmark; tap → toggles via `setSupplyPriority(supplyId, isPriority)` (already exists from CP6d-Pantry).

**Storage picker:** small dropdown/segmented control. Shows current `supply.storage_location` (Fridge/Freezer/Pantry/Counter). Tap → opens a small inline picker. On select → calls `setSupplyStorage(supplyId, location)` (already exists from CP6d-SupplyDetail).

**"+ Add to grocery list" button:** Tap → opens a sub-menu showing all the user's views (default + custom). On select → creates a need for this supply with the view's filter inheritance (urgency, store tags). Reuse the same logic as `addNeedFromRecipe` minus recipe attribution — basically a `createNeed({ supplyId, spaceId, tags: <inherited> })` call. The sub-menu pattern can mirror the picker in AddRecipeToNeedsModal — small bottom-sheet with view names. Don't auto-pick; require user to select.

**"Search Recipes →" link:** New small clickable text. Same behavior as the SupplyDetail "Find recipes" CTA — navigates cross-stack to RecipesStack/RecipeList with `initialIngredient: <name>` and **defaults to browse mode 'all' (NOT 'try_new')** per Tom's smoke note D11. Note: this is also addressed in a later smoke-fix prompt; for here just wire the navigation correctly.

**"Open detail ›" link:** stays as before, navigates to SupplyDetailScreen.

**Vertical accordion:** when this row expands, ALL OTHER inline-expanded rows in the section close (per Tom's note "If you expand one inline, it should collapse any other open inlines"). Track via shared `expandedSupplyId: string | null` state in SuppliesSection (lift from per-row to section-level).

### Task 7 — Long-press quick-edit modal (P32 redesign)

NEW component: `components/pantry/SupplyQuickEditModal.tsx` (~200-250 lines).

When user long-presses a SupplyRow, this modal opens. Same controls as the inline-expand row from Task 6 (status slider, regular/priority/storage toggles, +Add to grocery list, Search Recipes), styled as a centered or bottom-sheet modal.

**Visual feel matches inline-expand version** per Tom's note. Same icons, same toggle styles, same picker patterns. The modal IS essentially the inline-expand layout rendered as an overlay rather than inline.

Key differences from inline-expand:
- Has a header bar with the supply name + close (×) button
- Takes more vertical space (no need to keep tight)
- Backdrop dismisses
- Doesn't include "Open detail ›" link (the modal IS the quick-edit; users wanting more navigate via a separate "Full detail" link in modal footer if desired — your call)

Wire long-press in SupplyRow:
```ts
<TouchableOpacity 
  onLongPress={() => onLongPress?.(supply)}
  delayLongPress={500}
  ...>
```

PantryScreen state: `quickEditSupply: SupplyWithTags | null`. SuppliesSection's `onLongPress` prop bubbles up. PantryScreen renders the modal at screen level when `quickEditSupply !== null`.

### Task 8 — Section ordering: On Hand above Regulars (P18)

In `components/pantry/SuppliesSection.tsx`, swap render order. Current order: Attention → Regulars → On Hand. New order: Attention → On Hand → Regulars.

Rationale per Tom's note: items in On Hand are typically more urgent attention-wise (perishables) and should surface higher.

### Task 9 — Top-level Attention collapses when sub-category opens (P18)

In `components/pantry/SuppliesSection.tsx`, modify the accordion state management so that opening any sub-category in Regulars or On Hand also CLOSES Attention if Attention was open.

Currently Attention can stay open simultaneously with a Regulars/On Hand sub-category. Change to: at most one major surface visible at a time across all sections.

State: `expandedSection: 'attention' | { type: 'restock', family: string } | { type: 'track_only', family: string } | null`. Single source of truth.

### Task 10 — Dual-listing fix (P19/P20 bug)

Tom confirmed dual-listing isn't working: items appear in Attention OR original sub-category but not both. CP6d-Pantry's intent was both.

Fix: In `components/pantry/SuppliesSection.tsx`, the section-classification logic currently filters Attention items OUT of Regulars/On Hand. Remove that exclusion. Items with status IN ('out', 'critical', 'low') should appear in BOTH:
- Their tracking-mode-appropriate section (Regulars or On Hand) within their family sub-category, AND
- The Attention section's Out or Low sub-section

Both rendered rows should be FULLY interactive — cycling status from either row updates the underlying supply, both rows reflect new state on next render. This works automatically as long as both rows reference the same Supply object via `supplies` array.

Test: a low-stock olive oil should appear in BOTH Attention > Low AND Regulars > Pantry items. Cycling from either row triggers the count-bump animation on the OTHER section's count badge if that section is collapsed.

---

## Constraints

- **DO NOT** modify ViewDetail, AddNeedSheet, EditNeedSheet, ExpandedRegularsSheet, RecipeDetailScreen, AddRecipeToNeedsModal, SupplyDetailScreen, SupplyCreateSheet — those are out of scope for Group 1.
- **DO NOT** change the SuppliesSection's filter pipeline beyond removing the Attention exclusion (Task 10). Search filtering and section-classification stay as-is otherwise.
- **DO NOT** modify cookDepletionService, SpawnOnOutToast wiring.
- **DO NOT** delete the existing `pluralize` helper; it's still used by ViewDetail's need rows. Just bypass it in pantry display logic.
- **DO** preserve cycle-tap as a tap on the small status icon, name-area-tap as expand-inline, long-press as the new modal trigger.
- **DO** preserve the search bar's "+ Add" affordance (Group 2 will redesign the search bar).
- **DO** preserve the StaleItemsBanner.

---

## Verification

1. **Cycle-tap progression.** Tap status icon repeatedly: 5→4→3→2→1→0→5. All 6 levels reached.
2. **Slider in inline-expand.** Drag from level 5 to level 4 → row visually shows 4/5, supply.usage_level=4 in Supabase, status stays in_stock.
3. **Status labels simplified.** "Status: In Stock" not "Status: in_stock - level 5/5".
4. **Row visual redesign.** Color appears on left bar only + status text. Row height reduced ~35%.
5. **Bookmark icons render.** A `tracking_mode='restock'` supply shows the regular bookmark in teal. A `is_priority=true` supply shows the priority bookmark in teal. A supply that's both shows both. A supply that's neither (`track_only` + `is_priority=false`) shows neither.
6. **Pluralization in pantry.** A supply for "banana" with `plural_name='bananas'` displays as "bananas" in the pantry. Mass noun like "olive oil" with NULL plural_name displays as "olive oil" (singular).
7. **Inline-expand new shape.** Tapping name expands to show: status slider, regular/priority/storage toggles, "+ Add to grocery list" with sub-menu, "Search Recipes →" link, "Open detail ›" link. Tapping another supply's name closes the previous expand.
8. **Long-press modal.** Long-press any supply row → modal opens with same controls as inline-expand. Backdrop dismisses. Status updates from modal reflect in pantry list.
9. **Section ordering.** Attention → On Hand → Regulars (top to bottom).
10. **Accordion collapse.** Opening Attention closes any open Regulars/On Hand sub-category. Opening Spices in Regulars closes Attention if open.
11. **Dual-listing.** Cycle olive oil to low → it appears in Attention > Low AND Regulars > Pantry items. Cycling from either row updates the other.
12. **+ Add to grocery list flow.** From inline-expand, tap "+ Add to grocery list" → sub-menu of views appears → tap "Tonight" → need created with `urgency=today` tag, supply_id linked, navigated back to expand state.

---

## SESSION_LOG entry format

Standard template. Per-file lines, deviations, schema-gaps surfaced, open questions.

Mark **P8R-D24 as RESOLVED 2026-05-04** in DEFERRED_WORK.md (the new `setSupplyUsageLevel` helper closes that gap).

Stage to `_pk_sync/SESSION_LOG_2026-05-04_CP6d-SmokeFix-1.md`.
