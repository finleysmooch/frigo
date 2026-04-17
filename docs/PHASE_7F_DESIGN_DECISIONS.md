# Phase 7F Design Decisions
**Wireframe Session:** 2026-04-09
**Status:** Locked, ready for build
**Companion artifact:** `frigo_phase_7f_wireframes.html` (6 passes, 60+ states)
**Build prompt:** `CC_PROMPT_7F.md`

---

## Purpose of this doc

This document captures every design decision made during the Phase 7F wireframe session, the reasoning behind each one, the alternates considered, and the deferred work items the session surfaced. It is the canonical reference for "what was decided and why" for 7F build, and the source of truth for which design questions are still open.

Read this AFTER `PHASE_7_SOCIAL_FEED.md` for context. The phase doc contains the broader Phase 7 plan; this doc contains 7F-specific design rationale and the new decisions D41–D46 that came out of the wireframe session.

---

## Session arc — what we converged on

The session ran six wireframe passes. Roughly:

- **Pass 1** drew baseline feed cards (solo + meal variants, photoless, dish peek options, badge approaches) and a first-stab detail card. Established the "Strava-inspired but Frigo-distinct" framing.
- **Pass 2** added feed grouping previews, standalone-dish-with-meal-context byline variants, refined detail with two-comment sections, eater rating UI, and viewer badges. Surfaced major architectural questions (M1/M2/M3, eater ratings, comment attribution).
- **Pass 3** pivoted to "philosophy (c)" — hybrid stats with qualitative slot — after Strava observations reshaped the framing. Added Strava-style grouped meal pattern. Achievements collapsed to medal stat slot.
- **Pass 4** course-corrected on achievements (back to sentence pills per D2 style). Added cooked-vs-ate byline. Two-section detail card.
- **Pass 5** refined to "Highlights" slot in stat row, conditional vibe pill, full-width cards, two-level photo model, indented sub-cards in grouped meals.
- **Pass 6** locked the baseline. Highlights pill width fix. Recipe-vs-freeform color distinction in dish peek. Detail card section reorder. Pill row compaction.

The locked Pass 6 baseline is what 7F builds. Everything else is either deferred or retired.

---

## New decisions (D41–D46)

These are new decisions that came out of the wireframe session. They extend or refine earlier Phase 7 decisions and need to be added to `PHASE_7_SOCIAL_FEED.md` decisions log.

### D41 — Comment attribution: dual-attached, context-determined

**Decision:** Comments can attach to either the meal post directly OR a specific dish post, depending on where the user is when they comment. The comment list UI labels each comment with which one it belongs to ("on this meal" / "on Lima beans"). Default attachment is determined by entry point — tapping comment from the meal card defaults to commenting on the meal post; tapping comment from a dish row defaults to that dish.

**Rationale:** D28 originally said engagement attaches to dishes only and meal cards aggregate. This was too restrictive. Real conversations split naturally — some are about the event ("incredible night, the spread was unreal"), some are about a specific dish ("@Tom what kind of feta did you use?"). Forcing all comments through dishes loses the meal-as-event conversation surface.

**Alternates considered:**
- Strict D28 — comments only attach to dishes. Rejected: loses meal-event conversations.
- Comments only attach to meals — reject: loses dish-specific feedback like recipe questions.
- Free choice at compose time — rejected as too much friction; default determined by entry point is cleaner.

**Implementation:** The `posts` table already supports comments on any row (meal posts and dish posts both have `id`s comments can attach to via the existing comments table). No schema change required. Build work is in the comment composer UI (default attachment + override option) and the detail card render (two distinct comment sections).

**Refines:** D28 (which stays as the dish-engagement default but is no longer the only attachment path).

---

### D42-refined — Notification scope: rolled-up at meal level, individual at dish level, @-mention always direct, thread subscription on comment

**Decision:** Comment notifications follow a tiered model:
- **Meal-level comments** notify all meal participants but in a **rolled-up batched** form. If three people comment on Sunday potluck, the host gets one notification: "3 new comments on Sunday potluck." Volume is compressed at the meal level because meal-level comment volume can be high (10+ on a notable event).
- **Dish-level comments** notify the dish creator individually, per comment. Dish comment volume is typically low (0–3 per dish), so per-comment notifications are fine.
- **@-mentions** always ping the mentioned user directly, regardless of comment scope or batching. Implemented via `@username` parsing in the comment composer.
- **Thread subscription** (Strava model): once you comment on a thread (meal-level or dish-level), you receive notifications for subsequent comments in that thread. Subscription is implicit on first comment, with an option to mute later. Meal-level threads use the rolled-up notification format; dish-level threads use individual notifications.

**Rationale:** Tom's intuition that meal-level events deserve compression while dish-level events deserve individual attention matches the natural volume profile of each. Strava's "subscribe on comment" pattern is a well-known good for keeping conversations alive without overwhelming participants.

**Alternates considered:**
- All comments individual: rejected, would create notification spam on popular meals.
- All comments rolled up: rejected, would bury dish-specific feedback the cook actually wants.
- @-mentions don't ping: rejected, would defeat the @-mention purpose.

**Implementation:**
- Schema work: a `comment_thread_subscriptions` table or equivalent to track who's subscribed to which post's comment thread.
- Notification batching logic: aggregate meal-level comments into a single notification within a time window (e.g. 30 min) per recipient.
- @-mention parsing in the comment composer: tokenize `@` followed by a username, validate against followed users, render as a styled span, ping the user on submit.

**Build status:** Architecture documented for 7F. Actual notification system build is **DEFERRED** to a separate notifications/comments sub-phase. 7F builds the comment attachment model (D41) but not the notification logic.

---

### D43 — Eater ratings: schema, privacy, orthogonality

**Decision:** Eater ratings exist as a feature where users who ate at a meal but didn't cook a dish can rate dishes they ate. The feature has three locked properties:

1. **Schema (option α):** `rating numeric(3,1)` and `notes text` columns added to the `post_participants` table. Eater ratings are properties of the participation row (the row that says "Alex ate this dish"), not separate posts or a new reaction table. Cleanest data model — Alex's relationship to that dish is "I ate it," and a rating is a property of that relationship.

2. **Privacy (option ζ):** Eater ratings are **private to the eater**. Cooks never see them. Not even in aggregate. Aggregate dish ratings shown in the app are computed from cook-side ratings only, not eater ratings. The eater's own profile/stats shows their eater ratings; the cook's surfaces never do.

3. **Orthogonal to yas chefs:** Eater ratings and yas chefs are two different signals serving two different audiences. Yas chef = public, performative, generous social signal directed at the cook. Eater rating = private, honest, calibrated personal memory signal directed at the eater themselves. A user can yas-chef AND rate, just yas-chef, just rate, or neither. The two signals coexist because they have different jobs.

**Rationale (the social-pressure failure mode):** Friend-graph rating systems are vulnerable to a structural failure mode where guests feel obligated to perform positive feedback because the cook is their friend who fed them. Ratings drift toward the social mean, the data becomes worthless, and the failure is irreversible — you can't roll back trust once it's broken. By making eater ratings completely private to the eater, we eliminate the social pressure entirely. The cost is that cooks lose a feedback mechanism, but the yas chef signal still serves that purpose (performatively, optimistically). The two signals split the work: yas chef serves the cook, eater rating serves the eater.

**Privacy reminder pattern (locked from F1ec compare):**
- **β · First-time educational banner.** When a user enters the eater rating page for the first time, a teal banner explains the privacy model with a "Got it" button. After dismissal, the banner is gone.
- **Re-show on lapse.** If a user hasn't used the eater rating feature for 60+ days, the banner pops back on next entry. Tracked via `last_eater_rating_used_at` per user.
- **Info icon backup.** A small info button in the rating section title shows the privacy explanation in a popover, always available.

**Alternates considered:**
- (γ) Strict private: rejected — too restrictive, kills the secondary use case.
- (δ) Aggregate-only to cook: rejected — still has social pressure since eater knows aggregate will be visible.
- (ε) Yelp-style named to cook: rejected — maximum social pressure, worst version for friend-graph cooking.
- Schema option β (separate reaction table): rejected — α is cleaner, treats ratings as a property of participation.

**Implementation requires:**
- `ALTER TABLE post_participants ADD COLUMN rating numeric(3,1) NULL, notes text NULL`
- New service functions for setting/reading eater ratings with privacy enforcement
- New UI surfaces (the eater rating page itself, the "Things I've eaten" history page in profile)
- Privacy enforcement in queries — eater ratings must NEVER be returned in any query that surfaces them to the cook

**Build status:** **DEFERRED.** Wireframed but not built in 7F. Lives in a future eater-ratings sub-phase. Schema work + service work + UI work + privacy enforcement is meaningful and needs its own scope. The wireframe (states F1e+ and F1ec in the artifact) is the visual target.

---

### D44 — M3 architecture: deferred, target locked

**Decision:** The M3 model — where each meal participant has their own owned post for the meal — is the eventual target architecture for multi-cook meal rendering. 7F ships **M1** (status quo: one meal post owned by creator, others appear via `meal_participants` join). 7F's K-family cards (K1rrr–K5rrr) all assume M1.

The G4rr-b grouped meal pattern (Strava-style meal-summary header + indented contributor sub-cards) is the **visual target** for M3 but is NOT built in 7F. It's locked as the design that 7I (expanded scope) or Phase 9 will build TOWARD.

**Why M1 in 7F:**
- M3 requires schema verification (not all dish ownership is consistently structured today) + service layer changes + a new GroupedMealCard component
- Adding M3 to 7F would expand scope by 30–40% and create a multi-week build with high failure risk
- Right sequencing: ship the unified card pattern first, react to it on real devices with F&F testers, THEN expand to the grouped case armed with that feedback

**Why G4rr-b is the locked target (not retired):**
- The Strava-style grouped pattern is the right answer when M3 lands. We confirmed this through 6 wireframe passes and direct comparison against Strava screenshots.
- Locking it now means 7I/Phase 9 doesn't need to re-wireframe — the visual brief is already done.

**Where G4rr-b will be built:** **Phase 7I scope expanded.** 7I was originally scoped as "wire `LinkedPostsGroup` + `feedGroupingService` into FeedScreen for the same-recipe-different-cooks case." This scope is now expanded to include G4rr-b implementation: schema audit for dish ownership, service layer changes for grouped feed queries, and a new `GroupedMealCard` component. Phase 7I session estimate grows from 1–2 sessions to **3–5 sessions**. Add to deferred work and update phase doc.

**Alternates considered for G4 layout:**
- G4 (pass 2) — Tom's contribution as the primary card: rejected — privileges host inappropriately
- G4r (pass 4) — meal post as full card with contributor cards at same indent level: rejected — visual hierarchy unclear
- G4rr-a (pass 5) — meal-summary header + strong "Contributors" divider + indented sub-cards: rejected — too explicit, breaks Strava-faithful flow
- **G4rr-b (pass 5) — meal-summary header + soft transition + indented sub-cards: LOCKED** ✓

**Photo model in the grouped pattern (per D46):**
- Meal-summary header shows MEAL photos (from `meal_photos` bucket — multi-uploader, anyone at the meal can contribute)
- Contributor sub-cards are mostly photoless because most cooks photograph the table, not their individual plates
- Sub-cards with dish photos render only when the cook explicitly tagged a photo as a dish photo

**Engagement attribution in the grouped pattern (per D41):**
- Meal-summary header has its own engagement row + action row (per Q38-confirm — meal is a fully interactive surface)
- Each contributor sub-card has its own engagement row + actions, scoped to that contribution
- Two interactive surfaces in the same group, each clearly attributed
- "Started by Tom" footnote on the meal-summary acknowledges ownership without making Tom the headline (per Q33 c)

---

### D45 — Cooked-vs-ate byline split

**Decision:** Multi-cook meal cards distinguish cooks from eaters in the byline. The header text reads "Cooked by Tom, Nick & Mary" with a sub-line "with Alex & Sara · Apr 5 · Sunday potluck." The avatar stack in the header shows **only cooks** (host + sous chef roles). Eaters (`role='ate_with'`) appear in the sub-line text but not in the avatar stack.

**Rationale:** The data model already distinguishes `host`/`sous_chef`/`ate_with` roles on `post_participants`. Pre-7F card rendering flattened the distinction, treating all participants identically. Cooking and eating are different acts with different social signals — cooks deserve cooking credit, eaters deserve presence credit, but they shouldn't be conflated.

**Alternates considered:**
- Flatten all participants together (current behavior): rejected — loses meaningful distinction
- Show eaters as smaller avatars in a secondary stack: rejected — too visually busy
- Show only host in header, list everyone in detail: rejected — undersells multi-cook contribution

**Implementation:** `MealPostCard` and `PostCard` need to query `post_participants` filtered by role and render the byline accordingly. The cook count and eater count both inform the stat row (e.g. "Cooks · 3" stat). External guests render as initials circles with dashed borders (per D27/D37).

**Visibility interaction with D34:** The follow-graph filtering rule from D34 still applies — viewers only see participants they follow (or the host on Everyone-visible posts per the two-layer rule from session Q3/Q11). The cook/eat split applies AFTER the visibility filter. If only Mary is visible to a viewer and Mary cooked a dish at this meal, the byline shows "Mary" in the cook position even if other cooks were present but not visible.

---

### D46 — Two-level photo model

**Decision:** Photos in meal contexts split into two buckets based on intent:

- **Meal photos** (`meal_photos` table — already exists): photos of the table, the spread, the room, group shots — anything that captures the meal as a whole event. Multi-uploader: anyone present at the meal can contribute. These render in the meal-summary header in grouped meal renders, and as the "highlight photos" in single-meal-card renders (when the meal has no dish-specific photos).
- **Dish photos** (`posts.photos` JSONB — already exists per dish post): photos of specific dishes. Render in solo dish posts and on contributor sub-cards in grouped meal renders (when the cook tagged the photo as dish-specific).

**The default rule:** When a user uploads a photo via LogCookSheet for a meal-attached cook, the photo goes to **the meal_photos bucket by default**. The user can explicitly tag a photo as a dish photo via a per-photo "this is a photo of the dish" toggle. Most cook-time photos are table/spread shots, not individual plate portraits — the default reflects this reality and puts the burden on the few users who actually photograph specific dishes.

**Relationship to D24:** D46 clarifies D24, doesn't contradict it. D24 said "photos belong to the post; one is designated the highlight." D46 establishes that there are TWO scopes of "post" in a meal context — the meal post itself and each dish post — and each has its own photo collection with its own highlight. They don't compete because they live in different buckets.

**Alternates considered:**
- All photos to dish post (current behavior): rejected — most photos are meal-level
- All photos to meal_photos (with dish-specific override): the lock — meal-default with explicit dish tagging
- Toggle at upload time (i/ii/iii from session Q39b): rejected — adds friction, the (ii) meal-default rule is the right balance

**Implementation:**
- LogCookSheet photo picker needs a per-photo "dish photo" checkbox
- When meal context is present, default photo target is `meal_photos` table
- When no meal context (solo dish post), photos go to `posts.photos` as before
- Render rules: meal-summary surfaces show meal photos, dish posts (and contributor sub-cards) show their own dish-tagged photos

**Build status:** The DATA model is already in place (`meal_photos` table exists, `posts.photos` JSONB exists). The render rules can be implemented in 7F partially — the K-family cards in 7F are single-meal-card renders, so the "show meal photos in the highlight photo position" rule applies when the meal has meal_photos but no dish photos. The full grouped-meal photo separation (meal photos in header, dish photos in sub-cards) lands with G4rr-b in 7I.

The dish-photo tagging UI in LogCookSheet is **DEFERRED** to a small follow-up (probably 7L or part of 7I scope) — for 7F, all photos uploaded via LogCookSheet continue to go to the dish post (current behavior), but the design doc establishes that the eventual default is meal-bucket-by-default.

---

## Earlier decisions reaffirmed or refined

### D24 reaffirmed and clarified by D46

The highlight photo model from D24 holds. D46 clarifies it for the multi-bucket case.

### D28 refined by D41

D28's "engagement attaches to dishes" rule is now the DEFAULT but no longer the ONLY rule. D41 allows meal-level comments and likes to attach to the meal post directly. The detail card surfaces both kinds with explicit attribution.

### D34 unchanged

The global Followers default + contextual rules visibility model from D34 is unchanged. The two-layer host visibility rule (host always visible on Everyone-visible posts, follow-graph-filtered on Followers-visible posts) was confirmed during session Q11.

---

## Philosophy (c): the design framing

A meta-decision that doesn't have a D-number but informs everything else.

**Decision:** Frigo's feed cards follow "philosophy (c)" — a hybrid of quantitative stats and qualitative context. NOT pure Strava-strict (philosophy α) where everything is a number. NOT the pass 2 contextual approach (philosophy β) which mixes stats but has no qualitative slot. Instead: 3 quantitative stats + 1 qualitative slot (the Highlights pill) + 1 optional qualitative pill row (vibe).

**Rationale:** Frigo is "Strava for cooking" but cooking is not just measurable effort — it's also about the food's character and the social experience. Pure quantification flattens the experience. But going fully experiential/mood-led abandons the scannable card density that Strava does well. The hybrid keeps cards scannable while leaving room for qualitative texture.

**The Highlights slot is the key innovation.** It lives in the stat row as a 4th compact slot (not a separate row like sentence-pill achievements), and its content can be either an author achievement ("First potluck") or a viewer recommendation ("73% in your pantry"). The system picks ONE most-relevant signal per card. The detail card has room to show the full list with author/viewer separation per D43/ζ.

**The vibe pill is the secondary qualitative slot.** Lives below the stats as its own pill row, conditional render (most cards have no vibe pill — only renders when the recipe or meal has a strong primary vibe tag). In 7F it's static (same vibe shown to every viewer); personalized selection (Reading 2 — viewer-relevance-driven selection from the meal's vibe tags) is documented as deferred work pending a viewer-taste-profile model that doesn't exist yet.

---

## Locked design specifications for 7F build

This section is the source of truth for what 7F's MealPostCard, PostCard, and detail card actually look like. The build prompt references this section.

### Feed card chrome (shared across solo and meal cards)

- **Full width edge-to-edge.** No horizontal margin around the card. Horizontal padding lives inside the card.
- **Header.** Avatar (single for solo, stack of up to 3 for meals) + title text + meta line. Three-dot menu on the right.
- **Title.** Large bold text below the header.
- **Description line** (NEW — `posts.description` field rendered as a paragraph below the title). Optional — only renders if description is set.
- **Recipe line** (solo cards) or **dish peek** (meal cards). Recipe-vs-freeform color distinction in dish peek.
- **Hero photo.** 4:3 aspect ratio, single photo or horizontal scroll carousel. Photoless cards omit this section entirely.
- **Stats row.** 2–3 quantitative stats + optional Highlights pill in 4th slot. Stats are: cook time, rating, dish count, cooks count, total time (varies by card type).
- **Vibe pill row.** Conditional. Renders when the recipe/meal has a primary vibe tag (static selection in 7F).
- **Engagement row.** Liker avatars + "X gave yas chef" + comment count.
- **Action row.** Like / Comment / Share buttons.

### Solo dish card (PostCard refresh)

- Header: single avatar
- Title: dish name
- Recipe line: "📖 [Recipe Name] · [Author]" (teal link) for recipe-backed, "📖 Freeform · no recipe" for freeform
- Description: from `posts.description`
- Photo (single)
- Stats: Cook time / Rating / Times cooked / Highlights
- Vibe pill (conditional)
- Engagement + actions

### Meal card (MealPostCard rebuild)

- Header: avatar stack (up to 3 cooks) + cooked-vs-ate byline ("Cooked by X, Y & Z" / "with A & B · date · meal name")
- Title: meal name
- Description: from `posts.description`
- Photo carousel
- Dish peek (recipe-vs-freeform color distinction): comma-separated dish list, recipe-backed in teal underlined, freeform in gray, "+N more" affordance
- Stats: Dishes / Cooks / Time / Highlights
- Vibe pill (conditional)
- Engagement + actions

### Photoless variants

- Same chrome as photo variants but the hero photo section is omitted entirely
- Card is meaningfully shorter (~250pt vs ~440–520pt for photo cards)
- Description line still renders (and matters more without a photo)
- Vibe pill omitted on photoless cards (kept tight)

### Detail card (F1++++)

Section order, top to bottom:
1. Header (back button, meal title, menu)
2. Hero photo carousel
3. Title section: meal title + sub (date/time/location) + description + 4 stats + vibe pill + "started by X" footnote
4. **Dishes section** (moved here from later — content first, meta-context after)
5. **Highlights section** (compacted: pill + em-dash + gray description on one line per item)
6. **For You section** (cream background, distinct visual treatment, "personal to you · the cook does not see this" framing, color provisional)
7. Comments on this meal
8. Comments on individual dishes (with per-comment "on [dish name]" chips, @-mention rendering)

### Highlights slot computation rules

- The Highlights pill content is picked by the system per card per viewer
- Author signals: "First potluck", "Cooking with [name] (new)", "Cooked N× this month", "Biggest meal yet", "First time cooking with [name]"
- Viewer signals: "73% in your pantry", "Matches your cuisine"
- When both author and viewer signals apply, viewer signals win (more relevant to the reader)
- When no signals apply, the slot is omitted (3-stat row instead of 4-stat row)
- Maximum ONE pill on the feed card. The full list lives in the detail card's Highlights and For You sections.

### Vibe pill rules

- Render when the recipe/meal has a primary vibe tag (static for 7F)
- One pill per card maximum
- Position: own row below the stats row, above the engagement row
- Photoless cards: no vibe pill
- 7F implementation note: pick the recipe's first vibe tag, or the meal's most-common vibe tag from its dishes. Document the rule in the build for easy replacement when personalization (Q36 hybrid b) lands.

---

## Hard line — what 7F builds vs what's wireframed but deferred

This is the explicit cut. Everything in the build column is in the build prompt. Everything in the deferred column is in the design doc but explicitly NOT in the build prompt.

### Build (7F scope)

- `PostCard` refresh: full-width chrome, description line, recipe vs freeform color distinction, Highlights slot rendering
- `MealPostCard` rebuild: cooked-vs-ate byline, dish peek with color distinction, stats row + Highlights slot, vibe pill row, "started by X" footnote
- Detail card rebuild: section reordering (dishes first), Highlights + For You sections (compacted), comment attribution sections per D41
- Highlights computation: which author signals to surface, viewer signal pick (pantry %, cuisine match), conditional rendering when no signals apply
- Static vibe pill rendering (Q36 hybrid b)
- Description line rendering from `posts.description`
- Recipe-vs-freeform dish peek styling
- Comment attribution model (D41) — the data model and the detail card render. Comment composer with default-by-entry-point + override
- Per-dish "on [dish name]" chips on dish-level comments
- Cooked-vs-ate byline rendering (D45)
- Visibility filter audit (ensure both `loadDishPosts` and `getMealsForFeed` apply consistent filtering after the cooked-vs-ate split)

### Wireframed but deferred (NOT in 7F)

- **G4rr-b grouped meal pattern (D44).** Locked target. Built in **Phase 7I (scope expanded)**. Requires M3 schema audit, service layer changes, new `GroupedMealCard` component. Estimate: 3–5 sessions.
- **Eater rating UI (D43).** Wireframe-only. Built in a future eater-ratings sub-phase. Requires schema migration, service work, privacy enforcement, new UI surfaces.
- **@-mention parsing in comment composer (D42).** Wireframe-only for 7F. The render exists in the detail card but the input parser is deferred.
- **Comment thread subscriptions (D42).** Wireframe-only. Requires new subscriptions table + notification batching logic.
- **Notification batching (D42).** Wireframe-only. Requires notification system work.
- **Vibe pill personalization (Q36 hybrid b → eventual Reading 2).** Static for 7F. Personalized selection requires viewer-taste-profile model (Phase 11 territory).
- **Two-level photo upload UI (D46).** Render rules apply in 7F where possible, but the LogCookSheet "tag as dish photo" UI is deferred to a small follow-up.
- **Standalone-dish-with-meal-context byline pattern (H2 winner from session).** Locked but deferred. Depends on Rule B/C (M3 architecture) — same dependency as G4rr-b.
- **Eater rating "Things I've eaten" history page in profile.** New surface implied by D43, deferred with the eater rating feature.
- **Flip-card recipe affordance.** Parked concept. Tom liked it conceptually but it's not in 7F. The current K cards rely on tappable dish-peek navigation + recipe-vs-freeform color distinction to make recipes accessible. The flip is documented as a future iteration possibility, neither dead nor scheduled.
- **F1++++ For You section color treatment.** Locked structurally but the cream tone is provisional. To revisit when build hits the design system.

---

## New deferred work items (add to DEFERRED_WORK.md and Phase 7 doc)

Each item below is a new entry that should be added to the deferred work tracking. They're grouped by which phase or sub-phase will eventually address them.

### Add to Phase 7I scope (expanded)

**P7-28 · M3 schema audit and dish post ownership verification.** Before G4rr-b can render, every dish in a multi-cook meal needs to be owned by the actual cook (not the meal creator). Audit existing data, identify drift, write migration to fix. Required prerequisite for G4rr-b implementation.

**P7-29 · `GroupedMealCard` component build.** New React component implementing the G4rr-b pattern: meal-summary header (fully interactive, own engagement + actions) + indented contributor sub-cards (compact, photoless by default, own engagement + actions). Vertical teal line on left visually links the group.

**P7-30 · `feedGroupingService` rewrite for grouped meals.** Current service handles same-recipe-different-cooks grouping (LinkedPostsGroup case). Expanded scope: detect when a meal has multi-cook contributions and decide whether to render as grouped (G4rr-b) vs unified (current K-family cards). Per-viewer logic optional.

**P7-31 · Two-level photo render rules in grouped meals.** Meal-summary header surfaces meal photos from `meal_photos` bucket. Contributor sub-cards surface dish-tagged photos from each cook's dish post. Most sub-cards photoless. Per D46.

### Add to a new "eater ratings" sub-phase (TBD position)

**P7-32 · `post_participants` schema migration for eater ratings.** Add `rating numeric(3,1)` and `notes text` columns. Per D43 option α.

**P7-33 · Eater rating service functions with privacy enforcement.** Get/set eater ratings. Privacy enforcement in queries — eater ratings must NEVER be returned in any query that surfaces them to the cook. Per D43 ζ.

**P7-34 · Eater rating UI in meal detail.** New section on meal detail viewable only by users who attended the meal as eaters. Per-dish rating affordance with the F1e+ pattern from the wireframes. First-time educational banner with re-show on 60-day lapse. Info icon backup.

**P7-35 · "Things I've eaten" history page in profile.** New profile surface where eater ratings collect. Personal-only view. Linked from the meal detail eater rating section.

### Add to comments sub-phase (TBD)

**P7-36 · @-mention parsing in comment composer.** Tokenize `@username`, validate against followed users, render styled span, ping mentioned user. Per D42.

**P7-37 · Comment thread subscriptions table.** New table to track who's subscribed to which post's comment thread. Implicit subscribe on first comment. Mute option. Per D42.

**P7-38 · Notification batching for meal-level comments.** Aggregate meal-level comments into single rolled-up notification within a time window. Per D42.

### Add to a small follow-up sub-phase (probably 7L or part of 7I)

**P7-39 · Per-photo "tag as dish photo" toggle in LogCookSheet.** Required for full D46 implementation. Default photo target is meal_photos bucket when meal context is present; per-photo override sends to the dish post instead.

### Add to personalization sub-phase (Phase 11 era)

**P7-40 · Viewer-taste-profile model.** Computed taste profile from cook history, ratings, saves, and pantry data. Required for vibe pill personalization (Q36 Reading 2) and for richer "For You" signal computation.

**P7-41 · Vibe pill personalized selection.** Once P7-40 lands, the vibe pill can select the most-relevant vibe tag from the meal's tags based on the viewer's profile. Until then, vibe pill is static (Q36 hybrid b).

### Parked design concepts (no specific phase)

**P7-42 · Flip-card recipe affordance.** Tom liked the concept of tap-to-flip on solo dish cards to reveal recipe metadata. Not built in 7F. Not retired. Lives in the wireframes (state A1r2) as a parked idea for future iteration. Reconsider after F&F testing reveals whether the current dish-peek-tappable navigation is sufficient.

---

## Open questions for the build prompt

These are things the build prompt should explicitly ask Claude Code to confirm or decide during implementation:

1. **Vibe pill source for meal cards.** When a meal has multiple recipes with different vibe tags, what's the rule for picking the meal-level vibe? Most-common tag? First-listed? Tag with highest weight? The build prompt should pick a simple rule and document it.

2. **Highlights pill priority logic.** When multiple author signals apply to a single card, which one wins? Specificity? Recency? First in priority order? Build prompt should pick and document.

3. **Description line truncation.** `posts.description` could be arbitrarily long. What's the max length on the feed card? Strava's pattern is roughly one line of ~120 characters. Build prompt should pick a number.

4. **Recipe vs freeform peek on cards with mixed-source dishes.** Confirmed in K3rrr — recipe-backed in teal underlined, freeform in gray. Build prompt should specify the exact CSS.

5. **"Started by X" footnote rendering.** Where exactly does it sit on the feed card vs the detail card? In the wireframes it's between the engagement row and the action row on the feed; on the detail card it's under the title section meta. Build prompt should specify both placements.

6. **Conditional rendering rules.** Highlights pill omits when no signal applies. Vibe pill omits on photoless cards and when no primary vibe exists. Description line omits when `posts.description` is null. Build prompt should enumerate every conditional render rule explicitly.

---

## Appendix · session question reference

For continuity between this doc and the wireframe artifact, here's the index of questions raised and resolved during the session:

- **Q1–Q10** · Pass 1 clarifying questions (largely about feed card structure, host visibility, dish peek, etc.)
- **Q11** · Host visibility two-layer rule. Resolved into D45/D34 interaction.
- **Q12** · Cook detail card scope. Resolved as wireframe + first-stab build.
- **Q13** · Effort-signal stats (eventually superseded by philosophy c framing).
- **Q14** · Accomplishments row. Eventually folded into Highlights slot.
- **Q15** · Photoless cards as distinct variant. Locked.
- **Q16** · Solo cards get accomplishments row. Eventually folded into Highlights slot.
- **Q17** · A2 multi-recipe gap. Resolved into recipe peek + tappable navigation.
- **Q18** · Yas chef on meal card → meal post. D41-locked.
- **Q19** · Author vs viewer badges. Resolved via Highlights slot collapse on feed + section split in detail.
- **Q20** · Recipe metadata on solo cards. Resolved as exploratory, retired in favor of tappable nav.
- **Q21** · Eater rating concept. D43-locked.
- **Q22** · Viewer badge content. Resolved into pantry %, cuisine match, etc.
- **Q23** · Comment notification scope. D42-refined.
- **Q24** · Eater rating data model. D43-α-locked.
- **Q25** · M3 deferral. D44-locked.
- **Q26** · Yas chef public, eater rating private (ζ). D43-locked.
- **Q27** · Mock components in 7F. Rejected — wireframes only.
- **Q28** · Stat row philosophy (α/β/γ). γ locked = philosophy (c).
- **Q29** · Difficulty stat for cooking. Rejected — Frigo distinct from Strava on quantification.
- **Q30** · Eater privacy reminder mode. β with refinements locked.
- **Q31** · Card framing (Strava-with-numbers vs experience-shaped vs hybrid). (c) hybrid locked.
- **Q32** · Achievements style (D2 sentence pills vs medal slot). D2 sentence pills, eventually evolved to Highlights slot.
- **Q33** · G4 ownership (a/b/c). (c) "started by Tom" footnote locked.
- **Q34** · Vibe pill merge with For You (Reading 1/2/3). Reading 2 locked, hybrid b implementation.
- **Q35** · Comment batching scope. Meal-only batching confirmed. D42-refined.
- **Q36** · Vibe pill ship strategy (a/b/c). (b) hybrid — static now, personalized later.
- **Q37** · "Highlights" as slot label. Locked.
- **Q38** · Meal-level engagement in G4rr placement. (c) sticky on meal-summary header, fully interactive surface.
- **Q39** · Two-level photo model. D46-locked.
- **Q40** · Detail card highlights treatment (merge vs split). (b) split locked.
- **Q41** · Highlights slot Reading A vs B. Reading A locked.
- **Q42** · Flip cards. Parked concept, not built but not dead.
- **Q43** · Detail card Highlights vs For You order. Highlights first.
- **Q44** · G4rr-b future phase commitment. (a) Phase 7I with explicit scope expansion, before launch.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-09 | Created during the Phase 7F wireframe session. 6 wireframe passes, ~60 states, 44 questions resolved. New decisions D41–D46 captured. Hard line drawn between 7F build scope and deferred work. Phase 7I scope expansion documented. |
