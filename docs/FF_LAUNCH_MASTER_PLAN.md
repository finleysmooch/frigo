# Frigo — Friends & Family Launch Master Plan
**Created:** March 17, 2026
**Last Reconciled:** April 6, 2026
**Target Launch:** Early-to-mid June 2026 (revised from late May after April 6 scope reconciliation)
**Status:** Active — Phase 7 in progress

---

## Purpose

This document is the strategic plan for getting Frigo from Phase 4 completion to real users. It sits above the individual phase docs and provides the full picture: what we're building, in what order, and why.

**Read this first** to understand the F&F journey. Then read the specific phase doc for whatever is currently being built.

---

## Strategic Context

### Where We Are (April 2026)

Phases 5 (Ingredients) and 6 (Cooking Mode) complete. Phase 7 (Social & Feed) actively in progress. Sub-phases 7A through 7B-Rev shipped and tested; multi-dish posts, historical cook logging, linked posts, recipe sharing, and chef backfill remain.

The app has breadth: recipe extraction, social feed, meal planning, shared pantries, grocery lists, recipe browse with rich filtering, per-recipe nutrition, comprehensive cooking stats dashboard, full step-by-step cooking mode with timers, and a unified post-cook logging flow. Built on seeded test data (1,740 posts, 17 test users). No real usage yet. Runs on Expo Go only.

### What Needs to Happen

The app needs to go from "works on the developer's phone with test data" to "works reliably on friends' phones with real data." That means:
- Finish the social loop so it feels complete
- Overhaul pantry and grocery UX (single biggest weak spot today)
- Fix meal creation, calendar, and invitation flows
- Add nutrition depth (micronutrients, meal-level aggregation, source labeling)
- Polish the recipe system (extractors, cookbook view, cook soon, edit mode)
- Add concept cooking and ingredient substitutions as first-stab features
- Handle distribution mechanics (TestFlight, onboarding, privacy, invite codes)
- Add content (more cookbooks in the database)

### Key Decisions on Scope

**March 17 — Original expanded scope.** The original roadmap doc proposed a tight ~22-32 session plan targeting end of April. Tom expanded scope to include pantry intelligence, a first attempt at flexible meal planning, social depth improvements, and NYT Cooking exploration. Pushed timeline to mid-to-late May.

**April 6 — Post-Phase-7B reconciliation.** Tom reviewed pre-F&F scope notes against the master plan and surfaced gaps. Decisions made:
- Micronutrients (curated subset of 12) moved **into pre-launch scope** (was deferred)
- Meal-level nutrition moved **into pre-launch scope** (was deferred)
- Cookbook/book view UX update added to pre-launch scope
- Cook Soon queue UX update added to pre-launch scope
- Meal creation, calendar, and invitation UX added to pre-launch scope
- Concept cooking first-stab added to pre-launch scope (Phase 11)
- Ingredient substitutions v0 added to pre-launch scope (Phase 11, 1 session, same-type list)
- Edit Mode redesign added to pre-launch scope (Phase 11)
- Nutrition data source labeling added to pre-launch scope
- AI pantry photo recognition, grocery account integration, full micronutrient import → post-launch
- Linecook competitor diligence → action item, not a build phase

Net effect: ~10-18 additional sessions, ~3 weeks of slip. Tom accepted the slip in exchange for completeness.

### Session Budget

At 8-12 sessions/week, the original April 6 budget was 40-55 sessions. Reconciled estimate is **~55-70 sessions** from April 6 onward, putting target launch in **early-to-mid June**. Buffer for testing, bug fixes, and unforeseen issues built in.

---

## Phase Sequence

| Phase | Focus | Est. Sessions | Status |
|-------|-------|---------------|--------|
| **5** | Ingredient Architecture + Critical Fixes | — | ✅ Complete |
| **6** | Cooking Mode v2 | — | ✅ Complete |
| **7** | Social & Feed Polish | 12-18 | 🔄 In Progress |
| **8** | Pantry Intelligence + Pantry/Grocery UX Overhaul | 6-10 | 🔲 Pre-launch |
| **9** | Meal & Planning UX | 5-8 | 🔲 Pre-launch |
| **10** | Nutrition Depth | 4-6 | 🔲 Pre-launch |
| **11** | Recipe Polish | 6-10 | 🔲 Pre-launch |
| **12** | Distribution, Polish & Testing | 7-11 | 🔲 Pre-launch |
| **Parallel** | Tom photographs cookbooks for batch extraction | — | 🔲 Ongoing |

**Total remaining sessions (Phase 7 onward):** ~40-63

### Why This Order

**Phase 7 (Social) is current** because the social loop is the visible heart of the app and the post-cook flow is what ties together cooking, recipes, and stats. The remaining sub-phases (multi-dish posts, historical logging, linked posts, recipe sharing, chef backfill) round out the social experience F&F testers will actually use.

**Phase 8 (Pantry) next** because it's the most complex remaining domain and depends on Phase 5's ingredient architecture. The pantry/grocery UX is the single most-flagged weak spot in Tom's pre-F&F notes. Recipe-pantry matching ("what can I cook?") is a high-value F&F feature.

**Phase 9 (Meal & Planning UX) third** because meal flows are functional but rough — meal creation, calendar/week picker, and invitations all need UX passes. Flexible meal planning v1 (locked + shortlisted commitment levels) lands here because it depends on the meal creation flow being clean.

**Phase 10 (Nutrition Depth) fourth** because micronutrients and meal-level nutrition build directly on the per-recipe nutrition system from Phase 5. Dietary preferences capture also lands here since it feeds the nutrition + browse experiences.

**Phase 11 (Recipe Polish) fifth** because by this point all the dependent systems (ingredients, pantry, meals, nutrition) are stable and we can do the recipe system polish without rework. Edit mode redesign, concept cooking, ingredient substitutions, cookbook UX, cook soon UX, and extractor updates all consolidate here.

**Phase 12 (Distribution) last** because it's gated by content and feature stability. Onboarding flow includes historical cook entry as the immediate-value moment for new users. TestFlight build only happens once we're confident in the rest of the app.

---

## Phase Scope Definitions

### Phase 7: Social & Feed Polish 🔄

See `PHASE_7_SOCIAL_FEED.md` for full sub-phase detail. **Phase 7D was reframed and split April 7 — see decisions D21–D31 in the phase doc and `_SCOPING_NOTES_7D.md` for the reasoning.** Summary:

- **7A** ✅ — Bug fixes (P6-4 PostCookFlow data gap, P6-5 notes/modifications duplication)
- **7B** ✅ — Overflow menu redesign, LogCookSheet unified component, feed visibility filter
- **7B-Rev** ✅ — Polish pass: half-star slide-to-rate (teal), keyboard handling, CTA flip, edit mode banner, delete fix, step notes display, PencilIcon, TimesMadeModal redesign
- **7C** ✅ — Meal Plan "Create new meal" wiring fix
- **7D** 🔲 — **Multi-cook & meal experience: Data + service layer.** Audit existing meal flows. Add `external_name` to `post_participants`. Add nullable `recipe_id` + `dish_name` for freeform dishes. Add `meal_dish_plans` ↔ logged meal post link. Verify meal post visibility filter. Document Option γ wrap helper for dish→meal conversion. Migration spec for Tom to run. (1-2 sessions)
- **7E** 🔲 — **Multi-cook & meal experience: Cook-logging → meal handoff UX.** LogCookSheet meal-attach affordance. Strava-style enrichment prompt. Smart planned-meal detection. "Made other dishes too?" follow-up. "Make this part of a meal" overflow item. Wire AddCookingPartnersModal to LogCookSheet. v1 publishing model: drafted-not-published. (2-3 sessions)
- **7F** 🔲 — **Multi-cook & meal experience: Feed rendering + post detail.** New MealPostCard. Highlight photo model. Render `meal_photos`. Tappable dish navigation (basic — discovery preview deferred to PHASE_RECIPE_DISCOVERY). Contextual visibility defaults applied. (1-2 sessions)
- **7G** 🔲 — Historical cook logging with dates (`posts.cooked_at`, date picker, per-cook history) — was 7E
- **7H** 🔲 — My Posts in You tab — was 7F
- **7I** 🔲 — Linked/grouped posts wiring (`LinkedPostsGroup` + `feedGroupingService`) — was 7G. **Note:** This is for the same-recipe-different-cooks case, NOT multi-dish meals which are handled by 7D-7F.
- **7J** 🔲 — Recipe sharing (external share sheet) — was 7H
- **7K** 🔲 — Chef name backfill + auto-association on extraction — was 7I
- **7L** 🔲 — Small fixes (post privacy defaults, MealPostCard dish press handler, cooking methods) — was 7J

**Estimated total: 14-21 sessions** (was 13-19 before the 7D split).

### Phase 8: Pantry Intelligence + Pantry/Grocery UX Overhaul 🔲

- Pantry UX overhaul — expiration visibility, organization, item entry friction
- Grocery UX overhaul — list management, item flow, store integration (basic)
- Recipe-pantry matching ("what can I cook?") — UI surface, matching strictness, staple handling
- Missing-ingredients-to-grocery flow
- Low stock indicators (#31)
- Pantry rethink: fraction display, "Add missing to Grocery List" treatment (carry-over from P6-6, P6-7)

**Estimated:** 6-10 sessions.

### Phase 9: Meal & Planning UX 🔲

- Meal creation UX update — review and rebuild flow
- Meal calendar + week picker UX update
- Meal invitations QA + UX update
- Flexible meal planning v1 — locked + shortlisted commitment levels (per `CONCEPT_FLEXIBLE_MEAL_PLANNING.md`)
- Multi-user vision: handoff between cooking partners

**Estimated:** 5-8 sessions.

### Phase 10: Nutrition Depth 🔲

- **Micronutrients (curated subset of 12):** Vitamin A, Vitamin C, Vitamin D, Vitamin B12, Folate, Iron, Calcium, Potassium, Magnesium, Zinc, Sodium, Fiber. Import from USDA FDC. Backfill existing recipes via extraction pipeline. Add to StatsNutrition with daily-value reference.
- **Meal-level nutrition:** Aggregate dish nutrition across all dishes in a meal post. Display on MealDetailScreen.
- **Nutrition data source labeling:** All nutrition surfaces tagged with source (USDA, estimated, user-entered) and "guidelines, directionally correct" disclaimer.
- **Dietary preferences capture:** Onboarding-driven user dietary preferences (#20). Feeds browse filters and stats.

**Estimated:** 4-6 sessions.

### Phase 11: Recipe Polish 🔲

- **Recipe-from-photo extractor update** — match latest recipe format
- **Recipe-from-URL extractor update** — same
- **Cookbook / book view UX update** — review and rebuild
- **Cook Soon queue UX update** — review and rebuild
- **Concept cooking first-stab** — cook without a specific recipe; optional AI guidance for the concept (e.g. "I'm making a stir fry, walk me through it")
- **Ingredient substitutions v0** — click ingredient → see list of similar ingredients from same `ingredient_type` (1 session, no smart matching yet)
- **Edit Mode redesign** — notebook aesthetic, structural ingredient editing (separate quantity vs ingredient), drag handles for sections, "or" substitution syntax, clear edit mode indicator + exit button (already added in 7B-Rev as minimum viable)

**Estimated:** 6-10 sessions.

### Phase 12: Distribution, Polish & Testing 🔲

- **Onboarding flow** — welcome → invite code → signup → profile → permissions, with **historical cook entry** as the immediate-value moment (let users log recipes they already know they love before they post their first cook)
- **Privacy policy + account deletion** — for App Store compliance
- **Invite codes / referral tracking** — open signup + admin approval model, per-user shareable codes for organic spread (target 100-200 testers)
- **EAS / TestFlight build setup** — Apple Developer Account, provisioning, first build
- **Personal daily-use testing** → inner circle → broader F&F (2 weeks of testing)
- **Bug fix buffer** for issues found during testing
- **Decision: TestFlight vs direct App Store** — pending, leaning TestFlight for the F&F window

**Estimated:** 7-11 sessions.

---

## Scope Decisions

### In Scope for F&F (Pre-Launch)

**Recipe System**
- Recipe-from-photo extractor update (Phase 11)
- Recipe-from-URL extractor update (Phase 11)
- Cookbook / book view UX update (Phase 11)
- Cook Soon queue UX update (Phase 11)
- Edit Mode redesign (Phase 11)
- Concept cooking first-stab (Phase 11)
- Ingredient substitutions v0 (Phase 11)
- NYT Cooking — at minimum scope the integration effort, possibly build (timing TBD)
- Cookbook content — 5-10 more books via batch extraction (parallel)

**Social & Feed**
- Multi-dish posts, historical cook logging, linked posts wiring, recipe sharing, chef backfill, My Posts toggle, post privacy defaults (Phase 7)

**Meals & Planning**
- Meal creation UX update (Phase 9)
- Meal calendar + week picker UX update (Phase 9)
- Meal invitation QA + UX update (Phase 9)
- Flexible meal planning v1 (Phase 9)

**Pantry & Grocery**
- Pantry UX overhaul (Phase 8)
- Grocery UX overhaul (Phase 8)
- Recipe-pantry matching (Phase 8)
- Missing-to-grocery flow (Phase 8)
- Low stock indicators (Phase 8)

**Nutrition & Stats**
- Micronutrients curated subset (Phase 10)
- Meal-level nutrition (Phase 10)
- Nutrition data source labeling (Phase 10)
- Dietary preferences capture (Phase 10)

**Distribution**
- Onboarding (with historical cook entry) (Phase 12)
- Privacy policy, account deletion (Phase 12)
- Invite codes + referral tracking (Phase 12)
- EAS/TestFlight (Phase 12)

### Deferred to Post-F&F

- AI pantry photo recognition (onboarding moonshot)
- Grocery account integration to populate pantry
- Full micronutrient import (beyond curated 12)
- Public website (donation page, app description)
- Offline cooking mode
- Voice-to-text / talk-to-text
- Recipe comments (knowledge base system)
- Algorithmic feed
- Web version
- Social login (Google/Apple)
- Receipt scanning
- Flavor profiles
- Technique tagging
- Wearable integration
- Monetization / payment infrastructure (ship free for F&F)
- Full GDPR compliance
- Block/report users
- Data export
- Smart ingredient substitutions (beyond v0 same-type list)
- Concept cooking depth (beyond first-stab)
- Recipe annotations beyond current state
- Linecook competitor diligence (action item, not a build phase — schedule separately)

---

## Design Decisions Still Needed

| Decision | Phase | Notes |
|----------|-------|-------|
| Multi-dish post data model details | 7 | `post_dishes` junction table schema, dish ordering, photo ownership |
| Historical cook date picker UX | 7 | Calendar vs scroll picker; per-cook entries vs single backdated post |
| Pantry UX specifics | 8 | Define during phase planning |
| Grocery UX specifics | 8 | Define during phase planning |
| Recipe-pantry matching design | 8 | UI location, matching strictness, staple handling |
| Meal creation flow rebuild | 9 | What stays, what goes, how invitations integrate |
| Flex meal planning UX | 9 | Locked + shortlisted confirmed; surfacing TBD |
| Micronutrient daily value display | 10 | Bar chart vs pill list; daily progress vs weekly average |
| Concept cooking guidance flow | 11 | AI prompt design; how it integrates with cooking mode |
| Edit Mode notebook aesthetic | 11 | Spiral binding vs lined paper; inline structural editing approach |
| Onboarding flow steps | 12 | Minimum: welcome → invite code → signup → profile → permissions → historical cooks |
| Invite system design | 12 | Open signup + admin approval; per-user referral codes |
| TestFlight vs direct App Store | 12 | Currently leaning TestFlight |

---

## Tom's Annotations (Pre-F&F Notes Reconciliation, April 6)

Key inputs from Tom's pre-launch readiness notes that shaped the April 6 reconciliation:

- **Post creation:** "actively working on" — confirmed Phase 7 current scope.
- **NYT integration:** "would be awesome if we could get that shipped at or soon after F&F launch."
- **Concept cooking:** "lots of f&f value this highly" — pulled into Phase 11.
- **Ingredient substitutions:** "would be good to have pre f&f or soon after — even if it's first stab" — v0 added to Phase 11 with 1-session scope.
- **Pantry & grocery:** "feel like all the stuff in pantry and grocery should be addressed pre-launch" — confirmed Phase 8 priority.
- **Nutrition source labeling:** "should all be tagged saying where the stats are coming from and that they should be currently viewed as guidelines and directionally correct" — added to Phase 10.
- **Micronutrients:** "would be good to add pre-launch" — added to Phase 10 (curated subset of 12).
- **Meal-level nutrition:** "feels like it should be easy if we have recipe level" — added to Phase 10.
- **Dietary preferences in onboarding:** "would also be good to incorporate pre-launch" — folded into Phase 10.
- **F&F scale:** "send this F&F round out to lots of my contacts — maybe 100-200 and then allow them to share it with friends and allow / promote it to spread organically" — drives Phase 12 invite/referral design.
- **Onboarding signup model:** "I think i like open signup + admin approval — would be good to also know / document how user heard about app (could we provide users with their own unique codes to share with people so that spread of app use could be traced?)" — confirmed Phase 12 approach.
- **Onboarding historical cook entry:** "Add historical cooking to give users immediate value of identifying recipes they like to cook" — Phase 12 onboarding includes this. Depends on Phase 7E (historical cook logging) being shipped first.
- **Linecook competitor:** "first authentic competitor on market or close to" — added as action item, not a build task.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Phase 7 sub-phases stretch (now 13 sub-phases after 7D split into 7D/7E/7F) | Phase 7 stays open 4-5 weeks | Tom accepted single-phase framing for thematic clarity. Sub-phase status tracked in Phase 7 doc. April 7 reframing grew estimate from 13-19 to 14-21 sessions, but the new scope is more honest about the work that was always needed — the original 7D estimate was too small. |
| 7D scope drift toward "rebuild meals" instead of "fix the gaps" | Eats Phase 9 budget | Scope discipline locked in D30 + Tom-Claude agreement: bar for adding to 7D is "required for cook→meal handoff to feel coherent OR a small fix we'd be embarrassed to ship without." Anything else goes to Phase 9. Re-check at each wireframe pass. |
| Pantry/grocery UX overhaul scope creep | Phase 8 doubles in size | Define UX changes during phase planning, not during build. |
| Phase 9 meal flows are bigger than estimated | Eats Phase 10/11 buffer | Scope each meal flow rebuild as a separate sub-phase with its own session estimate. |
| Micronutrient data source quality | Stats look wrong, undermines trust | Source label disclaimer (Phase 10) addresses partially. Use USDA FDC primary, fall back gracefully. |
| Edit Mode redesign is bigger than estimated (Phase 11) | Pushes Phase 12 | 3-5 sessions estimated; if it grows past that, ship the minimum viable banner from 7B-Rev and defer the notebook aesthetic to post-launch. |
| EAS/TestFlight snags on first attempt | Delays distribution by days-weeks | Start Apple Developer Account setup early. Buffer in Phase 12. |
| Testing reveals significant issues | Consumes Phase 12 buffer | 2-week testing window. Prioritize ruthlessly — fix blockers, defer polish. |
| NYT Cooking integration is infeasible | Wasted sessions | Scope-first approach: 1 session to investigate before committing to build. |
| Linecook competitor reshapes positioning | Strategic pivot risk | Schedule diligence task separately from build phases; revisit positioning if needed. |

---

## Working Agreements

- **This plan is adaptive, not fixed.** Phase scope, ordering, and session estimates will evolve as we learn. When scope changes, update the affected phase doc, this master plan, and PROJECT_CONTEXT immediately.
- **Track feature roadmap numbers.** Each phase doc lists the Product Feature Roadmap item numbers it touches. When features ship, move, or get deferred, update both the phase doc and DEFERRED_WORK.md.
- **Deferred items live in the active phase doc until phase completion.** At phase completion, items are reconciled into DEFERRED_WORK.md.
- **Phase docs are self-contained.** A new Claude instance reads PROJECT_CONTEXT → this doc → the active phase doc.
- **Services handle ALL Supabase calls.** Components never call the database directly.
- **Never remove existing functionality** unless explicitly instructed.
- **Cookbook loading happens in parallel.** Tom photographs books; extraction runs alongside other work.
- **Design decisions happen in phase planning sessions,** not during Claude Code execution.
- **Apple Developer Account signup should happen during Phase 11** at the latest — it takes 24-48h to approve.
- **Feature playbooks** (per `docs/playbooks/`) are created or updated whenever a feature accumulates ≥2 design iterations or significant testing feedback. See `DOC_MAINTENANCE_PROCESS.md`.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-07 | **Phase 7D scoping reframing.** 7C marked done. 7D split into three sub-phases (7D data + service / 7E cook→meal handoff / 7F feed rendering) after April 7 scoping session discovered the existing meal model already implements multi-dish multi-cook meals. D12 retired as D21 in PHASE_7_SOCIAL_FEED.md. Old 7E–7J renumbered to 7G–7L. Phase 7 estimate grew from 13-19 to 14-21 sessions. Risk register updated with scope-discipline note (D30 commitment to push meal-rebuild work to Phase 9). New companion doc `_SCOPING_NOTES_7D.md` captures the raw conversation findings and reasoning chain. New stub `PHASE_RECIPE_DISCOVERY.md` for the dish-tap recipe discovery feature surfaced during scoping. |
| 2026-03-17 | Created. Established phase sequence (5-8), scope decisions, timeline, risk register. Based on Roadmap Decision Document + Tom's annotations + planning session. |
| 2026-04-06 | **Major reconciliation.** Phases 5 and 6 marked complete. Phase 7 marked in progress with 11 sub-phases (7A through 7J). Added Phases 9 (Meal & Planning UX), 10 (Nutrition Depth), 11 (Recipe Polish) based on Tom's pre-F&F notes. Renamed Phase 8 from "Pantry Intelligence" to "Pantry Intelligence + Pantry/Grocery UX Overhaul" to reflect scope. Renamed final phase to Phase 12 (Distribution). Added Tom's annotations from April 6 reconciliation. Pulled into pre-launch scope: micronutrients (curated subset of 12), meal-level nutrition, nutrition data source labeling, dietary preferences capture, cookbook UX, cook soon UX, meal flows, concept cooking first-stab, ingredient substitutions v0, Edit Mode redesign. Target launch revised from late May to early-to-mid June. |