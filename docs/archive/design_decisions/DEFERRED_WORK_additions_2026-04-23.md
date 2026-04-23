# [DRAFT] DEFERRED_WORK.md — Phase 8 additions

> **⚠️ DRAFT — pending second audit review.** New rows to add to the existing `DEFERRED_WORK.md` backlog, surfaced during Phase 8 planning + first audit. Generated 2026-04-23. Do NOT add to repo before second audit pass.

**Target doc:** `DEFERRED_WORK.md` in repo (currently v5.4)
**Purpose:** Capture post-F&F items the audit surfaced. These aren't in-scope for Phase 8 execution but need to live on the backlog so they don't get lost.

---

## Rows to add

Add under a new section `## From: Phase 8 — Pantry Intelligence Planning (April 23, 2026)` placed **before the existing `## From: Phase 7 — Social & Feed Polish` section header** (locate by header text, not line number — rows get added above it over time). Phase 8 is next sequentially after Phase 7, so the new section belongs immediately before Phase 7's block, keeping the doc in reverse-chronological phase order.

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

### Tech Debt surfaced by Phase 8 planning

| # | Item | Type | Priority | Notes |
|---|------|------|----------|-------|
| P8-T1 | CLAUDE.md references `lib/theme.ts` as single file, but theme is a folder `lib/theme/` | 🔧 | 🟢 | Discovered during first audit of Phase 8 prompts. Low urgency — doesn't affect runtime, just doc accuracy. ~5 min fix. |
| P8-T2 | `P5-1 base_ingredient_id` audit pass (scheduled for 8D-CP1) may surface a larger data backfill need | 📊 | 🟡 | 8D-CP1 runs query-and-report; if gap is large (protein cuts, cheese dupes, salt variants per P5-1 deferred item), spawns separate data-backfill CC prompt. Track here so the potential scope doesn't vanish. |

---

## What NOT to add

These appeared during Phase 8 planning discussion but don't need DEFERRED_WORK rows:
- Receipt scanning → already in DEFERRED_WORK from prior planning
- AI pantry photo recognition → already in DEFERRED_WORK (moonshot bucket)
- NYT Cooking integration → already flagged in master plan v6.0 as post-launch top-of-queue
- Flex meal planning → already in Phase 9 scope
- Staples onboarding survey → Phase 12 (Distribution) per plan, not post-launch proper
- Recipe comments KB → already in master plan v6.0 deferrals

---

## Changelog row to add

At the top of DEFERRED_WORK.md's changelog:

| Date | Version | Change |
|------|---------|--------|
| 2026-04-23 | 5.5 | Phase 8 planning reconciliation. Added 11 post-F&F items surfaced during Phase 8 wireframe session + first audit (P8-1 through P8-11) and 2 tech debt items (P8-T1, P8-T2). Full accessibility audit deferred as P8-1; brand discovery UI scope consolidated as P8-2. |

---

## Audit instance instructions

1. Open current `DEFERRED_WORK.md`
2. Add a new section `## From: Phase 8 — Pantry Intelligence Planning (April 23, 2026)` **before the existing `## From: Phase 7 — Social & Feed Polish` section header**. Locate by section header text, not line number.
3. Add the 11 Open Action Items rows + 2 Tech Debt rows above
4. Add the changelog row at the top of the changelog
5. Verify: are any of these already in DEFERRED_WORK under a different number? If so, link/merge rather than duplicate. Flag duplicates in audit notes.
