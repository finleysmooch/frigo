# CP3 BUILD PROMPT — APPROVED 2026-06-12 (oversight; 3 amendments below)

**Drafted:** 2026-06-12 · first self-authored CP prompt under the CC-native workstream model.
**Status:** ✅ APPROVED with 3 amendments (applied below) — executed 2026-06-12.

## Oversight amendments (2026-06-12)
1. **Tom's look is a deliverable.** D-ON-13 is provisional pending Tom seeing the screen. SESSION_LOG/closeout must include: the exact dev-wrapper entry path (how Tom reaches it in Expo) + a screenshot of the rendered checklist. Closeout explicitly invites the D-ON-13 content review — list edits after that are config-only, by design.
2. **storage_location mapping.** If `createSupply` accepts `storageLocation`, the config may carry a per-item value (Pantry → 'pantry', Fridge → 'fridge', Condiments → confirm the house convention from data rather than guessing); include the chosen mapping in the SESSION_LOG mapping table. If the service defaults it or doesn't accept it, do nothing and say so — do NOT extend the service.
3. **Throwaway-user hygiene.** Cleanup must also remove the `auth.users` row (CP6b smoke pattern), and the before==after counts must cover `spaces`, `space_members`, and `supplies` — not supplies alone.

---

# CC PROMPT — CP3: Pantry staples checklist (T11 component + screen; D-ON-2 / D-ON-13) — checkpoint tier

## Context
CP3 builds the standalone pantry-staples checklist: the T11 onboarding screen's guts, reused
verbatim by T15's empty-pantry "Add staples" CTA (CP9f) and likely Settings later. The list
content is RULED (D-ON-13, provisional content) — you implement it as a config constant; you do
NOT choose items. The onboarding stack does not exist yet (CP9a), so this CP ships the component
plus a dev-reachable screen wrapper; final T11 placement happens in CP9 wiring.

Checkpoint tier: you author + report via SESSION_LOG; Tom commits/pushes. No migrations expected.
If you find yourself needing a migration or any schema change, STOP and report.

## Inputs to read (in order)
1. `docs/onboarding/WORKSTREAM_PLAN.md` — §2 CP3 (scope, the space-ensure design rule, verification sketch) + §3 (space-ensure constraint).
2. Anchor `ONBOARDING_AND_COLDSTART_SCOPING.md` v0.3.9 — §2 D-ON-13 (the 21-item list, verbatim source of truth) + §6 (space-ensure).
3. Wireframes v4, screen 11 — visual reference: category-grouped checkbox rows, all default-checked, "Add N staples →" CTA counting selections.
4. Live code (confirm-from-code, do not trust this prompt's line numbers):
   - `lib/services/suppliesService.ts` — `createSupply` (params shape, status guard, dedup), `searchCatalogIngredients`.
   - `lib/services/spaceService.ts` — `ensureDefaultSpace`.
   - `contexts/SpaceContext.tsx` — `isInitialized`, `activeSpace`, how `ensureDefaultSpace` is invoked.
   - `lib/theme/` + an existing checklist-style component for house style (e.g. the wireframe names `StockUpCard` as a concept ancestor).

## Confirm-from-code before building
- `createSupply` param names/types and the dedup behavior (re-adding an existing active supply must not duplicate).
- How the ingredient catalog is queried (`searchCatalogIngredients` or equivalent) and what an `ingredient_id` lookup by NAME returns — the D-ON-13 items are names; resolve each to a catalog `ingredient_id` where one exists. Report any of the 21 that do NOT resolve to a catalog ingredient (fall back to `customName` for those — flag them in SESSION_LOG, don't silently drop).
- `SpaceContext` mount situation for your dev wrapper (the provider mounts inside the session branch of App.tsx).

## Task
1. **Config constant** — `lib/config/staplesChecklist.ts` (or the house-conventional config location; flag if you place it elsewhere): the D-ON-13 list verbatim — 3 categories (Pantry ×10, Fridge ×6, Condiments ×5), 21 items, each `{ label, ingredientName }`. Content iterates post-look without rebuild — no hardcoding inside the component.
2. **Component** — `components/onboarding/StaplesChecklist.tsx`:
   - Renders the config: category headers + checkbox rows, **all default-checked**, tap to toggle; primary CTA "Add N staples →" where N = checked count; CTA disabled at N=0 is NOT the behavior — at N=0 the CTA becomes a skip ("Skip for now") per the never-dead-end discipline.
   - **Space-ensure (THE load-bearing constraint, anchor §6):** before the FIRST supplies write, the component must hold a real space id: consume `SpaceContext`; if `isInitialized && activeSpace`, use `activeSpace.id`; otherwise `await ensureDefaultSpace(userId)` (the one existing path — never a second create path, never assume the context race has resolved).
   - On submit: for each checked item, `createSupply({ spaceId, ingredientId | customName, status: 'in_stock', addedBy: userId })` — sequential or batched per house style; rely on service dedup for re-runs.
   - Props: `onDone(addedCount)` callback (T11/T15 hosts decide navigation); no navigation inside the component.
   - Services handle all DB calls — the component never touches supabase directly.
3. **Dev wrapper screen** — minimal screen hosting the component so it's smoke-testable pre-CP9a (house-conventional dev entry; flag where you put it). Do NOT wire it into production navigation.

## Constraints
- No migrations, no schema changes, no RLS changes. No edits to `suppliesService`/`spaceService`/`SpaceContext` (consume them as-is; if they can't support the flow, STOP and report).
- Don't remove existing functionality. TypeScript strict. Match repo component conventions (theme via `useTheme`, StyleSheet pattern).
- The 21 items/3 categories are verbatim D-ON-13 — no additions, renames, or re-categorization. If an item name is ambiguous against the ingredient catalog (e.g. "neutral oil"), pick the closest catalog match and REPORT the mapping table in SESSION_LOG; do not invent new catalog rows.

## Verification (paste evidence verbatim in SESSION_LOG)
1. `tsc --noEmit` clean on touched files (pre-existing baseline noise excluded).
2. **New-user-no-space test (the one that matters):** brand-new user (0 `space_members` rows — create a throwaway via the established service-role harness pattern) → complete the checklist → confirm in DB: exactly one `is_default` space + accepted owner membership created; one `supplies` row per checked item with that `space_id`, `status='in_stock'`, correct `added_by`. Paste the counts.
3. **Idempotence:** re-run submit for the same user → dedup returns existing supplies; no duplicate rows (count unchanged).
4. **Skip path:** deselect all → skip → zero supplies written, no space-scoped write attempted.
5. **Mapping table:** the 21 items → resolved `ingredient_id` or `customName` fallback, pasted.
6. Cleanup: throwaway user + space + supplies deleted; counts back to baseline.
7. Watch the Metro/Expo terminal during any in-app smoke (standing instruction).

## SESSION_LOG
One entry per the DOC_MAINTENANCE_PROCESS §8 format: verification evidence verbatim (log-before-close);
"Recommended doc updates" block listing all four living docs; files-modified list (Rule E check
against PK_CODE_SNAPSHOTS.md); update the CP3 row in `docs/onboarding/WORKSTREAM_PLAN.md` §4 to its
post-CP state IN THE SAME COMMIT as the SESSION_LOG entry. Tom commits/pushes (checkpoint tier).
