# [DRAFT] Phase 8 v2.2 — Change Verification

> Compact before/after diffs for the seven changes applied after the second audit pass. Spot-check this doc rather than re-reading the full package. Generated 2026-04-23.

---

## 1. RLS INSERT policy — guest added

**File:** `phase_8_schema_migration.sql`

**Before:**
```sql
CREATE POLICY "pantry_staples_insert" ON pantry_staples FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = pantry_staples.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member')
));
```

**After:**
```sql
CREATE POLICY "pantry_staples_insert" ON pantry_staples FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM space_members sm
  WHERE sm.space_id = pantry_staples.space_id
    AND sm.user_id = auth.uid()
    AND sm.status = 'accepted'
    AND sm.role IN ('owner', 'member', 'guest')
));
```

---

## 2. RLS UPDATE policy — guest added

**File:** `phase_8_schema_migration.sql`

**Before:**
```sql
CREATE POLICY "pantry_staples_update" ON pantry_staples FOR UPDATE
USING (EXISTS (
  ...
    AND sm.role IN ('owner', 'member')
));
```

**After:**
```sql
CREATE POLICY "pantry_staples_update" ON pantry_staples FOR UPDATE
USING (EXISTS (
  ...
    AND sm.role IN ('owner', 'member', 'guest')
));
```

---

## 3. RLS DELETE policy — unchanged + comment added

**File:** `phase_8_schema_migration.sql`

**Before:** (no comment; same `('owner', 'member')` allowlist)

**After:**
```sql
-- DELETE restricted to owner + member only (matches pantry_items pattern).
-- Guests can add and cycle staple state, but cannot remove entries.
CREATE POLICY "pantry_staples_delete" ON pantry_staples FOR DELETE
USING (EXISTS (
  ...
    AND sm.role IN ('owner', 'member')
));
```

**Allowlist unchanged** — DELETE stays owner+member only. Comment added to explain why guest has asymmetric permissions across INSERT/UPDATE vs DELETE.

---

## 4. DEFERRED_WORK Phase 7 anchor

**File:** `DRAFT_DEFERRED_WORK_additions.md`

**Before (in the body + audit instructions):**
> "Add a new section `## From: Phase 8 — Pantry Intelligence Planning (April 23, 2026)` near the top of the doc (before Phase 7P's section, since Phase 8 is next sequentially)."

**After:**
> "Add a new section `## From: Phase 8 — Pantry Intelligence Planning (April 23, 2026)` placed **before the existing `## From: Phase 7 — Social & Feed Polish` section header** (locate by header text, not line number — rows get added above it over time)."

**Change rationale:** No Phase 7P section exists in DEFERRED_WORK. P7-44 + P7-45 live inside the Phase 7 — Social & Feed Polish section. Polish note from audit applied: anchor by header text, not line number.

---

## 5. PROJECT_CONTEXT delta — Section 3 removed

**File:** `DRAFT_PROJECT_CONTEXT_delta.md`

**Before:** 3 sections (Section 1 heading swap, Section 2 narrative block replacement, Section 3 "Scope bullets" replacement elsewhere).

**After:** 2 sections (Section 1 heading swap, Section 2 narrative block replacement). Section 3 deleted.

**Change rationale:** Section 3's target (Phase 8 scope bullets) is the same block Section 2 already replaces. Section 3 was dead letter that would have confused CC. Audit instructions also updated to reflect 2-section patch.

---

## 6. Master plan risk register — explicit before/after

**File:** `DRAFT_FF_LAUNCH_MASTER_PLAN_v6.1_delta.md` Section 3

**Before (ambiguous):**
> "Update existing row (if present) re: '2×-growth-repeat risk' — note that Phase 8 already grew ~150% during wireframing before any execution. This is scope discovery, not scope creep — the growth happened in planning, which is the right place for it..."

**After (explicit find/replace):**
> "Find cell content (approximately): 'Accept as documented worst-case scenario; Phase 11 is primary scope-cut lever.' (or whatever the current Mitigation text is for that row...)
> 
> Replace with: 'Phase 8 already grew ~150% during wireframing before any execution — this is scope *discovery* (happening in planning, the right place for it), not scope *creep*. Actual build velocity from this point forward is the remaining unknown. Phase 11 remains primary scope-cut lever; Phase 8's natural-language search is secondary.'
> 
> If the exact current Mitigation text doesn't match the expected content, flag in audit notes — don't silently overwrite a different mitigation."

---

## 7. CC Prompt 1 — SQL handoff path explicit

**File:** `DRAFT_CC_PROMPT_1_8A-CP1_schema_foundation.md` Part 1

**Before:**
> "Copy `phase_8_schema_migration.sql` from the prompt package into `supabase/migrations/20260424_phase_8_schema_foundation.sql`."

**After:**
> "Tom will have placed `phase_8_schema_migration.sql` at the **repo root** (top-level of the project, same directory as `package.json`) before handing you this prompt. Your task: move that file to `supabase/migrations/20260424_phase_8_schema_foundation.sql`. [...] If `phase_8_schema_migration.sql` is NOT at the repo root when you look, STOP and flag in SESSION_LOG — don't proceed with Parts 2 and 3, and don't search the filesystem for it in other locations."

**Change rationale:** "Top level of this prompt package" was ambiguous from CC's perspective. Explicit path removes the guess, plus explicit STOP-if-not-findable discipline.

---

## Also applied (narrative polish, no diff view needed)

- **SQL migration:** Added explanatory comment on `custom_name` column — "Custom items still require quantity_display > 0 and unit_display per existing constraints — use natural display units (e.g., '1 roll', '2 pack')."
- **SQL migration header:** Added "Post-second-audit updates" block at top documenting the RLS change.
- **Phase doc D8-25:** Extended rationale with one-line note about Day-1 freezer cleanout surge being correct-by-spec (expectation-setting for testers, no logic change).
- **Phase doc 8A-CP3:** Clarified that recipe tap-sheet quantity wiring is 8D-CP3's cost, not 8A's. Estimate stays 0.5 session for 8A's portion.
- **Phase doc 8C-CP5:** Stub-handler wiring TODO now names specific call sites: `screens/PantryScreen.tsx` `handleTapRecipes` (~line 512), `handleTapItem` (~line 518), plus the `onStapleLabelTap` handler that PantryScreen passes to `<StaplesGrid />` in 8B-CP2.
- **All updated files:** DRAFT banners bumped to reflect v2.1 / v2.2 state (phase doc is v2.2; deltas + CP1 are v2.1).

---

## What did NOT change

- Sub-phase structure (still 5: 8A/8B/8C/8D/8E, same checkpoint assignments)
- Session estimate (18-28 total)
- Decision IDs (still D8-1 through D8-28)
- Schema additions/removals (still: pantry_staples table, last_confirmed_at + discarded fields on pantry_items, priority_reason + custom_name on grocery_list_items, expiration_falloff_days on space_settings, staleness_threshold_days on user_pantry_preferences; NOT adding default_aisle, NOT adding brand columns)
- CP1/CP2/CP3 renumbering (8A-CP1, 8B-CP1, 8B-CP2 — stable)
- Wireframes (v3/v4/v5 HTML files unchanged)
- Phase doc architecture section, deferred items list, prerequisites

---

## File list (v2.2 / v2.1 post-second-audit)

Files modified in this pass:
- `phase_8_schema_migration.sql` → RLS guest permissions, custom_name comment, header note
- `DRAFT_DEFERRED_WORK_additions.md` → Phase 7 section anchor (no line number)
- `DRAFT_PROJECT_CONTEXT_delta.md` → Section 3 deleted, 2-section delta now
- `DRAFT_FF_LAUNCH_MASTER_PLAN_v6.1_delta.md` → Risk register explicit before/after
- `DRAFT_PHASE_8_PANTRY_INTELLIGENCE.md` → D8-25 note, 8A-CP3 clarification, 8C-CP5 call sites, v2.2 banner + changelog
- `DRAFT_CC_PROMPT_1_8A-CP1_schema_foundation.md` → Explicit SQL handoff path, STOP-if-missing discipline

Files unchanged in this pass:
- `DRAFT_CC_PROMPT_2_8B-CP1_staples_service.md`
- `DRAFT_CC_PROMPT_3_8B-CP2_staples_ui.md`
- `DRAFT_phase_8_wireframes_README.md`
- `DRAFT_AUDIT_RESPONSE_v2.md` (describes the v2 state; change verification complements it)
- `AUDIT_INSTANCE_PROMPT.md`
- 3 HTML wireframe files

---

## Recommendation to Tom

Package is ready. Next moves:

1. Add all 7 DRAFT files + the SQL migration to the project folder / repo
2. If a third audit pass feels unnecessary (audit instance suggested spot-check via this doc is sufficient), proceed to execution:
   - Pre-commit wireframes to `docs/wireframes/phase_8/` as part of the doc updates commit
   - Paste `phase_8_schema_migration.sql` into Supabase Dashboard SQL Editor → run
   - Hand `DRAFT_CC_PROMPT_1_8A-CP1_schema_foundation.md` to Claude Code
3. If a third audit pass is wanted, hand this Change Verification doc + the updated files to a fresh instance with prompt: "Spot-check the 7 changes in the Change Verification doc. Flag any that weren't actually applied or were applied incorrectly. Don't re-audit the full package — trust the v2 baseline."
