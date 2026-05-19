# Phase 7P: Feed Polish
**Started:** TBD
**Last Updated:** April 22, 2026
**Status:** ✅ Complete
**Master Plan:** See FF_LAUNCH_MASTER_PLAN.md for full F&F context

---

## Goals

Pull two high-priority items from the Phase 7 backlog into a small focused bundle that ships before Phase 8 proper. The feed needs to perform correctly under tester load; pagination and the pull-to-refresh hang are the two gaps that would be visible to F&F testers day one if left unfixed.

**Why this is Phase 7P (and not part of Phase 7 or Phase 8):** Phase 7 closed 2026-04-17 with 42 items deferred. P7-44 (infinite scroll pagination) and P7-45 (pull-to-refresh hang) are the two items in the 🔴 High priority bucket — bundling them as a 1-2 session pre-Phase-8 polish pass is cleaner than re-opening Phase 7 or diluting Phase 8's pantry focus.

**Success criteria:**
- Feed loads more than 200 dishes via `onEndReached` pagination (current hard cap removed)
- Pull-to-refresh completes within ~1-2s on a populated feed (no ~15s hang)
- No regressions to the cook-post-centric feed model shipped in Phase 7I

---

## Prerequisites

- Phase 7 complete (shipped 2026-04-17)
- 7I cook-post-centric feed architecture in place
- 7M 5s stale-refetch threshold shipped (may have already resolved P7-45 — verify first)
- FeedScreen.tsx, feedGroupingService.ts, cookCardDataService.ts stable

---

## Scope

### Product Feature Roadmap Items Touched
| # | Feature | Action |
|---|---------|--------|
| 93 | Feed view | Polish — pagination + refresh performance |

### Feed infinite scroll / pagination (P7-44)

Current state: hard-capped at 200 dishes after 7F Fix Pass 7. No `onEndReached` handling.

Scope:
- Add `onEndReached` + `onEndReachedThreshold` to the feed FlatList
- Paginate `loadDishPosts` via `.range(offset, offset + limit - 1)` or cursor-style `.lt('cooked_at', cursor)`
- Maintain the visibility filter (D34 follower-graph rule) across paginated queries
- Loading indicator at the list footer during pagination fetches
- De-duplication across pages (defensive against overlap from concurrent cook post inserts)

Design approach (decided 2026-04-22, see Decisions Log):
- Cursor-based pagination on `(cooked_at, id)` tuple — stable under concurrent inserts, index-efficient at depth
- Page size 30 — industry-standard mobile social feed range; large enough to keep most cook-partner / meal-event clusters within a single page
- `buildFeedGroups` re-runs on the accumulated post set after each page load (option A); pull-to-refresh / logo tap / scroll-to-top resets to page 1

**Effort:** 1-1.5 sessions.

### Pull-to-refresh hang investigation (P7-45)

Current state: ~15s hang reported during Phase 7I testing. 7M introduced a 5s stale-refetch threshold which may have already resolved it — unclear without verification.

Scope (decided 2026-04-22):
1. Add inner timing logs inside `hydrateEngagement` for the 4 parallel queries (`computeHighlightsForFeedBatch`, `loadLikesForPosts`, `loadCommentsForPosts`, `loadParticipantsForPosts`). Outer phases already timed.
2. Tom runs single device test (populated feed, pull-to-refresh).
3. Interpret via decision tree:
   - Total `loadFeed` <3s → close P7-45 as resolved, skip fix
   - Total >3s, one phase dominant → targeted fix on that phase
   - Total >3s, no dominant phase → UI/gesture-class issue (FlatList render, main-thread blocking); separate fix prompt

**Effort:** 0.5-1 session (may be zero if already resolved).

### Resolution (2026-04-22)

Closed via Phase 7P-2 pagination. D7P-2 threshold met:
- Cold page-1 load: 2888ms (threshold: <3s) — PASS
- onEndReached pages 2-4: 1913-2967ms — PASS

Root cause was the 200-post batch size compounding `computeHighlightsForFeedBatch`'s per-post query cost (~2.6s cold on 200 posts). Pagination (30-post pages) cut the per-load batch to ~13% of original, reducing cold-path highlights cost ~7× without needing a service rewrite. Post-launch highlights RPC rewrite tracked as PL-H1 in DEFERRED_WORK.

The original 15s hang report from Phase 7I testing remains partially unexplained — worst cold measured in 7P-1 was 5.3s. Likely contributors to the gap: React StrictMode dev-mode double-invoke, network variance at time of original report, per-install cold-start overhead.

---

## Architecture

No architectural changes expected. Pagination is an additive change to FeedScreen + loadDishPosts. Hang investigation is diagnostic; any fix will be localized.

---

## Build Phases

| Sub-phase | Scope | Sessions | Status |
|-----------|-------|----------|--------|
| 7P-1 | P7-45 instrumentation + device test + fix if localized | 0.5-1 | 🔲 |
| 7P-2 | P7-44 pagination implementation | 1-1.5 | 🔲 |

**Estimated total:** 1-2 sessions (lower bound if P7-45 is already resolved).

Order rationale: verify P7-45 first because it's cheap to investigate and the answer determines how much session budget is left for pagination work. If P7-45 is resolved, P7-44 can absorb the full 1-2 session budget with room for polish.

---

## Decisions Log

| ID | Decision | Rationale |
|---|---|---|
| D7P-1 | P7-45 verification via instrumentation-first (option b), not repro-first | Single device session yields definitive root-cause signal. Outer phases already timed; `hydrateEngagement`'s 4 parallel queries are the only blind spot. |
| D7P-2 | P7-45 "resolved" threshold: total `loadFeed` <3s on populated feed | Covers original 15s hang and any intermediate sluggishness. Operational bar for closing the item. |
| D7P-3 | Pagination: cursor-based on `(cooked_at, id)` | Stable under concurrent inserts, index-efficient at depth. Tuple with `id` tiebreaker handles shared-millisecond `cooked_at` edge case. Offset rejected as fragile on chronological feed. |
| D7P-4 | Page size: 30 | Industry-standard mobile feed range (Strava 30, Twitter 20, Instagram 12). Large enough to keep most cook-partner / meal-event clusters within a single page, minimizing option A reshuffle. Small enough that per-page hydration stays snappy. |
| D7P-5 | Grouping: option A — re-group accumulated posts on each page load | `buildFeedGroups` re-runs on the full accumulated post set after every page. Accepts occasional solo→linked "upgrade" reshuffle mid-scroll as preferable to cross-page clusters silently failing to link. Page-size-30 choice mitigates frequency. |
| D7P-6 | Refresh model: pull-to-refresh / logo tap / `useScrollToTop` reset to page 1 | Full reload from top, discards accumulated pages. Matches user expectation of "fresh feed." Serves as escape hatch for any option A reshuffle artifacts. |
| D7P-7 | Scope discipline: no 7P expansion if P7-45 closes cleanly | Freed budget does not absorb P7-74 (`hydrateEngagement` perf) or pagination polish. Stays tight for Phase 8 kickoff. |
| D7P-8 | Skip `highlightsService` optimization in 7P; rely on pagination as primary cold-path mitigation | Cold `hydrate:highlights` = 2.6s on 200-post load (50% of total `loadFeed` time). Per-post `computeSoloAuthorSignal` query fires ~200 parallel queries; the service source flags a batched RPC / materialized view as the real fix. Pagination cuts the per-load batch to 30, giving ~7× cold-path improvement (extrapolated to ~390ms) without a service rewrite. Full rollup rewrite deferred to post-launch. See 2026-04-22 SESSION_LOG (third entry) for the 4-run timing data that informed this call. |

---

## Deferred Items

*Populated during execution.*

---

## Claude Code Prompts Issued

*Populated during execution.*

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-22 | Created during FF_LAUNCH_MASTER_PLAN v6.0 refresh. Scope: P7-44 (feed pagination) + P7-45 (pull-to-refresh hang). 1-2 sessions bundled as pre-Phase-8 polish pass. |
| 2026-04-22 | Decision pass during Phase 7P kickoff planning. Seven decisions logged (D7P-1 through D7P-7): P7-45 verification approach, resolved-threshold, pagination cursor strategy, page size 30, grouping option A, refresh model, scope discipline. P7-44 open questions resolved; P7-45 scope collapsed into instrumentation-first flow. |
| 2026-04-22 | D7P-8 added — skip highlights-service optimization in 7P; rely on P7-44 pagination as primary cold-path mitigation. Post-launch rewrite deferred (see DEFERRED_WORK.md). |
| 2026-04-22 | Phase 7P complete. 7P-1 shipped `console.log` timing instrumentation. 7P-2 shipped cursor-based pagination (page size 30, option A grouping, new-page-only hydration). P7-45 resolved per D7P-2 threshold; double-fire guard added post-test. PL-H1 (highlights RPC rewrite) bumped 🟢 → 🟡 in DEFERRED_WORK. New row added tracking orphaned `parent_meal_id` data-integrity issue surfaced in 7P-2 device test. |
