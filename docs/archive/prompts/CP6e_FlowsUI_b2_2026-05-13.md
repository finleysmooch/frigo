# CC PROMPT — CP6e-FlowsUI-b2 · Server-side supply search + match-dimension pills

**Phase:** 8R · CP6e-Lots · FlowsUI sub-phase b2 (last sub-CP of CP6e)
**Date drafted:** 2026-05-13 (Claude.ai planning instance)
**Predecessor:** CP6e-FlowsUI-b1 (shipped 2026-05-13)
**Successor:** Combined PantryUI + FlowsUI smoke → CP6e closeout → 8R closeout
**F&F target:** late August / early September 2026

---

## Context

`SuppliesSection`'s current search is client-side substring matching on `name`/`plural_name`/`family`/`ingredient_type` (the `supplyMatchesQuery` helper at line ~874). It misses tag values and all lot-level metadata (variant, brand, notes, storage). CP6e-Schema shipped a server-side `search_supplies(query_text, p_space_id)` RPC backed by GIN-indexed tsvectors that covers all 8 dimensions:

**Supply-level** (in `supplies.search_vector`, populated by `supplies_search_vector_trigger`):
- `name` — custom_name, ingredient.name, ingredient.plural_name (weight A)
- `family` — ingredient.family (weight B)
- `type` — ingredient.ingredient_type (weight B)
- `tag` — supply_tag joined values (weight C)

**Lot-level** (computed inline at RPC time from active `supply_lots`):
- `variant` — variant_label
- `brand` — brand
- `notes` — notes
- `storage` — storage_location (with synonym expansion via `expand_storage_synonyms`)

The RPC returns `(supply_id uuid, rank real, match_count integer)` — only IDs + ts_rank. It doesn't say which dimension caused each match. This sub-phase wires the RPC into `SuppliesSection` and adds a client-side post-hoc matcher that re-runs the dimension scan on returned supplies to compute pill labels and lot-level highlights.

### Scope leans (locked in Claude.ai chat)

- **Pill source: client-side post-hoc matcher** reusing `lib/utils/lotSearch.ts`'s synonym logic, extended to cover supply-level dimensions. (Option B from Claude.ai planning — rejected (A) RPC modification because it adds a migration; rejected (C) no-pills because pills are meaningful UX.)
- **Search threshold: query length ≥ 2.** Below that → no server search (show all supplies, existing pre-search behavior). At ≥ 2 → debounced 200ms server call.
- **Sections preserved.** Section partitioning logic (Attention / Restock / Track Only / Not Tracked Yet) is unchanged. Server-search just filters which supplies enter the partition. Within each section, in search mode, sort by RPC rank DESC; outside search mode, existing alphabetical-by-status-priority sort.
- **Catalog shadow search untouched.** The existing `searchCatalogIngredients` parallel fetch + "Not tracked yet" group keeps working as today.
- **Lot-level highlighting** = subtle background tint on matched LotRows when expanded. Don't replace the existing left-border urgency styling — overlay a soft background tint.
- **Pill display: max 3 visible + "+N more" overflow.** Inline single row, no wrap. Order priority: name → variant → brand → family → type → tag → notes → storage.
- **Combined smoke deferred until after this lands.** This is the last sub-CP before CP6e closeout. Smoke covers PantryUI a/b/c + FlowsUI a + b1 + b2 in one pass.

---

## Pre-read order

1. `lib/services/suppliesService.ts` — add new `searchSuppliesServerSide` wrapper.
2. `lib/utils/lotSearch.ts` — extend with the post-hoc matcher. The existing `STORAGE_SYNONYMS` map + `expandToken` are the foundation; mirror the server's synonym expansion.
3. `lib/types/supplies.ts` — add `SearchMatchDimension` + `SupplySearchMatch` types.
4. `components/pantry/SuppliesSection.tsx` — main refactor: replace client-side `supplyMatchesQuery` filter with debounced server search + post-hoc match + map → SupplyRow.
5. `components/pantry/SupplyRow.tsx` — add `searchMatch?: SupplySearchMatch` prop; render MatchPillRow when set; forward `matchedLotIds` to LotsList.
6. `components/pantry/LotsList.tsx` — accept optional `matchedLotIds?: Set<string>`; pass `highlighted` to each LotRow.
7. `components/pantry/LotRow.tsx` — add optional `highlighted?: boolean` prop with subtle background tint.
8. `components/pantry/MatchPillRow.tsx` — NEW component (small inline pill row).
9. `screens/PantryScreen.tsx` — verify `searchQuery` is plumbed to SuppliesSection (informational; no changes expected).

---

## Task list

### Task 1 — Add `searchSuppliesServerSide` to `lib/services/suppliesService.ts`

```ts
export interface SupplySearchHit {
  supplyId: string;
  rank: number;
}

export async function searchSuppliesServerSide(
  query: string,
  spaceId: string
): Promise<SupplySearchHit[]>
```

Body: call `supabase.rpc('search_supplies', { query_text: query, p_space_id: spaceId })`. Map rows to `{ supplyId: row.supply_id, rank: row.rank }`. On error: log + throw (caller handles).

The RPC handles empty/whitespace queries internally (returns nothing); pass through.

### Task 2 — Add types to `lib/types/supplies.ts`

```ts
export type SearchMatchDimension =
  | 'name'        // custom_name | ingredient.name | ingredient.plural_name
  | 'family'      // ingredient.family
  | 'type'        // ingredient.ingredient_type
  | 'tag'         // any supply_tag value
  | 'variant'     // any lot's variant_label
  | 'brand'       // any lot's brand
  | 'notes'       // any lot's notes
  | 'storage';    // any lot's storage_location (with synonym expansion)

export interface SupplySearchMatch {
  supplyId: string;
  rank: number;                              // from RPC
  matchedDimensions: Set<SearchMatchDimension>;
  matchedLotIds: Set<string>;                // lots that contributed via any lot-level dimension
}
```

### Task 3 — Extend `lib/utils/lotSearch.ts` with the post-hoc matcher

Keep `filterLotsBySearch` (existing function) intact — it serves the "Find within lots" affordance in SupplyDetail. Add new exported function:

```ts
export function computeSupplySearchMatch(
  supply: SupplyWithTags,
  query: string
): SupplySearchMatch
```

Behavior — mirror the server's match logic per-dimension:

1. **Tokenize** `query` on whitespace, lower-case, drop empties. If empty: return `{ supplyId: supply.id, rank: 0, matchedDimensions: new Set(), matchedLotIds: new Set() }`.
2. **For each dimension**, check whether ALL tokens (with synonym expansion) match SOMETHING in that dimension. Server tsquery is AND-joined across tokens, so per-dimension match means every token has a substring-or-synonym hit in that dimension's text.
3. **Token-matches-dimension predicate:** for a given token and a dimension's string(s), expand the token via `expandToken` (existing helper — synonyms apply uniformly across all dimensions, since `to_tsquery('simple', '...')` uses simple dictionary = no stemming), then check whether any expansion is a substring of any dimension string (case-insensitive).

   - For `name`: check against [`custom_name`, `ingredient.name`, `ingredient.plural_name`] (only non-null values).
   - For `family`: check against [`ingredient.family`].
   - For `type`: check against [`ingredient.ingredient_type`].
   - For `tag`: check against tags joined values. The supply's tags are available via `supply.tags?: SupplyTag[]` (existing on SupplyWithTags). Use `tag.value` (or whatever the existing field is — verify during pre-read).
   - For `variant`: union across `supply.lots ?? []`, dimension = `lot.variant_label`.
   - For `brand`: union across lots, `lot.brand`.
   - For `notes`: union across lots, `lot.notes`.
   - For `storage`: union across lots, `lot.storage_location`.

4. **Dimension match rule:** dimension is matched if every token in the query has a synonym-expanded substring hit somewhere in that dimension's text(s).
5. **matchedLotIds:** for lot-level dimensions (variant/brand/notes/storage), track WHICH lots contributed. A lot is in `matchedLotIds` if at least one token has a synonym-substring hit in any of its four lot dimensions. (Per-lot OR, not per-lot AND-of-all-tokens.)
6. **rank** is filled in by the caller (SuppliesSection — comes from the RPC result; the matcher doesn't compute it).

Defensive: if `supply.lots` is undefined or null, skip all lot-level dimensions. If `supply.tags` is undefined, skip `tag`.

Add unit-level comments showing the parallel between server SQL fragments and client predicates.

### Task 4 — Create `components/pantry/MatchPillRow.tsx` (NEW)

Small inline component rendering a horizontal row of dimension pills.

**Props:**

```ts
interface Props {
  matchedDimensions: Set<SearchMatchDimension>;
}
```

**Behavior:**

- Convert `matchedDimensions` set into an ordered array using this priority: `['name', 'variant', 'brand', 'family', 'type', 'tag', 'notes', 'storage']`. Filter to only those in the set.
- Render the first 3 as pills. If more than 3, append a `+N` indicator pill where N is the overflow count.
- If `matchedDimensions` is empty: render nothing (`return null`).

**Pill label map:**
- `name` → "name"
- `family` → "family"
- `type` → "category"
- `tag` → "tag"
- `variant` → "variant"
- `brand` → "brand"
- `notes` → "notes"
- `storage` → "storage"

(The `+N` overflow pill renders just `+N` text, no label.)

**Visual:**

- Single horizontal `flexDirection: 'row'`, `gap: 4`, no wrap.
- Each pill: `paddingHorizontal: 6`, `paddingVertical: 2`, `borderRadius: borderRadius.sm`, `backgroundColor: colors.background.surface`, text `fontSize: 11`, `color: colors.text.secondary`, `fontWeight: typography.weights.medium`.
- Pills are decorative (informational only) — `accessibilityElementsHidden={true}` on each pill; the parent row's accessibility text covers the meaning.
- Total height ~18-20pt — small enough to not blow up the SupplyRow.

### Task 5 — Extend `components/pantry/SupplyRow.tsx`

**Add optional prop:**

```ts
interface SupplyRowProps {
  // ... existing props
  searchMatch?: SupplySearchMatch;
}
```

**Visual changes (gated on `searchMatch !== undefined`):**

1. Render `<MatchPillRow matchedDimensions={searchMatch.matchedDimensions} />` below the existing name/status row but ABOVE the expand area. Use modest vertical padding (`marginTop: 2`).
2. Pass `matchedLotIds={searchMatch.matchedLotIds}` to `<LotsList>` when expanded (Task 6).

When `searchMatch` is undefined: zero visual change. Non-search mode is fully unchanged.

### Task 6 — Extend `components/pantry/LotsList.tsx`

Add optional prop `matchedLotIds?: Set<string>`. For each lot rendered, pass `highlighted={matchedLotIds?.has(lot.id) === true}` to `<LotRow>`.

When `matchedLotIds` is undefined: zero behavior change.

### Task 7 — Extend `components/pantry/LotRow.tsx`

Add optional prop `highlighted?: boolean`. When `true`, layer a soft background tint on the existing row container. Suggested: `backgroundColor: colors.primaryLight` (or `colors.background.tinted` if that exists) with a low opacity, layered such that it doesn't fight the existing urgency `borderColor` styling (urgency border is on the outer row container; the tint goes inside).

Cleanest impl: a separate inner `<View>` with `backgroundColor` set conditionally on `highlighted`, wrapping the existing row content. Outer container keeps the urgency border.

When `highlighted` is `false` or undefined: zero visual change.

### Task 8 — Rewire `components/pantry/SuppliesSection.tsx`

This is the bulk of the work. Walk through carefully:

**A. New state:**

```ts
const [serverSearchResults, setServerSearchResults] = useState<Map<string, SupplySearchMatch>>(new Map());
const [serverSearchLoading, setServerSearchLoading] = useState(false);
const [serverSearchError, setServerSearchError] = useState<string | null>(null);
```

**B. New useEffect — debounced server search:**

```ts
useEffect(() => {
  const trimmed = searchQuery.trim();
  if (trimmed.length < 2 || !spaceId) {
    setServerSearchResults(new Map());
    setServerSearchError(null);
    return;
  }
  let cancelled = false;
  const timer = setTimeout(async () => {
    setServerSearchLoading(true);
    setServerSearchError(null);
    try {
      const hits = await searchSuppliesServerSide(trimmed, spaceId);
      if (cancelled) return;
      // Build the meta map. For each hit, find the local supply, run the matcher.
      const supplyById = new Map(supplies.map(s => [s.id, s]));
      const map = new Map<string, SupplySearchMatch>();
      for (const hit of hits) {
        const supply = supplyById.get(hit.supplyId);
        if (!supply) continue;  // server has it but local snapshot doesn't — discard defensively
        const match = computeSupplySearchMatch(supply, trimmed);
        match.rank = hit.rank;  // overlay server rank
        map.set(hit.supplyId, match);
      }
      setServerSearchResults(map);
    } catch (err) {
      if (cancelled) return;
      console.error('❌ searchSuppliesServerSide error:', err);
      setServerSearchError('Search failed. Try again.');
    } finally {
      if (!cancelled) setServerSearchLoading(false);
    }
  }, 200);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}, [searchQuery, spaceId, supplies, refreshTrigger]);
```

(The `supplies` dep here is fine — when supplies reload, the matcher re-runs against the new list with the cached search query. Stable since `supplies` only changes when refreshTrigger fires or on initial load.)

**C. Replace the filter chain:**

Find the existing line (~341):
```ts
const filtered = supplies.filter((s) => !trimmedQuery ? true : supplyMatchesQuery(s, trimmedQuery));
```

Replace with:

```ts
const searchActive = trimmedQuery.length >= 2;
const filtered = !searchActive
  ? supplies
  : supplies.filter((s) => serverSearchResults.has(s.id));
```

For query length 0 or 1 → all supplies. For query length ≥ 2 → only supplies present in `serverSearchResults`. This preserves the section partitioning logic downstream.

**D. Sort within sections when search is active:**

Find the `sortSupplies` function. Add a parameter or a parallel function:

```ts
function sortSuppliesByRank(list: SupplyWithTags[], rankMap: Map<string, SupplySearchMatch>): SupplyWithTags[] {
  return [...list].sort((a, b) => {
    const rankA = rankMap.get(a.id)?.rank ?? 0;
    const rankB = rankMap.get(b.id)?.rank ?? 0;
    if (rankB !== rankA) return rankB - rankA;
    const aName = (a.ingredient?.name ?? a.custom_name ?? '').toLowerCase();
    const bName = (b.ingredient?.name ?? b.custom_name ?? '').toLowerCase();
    return aName.localeCompare(bName);
  });
}
```

At each section render site (Attention, Restock-all, TrackOnly-all, Unknown), apply: `searchActive ? sortSuppliesByRank(section, serverSearchResults) : sortSupplies(section)`.

**E. Pass `searchMatch` to each `<SupplyRow>`:**

At every `<SupplyRow ... />` render site within the section bodies, add `searchMatch={searchActive ? serverSearchResults.get(supply.id) : undefined}`.

**F. Error + loading UX:**

- Loading: subtle indicator near the search-empty message (e.g., when search is active but no results yet AND `serverSearchLoading === true` → show "Searching…" instead of "No supplies match"). Optional micro-detail — only show if implementation is trivial.
- Error: render `serverSearchError` text inline at the top of the SuppliesSection when set. Style with `functionalColors.warning` or `colors.text.tertiary`.

**G. Remove `supplyMatchesQuery` from the file** OR keep it for fallback. Lean: KEEP for now, dead but documented as legacy; do NOT delete in this prompt. Tom may want to revive it as an offline fallback later. Add a code comment marking it as legacy from CP6e-FlowsUI-b2.

**H. Empty state behavior:**

Existing logic at line ~398 ("No supplies match {searchQuery}.") fires when `attentionSupplies.length === 0 && restockAll.length === 0 && trackOnlyAll.length === 0`. With server search, this still works — empty server result map → filtered is empty → all sections empty. Preserve the message.

---

## Constraints

1. **No changes to:** `supplies_search_vector_trigger`, `supply_lots_search_vector_trigger`, `expand_storage_synonyms`, or the `search_supplies` RPC itself (server side untouched). No new migrations.
2. **No changes to:** `cookDepletionService`, `needsService`, `lotsService` (except using `getSuppliesForSpace`'s existing `includeLots: true` option — already wired).
3. **No deletion of existing exports.** `supplyMatchesQuery` stays (legacy comment).
4. **TypeScript strict.** No `any`.
5. **Existing client-side `filterLotsBySearch` in `lotSearch.ts` is untouched.** Adding `computeSupplySearchMatch` is additive.
6. **Behavior parity outside search mode** (query.trim().length < 2). Every rendering decision in SuppliesSection should be identical to today's behavior when there's no active search. Non-search renders zero MatchPillRows, zero highlights.
7. **No tests, no smoke** — combined smoke covers this in the next pass.
8. **Accessibility:** SupplyRow's parent accessibility label should mention the match when present. E.g., extend the existing label to suffix "; matched on {N} dimensions" when `searchMatch !== undefined`. Pills themselves are decorative (`accessibilityElementsHidden`).

---

## What's explicitly out of scope (do NOT implement)

- Modifying the `search_supplies` RPC, the supplies tsvector trigger, or the lot tsvector trigger / helper. Schema-side changes are blocked.
- Replacing the catalog shadow search (`searchCatalogIngredients`). It stays as-is, parallel and independent.
- Removing `supplyMatchesQuery`. Stays as legacy code.
- Pill values (e.g., showing "brand: Kerrygold"). Pills show DIMENSION labels only; the value is left for the row body / lot list.
- Per-token pill grouping. Pills are per-dimension regardless of which token caused the match.
- Search history, search autocomplete, search suggestion UI.
- Threshold-tunable settings UI. Threshold is hard-coded at ≥ 2.
- Offline-fallback to `supplyMatchesQuery` when RPC fails. Server error → show error string + retain previous result map (do not silently fall back).
- Auto-expand SupplyRow on match. Match highlights only render when user expands manually.

---

## Verification

1. `npx tsc --noEmit -p .` — filter to touched files (`lib/services/suppliesService.ts`, `lib/utils/lotSearch.ts`, `lib/types/supplies.ts`, `components/pantry/SuppliesSection.tsx`, `components/pantry/SupplyRow.tsx`, `components/pantry/LotsList.tsx`, `components/pantry/LotRow.tsx`, new `components/pantry/MatchPillRow.tsx`). Zero new errors.
2. **Read-through:**
   - Confirm non-search render is identical: no MatchPillRow renders when `searchMatch` is undefined; LotRow's `highlighted` defaults to `false`/undefined → no tint.
   - Confirm 200ms debounce: rapid query changes shouldn't fire multiple in-flight RPCs (the cancelled flag + cleanup timer).
   - Confirm `computeSupplySearchMatch` handles all 8 dimensions and respects the AND-across-tokens rule per-dimension. A query "spicy hot" should match `tag` only if BOTH "spicy" AND "hot" appear (via synonyms) somewhere in the supply's tag values.
   - Confirm storage synonym expansion works end-to-end: query "frozen" should mark `storage` as a matched dimension for a supply whose lot's `storage_location` is `freezer`.
   - Confirm `matchedLotIds` correctly identifies WHICH lots contributed (per-lot OR-of-tokens-having-any-dim-hit, NOT AND).
   - Confirm pill overflow: a supply matching 5+ dimensions shows 3 pills + "+2" (or whatever the overflow count is).
3. **Sanity check the wire-up:**
   - PantryScreen passes `searchQuery` to SuppliesSection unchanged.
   - SuppliesSection's existing shadow-fetch useEffect for catalog search at line ~123 is independent and continues to work.
   - Section partitioning at line ~350 onwards operates on `filtered` which now contains only server-matched supplies — but the partition rules are unchanged.

---

## SESSION_LOG entry template

```
## 2026-05-13 — CP6e-FlowsUI-b2 · Server-side supply search + match-dimension pills

**Type:** UI build. Last sub-CP of CP6e. Wires the `search_supplies` RPC into SuppliesSection with a client-side post-hoc dimension matcher for pill labels + lot-level highlighting.

**Files modified:**
- `lib/services/suppliesService.ts` — +N lines. Added `searchSuppliesServerSide(query, spaceId)` wrapper calling `supabase.rpc('search_supplies', ...)`. Returns `SupplySearchHit[]`.
- `lib/utils/lotSearch.ts` — +N lines. Added `computeSupplySearchMatch(supply, query)`. Mirrors the server's 8-dimension match logic with synonym expansion (reuses existing `expandToken`). `filterLotsBySearch` unchanged.
- `lib/types/supplies.ts` — +N lines. Added `SearchMatchDimension` union + `SupplySearchMatch` interface.
- `components/pantry/SuppliesSection.tsx` — +N lines. Replaced client-side `supplyMatchesQuery` filter with debounced (200ms) server search at query length ≥ 2. Result Map keyed by supplyId. New `sortSuppliesByRank` helper for in-section sort during search. `supplyMatchesQuery` retained as legacy code with marker comment.
- `components/pantry/SupplyRow.tsx` — +N lines. Added `searchMatch?: SupplySearchMatch` prop. Renders `<MatchPillRow>` when set. Forwards `matchedLotIds` to `<LotsList>`.
- `components/pantry/LotsList.tsx` — +N lines. Optional `matchedLotIds?: Set<string>`; pass `highlighted` to each LotRow.
- `components/pantry/LotRow.tsx` — +N lines. Optional `highlighted?: boolean` → soft background tint layer inside the existing row container.

**Files created:**
- `components/pantry/MatchPillRow.tsx` (NEW, ~N lines) — inline horizontal pill row. Max 3 visible + "+N" overflow. Priority order: name → variant → brand → family → type → tag → notes → storage.

**Dimensions wired:**
- `name` ← custom_name | ingredient.name | ingredient.plural_name
- `family` ← ingredient.family
- `type` ← ingredient.ingredient_type
- `tag` ← supply_tag joined values
- `variant` ← any lot's variant_label
- `brand` ← any lot's brand
- `notes` ← any lot's notes
- `storage` ← any lot's storage_location (with synonym expansion via `expandToken`)

**Decisions made during build:**
- [tags access pattern — how you read tag.value from supply.tags]
- [overflow pill styling — color/border choices]
- [LotRow highlight tint — exact color you chose]
- [whether/how loading + error state landed]
- [anything else]

**Constraints honored:**
- No SQL changes (RPC + triggers + helper untouched).
- TypeScript strict; no `any`.
- `supplyMatchesQuery` retained as legacy code.
- Behavior parity outside search mode — verified.
- Catalog shadow search unchanged.
- Accessibility on row labels; pills marked decorative.

**Verification:** `npx tsc --noEmit -p .` filtered to touched files = zero errors.

**Read-through verification:**
- [✅/❌ each item from §Verification]

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md` — recommended REAL update. CP6e is complete after this. Significant additions to capture: lots model, lotsService, LotEditSheet pattern, LotInputRowView pattern, server-side `search_supplies` RPC, client post-hoc matcher pattern, storage-synonym duplication (client + server), test-against-real-data discipline gap. This is the end-of-CP6e refresh referenced in CP6e-Services-a SESSION_LOG.
- `DEFERRED_WORK.md` — recommend adding: "Partial-ingredient indicator + grocery-list integration UX pass" (cross-cutting, deferred from FlowsUI-a planning); "Match-pill smoke watches" (async summary flash in FlowsUI-a, newly-selected-lot default qty footgun in FlowsUI-a); "RPC modification to surface per-dimension match metadata" (eliminate client-server duplicated match logic).
- `PROJECT_CONTEXT.md` — recommend updating phase status (CP6e complete; 8R close-out pending).
- `FF_LAUNCH_MASTER_PLAN.md` — none.

**Rule E PK-snapshot:** [files matched + updates]

**Recommended next steps for Tom:**
1. Sanity-read all diffs.
2. **Combined PantryUI + FlowsUI smoke** is the next gate. Scenarios should cover: (a) supply create with tracks_lots toggle + multi-lot inputs; (b) lot edit from PantryScreen; (c) cook flow with auto-pick depletion + Review modal; (d) cook flow with LotPicker manual override; (e) grocery acquire of tracks_lots supply → toast; (f) Edit affordance on the toast; (g) Undo affordance on the toast; (h) search with name match; (i) search with brand match; (j) search with storage synonym ("frozen" matching "freezer" lots); (k) cross-dimension search (e.g., "kerrygold butter") matching multiple pills.
3. Commit when smoke passes.
4. End-of-CP6e doc refresh: FRIGO_ARCHITECTURE update + PROJECT_CONTEXT phase status + DEFERRED_WORK additions. May be a separate CC prompt or done by Claude.ai directly.

**Surprises / Notes for Claude.ai:**
[anything worth flagging]
```

---

## ID card

| Label | UUID |
|---|---|
| Space ("Home") | `7aa945ab-fb32-4197-ae11-e6dbd3392587` |
| Tom's user_id | `47feb56f-530f-4ab3-8fef-33664c3885b7` |
| `SUPPLY_CHICKEN_ID` (tracks_lots=true) | `7be3388d-18b3-4279-b6c8-92974151ef6f` |
| `SUPPLY_OLIVE_OIL_ID` | `430d8b9d-a597-4215-940a-ad5d01ad7702` |

---

End of prompt.
