# Phase 7: Social & Feed Polish

**Started:** 2026-03-24 **Last Updated:** 2026-04-20 **Status:** ✅ Complete (all 13 sub-phases shipped: 7A, 7B, 7B-Rev, 7C, 7D, 7E, 7F, 7I, 7G, 7H, 7N, 7M, 7J, 7K, 7L) **Master Plan:** See FF_LAUNCH_MASTER_PLAN.md for full F&F context **Playbooks:** See docs/playbooks/ for feature playbooks (Overflow Menu, LogCookSheet, Star Rating, etc.) **Scoping reference:** See \_SCOPING_NOTES_7D.md for the multi-cook reframing reasoning, raw conversation findings, and unresolved questions tracked for wireframe sessions. **Phase 7I detailed reference:** See the "Phase 7I Detailed Reference" appendix at the bottom of this doc for cook-post-centric feed rebuild rationale, the seven checkpoints' detailed scope, supersession breakdowns for D41/D44/D45/D46, and the original 7M scope. (Absorbed from the now-deleted `PHASE_7I_MASTER_PLAN.md` on 2026-04-20.)

## Goals

Make the social loop feel complete and polished before testers arrive. The post-cook flow is the heart of the app — what users do after they cook, how they capture it, share it, and find it later — and it ties together cooking, recipes, meals, and stats.

**Why this is Phase 7:** Social features are what make Frigo "Strava for cooking" rather than just a recipe manager. The feed is what users see first. The post-cook moment is what creates the cooking history that powers stats. This phase needs to feel finished, not half-built.

**Success criteria:**

- Logging a cook from the recipe detail screen is one tap and feels lightweight

- Logging a cook from cooking mode flows directly into the same logging UI (no redundant screens)

- Users can rate dishes with half-star precision via slide-to-rate; rating drives stats

- Star color is brand teal, never yellow

- Multi-dish meals (the most common real-world case) post correctly with per-dish + per-meal photos

- Historical cooks can be backdated with a date picker, creating authentic timeline entries

- Shared meals are visually grouped on the feed

- Recipe sharing works via external share sheet

- My Posts toggle works in the You tab

- Chef attribution shows on posts

- Private posts ("just log it") never appear on the feed

- Post privacy defaults are respected

- Feed feels like a social experience, not a list of cards

## Prerequisites

- Phase 5 (Ingredients) complete

- Phase 6 (Cooking Mode v2) complete

- Existing components: LinkedPostsGroup.tsx, feedGroupingService.ts (built but not wired)

- Existing: rating field on posts (now nullable numeric, supports half stars after 7B-Rev)

- Existing: MyPostsScreen content (needs absorption into StatsScreen toggle)

- Three columns added to DB during 7A: posts.make_again (now unused), recipes.times_cooked, posts.visibility

- DB migration during 7B-Rev: posts.rating → numeric(3,1), nullable, constraint allows 0-5

- 7D Checkpoint 1 migration (April 7): post_participants.external_name + nullable participant_user_id + CHECK constraint, posts.dish_name, posts.visibility 4-value CHECK, meal_dish_plans.logged_meal_post_id FK + index

- Checkpoint 4 fix pass 2 direct DDL (April 7): get_meal_dishes and get_meal_plan_items RPCs recreated with dish_rating numeric(3,1) to match the 7B-Rev rating column type change

## Scope

### Product Feature Roadmap Items Touched

| **\#** | **Feature** | **Sub-phase** |
|----|----|----|
| 10 | Ratings system | 7B, 7B-Rev (half-star slide-to-rate) |
| 43 | Share recipes | 7J |
| 93 | Feed view | 7B (visibility filter), 7I (linked posts wiring) |
| 96 | Post privacy | 7B (visibility model), 7L (default settings) |
| 4 | Post photos | 7D (multi-dish per-dish + per-meal photos) |
| 58 | Stats dashboard | 7H (My Posts toggle) |
| 6 | Historical posts | 7G (backdated cook logging) |
| 64 | "I loved it" reactions | Out of scope (post-launch) |
| B4 | Chef attribution backfill | 7K |
| D3 | Cooking methods in PostCreationModal | 7L |

## Architecture

### The meal model — what already exists (Model 1)

**Important context:** The original Phase 7D scope assumed multi-dish meals required a new post_dishes junction table. This was wrong. The existing code already implements a sophisticated multi-cook meal model that the original 7D plan would have duplicated. See decisions D21 below and the full reasoning in \_SCOPING_NOTES_7D.md.

The existing model — referred to as **Model 1** throughout this doc — is:

posts (single table for both meals and dishes)

├── id, user_id, post_type ('meal' \| 'dish'), created_at

│

├── DISH POST fields (when post_type='dish'):

│ ├── recipe_id (1:1 — the recipe being cooked, NULLABLE since 7D Checkpoint 1)

│ ├── dish_name (text, NULLABLE — set for freeform dishes per D23)

│ ├── rating (numeric(3,1), nullable, 0-5 in 0.5 steps)

│ ├── notes ("thoughts" — casual cook-level observations)

│ ├── modifications (recipe-level edits the cook made)

│ ├── photos (JSONB array)

│ ├── parent_meal_id (FK to a posts row with post_type='meal' — null if standalone)

│ └── visibility ('everyone'\|'followers'\|'private'\|'meal_tagged' since 7D Checkpoint 1)

│

└── MEAL POST fields (when post_type='meal'):

├── title, description, meal_type, meal_time, meal_location

├── meal_status ('planning' \| 'completed')

├── photos (JSONB — meal-level photos on the post itself)

└── visibility (same model as dish posts)

dish_courses (junction — links a dish post to its parent meal post with course metadata)

├── dish_id (FK to posts where post_type='dish')

├── meal_id (FK to posts where post_type='meal')

├── course_type ('appetizer'\|'main'\|'side'\|'dessert'\|'drink'\|'other')

├── is_main_dish (boolean)

└── course_order (int)

post_participants (cook attribution + ate-with tagging on a SPECIFIC POST)

├── post_id, participant_user_id (NULLABLE since 7D Checkpoint 1), role

├── role: 'host' \| 'sous_chef' \| 'ate_with'

├── status: 'pending' \| 'approved' \| 'rejected' (approval flow)

├── invited_by_user_id

├── external_name (text, NULLABLE — set for non-Frigo participants per D27)

├── CHECK constraint: either participant_user_id OR external_name must be set

└── Used for: tagging co-cooks on a single dish, tagging people you ate with

meal_participants (RSVP at the MEAL level — separate from post-level cook attribution)

├── meal_id (FK to posts where post_type='meal'), user_id

├── role: 'host' \| 'attendee'

├── rsvp_status: 'pending'\|'accepted'\|'maybe'\|'declined'

└── Used for: who's at the dinner, who's invited

meal_photos (per-meal photo bucket — multi-uploader)

├── meal_id, user_id, photo_url, caption

└── Used for: photos contributed by meal participants (any of them, not just host)

meal_dish_plans (PLANNED meals — the meal planner, separate from logged meal posts)

├── meal_id, course_type, recipe_id, placeholder_name

├── claimed_by, assigned_to (who's responsible for cooking what)

├── completed_at (set when the planned dish is actually cooked)

└── logged_meal_post_id (FK to posts, NULLABLE — added 7D Checkpoint 1, set when a planned dish is promoted into a real dish post via Checkpoint 4's MadeOtherDishesSheet)

post_relationships (sibling-post linking — built but not wired to feed)

├── post_id_1, post_id_2, relationship_type ('dish_pair'\|'meal_group')

└── addDishesToMeal currently writes 'meal_group' rows here AS WELL AS dish_courses,

creating three parallel meal↔dish representations (parent_meal_id, dish_courses,

post_relationships). See P7-14 / P7-25 in Deferred Items for the active drift

finding from Checkpoint 4.

### Existing services and components — what's already built

**Services:**

- **mealService.ts** (~1380 lines as of EOD 2026-04-07) — fully built meal CRUD: createMeal, updateMeal, completeMeal, deleteMeal, addDishesToMeal, removeDishFromMeal, getMealDishes (returns DishInMeal\[\] with contributor info), updateDishCourse, inviteParticipants, respondToInvitation, removeParticipant, transferHost, addMealPhoto, getMealPhotos, deleteMealPhoto, getUserRecentMeals, getMealsForFeed, getUserAvailableDishes, canAddDishToMeal, groupDishesByCourse, formatMealParticipantsText. Added in Checkpoint 4: wrapDishIntoNewMeal (Option γ helper, D26) and detectPlannedMealForCook (smart-detect, D33). **This is a finished domain — 7D is mostly UX/wiring work, not service work.**

- **postParticipantsService.ts** — full participant CRUD with the sous-chef approval flow and formatParticipantsText (produces strings like "cooked with Mary and 2 others" / "ate with Anthony and Nick").

- **postService.ts** — createDishPost for solo cook logging. Also exports computeMealType (parent-meal/recipe/time-of-day precedence) and computeMealTypeFromHour (the shared 4-band time helper extracted in Checkpoint 4 Fix Pass 1). **NOTE:** createDishPost has a known drift bug that Fix Pass 3 will address — see Current Work.

**Components (built and wired):**

- **CreateMealModal.tsx** (1323 lines) — meal creation form with title/description/meal_type/meal_time/location + optional starter recipe.

- **AddDishToMealModal.tsx** — picker for adding existing dish posts to a meal.

- **AddCookingPartnersModal.tsx** — sous chef + ate-with tagging UI with role toggle. Updated in Checkpoint 3 to accept initialSelectedIds so re-opening shows previously-tagged users as pre-selected.

- **CookingPartnerApprovalModal.tsx** — when you're tagged as a sous chef, approval flow that includes the option to create your own attribution post for the same dish.

- **MealDetailScreen.tsx** (1115 lines) — full meal screen with dishes, participants, photos, RSVP, host controls.

- **MealPostCard.tsx** (765 lines) — feed card that renders meal posts and uses getMealDishes to display contributor info per dish.

- **LogCookSheet.tsx** — Checkpoint 2-3 added meal-attach chip, smart-detect banner, visibility row + override overlay, in-sheet meal picker view, Tag chip wired to AddCookingPartnersModal. ~1572 lines.

- **MealPicker.tsx** (Checkpoint 3) — meal picker sub-view used by both LogCookSheet's meal-attach chip and RecipeDetailScreen's "Add to meal" overflow item.

- **InSheetMealCreate.tsx** (Checkpoint 3) — in-sheet meal creation form with inline tagging per D36/D37.

- **MadeOtherDishesSheet.tsx** (Checkpoint 4) — post-publish "Made other dishes too?" sheet with planned-meal suggested rows and unplanned-meal recommendation cards per D40.

**Components (built but only partially wired):**

- **LinkedPostsGroup.tsx** + **feedGroupingService.ts** — sibling-post grouping via post_relationships. Built November 2025, never wired into FeedScreen. Originally intended for "linked posts" (e.g. same recipe cooked by two friends linked together). **NOT** for multi-dish meals — that's what dish_courses + parent_meal_id already handles. Will be addressed in 7I.

### What this model already supports (covered by existing code)

- **Single-cook, multi-recipe meals** (Tom cooks chicken + green beans): one meal post + N dish posts, each with parent_meal_id set, joined via dish_courses.

- **Potluck meals** (Nick brought salad, Anthony brought wings, Tom brought couscous): one meal post + dish posts owned by different user_ids. getMealDishes returns contributor_username/contributor_display_name/contributor_avatar_url for each dish.

- **Joint cooking on a single dish** (Tom and Mary cook the chicken together): the dish post is owned by one of them; the other is added via post_participants with role='sous_chef'. The sous chef gets an approval prompt and can opt to create their own attribution post.

- **"Ate with" tagging** (people present but not cooking): post_participants with role='ate_with'.

- **Per-meal photos from multiple uploaders**: meal_photos table.

- **Freeform dishes** (since 7D Checkpoint 1): nullable recipe_id + dish_name text column on dish posts per D23.

- **External (non-Frigo-user) participants** (since 7D Checkpoint 1): external_name text column on post_participants per D27/D37.

- **Wrap pattern for dish→meal** (since 7D Checkpoint 4): wrapDishIntoNewMeal in mealService creates a new meal post and links the existing dish via addDishesToMeal per D26 / Option γ.

### What this model does NOT yet support — the real 7D gaps

| **Gap** | **Description** | **Sub-phase** | **Status** |
|----|----|----|----|
| **Gap 1** | LogCookSheet has no "this is part of a meal" affordance. | 7E | ✅ Done (Checkpoint 2-3) |
| **Gap 2** | Creating a meal is a separate path from cooking. | 7D | ✅ Done (Checkpoint 3 — in-sheet meal creation per D36) |
| **Gap 3** | No "Made other dishes too?" follow-up exists. | 7E | ✅ Done (Checkpoint 4 — MadeOtherDishesSheet) |
| **Gap 4** | No FK link between meal_dish_plans and logged meal posts. | 7D / 7E | ✅ Done (Checkpoint 1 migration + Checkpoint 4 wiring via promoted suggestions) |
| **Gap 5** | meal_photos table is built but unrendered in MealPostCard. | 7F | 🔲 |
| **Gap 6** | "Add to Post" overflow item placeholder. | 7E | ✅ Done (Checkpoint 4 — "Add to meal" overflow item with Option γ wrap) |
| **Gap 7** | MealPostCard dishes may not be tappable. | 7F | 🔲 |
| **Gap 8** | Three parallel meal↔dish representations. | Deferred → ACTIVE BUG | 🟡 **Reframed as drift bug — Fix Pass 3** |
| **Gap 9** | Meal-shaped posts may not be visibility-filtered in FeedScreen. | 7D | ✅ Done (Checkpoint 2a) |
| **Gap 10** | Non-Frigo-user contributors (external_name). | 7D | ✅ Done (Checkpoint 1 + Checkpoint 3 inline tagging) |
| **Gap 11** | Freeform dishes (recipe_id nullable + dish_name). | 7D | ✅ Done (Checkpoint 1 + Checkpoint 4 inserts) |

### Mode-variant component pattern

LogCookSheet introduces a pattern worth documenting: a single component with a mode prop that switches layout density and feature set without duplicating code. Used here because the same logging sheet serves two contexts (lightweight from recipe detail, heavyweight from cooking mode) but the form fields and submission logic are identical. Pattern candidate for FRIGO_ARCHITECTURE.md "Common Patterns" section.

### Sheet content-replacement pattern

Checkpoint 3 added a second pattern worth noting: rather than opening modal-on-modal (which iOS handles unreliably), LogCookSheet uses a sheetView state ('main' \| 'picker' \| 'create') that swaps body content in place while keeping the same outer Modal. Sub-views render inside the existing sheet rather than as nested modals. This avoids the iOS sibling-Modal stacking bug and keeps the interaction within a single sheet surface. Pattern candidate for FRIGO_ARCHITECTURE.md.

## Build Phases

| **Sub-phase** | **Scope** | **Sessions** | **Status** |
|----|----|----|----|
| **7A** | Bug fixes (P6-4 PostCookFlow data gap, P6-5 notes/modifications duplication) | 1 | ✅ Done |
| **7B** | Overflow menu redesign, LogCookSheet unified component, feed visibility filter | 2 | ✅ Done |
| **7B-Rev** | Polish pass: half-star slide-to-rate (teal), keyboard handling, CTA flip, edit mode banner, delete fix, step notes display, PencilIcon, TimesMadeModal redesign | 1-2 | ✅ Done + Tested |
| **7C** | Meal Plan "Create new meal" wiring fix | 0.5 | ✅ Done |
| **7D** | **Multi-cook & meal experience — Data + service layer.** Audit + migration (Checkpoint 1), service additions (wrapDishIntoNewMeal, detectPlannedMealForCook), gap closure for Gaps 4/9/10/11. | 1-2 | ✅ Done (delivered as part of the combined 7D+7E build prompt) |
| **7E** | **Multi-cook & meal experience — Cook-logging → meal handoff.** LogCookSheet meal-attach chip + smart-detect + visibility model (Checkpoint 2). In-sheet meal creation + tagging (Checkpoint 3). "Made other dishes too?" sheet + Option γ wrap pattern + RecipeDetailScreen overflow item + parent meal banner + comments label (Checkpoint 4). | 2-3 | ✅ Done. Combined 7D+7E build prompt delivered all 5 checkpoints. Checkpoint 4 required 4 fix passes (Fix Pass 1-2 on 4/7, Fix Pass 3-4 on 4/7-4/8) plus 1 direct DB migration (RPC return type drift) plus 1 historical backfill (420 dishes across 276 meals). Checkpoint 5 cleanup landed cleanly on 4/8 with three small fixes (null-time guard on detectPlannedMealForCook, utils extraction for computeMealTypeFromHour, in-sheet meal time default). All 9 verification tests passing. |
| **7F** | **Multi-cook & meal experience — Feed rendering + post detail.** New MealPostCard and PostCard renderers reflecting the locked Pass 6 wireframe baseline (Krrr family + F1++++). Philosophy (c) hybrid stat row with Highlights slot per-card per-viewer computation. Cooked-vs-ate byline split (D45). Two-level photo model render rules where applicable (D46). Comment attribution refinement with two-section detail card (D41). Static vibe pill render. Description line render. Recipe-vs-freeform color distinction in dish peek. Highlight photo model (D24). Render meal_photos bucket. Tappable dish navigation. Visibility filter audit. **Wireframed in 6-pass session 2026-04-09 — see PHASE_7F_DESIGN_DECISIONS.md for full design rationale and frigo_phase_7f_wireframes.html for the artifact.** Scope-deferred items: G4rr-b grouped meal pattern (originally → 7I per D44; **SUPERSEDED 2026-04-13 — see D47 below**), eater rating UI (→ future eater-ratings sub-phase per D43), notification implementation (→ comments sub-phase per D42), LogCookSheet dish-photo tagging UI (→ small follow-up per P7-39). Shipped with Fix Passes 7/8/9 closing all reported feed bugs. | 1-2 | ✅ Shippable |
| **7G** | Historical cook logging with dates (posts.cooked_at, date picker, per-cook history entries). DateTimePicker extended with quickSelectPreset='past' prop. createDishPost now writes cooked_at explicitly. Feed, detail screen, and grouping service all sort by cooked_at. | 1 | ✅ Done (single session, 2026-04-15) |
| **7H** | My Posts in You tab — StatsScreen My Posts navigation target switched from RecipeDetail to CookDetailScreen (L6). Sort/display switched to cooked_at. CookDetail route registered in StatsStack. Freeform dishes now tappable. | 0.5 | ✅ Done (bundled with 7G, 2026-04-15) |
| **7I** | **Cook-post-centric feed rebuild. SUPERSEDES D44's M3/G4rr-b framing per D47 below.** Every feed unit becomes a solo cook post. Meal events retire from the feed entirely and become detail-screen-only connective tissue. Linked posts render as indented stacks with a left gutter connector (Strava-style). Structured as 7 sequential checkpoints across two waves: **Wave 1** (before 7G/7H): Checkpoint 1 (SQL migration post_type='meal' → 'meal_event'), Checkpoint 2 (services layer: cook partner links, meal event queries, feed grouping with union-find + Rule C visibility), Checkpoint 3 (new CookCard + prehead/group-header primitives + polish: book icon, friends icon, description-above-recipe), Checkpoint 4 (FeedScreen rewrite: remove parent_meal_id filter, stop querying meals, replace CombinedFeedItem with FeedGroup\[\], retire LinkedPostsGroup/PostCard/MealPostCard from feed render path, bundled polish: logo tap-to-top, pull-to-refresh hang investigation). **Wave 2** (after 7G/7H): Checkpoint 5 (new CookDetailScreen — L6 — **plus narrow-scope editing**: overflow menu with Add photos, Edit title, Edit description, Manage cook partners, Change meal event, Delete post — the narrow scope is explicit scaffolding that 7M replaces), Checkpoint 6 (rewrite MealDetailScreen as MealEventDetailScreen — L7 — **plus host editing**: overflow menu with Edit title/date/location/highlight photo/attendees, non-destructive Delete event that clears parent_meal_id on linked cook posts rather than deleting them, attendee menu with Add photo/Add comment/Leave event), Checkpoint 7 (delete deprecated components, remove 'meal' from PostType union, chef page audit). Wireframes L1–L7 locked in frigo_phase_7i_wireframes.html. Master plan: PHASE_7I_MASTER_PLAN.md. First CC prompt: CC_PROMPT_7I_CHECKPOINT_1_MIGRATION.md. **Scope expanded 2026-04-13 (later that day)** to include narrow-scope editing affordances on the new detail screens — prevents regression from today's MyPostDetailsScreen and unblocks Tom's own testing workflow during Wave 2 execution. Expansion adds ~2-3 sessions to Wave 2. | 9-13 | ✅ Complete (Checkpoints 1-7 shipped 2026-04-13 through 2026-04-15, plus 3 fix passes) |
| **7J** | Recipe sharing via React Native's built-in Share API. shareRecipe + sharePost in shareService.ts. Wired to RecipeDetailScreen overflow, CookDetailScreen header, MealEventDetailScreen header. Fix pass: async share before menu close. | 1 | ✅ Done (2026-04-17) |
| **7K** | Chef attribution backfill. backfillChefIds() in chefService.ts — one-time admin function, triggered from SettingsScreen. Updated 147 recipes + books with chef_id via books.author → getOrCreateChef join. cookCardDataService already had the chefs(name) join. | 0.5 | ✅ Done (2026-04-17) |
| **7L** | Settings UI for global visibility default (D34). default_visibility column on user_profiles, picker in SettingsScreen, computeDefaultVisibility reads stored preference, LogCookSheet wired. meal_tagged excluded from defaults (per-post only). | 0.5 | ✅ Done (2026-04-17) |
| **7M** | **Full post editing pass.** EditPostScreen (Strava Edit Activity pattern) with all editable fields: title, description, rating, cooking method, date cooked, modifications, notes, visibility, meal event, cook partners, photos (via EditMedia). StarRating extracted as reusable component. Dirty state detection, unsaved-changes confirmation, delete-from-edit. CookDetailScreen overflow collapsed from 6 items to 2 ("Edit post" + "Delete post"), ~508 lines removed. constants/cookingMethods.ts created matching DB constraint. Eating partners stub row. Meal picker enhanced (dates, chronological, create new). 2 fix passes: cooking method constraint, screen refresh, keyboard avoidance, recipe line non-tappable, partner chip immediate update, bottom bar keyboard rise. | 3 | ✅ Done (CP1-CP3 + 2 fix passes, 2026-04-17) |
| **7N** | **Detail screen polish + feed carousel UX.** CP1: CommentsScreen keyboard fix (P7-85), photo carousel peek + count pill (P7-87), CookDetailScreen header title (P7-90), rating label fix (P7-96 label), swipe reliability audit. CP2: swipe restructure (3-zone Pressable split), multi-photo select (P7-88), star picker stay-open (P7-97), inline engagement bar (P7-98), keyboard return key, header truncation. Fix pass: back button tintColor (brand teal globally), star picker tap-outside dismiss, engagement bar layout (like left, comment right). | 1.5 | ✅ Done (2026-04-15 through 2026-04-17) |

**Estimated total: 25-37 sessions** (7I expanded from 3-5 to 9-13 per 2026-04-13 D47 supersession of D44 + later-same-day narrow editing scope expansion in Wave 2 Checkpoints 5-6; 7M added as new 3-5 session sub-phase for the full post editing pass modeled on Strava's Edit Activity. 7L and earlier estimates unchanged.) **Sessions completed (through 7E Checkpoint 5): ~9-10** **Sessions remaining (7F build onward): ~9-16**

**Renumbering note:** 7D was originally a single multi-dish posts sub-phase. After scoping (April 7), it was split into three sub-phases (7D/7E/7F) representing data layer, cook-logging handoff, and feed rendering. Old 7E–7J were renumbered to 7G–7L respectively. The mapping is:

| **Old** | **New** | **Scope** |
|----|----|----|
| 7D (single) | 7D + 7E + 7F | Multi-cook & meal experience, three workstreams |
| 7E (Historical cook logging) | 7G | Same scope |
| 7F (My Posts in You tab) | 7H | Same scope |
| 7G (Linked posts wiring) | 7I | Same scope |
| 7H (Recipe sharing) | 7J | Same scope |
| 7I (Chef backfill) | 7K | Same scope |
| 7J (Small fixes) | 7L | Same scope |

Old session log entries reference the old numbering (7E–7J) and stay as-is for historical accuracy. Forward references in this doc, FF_LAUNCH_MASTER_PLAN.md, and PROJECT_CONTEXT.md use the new numbering.

## Decisions Log

| **\#** | **Decision** | **Rationale** | **Date** | **Origin** |
|----|----|----|----|----|
| D1 | Chef backfill moved from Phase 5 to Phase 7 | Better to address attribution alongside social features | 2026-03-17 | Tom + Claude planning |
| D2 | Kept star rating only, removed make-again Yes/Maybe/No | Redundant — 5-star implies yes, 1-star implies no. Stars give more signal. | 2026-03-24 | Testing feedback |
| D3 | Half-star support + slide-to-rate + teal color | More granular ratings, natural interaction, brand-consistent color | 2026-03-24 | Testing feedback |
| D4 | Thoughts and modifications remain distinct DB fields | Thoughts = casual cook-level observations (ephemeral). Modifications = formal recipe edits (permanent). Different lifecycles justify separate fields. | 2026-03-24 | Architecture review |
| D5 | Visibility model: everyone / followers / private | "Just log it" needs real privacy. 3-tier model allows for follower-only posts later. | 2026-03-24 | Testing feedback |
| D6 | "Log This Cook" primary CTA on RecipeDetailScreen | Most users cook without entering step-by-step cooking mode. Primary CTA should match common behavior. Action-oriented language preferred over passive "I Made This". | 2026-03-24 / 2026-04-06 | Testing feedback |
| D7 | "Cook in Step-by-Step Mode" as secondary text-link CTA | Cooking mode is for when you want guidance, not the default. | 2026-03-24 | Testing feedback |
| D8 | LogCookSheet gets compact (~65%) and full (~90%) modes via prop | Compact from recipe detail keeps the recipe peeking through — lower friction. Full from cooking mode needs all fields. | 2026-03-24 | Design discussion |
| D9 | PostCookFlow merged into LogCookSheet full mode | Two screens felt redundant. "Nice cook!" lives in LogCookSheet header now. Old PostCookFlow.tsx marked deprecated. | 2026-03-24 | Testing feedback |
| D10 | "I've Made This Before" decoupled from post creation | Creating fake today-dated posts for historical cooks was misleading. The new menu item updates times_cooked only. Real backdated posts come in 7G. | 2026-03-24 | Testing feedback |
| D11 | TimesMadeModal redesigned: shows additions (default 1) with live preview of new total | Showing the absolute total in the stepper was confusing. "Adding to existing count" matches user mental model. | 2026-04-06 | Live testing |
| D12 | Multi-dish posts require post_dishes junction table | 1:1 post→recipe is the wrong model. One meal = many dishes (recipes + improvised items). | 2026-03-24 | Architecture review |
| D13 | Photo model in multi-dish: per-dish + per-meal (both) | Dish thumbnails on individual dish rows, meal-level photos for table/occasion shots. Resolves group meal photo question entirely. | 2026-03-24 | Design discussion |
| D14 | Smart auto-populate from planned meals (7D) | If user planned Tuesday dinner with 3 dishes and taps "I Made This" on one, system should offer to auto-populate the other two with quick rating prompts. | 2026-03-24 | Design discussion |
| D15 | Voice-to-text for thoughts (placeholder UI in LogCookSheet, real impl post-launch) | Thoughts often captured hands-busy right after cooking. Voice lowers friction. | 2026-03-24 | Design discussion |
| D16 | View mode renamed Original / Clean / Markup under "Recipe View" subheader | Provisional. Tom flagged the entire overflow menu as needing iteration with user feedback. See Overflow Menu playbook. | 2026-03-24 | Testing feedback |
| D17 | Edit Mode minimum-viable banner + Exit button shipped in 7B-Rev | Full notebook-aesthetic redesign deferred to Phase 11. Banner makes edit mode discoverable in the meantime. | 2026-04-06 | Testing feedback |
| D18 | Step notes display added to RecipeDetailScreen "Your Private Notes" section | Root cause of step-notes-not-displaying bug: RecipeDetailScreen wasn't fetching recipe_step_notes at all, only annotations. Now fetches both. Two note systems remain separate (could unify post-launch). | 2026-04-06 | Testing feedback |
| D19 | Phase 7 stays as one big phase (11 sub-phases) rather than splitting into 7 + 7-bis | Thematic clarity and single-completion milestone outweigh tracking overhead. | 2026-04-06 | Tom decision |
| D20 | Group meal photos (originally a separate sub-phase) folded into 7D | Per-dish + per-meal photo model from D13 already addresses group meal photo needs entirely. | 2026-04-06 | Scope reconciliation |
| D21 | **D12 RETIRED — Model 1 with dish_courses is sufficient.** The original "build a post_dishes junction" decision was based on an incomplete picture of the existing schema. The codebase already implements multi-dish meals via posts.parent_meal_id + dish_courses + post_participants + meal_participants + meal_photos. Building a parallel post_dishes junction would have duplicated dish_courses and broken the existing MealPostCard rendering path. 7D is reframed as "close the gaps in Model 1," not "build a replacement model." See \_SCOPING_NOTES_7D.md for the full reasoning chain. | 2026-04-07 | Scoping session — code review of mealService.ts, postParticipantsService.ts, MealPostCard.tsx |  |
| D22 | **Multi-cook reframing — meals are about people, not just dishes.** The participant + contribution model is the heart of the feature, not the multi-dish piece. A meal can be: one person + multiple recipes; one person + recipe + freeform; multiple people + parallel contributions (potluck); multiple people + joint contribution (joint cooking on one dish). All four already supported by the existing schema (post_participants with sous_chef role, dish-level user_id ownership, meal_participants for RSVP). 7D's job is to surface these capabilities in the cook-logging UI. | 2026-04-07 | Tom — Q1 response in scoping session |  |
| D23 | **Freeform dishes — nullable recipe_id + dish_name text column on dish posts.** The "rice with no recipe" case is supported by making recipe_id nullable on post_type='dish' rows and adding a dish_name text column. Freeform dishes contribute nothing to times_cooked or nutrition stats (no recipe to increment against, no ingredient data). Concept cooking (Phase 11) will later allow these to be linked to a concept tag without a specific recipe; the schema we add now must not block that direction. Future direction: when a user types "rice" as a freeform dish, the system could surface concept matches inline as suggestions. | 2026-04-07 | Tom — Q2 response, with concept cooking direction noted |  |
| D24 | **Highlight photo model.** All photos belong to the post; one is designated the highlight (the first/main photo visible in the feed card). Tagging individual photos to specific dishes is an *additive* layer on top, not the primary model. This is a Strava-equivalent pattern Tom called out explicitly. Replaces the original D13 framing of "per-dish vs per-meal photos as separate buckets." meal_photos is repurposed: it stays as the multi-uploader photo bucket for meal-level photos (anyone at the dinner can contribute) but the highlight/order is post-level. | 2026-04-07 | Tom — Q17 response |  |
| D25 | **Contextual privacy defaults (v1).** Default visibility is contextual, not global: solo lunches/breakfasts/snacks → private; solo dinners → public; all meal-shaped posts (multi-dish, multi-participant) → public; planned group meals → public. User can always override per-post. Picked on instinct; revisit with real F&F usage data. Captured here so the policy isn't quietly changed during build. | 2026-04-07 | Tom — Q3 follow-up + final clarification |  |
| D26 | **"Add to Post" / dish→meal conversion uses Option γ — wrap, don't convert.** When a user is on a dish recipe and chooses to make their existing solo dish post part of a meal, we do NOT flip post_type='dish' to post_type='meal' in place. Instead: create a *new* meal post that wraps the existing dish post; the original dish post is unchanged (recipe_id, rating, photos all stay); set parent_meal_id on the original dish post to point at the new meal post; the original dish post's likes/comments stay attached to the dish post where they belong. The new meal post is empty until the user adds another dish. | 2026-04-07 | Tom — Q11 follow-up + γ recommendation accepted |  |
| D27 | **External (non-Frigo-user) participants.** post_participants gets an external_name text column, with participant_user_id made nullable. When a user tags "Mary" who doesn't have Frigo, an external row is created. The dish post's own user_id stays as the host (the actual creator of the post row). Byline rendering needs to handle "Mary (external)" vs Frigo users. Retroactive claim path (Mary later joins Frigo and claims past attributions) is noted as a gap and deferred — schema must support it but UI doesn't ship in 7D. | 2026-04-07 | Tom — Q1c response + follow-up Q1 |  |
| D28 | **Like/comment attribution on wrapped dish posts (γ constraint).** When a dish post is wrapped into a meal via D26, the existing likes and comments stay attached to the dish post (correct from a data perspective). The user-facing rendering rule: the meal card shows aggregate engagement ("12 likes across this meal"); tapping into a specific dish shows the likes/comments that belong to that dish specifically. Mary's "looks amazing!" comment on the carbonara stays a comment on the carbonara, not on the meal as a whole. This is a constraint the wireframes and the build prompts must honor — flagging here so it can't be quietly designed away. | 2026-04-07 | Tom — Q11 follow-up concern |  |
| D29 | **Strava-style enrichment direction with explicit v1 trigger.** v1 triggers the cook log explicitly (user taps "Log this cook"), but the post is *drafted, not auto-published*. The enrichment sheet appears with smart defaults (rating, modifications, photos, meal-attach) and the user must actively confirm/submit to publish. This is option (i) from the scoping session — the safest publishing model. Future: move toward Strava's option (iii) (auto-publish with enrichment-as-update) once we have passive triggers worth trusting (cooking-mode dwell time, planned-meal expiry, etc.). The architecture must be designed so the (i)→(iii) transition is cheap. | 2026-04-07 | Tom — Q3 response, Strava reference (image 5025 in scoping session) |  |
| D30 | **7D scope split into 7D/7E/7F (three sub-phases) instead of one.** Original 7D was estimated 3-4 sessions for a single multi-dish ship. After scoping, it's clear the work is bigger and benefits from a clean split: 7D = data + service layer (1-2 sessions), 7E = cook→meal handoff UX (2-3 sessions), 7F = feed rendering + post detail (1-2 sessions). Each ships independently. If we run out of runway, we can stop after 7E and ship 7F as a follow-up. Total 4-7 sessions across the three. Old 7E–7J renumbered to 7G–7L. | 2026-04-07 | Tom — Push 1 acknowledgment |  |
| D31 | **Meals tab stays as-is for 7D scoping.** No top-level navigation restructuring as part of 7D. Tom: "I think the meal planning function is an important function that I want to maintain but it will definitely evolve." If the meal experience evolves significantly in Phase 9, the tab can be reshaped then. Wireframes for 7D/7E/7F assume the existing tab structure. | 2026-04-07 | Tom — Push 3 response |  |
| D32 | **Pattern Y publishing model (refines D29).** LogCookSheet IS the enrichment sheet. Submit equals publish. There is no separate confirm step. The visibility default lives inline above the primary CTA as a small "Visible to · {value} ›" affordance. The override is a small overlay that hangs off the CTA, not a new screen. D29's "drafted not auto-published" intent stands — the post does not exist in the DB until the user taps "Log & share" — but the v1 implementation collapses "draft and confirm" into a single sheet rather than two. Reason: closer match to Tom's "low barrier to post creation" direction and the Strava reference, less interaction cost than a two-sheet pattern. | 2026-04-07 | Tom — wireframe review Q1 |  |
| D33 | **Smart-detect tiered fallback with high/low confidence split.** Smart-detect for "this cook is part of a planned meal" uses a tiered match window: ±4hr of meal_time first, fall back to meal-type slot for today, fall back to same-day. Within the time window, the system distinguishes high-confidence (the recipe being logged appears in the matching meal's meal_dish_plans rows) from low-confidence (a meal exists in the time window but the recipe is not on its plan). High-confidence cases auto-attach with a sparkle banner. Low-confidence cases show a recommendation card with explicit "Attach" / "Not this one" buttons — the post stays unattached until the user takes an action. Auto-attach is never silent: the smart-detect banner is always visible when the system makes a guess. | 2026-04-07 | Tom — wireframe review Q8 / Q9, decisions confirmed in chip lock pass |  |
| D34 | **Retired D25 — global default + contextual rules + user-configurable.** D25 (purely contextual privacy defaults) is retired. New model: global default for all post visibility is **Followers**, configurable in user settings. Contextual rules layer on top: any post with meal context (parent_meal_id set OR multi-cook participants present) defaults to Followers regardless of meal_type; solo dish posts check meal_type and default to Followers for dinners and Just me for everything else (lunches, breakfasts, snacks). Contextual rules are hardcoded in v1 and become user-configurable in a deferred phase (P7-21). Per-post override always available via the inline "Visible to" affordance. The global default value ships hardcoded in 7E so F&F testers get the right default day one; the settings UI ships in 7L. | 2026-04-07 | Tom — wireframe review Q11 + Q4 follow-up |  |
| D35 | **Visibility model — four values, fourth is meal-only.** The visibility enum gains a fourth value: meal_tagged ("People tagged in this meal"). This value is selectable only on posts that have a meal context (either a meal post itself or a dish post with parent_meal_id set). For solo dish posts the option is rendered in the override overlay but disabled with a "(meal posts only)" label so users can see it exists. Backend semantics: when a post has visibility='meal_tagged', the visible-to set is the union of post_participants for the post itself plus meal_participants for the parent meal. Implementation deferred to 7L; 7E ships the wireframe-visible disabled state and writes the enum value into posts.visibility when meal context is present and the user picks it. | 2026-04-07 | Tom — wireframe review Q12 |  |
| D36 | **In-sheet meal creation with inline tagging (refines D26 / Q7).** When the user picks "Create new meal" from the meal-attach picker, an in-sheet form opens inside LogCookSheet (NOT the existing CreateMealModal, which is too heavy). Form contains: title (smart-defaulted to "{Day} {Meal type}", e.g. "Monday Dinner"), a "Cooking with" row for sous-chef tagging, an "Eating with" row for ate-with tagging. Both tag rows use an inline pill-based picker with recent-partners suggestions surfaced as one-tap pills. **No escape hatch to the full AddCookingPartnersModal from this form** — the long tail is handled by free-text search inside the "add" pill itself (typing surfaces matching followed users). Fields explicitly NOT in the form: meal_time, meal_type (inferred from current time), meal_location, description. All editable later in MealDetailScreen. | 2026-04-07 | Tom — wireframe review Q4 / Q3 (inline picker, Option C) |  |
| D37 | **External participant tagging via free-text input on the tag pill (refines D27).** When tagging a partner who isn't on Frigo, the user types a name into the inline tag pill (same input used for searching followed users). If the typed string doesn't match a followed user, an "Add as guest" affordance appears. Selecting it creates a post_participants row with external_name set and participant_user_id null. Byline rendering treats external names as plain text without an avatar link. The retroactive claim path (R8) remains deferred. | 2026-04-07 | Wireframe review Q3 lock implication |  |
| D38 | **Cross-meal deduplication deferred to Phase 9.** When a user creates a meal and tags people in it, the system does NOT detect "this user is being tagged into a meal that already exists in their network with overlapping participants and timing" and prompt them to join the existing meal. For 7E, the simple flow ships: tagged users get a meal_participants invitation via the existing flow. Cross-user meal-deduplication is a non-trivial backend feature and is flagged as a Phase 9 (meal UX rebuild) concern. | 2026-04-07 | Tom — wireframe review Q4b |  |
| D39 | **After-wrap landing — stay on dish detail with toast (resolves Q11 implementation gap).** After Option γ wraps a dish into a new meal, the user stays on the dish detail screen they were already viewing. A floating toast appears at the bottom confirming the wrap with a "View meal" one-tap action. The back-link banner (Part of Monday Dinner · view meal) is now visible above the dish photo as a permanent affordance. Reason: lowest disorientation, highest reversibility, matches the "wrap is a metadata-change action, not a new task" mental model. Alternates considered: jump to home feed showing the new meal post (most social, most disorienting), land on the new meal detail (most task-continuous but ties us to MealDetailScreen which is being rebuilt in Phase 9). | 2026-04-07 | Tom — wireframe review Q1 / Q6 |  |
| D40 | **"Made other dishes too?" hybrid pattern — planned suggests, unplanned recommends.** The post-publish "Made other dishes too?" sheet uses two different content models depending on whether the parent meal has a plan. Planned meals: pre-populate suggested dish rows from the meal's meal_dish_plans rows that haven't been logged yet, styled as "Suggested · planned for tonight" with muted thumbnails. Unplanned meals: surface recipe recommendations from recently-viewed, recently-saved, and frequently-cooked recipes, styled as dashed-border cards labeled with the source signal ("Saved 3 days ago", "Viewed earlier today", "You've cooked this 4×"). Both modes support adding dishes via free-text input (freeform support per D23). Sheet has two distinct exits: header X (abandon, discard partial entries) and "Skip for now" (preserve partial entries for later). | 2026-04-07 | Tom — wireframe review Q5 / Q18 |  |
| D41 | **Comment attribution: dual-attached, context-determined.** Comments can attach to either the meal post directly OR a specific dish post, depending on entry point. Tapping comment from a meal card defaults to a meal-level comment; tapping comment from a dish row defaults to that dish. The detail card UI surfaces both kinds with explicit per-comment attribution chips ("on this meal" / "on Lima beans"). **Refines D28** — D28's "engagement attaches to dishes" remains the default but is no longer the only attachment path. Real conversations split naturally between event-level ("incredible night, the spread was unreal") and dish-level ("@Tom what kind of feta did you use?"). No schema change required — the existing comments table already supports comments on any posts.id. Build work is in the comment composer UI (default attachment + override) and the detail card render (two distinct comment sections with attribution chips). Full rationale, alternates considered, and implementation notes in PHASE_7F_DESIGN_DECISIONS.md D41. | 2026-04-09 | Tom — Phase 7F wireframe session |  |
| D42 | **Notification scope: tiered model — meal-level rolled up, dish-level individual, @-mentions always direct, thread subscription on first comment.** Meal-level comments notify all participants in a rolled-up batched form (e.g. "3 new comments on Sunday potluck") because meal-level volume can be high. Dish-level comments notify the dish creator individually per comment because dish volume is typically low (0-3 per dish). @-mentions always ping the mentioned user directly regardless of scope or batching, via @username parsing in the composer. Thread subscription follows the Strava model: commenting on a thread implicitly subscribes you to subsequent comments, with mute as opt-out. Refines the notification side of D28 (which only specified rendering attribution, not notification volume). Requires new comment_thread_subscriptions table or equivalent + notification batching logic + @-mention parser. **Architecture documented for 7F build prompt; actual notification system implementation DEFERRED to a separate notifications/comments sub-phase.** Full rationale in PHASE_7F_DESIGN_DECISIONS.md D42. | 2026-04-09 | Tom — Phase 7F wireframe session Q23 / Q35 |  |
| D43 | **Eater ratings: schema option α, privacy option ζ, orthogonal to yas chefs.** Three locked properties for the eater rating feature: **(α schema)** add rating numeric(3,1) and notes text columns to post_participants — eater ratings are properties of the participation row, not separate posts or a new reaction table; **(ζ privacy)** eater ratings are PRIVATE TO THE EATER. Cooks never see them, not even in aggregate. Aggregate dish ratings shown in the app are computed from cook-side ratings only. The eater's own profile/stats shows their eater ratings; the cook's surfaces never do; **(orthogonality)** eater ratings and yas chefs are two different signals serving two different audiences. Yas chef = public, performative, generous, directed at the cook. Eater rating = private, honest, calibrated, directed at the eater themselves. A user can do both, just one, or neither. Privacy reminder pattern: first-time educational banner with re-show on 60-day lapse + permanent info icon backup. Rationale: friend-graph rating systems suffer a structural failure mode where guests perform positive feedback because the cook is their friend — making eater ratings completely private to the eater eliminates the social pressure entirely while yas chefs continue to serve the cook's feedback need. **Wireframed in F1e+ / F1ec but DEFERRED to a future eater-ratings sub-phase** — schema migration + service work + privacy enforcement + new UI surfaces (rating page + "Things I've eaten" history) need their own scope. Full rationale and alternates in PHASE_7F_DESIGN_DECISIONS.md D43. | 2026-04-09 | Tom — Phase 7F wireframe session Q21 / Q24 / Q26 / Q30 |  |
| D44 | **M3 architecture deferred, G4rr-b grouped meal pattern locked as the visual target for Phase 7I.** The M3 model — where each meal participant has their own owned post for the meal — is the eventual target architecture for multi-cook meal rendering, but 7F ships M1 (status quo: one meal post owned by creator, others surfaced via meal_participants join). 7F's K-family cards (K1rrr-K5rrr) all assume M1. The Strava-style G4rr-b grouped meal pattern (meal-summary header with its own engagement row + indented contributor sub-cards each with their own engagement row, vertical teal line linking the group) is locked as the visual target for the M3 case but is NOT built in 7F. **Built in Phase 7I, scope expanded.** 7I's original 1-2 session "wire LinkedPostsGroup + feedGroupingService" scope is expanded to 3-5 sessions to absorb: M3 schema audit for dish ownership, feedGroupingService rewrite for grouped meals, and a new GroupedMealCard component. Locking G4rr-b now means 7I doesn't need to re-wireframe — the visual brief is done. Alternates considered (G4 host-as-headline, G4r flat hierarchy, G4rr-a explicit Contributors divider) all rejected per session reasoning. Full rationale in PHASE_7F_DESIGN_DECISIONS.md D44. | 2026-04-09 | Tom — Phase 7F wireframe session Q25 / Q44 |  |
| D45 | **Cooked-vs-ate byline split.** Multi-cook meal cards distinguish cooks from eaters in the byline. Header text reads "Cooked by Tom, Nick & Mary" with a sub-line "with Alex & Sara · Apr 5 · Sunday potluck." The avatar stack in the header shows ONLY cooks (host + sous_chef roles from post_participants). Eaters (role='ate_with') appear in the sub-line text but not in the avatar stack. The data model already distinguishes these roles — pre-7F card rendering flattened the distinction. Cooking and eating are different acts with different social signals: cooks deserve cooking credit, eaters deserve presence credit, but they shouldn't be conflated. External guests render as initials circles with dashed borders per D27/D37. **Visibility interaction:** the D34 follow-graph filtering rule still applies first; the cook/eat split applies AFTER the visibility filter. Implementation in MealPostCard and PostCard queries post_participants filtered by role. 7F build includes a visibility filter audit ensuring loadDishPosts and getMealsForFeed apply consistent filtering after the split. Full rationale and alternates in PHASE_7F_DESIGN_DECISIONS.md D45. | 2026-04-09 | Tom — Phase 7F wireframe session |  |
| D46 | **Two-level photo model — meal photos default, dish photos by explicit tag.** Photos in meal contexts split into two buckets based on intent: **meal photos** (meal_photos table, multi-uploader, anyone present can contribute) for table/spread/group shots that capture the meal as an event, and **dish photos** (posts.photos JSONB on each dish post) for photos of specific dishes. **The default rule:** when a user uploads a photo via LogCookSheet for a meal-attached cook, the photo goes to meal_photos BY DEFAULT. Per-photo "this is a photo of the dish" toggle moves it to the dish post instead. Most cook-time photos are table/spread shots, not individual plate portraits — the default reflects this reality. **Render rules:** meal-summary surfaces show meal photos; dish posts (and contributor sub-cards in grouped meals) show their own dish-tagged photos. **Relationship to D24:** D46 clarifies D24, doesn't contradict it. There are TWO scopes of "post" in a meal context (the meal post and each dish post), each with its own photo collection and its own highlight; they don't compete because they live in different buckets. **Build status:** the data model is already in place (meal_photos and posts.photos both exist). 7F applies the render rules where possible — K-family cards surface meal photos when no dish-specific photos exist. The full grouped-meal photo separation lands with G4rr-b in 7I. The LogCookSheet "tag as dish photo" UI is DEFERRED to a small follow-up (see P7-39). Full rationale, alternates, and implementation notes in PHASE_7F_DESIGN_DECISIONS.md D46. | 2026-04-09 | Tom — Phase 7F wireframe session Q39 |  |
| D47 | **Cook-post-centric feed model; SUPERSEDES D44 and partially supersedes D41/D45/D46.** The 2026-04-13 planning session re-opened the feed architecture after Tom hit a mental block reconciling individual cook voice vs. meal event context during the 7F polish review. Resolution: retire meal cards from the feed entirely. **New model:** every feed unit is a solo cook post with exactly one author. Posts link to other cook posts via cook-partner relationships OR to meal event records (posts with post_type='meal_event' after Checkpoint 1 migration). Linked cook posts render as indented stacks with a thin gray connector in a left gutter, Strava-style. Meal events become first-class entities with their own detail screen (L7) but never appear as feed cards. **Supersession details — per Tom's explicit instruction during the 4/13 session, these override the earlier decisions where they conflict:** (a) **D44 fully superseded** — the M3 architecture framing and G4rr-b grouped meal pattern are retired; the Strava-style indent+connector visual survives but applied to standalone cook posts, not "contributor sub-cards under a meal-summary header"; GroupedMealCard component is never built (P7-29 retired); (b) **D41 partially superseded** — dual-attached comments still exist conceptually, but meal-level comments live on MealEventDetailScreen (L7 "About the evening" section) and dish-level comments live on CookDetailScreen (L6), on two separate screens instead of two sections of one card; attribution chips are gone; (c) **D45 effectively superseded** — every cook card has one author, one avatar, one byline; the cooked-vs-ate split moves entirely to L7's "At the table" section; the post_participants role distinction still matters at the data layer but renders differently; (d) **D46 partially superseded** — meal_photos table survives as the shared media pool on L7, but the "meal-summary card shows meal photos" half is retired because no meal-summary card exists; the LogCookSheet default behavior still pre-populates meal_photos when meal context is present, flagged as **NEEDS REVIEW** (P7-31). **What survives unchanged:** D42 (notification tiering, already deferred), D43 (eater rating schema + privacy), and the lower-numbered decisions D1-D40 are untouched. **Scope impact:** Phase 7I expands from 3-5 sessions (D44 scope) to 7-10 sessions structured as 7 checkpoints across two waves, per PHASE_7I_MASTER_PLAN.md. Full wireframe brief locked as frigo_phase_7i_wireframes.html (7 states L1–L7). First CC prompt issued as CC_PROMPT_7I_CHECKPOINT_1_MIGRATION.md. 16 new deferred items P7-44 through P7-59; P7-28 through P7-31 reframed/retired per the master plan's supersession notes. | 2026-04-13 | Tom — Phase 7I planning session |  |
| D49 | **Same-author multi-dish collapse within meal events.** When an author contributed multiple dishes to one meal event, same-author dishes can collapse into a compressed renderer within a linked meal event group. Collapse is per-author, not all-or-nothing: Mary+Mary+Andrew → D49(Mary collapsed) + solo(Andrew). Engagement attaches at the meal-event level. **Implementation timing:** the D49 renderer was NOT built in Checkpoints 5-6. It was deferred to its own focused checkpoint because (a) it adds significant scope (new grouping primitive + card renderer + feed-level rendering), and (b) D51 resolved the schema coupling that previously motivated bundling it with Checkpoint 6. D49 can now ship independently whenever. | Per-author collapse is more natural than all-or-nothing; engagement at meal-event level avoids splitting likes across duplicate cards. | 2026-04-14 | Tom — Phase 7I Checkpoint 5 planning |
| D50 | **No-image state rendering across photo surfaces.** Context-specific: feed cards collapse the photo slot entirely when all photos fail or are absent; detail screens (CookDetailScreen, MealEventDetailScreen, RecipeDetailScreen) render NoPhotoPlaceholder (light grey bg, centered BookIcon at 48px, "No photo yet" label). Retroactive across all surfaces. NoPhotoPlaceholder is a shared primitive in sharedCardElements.tsx. PhotoCarousel extended with failedIndices state + onError callback; visibleCount === 0 early-return composes with the feed card's empty-photos branch. | Avoids broken image icons; gives users a clear signal that no photo exists rather than rendering a blank space. | 2026-04-14 | Tom — Phase 7I Checkpoint 4.5 verification |
| D51 | **Meal-event-level engagement uses existing infrastructure.** Meal-event-level likes and comments use the existing post_likes and post_comments tables with the meal_event post's ID as the target. No new engagement tables or columns needed. The meal_event row IS a post (it's in posts with post_type='meal_event'), so the existing engagement infrastructure works without modification. This applies to Checkpoint 6's L7 "About the evening" comment section and the future D49 renderer's engagement row. **Resolves the schema-coupling concern that previously linked D49 to Checkpoint 6 — D49 can now ship independently.** | Simplest viable approach; avoids new tables; leverages existing comment/like services without modification. | 2026-04-15 | Tom — Phase 7I Checkpoint 6 planning |

## Work Completed

### 7A — Bug Fixes (2026-03-24)

Fixed P6-4 (PostCookFlow makeAgain/thoughts data getting dropped) and P6-5 (notes/modifications duplication). Extended PostData interface, added useRef stash pattern in CookingScreen for PostCookFlow data, routed thoughts to notes column and kept modifications distinct. Three DB columns added by Tom: posts.make_again, recipes.times_cooked, posts.visibility.

**Session log entry:** 2026-03-24 — Phase 7A: Bug Fixes (P6-4 + P6-5)

### 7B — Overflow Menu + LogCookSheet + Feed Filter (2026-03-24)

**Components built:**

- TimesMadeModal.tsx — initial version (later redesigned in 7B-Rev)

- LogCookSheet.tsx — unified cook-logging bottom sheet with 7 inline SVG icons

- Service additions: getTimesCooked(), updateTimesCooked() in postService.ts

**Wiring:**

- RecipeDetailScreen overflow menu redesigned (grouped layout, icons, "I Made This" highlighted, Cook Soon state toggle, view mode radios, Delete Recipe newly added)

- RecipeDetailScreen wired: overflow menu → TimesMadeModal → LogCookSheet → createDishPost

- PostCookFlow simplified (removed share section, kept remember chips + modifications input)

- CookingScreen refactored to use LogCookSheet instead of PostCreationModal

- FeedScreen.loadDishPosts() filters by visibility

**Testing result:** Surfaced critical bugs and UX gaps. Triggered 7B-Rev pass.

**Session log entries:** 2026-03-24 — Phase 7B Components, then Phase 7B Wiring

### 7B-Rev — Polish Pass (2026-04-06)

Comprehensive revision pass addressing all 7B testing feedback. 9 parts:

**Bug fixes:**

- posts_rating_check constraint violation — rating now passes null instead of 0; DB migration allows nullable numeric(3,1)

- Delete Recipe now actually deletes — extracted to recipeService.deleteRecipe()

- Keyboard covers thoughts field — KeyboardAvoidingView with behavior="position", InputAccessoryView Done button, tap-outside-to-dismiss

- TimesMadeModal re-open bug — redesigned to show additions delta instead of absolute count

**Feature changes:**

- LogCookSheet split into compact (recipe detail) and full (cooking mode) modes via mode prop

- Half-star slide-to-rate with PanResponder, teal color, slide-left-to-clear, per-star position mapping with gap awareness

- CTA flip on RecipeDetailScreen — primary "Log This Cook" (compact LogCookSheet), secondary "Cook in Step-by-Step Mode" text link

- PostCookFlow merged into LogCookSheet full mode (PostCookFlow.tsx marked deprecated)

- Edit mode banner with Exit button below sticky bar

- PencilIcon component built from noun-pencil SVGs

- "I've Made This Before" menu item using TimesMadeModal (decoupled from post creation)

- View mode renamed Original / Clean / Markup under "Recipe View" subheader

- Step notes display added to RecipeDetailScreen "Your Private Notes" section

**DB changes (run by Tom in Supabase Dashboard):**

ALTER TABLE posts ALTER COLUMN rating TYPE numeric(3,1);

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_rating_check;

ALTER TABLE posts ADD CONSTRAINT posts_rating_check

CHECK (rating IS NULL OR (rating \>= 0 AND rating \<= 5));

**Note:** This migration is the source of two drift bugs discovered later in Checkpoint 4 — detectPlannedMealForCook time bands and get_meal_dishes / get_meal_plan_items RPC return types. Both fixed during Checkpoint 4. See T3 in DEFERRED_WORK for the schema-change-propagation discipline lesson learned.

**Testing result:** ✅ Passed (Tom confirmed 2026-04-06).

**Session log entries:** 2026-04-06 — Phase 7B Revision: Post-Test Fixes, then Phase 7B Revision: UX Polish Pass (Star Rating, Keyboard, Modal Layout)

### 7C — Meal Plan "Create new meal" wiring fix (2026-04-06)

Root cause: onCreateNewMeal callback in RecipeDetailScreen.tsx was wired to () =\> {} (empty function). The \<SelectMealForRecipeModal\> was rendered but its "Create new meal" button did nothing. Fix: added showCreateMealModal state to RecipeDetailScreen, render \<CreateMealModal\> with initialRecipeId={recipe.id} and initialRecipeTitle={recipe.title} (CreateMealModal already accepted these props), wired onCreateNewMeal to open it. Tested ✅.

**Session log entry:** 2026-04-06 — Phase 7C Meal Plan Wiring Fix

### 7D — Multi-cook Data + Service Layer (2026-04-07, Checkpoint 1)

Delivered as Checkpoint 1 of the combined 7D+7E build prompt.

**Audit findings:**

- All four meal flow paths (CreateMealModal entry points, addDishesToMeal write paths, MealDetailScreen render path) are functional. P7-15 closed.

- Gap 9 confirmed: loadMealPosts in FeedScreen lacked the visibility filter that loadDishPosts had. Both broadened to include followers (the new global default per D34) — addressed in Checkpoint 2a.

- All 11 documented gaps confirmed real, no surprises.

**Migration spec produced and run by Tom in Supabase:**

ALTER TABLE post_participants

ADD COLUMN external_name TEXT NULL;

ALTER TABLE post_participants

ALTER COLUMN participant_user_id DROP NOT NULL;

ALTER TABLE post_participants

ADD CONSTRAINT chk_participant_identity

CHECK (participant_user_id IS NOT NULL OR external_name IS NOT NULL);

ALTER TABLE posts

ADD COLUMN dish_name TEXT NULL;

ALTER TABLE posts DROP CONSTRAINT IF EXISTS chk_posts_visibility;

ALTER TABLE posts ADD CONSTRAINT chk_posts_visibility

CHECK (visibility IS NULL OR visibility IN ('everyone', 'followers', 'private', 'meal_tagged'));

ALTER TABLE meal_dish_plans

ADD COLUMN logged_meal_post_id UUID NULL

REFERENCES posts(id) ON DELETE SET NULL;

CREATE INDEX idx_meal_dish_plans_logged_meal_post_id

ON meal_dish_plans(logged_meal_post_id)

WHERE logged_meal_post_id IS NOT NULL;

**Service additions (Checkpoint 1 sketch, Checkpoint 4 implementation):**

- wrapDishIntoNewMeal in mealService.ts per D26 / Option γ. Locked decision: implementation uses addDishesToMeal for the linking step rather than hand-rolling the three writes. This pattern is what surfaced the Fix Pass 3 drift bug — see Current Work.

**Status:** ✅ Done. Checkpoint 1 closed cleanly.

### 7E — Cook-logging → Meal Handoff (2026-04-07, Checkpoints 2-4)

Delivered as Checkpoints 2, 3, and 4 of the combined 7D+7E build prompt.

#### Checkpoint 2a — Chip + visibility model + override overlay

**Built:**

- Meal-attach chip in LogCookSheet's chip row (idle/active states)

- Inline "Visible to · {value} ›" affordance above primary CTA

- Visibility override overlay (4 values, meal_tagged disabled when no meal context)

- D34 visibility default model with global Followers + contextual rules

- Gap 9 fix: broadened both loadDishPosts and getMealsForFeed visibility filters to include followers

- Fixed postService.createDishPost meal_type hardcoding via new computeMealType() helper with precedence parentMeal.meal_type → recipe.meal_type → time-of-day bands → 'dinner' fallback

**Status:** ✅ Done.

#### Checkpoint 2b — Smart-detect + banner states

**Built:**

- detectPlannedMealForCook in mealService.ts per D33 (tiered fallback ±4hr → meal-type slot → same-day; high/low confidence split based on whether recipe is in meal_dish_plans)

- High-confidence auto-attach banner (teal, sparkle)

- Low-confidence recommendation card with "Attach" / "Not this one" buttons

- Confirmed banner state for attached meal context

**Bugfixes during testing (3 rounds):**

- computeMealType signature broadened from positional (recipeMealType?) to object ({recipe, parentMeal}) so parent meal can take highest precedence. Fixed dish at 1pm attached to "Tuesday Dinner" being written as meal_type='lunch'.

- Solo lunch defaulting fixed (call site routing through new object signature)

- Time bands tightened to 4 bands (breakfast \<10:30, lunch 10:30-14:00, dinner 14:00-22:00, late_night 22:00+) — dropped snack and brunch windows

**Note:** This time-band tightening did NOT propagate to the duplicate inline band logic in detectPlannedMealForCook, which kept a 5-band scheme (with a snack slot). This drift was missed at the time and only discovered in Checkpoint 4 Fix Pass 1 — see below. Lesson captured in T3 of DEFERRED_WORK.

**Status:** ✅ Done.

#### Checkpoint 3 — Meal picker + in-sheet meal creation + Tag chip wiring

**Built:**

- MealPicker.tsx sub-view (state 1c)

- InSheetMealCreate.tsx form per D36/D37 (inline tagging via pill-based picker, free-text guest support, no escape to AddCookingPartnersModal)

- Sheet content-replacement pattern (sheetView state — main/picker/create) replacing the original sub-modal approach

- Tag chip wired to AddCookingPartnersModal with initialSelectedIds prop for pre-selection on re-open

**Bugfixes during testing (4 rounds):**

- Sibling Modal stacking on iOS — moved AddCookingPartnersModal to be nested inside the main Modal

- maxHeight vs height on sheet style — children with flex: 1 were collapsing inside an unbounded parent

- Picker wrapper missing flex: 1 — added inline to picker and create view wrappers

- Tag chip data flow wiring (3 attempts) — the data chain (state → LogCookData → parent screen addParticipantsToPost) was specified in two earlier prompts and CC didn't implement either time. Third prompt was a literal 7-step instruction with code snippets and finally landed.

**Status:** ✅ Done.

#### Checkpoint 4 — "Made other dishes too?" + Option γ wrap + overflow + comments label

**Built:**

- MadeOtherDishesSheet.tsx per D40 (planned variant with meal_dish_plans suggested rows; unplanned variant with cook-soon + frequently-cooked recommendation cards; recipe search; freeform dish support)

- wrapDishIntoNewMeal implementation per D26 / Option γ (uses addDishesToMeal for linking, not hand-rolled writes — locked decision from Checkpoint 1)

- "Add to meal" overflow item on RecipeDetailScreen with picker → wrap path

- Parent meal link banner above hero photo (D26 affordance)

- After-wrap floating toast per D39

- "Comments on this dish" label per D28

**Initial review surfaced 6 issues requiring Fix Pass 1.**

#### Checkpoint 4 Fix Pass 1 (2026-04-07)

Six fixes, all landed and verified:

1.  **Freeform dish insert missing meal_type and explicit recipe_id: null** — added mealType prop to MadeOtherDishesSheet, threaded through both RecipeDetailScreen and CookingScreen call sites, called computeMealType to compute the inheritance.

2.  **MyPostDetailsScreen parent meal banner hardcoded "a meal"** — added second query in loadPost to fetch the parent meal's title.

3.  **detectPlannedMealForCook time band drift** — extracted computeMealTypeFromHour as a shared helper in postService.ts used by computeMealType, detectPlannedMealForCook, and handleWrapCreateNew in RecipeDetailScreen. Eliminates the inline-band drift pattern. The bug was a pre-existing Checkpoint 2b regression that had been live for 3 checkpoints — caused smart-detect to miss planned dinners in the afternoon.

4.  **"Add to meal" menu item not gated on existing dish posts** — added hasPublishedDishPost state, queried on mount, used to conditionally render the menu item. Set to true after successful createDishPost so it appears immediately without reload.

5.  **CommentsScreen header title hardcoded to "Comments"** — added post_type to post query, set navigation.setOptions based on type after post loads. Dish posts show "Comments on this dish", meal posts show "Comments". App.tsx unchanged.

6.  **Recommendation signal 3 label/semantic mismatch** — changed label from "You've cooked this N×" (which used recent post counts, not all-time times_cooked) to "Cooked N× recently" to match the actual semantic.

**Status:** ✅ Done.

#### Checkpoint 4 Fix Pass 2 (2026-04-07)

Two fixes, both landed and verified via break-and-revert manual test:

1.  **JSX unicode escapes rendering as literal text (Bug A)** — three locations in MadeOtherDishesSheet.tsx plus one extra in RecipeDetailScreen.tsx (line 1151, found via grep sweep — manual code review had explicitly approved this banner) had \u2026 and \u00b7 rendering as literal \u2026 and \u00b7 in the UI. Root cause: JSX text nodes and attribute values don't process JS string escape sequences the way JS literals do. Fixed by replacing with literal … and · characters.

2.  **Silent error swallowing in handleDone (Bug C)** — three inner try/catch blocks were logging to console and silently continueing past failures, hiding a real DB error during testing. Refactored to collect-and-report pattern: failures array, end-of-loop case handling (all-good closes sheet, all-failed shows Alert and keeps sheet open for retry, partial-failure shows Alert listing failed dishes then closes), setSubmitting(false) moved to finally block. Verified by intentionally breaking the parent_meal_id insert and confirming the Alert surfaced the real Postgres 22P02 error.

**Status:** ✅ Done.

#### Checkpoint 4 direct-in-Supabase DDL migration (2026-04-07)

During Fix Pass 2 verification testing, a Postgres error surfaced in Supabase Logs: structure of query does not match function result type — Returned type numeric(3,1) does not match expected type integer in column 4.

**Root cause:** Checkpoint 7B-Rev's posts.rating migration (integer → numeric(3,1)) did not propagate to the RETURNS TABLE signatures of two RPCs that select from posts.rating. Postgres strictly enforces return-shape matching, so any call to these RPCs against a dish with a rating threw at runtime.

**Affected RPCs:**

- get_meal_dishes (used by getMealDishes in mealService, called by MealDetailScreen and indirectly by the wrap flow's "View meal" action)

- get_meal_plan_items (used for meal plan rendering)

**Sibling RPCs audited and confirmed clean:** can_add_dish_to_meal, get_meal_participants, get_user_recent_meals — none select posts.rating.

**DDL run directly in Supabase SQL Editor by Tom.** Recorded in full in the "Direct DB Migrations" section below for reproducibility.

**Status:** ✅ Done. Verified post-migration: both RPCs now return dish_rating numeric in their signatures.

#### Checkpoint 4 verification testing (2026-04-07)

Original verification checklist had 9 tests. Status as of EOD 2026-04-07:

| **\#** | **Test** | **Status** |
|----|----|----|
| 1 | Freeform dish meal_type inheritance | ✅ Verified in DB (Rice-verification-001 row had meal_type='dinner', recipe_id=null, parent_meal_id set correctly) |
| 2 | MyPostDetailsScreen parent meal banner shows real title | ✅ Confirmed |
| 3 | Smart-detect afternoon dinner matching (Checkpoint 2b regression fix) | ✅ Confirmed |
| 4 | "Add to meal" menu visibility (4a hidden on no-dish recipe, 4b appears after first log) | ✅ Confirmed both states |
| 5 | CommentsScreen "Comments on this dish" header | ✅ Confirmed |
| 6 | "Cooked N× recently" recommendation label | ✅ Confirmed |
| 7 | Non-freeform dishes still work in MadeOtherDishesSheet | ⏸️ Deferred pending Fix Pass 3 |
| 8 | Solo dish logging regression check | ⏸️ Deferred pending Fix Pass 3 |
| 9 | Wrap toast "View meal" navigation (post-RPC-migration) | ⏸️ Deferred pending Fix Pass 3 |

Tests 7-9 were deferred because all three exercise createDishPost paths that are currently broken. Running them would just create more drift data.

**Session log entries:** 2026-04-07 — Phase 7D/7E Checkpoint 1 (audit + migration spec), Checkpoint 2a (chip + visibility), Checkpoint 2b (smart-detect + banner states + 3 bugfixes), Checkpoint 3 (meal picker + in-sheet creation + 4 bugfix rounds), Checkpoint 4 (initial pass), Checkpoint 4 Fix Pass 1, Checkpoint 4 Fix Pass 2

## Direct DB Migrations (ran outside a migrations folder)

Phase 7 has run several DDL changes directly in Supabase SQL Editor rather than through a migrations folder (which doesn't exist yet — see P7-23). Recording them here so the DDL isn't lost and new environments can reproduce the DB state.

### 2026-04-06 — 7B-Rev: rating column type change

ALTER TABLE posts ALTER COLUMN rating TYPE numeric(3,1);

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_rating_check;

ALTER TABLE posts ADD CONSTRAINT posts_rating_check

CHECK (rating IS NULL OR (rating \>= 0 AND rating \<= 5));

**Why:** Half-star slide-to-rate UX needed rating to support 0.5 increments; original integer type didn't allow it. Constraint also relaxed to allow null for "no rating yet" state.

**Cascading impact (discovered later):** This migration is the root cause of three downstream drift bugs that surfaced in Checkpoint 4 — see T3 in DEFERRED_WORK.

### 2026-04-07 — 7D Checkpoint 1: multi-cook & meal experience schema additions

ALTER TABLE post_participants

ADD COLUMN external_name TEXT NULL;

ALTER TABLE post_participants

ALTER COLUMN participant_user_id DROP NOT NULL;

ALTER TABLE post_participants

ADD CONSTRAINT chk_participant_identity

CHECK (participant_user_id IS NOT NULL OR external_name IS NOT NULL);

ALTER TABLE posts

ADD COLUMN dish_name TEXT NULL;

ALTER TABLE posts DROP CONSTRAINT IF EXISTS chk_posts_visibility;

ALTER TABLE posts ADD CONSTRAINT chk_posts_visibility

CHECK (visibility IS NULL OR visibility IN ('everyone', 'followers', 'private', 'meal_tagged'));

ALTER TABLE meal_dish_plans

ADD COLUMN logged_meal_post_id UUID NULL

REFERENCES posts(id) ON DELETE SET NULL;

CREATE INDEX idx_meal_dish_plans_logged_meal_post_id

ON meal_dish_plans(logged_meal_post_id)

WHERE logged_meal_post_id IS NOT NULL;

**Why:** Closes Gaps 4, 10, 11 from the architecture section and enables D27 (external participants), D23 (freeform dishes), D35 (4-value visibility enum), and D33 (smart-detect via planned meal link).

### 2026-04-07 — Checkpoint 4 Fix Pass 2: RPC return-type correction

**Why:** posts.rating was changed from integer to numeric(3,1) in 7B-Rev, but two RPCs (get_meal_dishes, get_meal_plan_items) still had dish_rating integer hardcoded in their RETURNS TABLE signatures. Postgres strictly enforces return-shape matching, so any call to these RPCs against a dish with a rating threw structure of query does not match function result type. Surfaced in Supabase Postgres Logs during Checkpoint 4 freeform insert testing.

**Context:** Three sibling RPCs were audited and confirmed clean: can_add_dish_to_meal, get_meal_participants, get_user_recent_meals — none select posts.rating.

**DDL run (copy/paste into Supabase SQL Editor to reproduce):**

-- Fix numeric(3,1) vs integer drift on meal RPCs

-- get_meal_dishes

DROP FUNCTION IF EXISTS public.get_meal_dishes(uuid);

CREATE OR REPLACE FUNCTION public.get_meal_dishes(p_meal_id uuid)

RETURNS TABLE(

dish_id uuid,

dish_title text,

dish_user_id uuid,

dish_rating numeric(3,1),

dish_photos jsonb,

dish_created_at timestamp with time zone,

recipe_id uuid,

recipe_title text,

recipe_image_url text,

course_type text,

is_main_dish boolean,

course_order integer,

contributor_username text,

contributor_display_name text,

contributor_avatar_url text

)

LANGUAGE plpgsql

AS \$function\$

BEGIN

RETURN QUERY

SELECT

d.id as dish_id,

d.title as dish_title,

d.user_id as dish_user_id,

d.rating as dish_rating,

d.photos as dish_photos,

d.created_at as dish_created_at,

d.recipe_id,

r.title as recipe_title,

r.image_url as recipe_image_url,

dc.course_type,

dc.is_main_dish,

dc.course_order,

up.username as contributor_username,

up.display_name as contributor_display_name,

up.avatar_url as contributor_avatar_url

FROM dish_courses dc

JOIN posts d ON d.id = dc.dish_id

LEFT JOIN recipes r ON r.id = d.recipe_id

LEFT JOIN user_profiles up ON up.id = d.user_id

WHERE dc.meal_id = p_meal_id

ORDER BY

CASE dc.course_type

WHEN 'appetizer' THEN 1

WHEN 'main' THEN 2

WHEN 'side' THEN 3

WHEN 'dessert' THEN 4

WHEN 'drink' THEN 5

WHEN 'other' THEN 6

END,

dc.is_main_dish DESC,

dc.course_order,

d.created_at;

END;

\$function\$;

-- get_meal_plan_items

DROP FUNCTION IF EXISTS public.get_meal_plan_items(uuid);

CREATE OR REPLACE FUNCTION public.get_meal_plan_items(p_meal_id uuid)

RETURNS TABLE(

id uuid,

meal_id uuid,

course_type text,

placeholder_name text,

is_main_dish boolean,

claimed_by uuid,

claimed_at timestamp with time zone,

claimer_username text,

claimer_display_name text,

claimer_avatar_url text,

recipe_id uuid,

recipe_title text,

recipe_image_url text,

dish_id uuid,

dish_title text,

dish_rating numeric(3,1),

completed_at timestamp with time zone,

created_at timestamp with time zone,

created_by uuid

)

LANGUAGE plpgsql

AS \$function\$

BEGIN

RETURN QUERY

SELECT

mdp.id,

mdp.meal_id,

mdp.course_type,

mdp.placeholder_name,

mdp.is_main_dish,

mdp.claimed_by,

mdp.claimed_at,

claimer.username as claimer_username,

claimer.display_name as claimer_display_name,

claimer.avatar_url as claimer_avatar_url,

mdp.recipe_id,

r.title as recipe_title,

r.image_url as recipe_image_url,

mdp.dish_id,

dish.title as dish_title,

dish.rating as dish_rating,

mdp.completed_at,

mdp.created_at,

mdp.created_by

FROM meal_dish_plans mdp

LEFT JOIN user_profiles claimer ON claimer.id = mdp.claimed_by

LEFT JOIN recipes r ON r.id = mdp.recipe_id

LEFT JOIN posts dish ON dish.id = mdp.dish_id

WHERE mdp.meal_id = p_meal_id

ORDER BY

CASE mdp.course_type

WHEN 'appetizer' THEN 1

WHEN 'main' THEN 2

WHEN 'side' THEN 3

WHEN 'dessert' THEN 4

WHEN 'drink' THEN 5

ELSE 6

END,

mdp.is_main_dish DESC,

mdp.created_at ASC;

END;

\$function\$;

**Verification after run:** pg_get_function_result for both should show dish_rating numeric (the (3,1) precision is stripped in display but preserved internally). Ran and verified on 2026-04-07.

**Related cleanup items:** P7-23 (set up supabase/migrations/ folder), T3 in DEFERRED_WORK (schema change propagation discipline rule).

### 2026-04-08 — Checkpoint 4 Fix Pass 3: createDishPost drift backfill

**Why:** createDishPost was writing parent_meal_id directly into the posts row when called with a parentMealId argument, but NOT writing the corresponding dish_courses or post_relationships rows. Every cook logged through LogCookSheet → meal attach → publish over the past several months left dish_courses and post_relationships unwritten for that dish. These dishes are invisible to getMealDishes RPC and to any future feed-grouping logic. Code fix (Fix Pass 3) closes the writing path; this backfill repairs historical drift.

**Surfaced during:** Checkpoint 4 fix pass 2 verification testing. Tom ran SQL to inspect Tuesday Dinner's state and found 16 dishes linked via parent_meal_id but only 5 dish_courses rows.

**DDL to run (to be filled in tomorrow after Fix Pass 3 scoping):** See CC_PROMPT_7D_7E_CHECKPOINT_4_FIX_PASS_3.md for the draft backfill SQL.

**Verification after run:** Scoping query should return zero drifted dishes across all meals. getMealDishes(\<meal_id\>) should return all legitimate dishes attached to each meal (excluding any test data that was deleted rather than backfilled).

## Testing Results

### 2026-03-24 — Pre-revision testing (7B initial pass)

Tom tested 7B on iOS simulator. Surfaced critical issues that drove the 7B Revision pass. See "What Failed Testing" in this section for the full list — all items addressed in 7B-Rev.

**Critical bugs found:**

- posts_rating_check constraint violation on submit

- Delete Recipe didn't actually delete

- Keyboard covered thoughts field

- TimesMadeModal re-open bug (default to N+1 with no way down)

- Meal Plan "Create new meal" closes back without creating (now 7C)

- React key prop warning in Meal Plan (could not reproduce in 7B-Rev investigation)

- Step notes not displaying on recipe detail

**UX concerns:**

- View mode names don't describe what they show

- Make-again + rating felt redundant

- Star rating should be teal, half-star, slide-to-rate

- Historical cook logging needs real date support

- Edit Mode needs clearer indicator + exit button

- Primary CTA should be "I Made This" (now "Log This Cook")

- PostCookFlow → LogCookSheet two-step felt redundant

- LogCookSheet should feel lightweight from recipe detail

### 2026-04-06 — Post-revision testing (7B-Rev)

Tom tested 7B-Rev. ✅ All previously-failing items now pass. No new critical issues. Two items remaining for 7C: Meal Plan "Create new meal" wiring fix (now also done).

### 2026-04-07 — Checkpoint 1-4 progressive testing

Each checkpoint was tested as it landed:

- **Checkpoint 1:** Migration verified column-by-column in Supabase. ✅

- **Checkpoint 2a:** Chip + visibility + override overlay tested in simulator. ✅

- **Checkpoint 2b:** Smart-detect + banner states tested with three bugfix rounds for parent meal type inheritance, solo lunch defaults, and time band tightening. ✅ (regression in detectPlannedMealForCook discovered later in Checkpoint 4 — fixed in Fix Pass 1.)

- **Checkpoint 3:** Meal picker + in-sheet creation + Tag chip data flow tested with four bugfix rounds (sibling Modal, sheet height, picker flex, Tag chip wiring). ✅

- **Checkpoint 4:** Initial build tested. ✅ Six issues found in review, fixed in Fix Pass 1.

- **Checkpoint 4 Fix Pass 1:** Re-tested. ✅ Two new issues found during testing (unicode escapes, silent error swallowing) plus one DB-level issue (RPC return-type drift) found via Supabase Logs. Fixed in Fix Pass 2 + direct DDL migration.

- **Checkpoint 4 Fix Pass 2:** Manually verified via break-and-revert test. Both fixes confirmed working. Tests 1-6 of the 9-item verification checklist pass. ✅

- **Drift finding (the trigger for Fix Pass 3):** During Test 7 setup, SQL inspection of Tuesday Dinner revealed createDishPost doesn't write dish_courses or post_relationships rows. 16 dishes via parent_meal_id, only 5 dish_courses rows. Pre-existing bug since Model 1 shipped, only surfaced under intensive Checkpoint 4 testing. Tests 7-9 deferred pending Fix Pass 3.

## Current Work

### Phase 7I — COMPLETE (2026-04-15)

Phase 7I closed after Checkpoint 7. All deprecated components deleted, test harness removed, architecture doc updated. See Phase 7I Closeout Statement in SESSION_LOG.

### Phase 7 — COMPLETE (2026-04-17)

All 13 sub-phases shipped and verified on device. 78 items delivered, 42 deferred to post-F&F. See PHASE_7_STATUS_REPORT.md for the full audit.

### Key legacy items from Checkpoint 7

- MealDetailScreen.tsx kept but deprecated — still referenced by 4 Meals-tab screens (see P7-100)

- PostActionMenu.tsx kept — still referenced by MyPostDetailsScreen + MyPostsScreen (see P7-102)

- console.warn instrumentation on CookDetailScreen + MealEventDetailScreen left in place for dogfooding; removes with 7M

- Stale post_type='meal' queries in MyMealsScreen + EditMealModal fixed (P7-101)

### Deferred from 7G+7H execution

- P7G-1: getLinkedCookPartnersForPosts temporal window uses created_at — backdated cooks won't match reciprocal partners correctly

- P7G-2: Legacy groupPostsForFeed dead code still has created_at sorting — delete in next cleanup pass

- P7H-1: CookDetailScreen cross-stack nav audit (StatsStack vs FeedStack internal navigation)

- P7H-2: Legacy MyPostDetailsScreen/MyPostsScreen routes orphaned from Stats tab — cleanup with P7-100/P7-102

## Deferred Items (Phase 7-Internal)

These items surfaced during Phase 7 work and are deferred. They live here until Phase 7 completes, then get reconciled into DEFERRED_WORK.md.

| **\#** | **Item** | **Type** | **Priority** | **Notes** |
|----|----|----|----|----|
| P7-1 | Step notes + annotations unification | 🔧 | 🟢 | Two separate tables (recipe_step_notes and recipe_annotations). Both now display in "Your Private Notes" but originate from different code paths. Could unify post-launch. |
| P7-2 | posts.make_again column cleanup | 🔧 | 🟢 | Column exists but unused after 7B-Rev. Drop when convenient post-launch. |
| P7-3 | PostCookFlow.tsx file deletion | 🔧 | 🟢 | Marked deprecated in 7B-Rev. No longer rendered anywhere. Delete in cleanup pass. |
| P7-4 | LogCookSheet inline SVG extraction | 🔧 | 🟢 | 7 SVG icons inline at top of file. Extract to components/icons/ if reused. |
| P7-5 | View mode naming iteration | 💡 | 🟡 | "Original / Clean / Markup" is provisional. Iterate post-F&F with user feedback. See Overflow Menu playbook. |
| P7-6 | Overflow menu context header iteration | 💡 | 🟡 | Tom flagged the whole overflow menu as needing post-F&F iteration. See Overflow Menu playbook. |
| P7-7 | Voice memo on LogCookSheet | 🚀 | 🟡 | Placeholder chip in LogCookSheet. Needs recording + transcription. Carries P6-24. |
| P7-8 | Photo upload on LogCookSheet | 🚀 | 🟡 | Placeholder buttons in LogCookSheet. Needs image picker. Carries P6-23. |
| P7-9 | Partner tagging on LogCookSheet | 🚀 | 🟢 | ✅ Done in Checkpoint 3 — Tag chip wired to AddCookingPartnersModal. |
| P7-10 | Meal Plan key prop warning | 🐛 | 🟢 | Could not reproduce during 7B-Rev investigation. All .map() calls in SelectMealForRecipeModal and CreateMealModal have proper keys. Monitor in next testing pass. |
| P7-11 | Edit mode notebook aesthetic + structural ingredient editing | 🚀 | 🟡 | Minimum-viable banner shipped in 7B-Rev. Full redesign (notebook aesthetic, structural ingredient editing, drag handles, "or" syntax) is Phase 11. |
| P7-12 | Recipe deletion service expansion | 🔧 | 🟢 | recipeService.ts currently only has deleteRecipe(). Other recipe CRUD still happens inline in screens. Consolidate over time. |
| P7-13 | Star rating tap interaction polish | 💡 | 🟢 | Slide-to-rate works. Pure tap-on-star also works. Mixed interactions (tap then slide) could be smoother. |
| P7-14 | Three parallel meal↔dish representations — REFRAMED | 🔧 | 🟡 | **Originally framed as redundancy concern; reframed by P7-25 as active drift bug.** addDishesToMeal writes to all three of posts.parent_meal_id, dish_courses, AND post_relationships. Originally documented as redundant — each saying the same thing. Checkpoint 4 investigation revealed they're not redundant in practice: createDishPost was writing only parent_meal_id while addDishesToMeal writes all three. That's active drift. Code fix in Checkpoint 4 Fix Pass 3 closes the writing gap. The deeper question of "should one of the three representations be dropped" is now P7-25. |
| P7-15 | CreateMealModal entry point audit | 🔧 | 🟢 | ✅ Done in Checkpoint 1 audit. Two entry points confirmed (Meals tab, SelectMealForRecipeModal). |
| P7-16 | Verify meal post visibility filter (Gap 9) | 🐛 | 🟡 | ✅ Done in Checkpoint 2a. Both loadDishPosts and getMealsForFeed now filter by visibility including the new followers default. |
| P7-17 | Retroactive external participant claim path | 🚀 | 🟢 | When an externally-tagged participant later joins Frigo, they should be able to claim past attribution rows (set participant_user_id to their user, null out external_name). Schema in 7D supports it; UI is post-launch. |
| P7-18 | Like/comment attribution rendering on wrapped meal posts | 🚀 | 🟡 | Per D28: when a dish post is wrapped into a meal via D26, likes/comments stay attached to the dish. Meal card shows aggregate engagement; dish detail shows the specific likes/comments. Needs explicit rendering logic in MealPostCard during 7F. Flagging here so it can't be quietly designed away. |
| P7-19 | Concept cooking inline suggestions for freeform dishes | 🚀 | 🟢 | When a user types a freeform dish name like "rice", surface concept matches inline as suggestions. Depends on Phase 11 concept cooking landing first. Marker only — no design now. |
| P7-20 | ~~Meal-shaped contextual privacy default policy implementation~~ — **superseded by D34**. D25 retired during wireframe review. The new global+contextual model (D34) is implemented in 7E (hardcoded defaults) with the settings UI in 7L. Item kept for traceability. | 🚀 | 🟢 | Superseded |
| P7-21 | User-configurable contextual privacy rules | 🚀 | 🟢 | Per D34: the contextual rules layered on top of the global default (e.g. solo lunch → Just me) are hardcoded in v1. Making them user-configurable requires a small rules-engine UI in settings. Defer beyond 7L. Revisit with real F&F usage data — if testers don't push back on the hardcoded rules, this can stay deferred indefinitely. |
| P7-22 | Orphan meal_dish_plans CHECK constraint | 🔧 | 🟢 | Surfaced during Checkpoint 4 testing. DB currently allows meal_dish_plans rows where both recipe_id and placeholder_name are NULL, which causes the "Made other dishes too?" sheet to render an empty "Planned dish" row. One such orphan row was found on Tuesday Dinner test meal and cleaned up. Fix: ALTER TABLE meal_dish_plans ADD CONSTRAINT chk_meal_dish_plans_has_content CHECK (recipe_id IS NOT NULL OR placeholder_name IS NOT NULL);. Deferred because (1) it's not blocking 7D/7E/7F, (2) need to SELECT for other orphans first before the constraint will apply cleanly, (3) no need for mid-phase schema changes. Do as a small cleanup in Phase 8 or 9. |
| P7-23 | Set up supabase/migrations/ tracking | 🔧 | 🟡 | As of Checkpoint 4 fix pass 2, at least four direct-in-Supabase migrations have been run without a migrations folder: 7B-Rev rating column type change, Checkpoint 1 schema additions (7D), Checkpoint 4's get_meal_dishes + get_meal_plan_items DDL fix, and pending Fix Pass 3's createDishPost drift backfill. DB state is becoming non-reproducible for new environments. Not urgent but increasingly valuable — set up supabase/migrations/ with all historical DDL documented in date-ordered files. Can be done as a weekend cleanup, doesn't require a phase. |
| P7-24 | Silent error swallowing audit across services | 🔧 | 🟢 | Checkpoint 4 fix pass 2 replaced the silent-continue pattern in MadeOtherDishesSheet.handleDone after a real DB error was hidden during testing. Other services may have the same pattern. Audit lib/services/\*.ts for try { ... } catch { console.error(...); continue; } or equivalent and replace with collect-and-report. Low urgency because errors still get logged; high value because silent failures during F&F testing will erode Tom's confidence in the app's correctness signals. |
| P7-25 | addDishesToMeal representation audit (updates P7-14) | 🔧 | 🟡 | **This updates P7-14's framing.** P7-14 originally described the three parallel meal↔dish representations as redundant. Checkpoint 4 investigation revealed they're not redundant in practice — createDishPost was writing only one of the three, leading to active drift. Fix Pass 3 closes the writing gap. **After Fix Pass 3 lands,** reassess whether any of the three representations is still genuinely unused and can be dropped, OR whether they should all stay and the real fix is keeping them in sync via a shared helper. Likely outcome: post_relationships with relationship_type='meal_group' is unused and can be dropped (it duplicates what parent_meal_id says in a less convenient shape). Do this audit in Phase 7I (linked posts wiring) or Phase 9 (meal UX rebuild), not now. |
| P7-26 | MadeOtherDishesSheet course_order collision | 🐛 | 🟢 | Surfaced in Checkpoint 4 SQL inspection. addedDishes.indexOf(dish) + 1 is used as course_order, but each sheet session starts at index 0, so dishes from different sessions collide on course_order=1. Result: non-deterministic sort order for dishes added across multiple Made-Other-Dishes sessions. Fix: query max course_order for the meal before inserting, or use a higher starting offset. Defer to Phase 9 — small impact, only affects multi-session dish addition. |
| P7-27 | Done button debounce in MadeOtherDishesSheet | 🐛 | 🟢 | SQL inspection showed 4 dishes inserted within 2 seconds on one test, suggesting a double-tap or retry on Done. The disabled={submitting} flag is in place but may not be enforced fast enough. Audit and add explicit debounce if needed. Defer to Phase 9. |

### Phase 7F wireframe session additions (2026-04-09)

The 6-pass wireframe session for 7F surfaced 14 deferred items spanning 7I scope expansion, a future eater-ratings sub-phase, a future comments sub-phase, a small follow-up, a personalization sub-phase, and one parked design concept. Each item references its source decision in PHASE_7F_DESIGN_DECISIONS.md. Grouped by target phase below.

> **Note on numbering:** P7-28, P7-29, and P7-32 in this table refer to the items added by the 2026-04-09 Phase 7F wireframe session (M3 schema audit, GroupedMealCard build, eater ratings schema migration). These same numbers are also referenced in passing by the incomplete 2026-04-08 Phase 7D/7E Checkpoint 5 closeout work (in DOC_UPDATES_WORKSHEET_2026-04-08.md and in this doc's CC Prompts table) where they referred to a different set of resolved cleanup items (null-time guard, utils extraction, meal_time default). Those Checkpoint 5 items were resolved during the 2026-04-08 session but were never added as canonical rows in this table — they're ghost references. The 2026-04-09 P-numbers are the canonical ones. See P7-43 below for the broader 4/8 doc backfill tracking item.

#### 7I scope expansion (per D44)

| **\#** | **Item** | **Type** | **Priority** | **Notes** |
|----|----|----|----|----|
| P7-28 | M3 schema audit and dish post ownership verification | 🔧 | 🟡 | Before G4rr-b can render, every dish in a multi-cook meal needs to be owned by the actual cook (not the meal creator). Audit existing data, identify drift, write migration to fix. Required prerequisite for G4rr-b implementation. Per D44. |
| P7-29 | GroupedMealCard component build | 🚀 | 🟡 | New React component implementing the G4rr-b pattern: meal-summary header (fully interactive, own engagement + actions) + indented contributor sub-cards (compact, photoless by default, own engagement + actions). Vertical teal line on left visually links the group. Per D44. |
| P7-30 | feedGroupingService rewrite for grouped meals | 🔧 | 🟡 | Current service handles same-recipe-different-cooks grouping (LinkedPostsGroup case). Expanded scope: detect when a meal has multi-cook contributions and decide whether to render as grouped (G4rr-b) vs unified (current K-family cards). Per-viewer logic optional. Per D44. |
| P7-31 | Two-level photo render rules in grouped meals | 🚀 | 🟡 | Meal-summary header surfaces meal photos from meal_photos bucket. Contributor sub-cards surface dish-tagged photos from each cook's dish post. Most sub-cards photoless. Per D46. |

#### Future eater-ratings sub-phase (per D43)

| **\#** | **Item** | **Type** | **Priority** | **Notes** |
|----|----|----|----|----|
| P7-32 | post_participants schema migration for eater ratings | 🔧 | 🟡 | Add rating numeric(3,1) and notes text columns. Per D43 option α. |
| P7-33 | Eater rating service functions with privacy enforcement | 🚀 | 🟡 | Get/set eater ratings. Privacy enforcement in queries — eater ratings must NEVER be returned in any query that surfaces them to the cook. Per D43 ζ. |
| P7-34 | Eater rating UI in meal detail | 🚀 | 🟡 | New section on meal detail viewable only by users who attended the meal as eaters. Per-dish rating affordance with the F1e+ pattern from the wireframes. First-time educational banner with re-show on 60-day lapse. Info icon backup. Per D43. |
| P7-35 | "Things I've eaten" history page in profile | 🚀 | 🟢 | New profile surface where eater ratings collect. Personal-only view. Linked from the meal detail eater rating section. Per D43. |

#### Future comments sub-phase (per D42)

| **\#** | **Item** | **Type** | **Priority** | **Notes** |
|----|----|----|----|----|
| P7-36 | @-mention parsing in comment composer | 🚀 | 🟡 | Tokenize @username, validate against followed users, render styled span, ping mentioned user. Per D42. |
| P7-37 | Comment thread subscriptions table | 🔧 | 🟡 | New table to track who's subscribed to which post's comment thread. Implicit subscribe on first comment. Mute option. Per D42. |
| P7-38 | Notification batching for meal-level comments | 🚀 | 🟡 | Aggregate meal-level comments into single rolled-up notification within a time window. Per D42. |

#### Small follow-up (7L or part of 7I — placement TBD)

| **\#** | **Item** | **Type** | **Priority** | **Notes** |
|----|----|----|----|----|
| P7-39 | Per-photo "tag as dish photo" toggle in LogCookSheet | 🚀 | 🟢 | Required for full D46 implementation. Default photo target is meal_photos bucket when meal context is present; per-photo override sends to the dish post instead. Could fold into 7I if scope allows or move to 7L if 7I gets crowded. Per D46. |

#### Personalization sub-phase (Phase 11 era)

| **\#** | **Item** | **Type** | **Priority** | **Notes** |
|----|----|----|----|----|
| P7-40 | Viewer-taste-profile model | 🚀 | 🟢 | Computed taste profile from cook history, ratings, saves, and pantry data. Required for vibe pill personalization (Q36 Reading 2) and for richer "For You" signal computation. Phase 11 territory. |
| P7-41 | Vibe pill personalized selection | 🚀 | 🟢 | Once P7-40 lands, the vibe pill can select the most-relevant vibe tag from the meal's tags based on the viewer's profile. Until then, vibe pill is static (Q36 hybrid b). |

#### Parked design concept (no specific phase)

| **\#** | **Item** | **Type** | **Priority** | **Notes** |
|----|----|----|----|----|
| P7-42 | Flip-card recipe affordance | 💡 | 🟢 | Tom liked the concept of tap-to-flip on solo dish cards to reveal recipe metadata. Not built in 7F. Not retired. Lives in the wireframes (state A1r2) as a parked idea for future iteration. Reconsider after F&F testing reveals whether the current dish-peek-tappable navigation is sufficient. |

### Doc maintenance debt surfaced 2026-04-09

| **\#** | **Item** | **Type** | **Priority** | **Notes** |
|----|----|----|----|----|
| P7-43 | Backfill the 2026-04-08 doc maintenance pass into the live phase doc | 📝 | 🟡 | The 2026-04-08 Phase 7D/7E Checkpoint 5 closeout was drafted in DOC_UPDATES_WORKSHEET_2026-04-08.md but never fully applied to the live PHASE_7_SOCIAL_FEED.md. Missing pieces: **(a)** a 2026-04-08 row in the Changelog table covering Fix Pass 3, Fix Pass 4, the historical backfill of 420 dishes across 276 meals, the RPC return type DDL fix, and Checkpoint 5 cleanup; **(b)** a 2026-04-08 sub-section in the Work Completed section replacing the forward-looking 4/7 placeholder (currently still says "(PENDING)" at line ~703) with the actual narrative; **(c)** Fix Pass 3 / Fix Pass 4 / Checkpoint 5 rows in the CC Prompts Issued table updated from 🔲 Pending to ✅ Done; **(d)** the resolved Checkpoint 5 cleanup items (null-time guard on detectPlannedMealForCook, utils extraction for computeMealTypeFromHour, in-sheet meal time default) should either be added as resolved-and-closed rows for historical traceability OR explicitly noted as "never persisted to the deferred items table — see ghost number warning above." **Tom is the authoritative source** for the 4/8 narrative — this can't be reconstructed from the worksheet alone. Recommended approach: schedule a small dedicated doc maintenance session where Tom dictates the 4/8 narrative and a Claude.ai instance writes it into the phase doc. Estimated effort: 30-45 minutes. **Until this lands, the phase doc state for Phase 7D/7E is incomplete and any new Claude.ai instance reading it will get a confused picture of where Phase 7 actually stands.** Surfaced during the 2026-04-09 7F doc maintenance pass — the dangling references to "Fix Pass 3 pending tomorrow" in the 7E status cell and the missing 2026-04-08 changelog row both trace back to this gap. |

### From Phase 7I planning (2026-04-13)

| **\#** | **Item** | **Type** | **Priority** | **Notes** |
|----|----|----|----|----|
| P7-44 | Feed infinite scroll / pagination | 🚀 | 🟡 | Still hard-capped at 200 dishes after 7F Fix Pass 7. |
| P7-45 | Pull-to-refresh ~15s hang investigation | 🐛 | 🟡 | Bundled into Checkpoint 4 — if CP4 doesn't fix it, this becomes a standalone item. **NEEDS REVIEW** |
| P7-46 | Strava-style tag-accept auto-draft flow | 🚀 | 🟡 | Checkpoint 2 builds plumbing; UI flow deferred. **NEEDS REVIEW** |
| P7-47 | Duplicate meal event detection | 💡 | 🟡 | Mary creates one, Andrew creates another for the same dinner — how to detect and merge. **NEEDS REVIEW** |
| P7-48 | Planned-dish entry flow on MealEventDetailScreen | 💡 | 🟡 | How host adds Cam's Greek salad slot before Cam posts. **NEEDS REVIEW** |
| P7-49 | "Host recap" post type | 💡 | 🟡 | Option 3 from the 4/13 conceptual discussion — host post about an evening rather than a specific dish. |
| P7-50 | RSVP flow redesign under new meal event model | 🚀 | 🟡 | Separate work — out of 7I scope. |
| P7-51 | "Related cooks from friends" on CookDetailScreen | 🚀 | 🟡 | Section at the bottom of L6, deferred from CP5. |
| P7-52 | Personalized chef page lens | 🚀 | 🟡 | Deferred from CP5. |
| P7-53 | Cookbook page number deep-linking | 🚀 | 🟡 | Tap a page number on a cook post to jump into cookbook detail. Deferred from CP5. |
| P7-54 | Collage hero photos for meal event detail | 🚀 | 🟡 | Hero photo picker on L7 could support multi-photo collage rather than single-photo highlight. |
| P7-55 | Per-cook + per-event comments as unified thread | 💡 | 🟡 | Possible convergence of CookDetail comments and MealEventDetail "About the evening" into one stream. **NEEDS REVIEW** (wait for F&F feedback) |
| P7-56 | Shared media notifications | 🚀 | 🟡 | Who gets notified when attendees add photos to a meal event's shared media pool. |
| P7-57 | Photo dimensions at upload time | 🔧 | 🟡 | Eliminates the `Image.onLoad` first-load layout shuffle by persisting width/height on upload. |
| P7-58 | Remove deprecated `'meal'` value from `PostType` union | 🔧 | 🟡 | After Checkpoint 4 bakes and no rows remain with `post_type='meal'`, backward-compat is no longer needed. |
| P7-59 | Migration rollback path | 📝 | 🟡 | Accepted tradeoff — rely on pre-migration snapshot rather than building a reverse-migration script. |

**Reframed in 4/13 planning (updates earlier rows):**

| **\#** | **Item** | **Type** | **Priority** | **Notes** |
|----|----|----|----|----|
| P7-28 | M3 schema audit | 📝 | 🟡 | Originally scoped as "verify every dish in a multi-cook meal is owned by the actual cook." Reframed: the Checkpoint 1 migration and Checkpoint 4 feed rewrite cover the practical part (cook posts retain their original authors). Audit scope shrinks to "post-Checkpoint 4 verification that no cook posts got orphaned during migration." **NEEDS REVIEW** |
| P7-29 | GroupedMealCard component | 📝 | 🟡 | **Retired.** No such component in the new model. Superseded by `CookLinkedGroup` + `LinkedGroupContainer` from Checkpoint 3. |
| P7-30 | `feedGroupingService` rewrite | 📝 | 🟡 | **Still needed** with different scope (grouping by cook partner + meal event, not `post_relationships`). Bundled into Checkpoint 2. |
| P7-31 | Two-level photo render rules in grouped meals | 📝 | 🟡 | **Partially retired.** The "meal-summary header shows meal photos" half goes away (no meal-summary header). The "LogCookSheet photo upload defaults to meal_photos when meal context is present" half survives. **NEEDS REVIEW** |

### From Phase 7I Checkpoints 4-7 (2026-04-14 / 2026-04-15)

> **Numbering note:** CC wrote P7-80 through P7-84 to the repo during Checkpoint 5 Pass 2 closeout, and D49/D50/D51 during Checkpoint 5/6 closeouts. However, the project knowledge copy used by Claude.ai planning sessions didn't reflect those writes. P7-72 through P7-79 were captured in Claude.ai working docs during Checkpoint 4/4.5 but never pasted. P7-85 through P7-102 accumulated during Checkpoints 5-7 verification feedback. All items are now consolidated here with reconciled numbering. Items P7-93 through P7-95 were allocated during Checkpoint 6 planning; CC independently used the same numbers for different items in the SESSION_LOG — this table uses the Claude.ai allocations as canonical and CC's items are renumbered to P7-100 through P7-102.

#### Infrastructure / data cleanup

| **\#** | **Item** | **Type** | **Priority** | **Notes** |
|----|----|----|----|----|
| P7-72 | Recipe image filename normalization | 🔧 | 🟡 | ~347 storage files have uppercase or double-extension filenames (e.g., .JPG, .jpeg.jpg). Rename to canonical lowercase single extension + update recipes.image_url. Also fix upstream cookbook extraction pipeline. |
| P7-73 | posts.photos jsonb shape normalization | 🔧 | 🟡 | Column contains mix of string-array (\["url1", "url2"\]) and object-array (\[{url, caption, order, is_highlight}\]) forms. CookCardInner handles both defensively (CP 4.5 Approach B) but data should be normalized and write paths audited. |
| P7-76 | console.time Metro issue | 🔧 | 🟢 | console.time/console.timeEnd doesn't surface to Metro stdout (LogBox filters them). Manual Date.now() workaround confirmed working. |
| P7-79 | Storage/DB reference integrity audit | 🔧 | 🟡 | 173 recipes have potentially broken URL patterns. At least 1 confirmed stale (Purple Sprouting Broccoli returns 404 on Supabase Storage). Need HEAD-check script to identify all broken refs. |
| P7-92 | getPendingApprovalsCount network errors | 🐛 | 🟡 | Pre-existing TypeError: Network request failed in postParticipantsService.ts. Surfaces during testing but not caused by any Phase 7I checkpoint. |
| P7-100 | Migrate Meals-tab callers from MealDetailScreen to MealEventDetailScreen | 🔧 | 🟡 | Four screens still route to legacy MealDetail: MyMealsScreen, MyPostDetailsScreen, MyPostsScreen, RecipeDetailScreen. Once migrated, MealDetailScreen.tsx and its route registration can be deleted. Surfaced in CP7. |
| P7-101 | MyMealsScreen + EditMealModal stale post_type='meal' queries | 🐛 | 🟡 | Fixed in CP7 (changed to 'meal_event'). These were silently returning empty since CP1 migration on 2026-04-13. Meals tab was broken for ~2 days. Flag in F&F release notes. |
| P7-102 | PostActionMenu.tsx cleanup | 🔧 | 🟢 | Still referenced by legacy MyPostDetailsScreen + MyPostsScreen. Delete after those screens migrate to CookDetailScreen. |

#### Feed performance

| **\#** | **Item** | **Type** | **Priority** | **Notes** |
|----|----|----|----|----|
| P7-74 | hydrateEngagement perf investigation | 🔧 | 🟡 | ~1.0s steady-state across 4 parallel queries. Leading hypothesis: computeHighlightsForFeedBatch per-post lookups or loadParticipantsForPosts N+1 pattern. |
| P7-75 | Batched getMealEventsByIds | 🔧 | 🟢 | Currently ~1.15s from N×4 round trips in prefetchPreheadContext. Batched variant reduces to 2-3 round trips. Expected loadFeed ~3.3s → ~2.5s. |

#### CookDetailScreen polish (→ Phase 7N)

| **\#** | **Item** | **Type** | **Priority** | **Notes** |
|----|----|----|----|----|
| P7-80 | Cook/prep time split on Block 8 stats grid | 🚀 | 🟢 | Currently shows aggregate recipe_cook_time_min (sum of cook + prep per Invariant 1). Splitting requires extending CookCardData with separate fields. |
| P7-81 | Highlights descriptive paragraph | 🚀 | 🟢 | Extend Highlight data model with longText field for richer Block 9 content. Currently pill-only after fix pass stripped redundant echo. |
| P7-82 | Author location line on Block 3 | 🚀 | 🟡 | Post-row data doesn't carry geo info. Location line omitted on Block 3 author block. Feed card hardcodes "Portland, OR" as placeholder. |
| P7-83 | CommentsScreen extraction for inline rendering | 🔧 | 🟢 | Extract ~400 lines of comment rendering from CommentsScreen into a reusable \<CommentList\> component for inline display on detail screens. |
| P7-84 | Pending cook partner visibility for post author | 🚀 | 🟡 | Author currently has no way to see pending sous_chef invitations on their own post. Need muted row showing "Pending: \[name\]" with cancel action. status='pending' is correct approval-gated behavior. |
| P7-85 | CommentsScreen keyboard avoidance | 🐛 | 🟡 | Text input hidden behind keyboard when opened from CookDetail/MealEventDetail tap-through. Pre-existing issue. Fix: KeyboardAvoidingView wrapper with behavior='padding' on iOS. |
| P7-87 | Photo carousel peek | 🚀 | 🟢 | Show edges of adjacent slides so users know there are more to swipe. Both feed cards and CookDetailScreen. Adjust width to ~85-90% of screen width with horizontal padding. |
| P7-88 | Multi-photo select from library | 🚀 | 🟢 | expo-image-picker allowsMultipleSelection: true. Currently single-select only. |
| P7-89 | CookDetailScreen inline photos layout | 🚀 | 🟢 | Remove separate "Photos" block (Block 12), render thumbnails inline after highlights. Reduces redundancy with hero carousel. |
| P7-90 | CookDetailScreen title in header bar | 🚀 | 🟢 | Move title from Block 4 into the nav header, replacing generic "Cook" text. Matches Strava's activity detail pattern. |
| P7-91 | "Create event" option in meal event picker | 🚀 | 🟢 | Add "Create new meal event" row to the Change meal event inline picker on CookDetailScreen. |
| P7-96 | CookDetailScreen "Your rating" label fix + eater rating on CookDetail | 🚀 | 🟡 | Block 8 "Your rating" → "\[Author\]'s rating" when viewing someone else's post. Add eater rating affordance on CookDetailScreen for viewers tagged as ate_with for the linked meal event. Two parts: label fix + new affordance. |
| P7-98 | Inline engagement bar (not sticky) on both detail screens | 🚀 | 🟡 | Move engagement bar from position: absolute bottom to inline within scroll content. MealEventDetailScreen: after "What everyone brought." CookDetailScreen: after comments. |

#### MealEventDetailScreen polish (→ Phase 7N)

| **\#** | **Item** | **Type** | **Priority** | **Notes** |
|----|----|----|----|----|
| P7-93 | Half-star eater ratings | 🚀 | 🟢 | Change eater_ratings from integer 1-5 to half-star resolution (0.5 increments). Build scrollable star component matching personal rating UX. Requires DDL alter on eater_ratings.rating column. |
| P7-94 | Eater rating privacy label | 🚀 | 🟢 | "Your rating" label with eye-slash icon or "?" info tooltip explaining D43 private-per-eater visibility rule. |
| P7-95 | Shared media thumbnail tap-through | 🚀 | 🟢 | Full-screen viewer modal or scroll-hero pattern for Block 7 shared media thumbnails. Currently render-only. |
| P7-97 | Star picker stay-open behavior | 🚀 | 🟢 | Eater rating star picker should stay open until dismissed (tap elsewhere or close button), not auto-close on star selection. Current auto-close is disorienting. |
| P7-99 | Highlight picker section headers | 🚀 | 🟢 | Split dual-pool grid into "From shared media" and "From dishes" section headers for clearer affordance. |

#### Feed polish (→ Phase 7N)

| **\#** | **Item** | **Type** | **Priority** | **Notes** |
|----|----|----|----|----|
| Feed card photo swipe reliability | 🐛 | 🟡 | Gesture handler tuning — distinguish tap (navigate to CookDetail) from horizontal swipe (carousel scroll) inside CookCard's outer Pressable. Pre-existing finicky behavior, not a CP5 regression. |  |

#### EditMedia redesign (→ Phase 7M)

| **\#** | **Item** | **Type** | **Priority** | **Notes** |
|----|----|----|----|----|
| P7-86 | EditMedia Strava-style redesign | 🚀 | 🟡 | Drag-to-reorder with hamburger handles, triple-dot per-photo menu for highlight/delete, + button at top. Current grid layout wastes space. |

### Resolved during Phase 7

These items were carried into Phase 7 from earlier phases and are now resolved:

- **P6-4** (PostCookFlow makeAgain/thoughts data gap) — Fixed in 7A

- **P6-5** (notes/modifications duplication) — Fixed in 7A

## Claude Code Prompts Issued

| **Date** | **Sub-phase** | **Prompt** | **Outcome** |
|----|----|----|----|
| 2026-03-24 | 7A | Bug fixes (P6-4 + P6-5) | ✅ Complete |
| 2026-03-24 | 7B-Components | LogCookSheet + TimesMadeModal + service additions | ✅ Complete |
| 2026-03-24 | 7B-Wiring | Overflow menu + I Made This flow + CookingScreen refactor + feed filter + auto-title | ✅ Complete (failed testing → 7B-Rev) |
| 2026-04-06 | 7B-Revision | 9-part revision pass | ✅ Complete (passed testing) |
| 2026-04-06 | 7C | Meal Plan "Create new meal" wiring fix | ✅ Complete |
| 2026-04-07 | 7D + 7E (combined) | Multi-cook & meal experience — data + service + cook→meal handoff UX. Five hard-stop checkpoints. See CC_PROMPT_7D_7E.md. | ✅ Checkpoints 1-4 complete (with three fix passes for Checkpoint 4) |
| 2026-04-07 | 7E Checkpoint 4 Fix Pass 1 | Six fixes from initial Checkpoint 4 review. See CC_PROMPT_7D_7E_CHECKPOINT_4_FIX_PASS.md. | ✅ Complete |
| 2026-04-07 | 7E Checkpoint 4 Fix Pass 2 | JSX unicode escapes + silent error swallowing. See CC_PROMPT_7D_7E_CHECKPOINT_4_FIX_PASS_2.md. | ✅ Complete (verified via break-and-revert manual test) |
| 2026-04-08 | 7E Checkpoint 4 Fix Pass 3 | createDishPost drift fix + backfill SQL. See CC_PROMPT_7D_7E_CHECKPOINT_4_FIX_PASS_3.md. | 🔲 Pending |
| TBD | 7E Checkpoint 5 | Final integration test + cleanup. | 🔲 Pending Fix Pass 3 |
| 2026-04-13 | 7I Checkpoint 1 | SQL migration post_type='meal' → 'meal_event'. See CC_PROMPT_7I_CHECKPOINT_1_MIGRATION.md. | ✅ Complete |
| 2026-04-13 | 7I Checkpoint 2 | Services layer: cook partner links, meal event queries, feed grouping. See CC_PROMPT_7I_CHECKPOINT_2_SERVICES.md. | ✅ Complete |
| 2026-04-14 | 7I Checkpoint 3 | CookCard + grouping primitives + test harness. See CC_PROMPT_7I_CHECKPOINT_3_COOKCARD.md. | ✅ Complete |
| 2026-04-14 | 7I Checkpoint 3.5 | Shared-recipe merged groups (D48). Inserted between CP3 and CP4. | ✅ Complete |
| 2026-04-14 | 7I Checkpoint 4 | FeedScreen rewrite. See CC_PROMPT_7I_CHECKPOINT_4_FEEDSCREEN.md. | ✅ Complete |
| 2026-04-14 | 7I Checkpoint 4.5 | Photo rendering fix pass (3 fixes). | ✅ Complete |
| 2026-04-14/15 | 7I Checkpoint 5 | CookDetailScreen (L6) + narrow-scope editing. Two-pass. See CC_PROMPT_7I_CHECKPOINT_5_COOKDETAIL.md. | ✅ Complete (Pass 1 + Fix Pass \#1 + Pass 2 + Fix Pass \#2) |
| 2026-04-15 | 7I Checkpoint 6 | MealEventDetailScreen (L7) + eater_ratings + host/attendee editing. Two-pass. See CC_PROMPT_7I_CHECKPOINT_6_MEALEVENTDETAIL.md. | ✅ Complete (Pass 1 + Pass 2) |
| 2026-04-15 | 7I Checkpoint 7 | Cleanup + deletion. Single-pass. See CC_PROMPT_7I_CHECKPOINT_7_CLEANUP.md. | ✅ Complete |
| 2026-04-15 | 7G + 7H (combined) | Historical cook logging + My Posts nav fix. Two hard-stop checkpoints. See CC_PROMPT_7G_7H.md. | ✅ Complete (CP1 + CP2 verified on device) |
| 2026-04-15/17 | 7N CP1 + CP2 + Fix Pass | Detail screen polish + feed carousel UX. CP1: 5 items. CP2: 6 items (incl. swipe restructure). Fix pass: 3 items. See CC_PROMPT_7N.md, CC_PROMPT_7N_CP2.md, CC_PROMPT_7N_FIXPASS.md. | ✅ Complete (all verified on device) |
| 2026-04-17 | 7M CP1 + CP2 + CP3 + 2 fix passes | Full Edit Cook screen. CP1: EditPostScreen scaffold + StarRating extraction + cookingMethods.ts. CP2: save logic + dirty state + delete. CP3: CookDetailScreen cleanup (−508 lines) + meal picker enhancement + eating with stub. Fix pass 1: cooking method constraint + screen refresh + keyboard + recipe line. Fix pass 2: partner chip display + bottom bar keyboard rise. See CC_PROMPT_7M.md. | ✅ Complete (all verified on device) |

## Phase 7I Detailed Reference

*Absorbed from `PHASE_7I_MASTER_PLAN.md` on 2026-04-20 (which can now be deleted). Captures the per-decision supersession rationale, pre-build code findings, granular checkpoint scope, ordering/milestones framing, and original 7M scope that the main Phase 7 doc summarizes but does not detail. Read this when you need the "why" behind 7I architecture decisions or when revisiting a 7I-era pattern in a later phase.*

### Supersession Notes (per-decision detail for D47)

Read these alongside the corresponding entries in `PHASE_7F_DESIGN_DECISIONS.md`. Each decision stays in the record for traceability; this section states what's been overwritten.

#### D44 — Fully superseded
- **Was:** M3 architecture with each meal participant owning their own post FOR the meal; grouped meals render as meal-summary header + contributor sub-cards (G4rr-b).
- **Is:** Every cook post is a first-class standalone unit authored by one person. Posts are linked via cook partner relationships OR meal event references, but the linked group has NO meal-summary card — only a thin tappable group header. Meal events live only on the MealEventDetailScreen (L7 wireframe).
- **What survives:** the Strava-style indent + gutter connector visual (L3b and L5 wireframes). The *algorithm* for grouping connected posts (union-find) is still applicable.
- **What's retired:** the GroupedMealCard component (P7-29 superseded), the meal-summary header with its own engagement row, the "Started by" footnote, and the two-level photo model's role of "meal-summary shows meal photos" (D46 partial).

#### D41 — Partially superseded
- **Was:** Comments dual-attached (meal-level OR dish-level), both rendered on the meal detail card with attribution chips.
- **Is:** The two-section separation of meal-level vs. dish-level comments still exists, but the two sections now live on *different screens*: dish-level comments live on the CookDetailScreen (L6), meal-level comments live on the MealEventDetailScreen (L7) in the "About the evening" section. The attribution-chip UI is gone because the two surfaces are now independent.
- **What survives:** The data model is unchanged (comments can still attach to any `posts.id`, now including `posts.id` where `post_type='meal_event'`). The notification tiering from D42 (meal-level rolled up, dish-level individual) still applies.

#### D45 — Effectively superseded
- **Was:** Multi-cook meal cards show a cooked-vs-ate byline split — "Cooked by Tom, Nick & Mary" with avatar stack of cooks only, eaters in sub-line.
- **Is:** Every cook card has exactly one author with a single avatar. Eater attribution moves entirely to the meal event detail screen's "At the table" section. There's no longer a multi-cook meal card to show a split byline on.
- **What survives:** The `post_participants` role distinction (`host`/`sous_chef`/`ate_with`) is still meaningful, but its UI interpretation shifts. `sous_chef` now means "cook partner on this specific cook post" (L3b pattern). `ate_with` now means "meal event attendee, not a cook" (surfaces on L7 only).

#### D46 — Partially superseded
- **Was:** Two-level photo model — meal photos (shared bucket, multi-uploader) for meal-summary cards, dish photos for individual dish posts. Meal-summary header shows meal photos.
- **Is:** No meal-summary card exists, so meal photos never render in the feed. The `meal_photos` table survives as the **shared media pool on the MealEventDetailScreen** (L7). Cook cards show their own `posts.photos` only.
- **What survives:** The `meal_photos` table. The "LogCookSheet uploads default to meal_photos when meal context is present" flow still makes sense as a pre-population of the shared media pool. The `is_highlight` flag on `posts.photos` still serves as "host's chosen highlight photo" for the L7 hero.

#### D43 — Unchanged
- Eater ratings schema (α) and privacy model (ζ) carry over cleanly. Each L7 dish row shows the viewer's private rating or "Tap to rate." Private-per-eater enforcement rule is unchanged.

#### D42 — Unchanged
- Notification tiering is unchanged. Already deferred to its own sub-phase; not in 7I scope.

### Pre-build Code Findings (Phase 7I)

**Before I wrote the checkpoints below, I read the current state of these files:**
- `components/LinkedPostsGroup.tsx` (the Nov 2025 linked-posts component, unwired until now)
- `lib/services/feedGroupingService.ts` (the Nov 2025 grouping service)
- `screens/FeedScreen.tsx` (post-Fix-Pass-9)
- `components/feedCard/sharedCardElements.tsx` (post-Fix-Pass-8/9)
- `components/PostCard.tsx` and `components/MealPostCard.tsx` (current feed card renderers)

**Key findings that shaped the checkpoints:**

1. **`LinkedPostsGroup.tsx` exists and has the right visual primitive** (Strava-style group with vertical connector), but its data model uses the old `post_relationships` table which 7I replaces. It also renders a shared recipe photo as the group's visual anchor and uses stacked avatars in the header, both of which conflict with the new "single avatar per card, gutter connector ties the group" model. **Decision: retire `LinkedPostsGroup` in favor of a new `CookLinkedGroup` component.** Keep the old file in the repo for reference during the build but mark it for deletion in Checkpoint 7.

2. **`feedGroupingService.ts` uses a union-find algorithm** on `post_relationships`. The algorithm itself (DFS over a graph of post IDs) is the right structure for 7I's grouping — cook partners and meal event memberships form the same kind of graph. **Decision: rewrite the service** (new signature, new data sources: `post_participants` for cook partners, `parent_meal_id` for meal event membership) but preserve the union-find structure as a known-good pattern.

3. **FeedScreen currently filters dish posts with `.is('parent_meal_id', null)`** (line in `loadDishPosts`, added as Fix Pass 4 / Fix 1). This means meal-attached dishes are hidden from the feed and only surface via `MealPostCard`'s dish peek. **Critical: this filter must be REMOVED in Checkpoint 4.** Under the new model, meal-attached dishes ARE standalone feed items — they just render with a meal event prehead. Failing to remove this filter means every dish attached to a meal event vanishes from the feed entirely. Will be called out prominently in the Checkpoint 4 prompt.

4. **`post_participants` already supports the new model's semantic reinterpretation** — `sous_chef` becomes "cook partner," `ate_with` becomes "meal event attendee." No schema change required for these role values; the change is in how services query them and how the UI renders them.

5. **`post_type` is a `text` column, not an enum** (per prior diagnostic work). Adding `'meal_event'` as a new value requires no `ALTER TYPE` — just an `UPDATE posts SET post_type = 'meal_event' WHERE post_type = 'meal'`.

6. **`posts.photos` JSONB field already has an `is_highlight` flag** on individual photo entries (visible in PostCard's photo sorting logic: `if (a.is_highlight) return -1;`). **This is the mechanism for the host's highlight photo on L7's hero** — no new field needed. The host picks which of their photos is the highlight; the MealEventDetailScreen surfaces it as the hero.

7. **`optimizeStorageUrl` in `sharedCardElements.tsx` already includes the Fix Pass 9 `resize=contain` fix**. CookCard inherits this automatically via the shared PhotoCarousel.

8. **`sharedCardElements.tsx` already exports the primitives we need:** `CardWrapper`, `CardHeader`, `TappableTitleBlock`, `PhotoCarousel`, `StatsRow`, `VibePillRow`, `EngagementRow`, `ActionRow`, `HighlightsPill`, `DescriptionLine`, `RecipeLine`, `StartedByFootnote`. CookCard reuses all of these. We add new primitives for `MealEventPrehead`, `LinkedGroupHeader`, `LinkedGroupContainer`, and `CookDishesBlock` (L2's multi-dish block).

9. **The `📖` emoji in `RecipeLine`** (currently hardcoded at line ~650 of sharedCardElements.tsx) gets replaced with the `noun-book-8333826` SVG from the assets folder. Bundled as a polish item into Checkpoint 3.

### Detailed Checkpoint Scope (Phase 7I)

7I is too large to ship as a single CC prompt. It's structured as seven sequential checkpoints, each with its own focused CC prompt generated only after the previous checkpoint's SESSION_LOG is reviewed. **Prompts are NOT generated ahead of time** — downstream checkpoints may need adjustment based on what happens upstream.

#### Checkpoint 1 — Data model migration [HIGH RISK]

**Goal:** Migrate existing `post_type='meal'` rows to `'meal_event'`. Preserve all data. Verify integrity.

**Scope:**
- Pre-migration SQL snapshot (mandatory — no rollback path without it)
- Diagnostic queries BEFORE migration: count rows by post_type, count dishes with parent_meal_id, count participant roles, data integrity check for orphaned parent_meal_id references
- Atomic transaction: `UPDATE posts SET post_type = 'meal_event' WHERE post_type = 'meal'`
- Diagnostic queries AFTER migration: verify all meal rows became meal_event rows, verify parent_meal_id still points at valid rows (now meal_event type), verify post_participants for meal_event posts still attached correctly
- Update `lib/types/` `PostType` union to include `'meal_event'` (keep `'meal'` in the union for backward compat during the transition)
- Add a comment in the type file explaining the model shift

**Risks:**
- The existing feed code queries `post_type='meal'` and won't find any rows after migration, so MealPostCard stops rendering anything. **This is expected during the transition between Checkpoint 1 and Checkpoint 4** — the feed will look "empty-ish" (dish posts only, no meal cards). This is correct behavior for the gap. The app should not crash.
- If the migration runs without snapshot, there's no rollback path.

**HARD STOP after this checkpoint.** Tom reviews migration output, row counts, and verifies the app still loads the feed without crashing before Checkpoint 2 begins.

#### Checkpoint 2 — Services layer

**Goal:** Build the service-layer plumbing for the new model without changing any UI.

**Scope:**

New services in `lib/services/`:
- `getLinkedCookPartners(postId)` — returns the list of cook partner post IDs for a given cook post. Queries `post_participants` where `post_id = $postId AND role = 'sous_chef' AND status = 'approved'`. Per-participant, if the participant has their own cook post for the same meal_event (or same date window), return those post IDs too. This is the "Tom and Anthony each posted about kombucha" case — the link is discovered via participant identity.
- `getMealEventForCook(postId)` — returns the meal event row (if any) that this cook post is linked to, via `posts.parent_meal_id`.
- `getMealEventDetail(mealEventId, viewerId)` — fat query for L7: event metadata, all linked cook posts with their authors, attendees from `post_participants` (role IN `host`, `ate_with`) + `meal_participants`, shared media from `meal_photos`, event-level comments. Applies viewer visibility filter.
- `getCookHistoryForUserRecipe(userId, recipeId)` — for L6's "Your history with this recipe" section. Returns `posts` where `user_id = $userId AND recipe_id = $recipeId` sorted by `cooked_at DESC` (or `created_at` if no `cooked_at`).

New grouping service (**replaces** `feedGroupingService.ts`):
- `buildFeedGroups(cookPosts, viewerId, followingIds)` — takes a list of cook posts and produces `FeedGroup[]`. Each group is either `{ kind: 'solo', cookPost, prehead? }` or `{ kind: 'linked', header, cookPosts[] }`. Uses union-find over cook-partner links and meal-event links. Applies Rule C visibility (group forms only when ≥2 linked posts are visible to viewer). Within each group, cook posts are sorted oldest-first. Groups themselves are sorted newest-first by most-recent-member activity.
- The old `groupPostsForFeed` function and `GroupedPost`/`SinglePost`/`FeedItem` types are marked deprecated but not deleted yet. Checkpoint 7 deletes them.

**No UI changes.** Feed still renders via the old PostCard/MealPostCard/LinkedPostsGroup path during Checkpoint 2.

#### Checkpoint 3 — CookCard + new shared primitives

**Goal:** Build the new unified feed card component and its supporting primitives.

**Scope:**

New components in `components/feedCard/`:
- `CookCard.tsx` — unified feed card for all cook posts. Handles L1 (solo, 1 dish) and L2 (solo, multi-dish) cases. Reuses existing sharedCardElements primitives (`CardWrapper`, `CardHeader`, `TappableTitleBlock`, `PhotoCarousel`, `StatsRow`, `VibePillRow`, `EngagementRow`, `ActionRow`, `HighlightsPill`, `DescriptionLine`).
- `CookDishesBlock.tsx` — new primitive for L2's multi-dish block. When a cook post has 2+ dishes, renders a lightly-framed box listing each dish with its source icon, recipe name (tappable), and chef/source byline. Handles mixed source types in one block.
- `MealEventPrehead.tsx` — the "context above the card" primitive for L3a (co-cook solo) and L4 (meal event solo). Renders a small icon + title + optional meta above a card. Tappable for meal events, descriptive-only for co-cook.
- `LinkedGroupHeader.tsx` — similar to MealEventPrehead but sits above a stack of cards instead of a single card. Used for L3b and L5.
- `LinkedGroupContainer.tsx` — the indent + gutter connector wrapper. Handles the 20px left indent and absolutely-positioned 1px gutter connector line.

Edits to existing `sharedCardElements.tsx`:
- `RecipeLine` — replace the hardcoded `📖` emoji with the `noun-book-8333826` SVG from the assets folder (bundled polish item from 7F review)
- `RecipeLine` — accept a `sourceType` prop (`'cookbook' | 'url' | 'user_created' | 'freeform'`) and render the corresponding icon. For F&F: cookbook uses the SVG, URL/user-created/freeform use emoji fallbacks (🌐/✏️/🤷).
- `CookDishesBlock` uses `noun-friends-4314800` SVG instead of the current friends emoji (per 7F review polish item)

**Polish items bundled into Checkpoint 3:**
- Book emoji → SVG icon
- Friends emoji → SVG icon (for L2 dishes block)
- Description above recipe line (new CookCard enforces this layout; PostCard still has the old order)
- Chef name tappable (verify `onChefPress` wires through to CookCard the same way it does in PostCard)

**No FeedScreen changes yet.** CookCard is built and renderable but not wired. PostCard/MealPostCard/LinkedPostsGroup still drive the feed.

#### Checkpoint 4 — FeedScreen rewrite

**Goal:** Wire FeedScreen to use CookCard + buildFeedGroups. Retire PostCard/MealPostCard/LinkedPostsGroup from the feed render path (don't delete yet).

**Scope:**

Changes to `screens/FeedScreen.tsx`:

1. **⚠️ CRITICAL: Remove `.is('parent_meal_id', null)` filter** from `loadDishPosts`. Under the new model, meal-attached dishes render as standalone feed items (with a meal event prehead) and must not be filtered out. Failing to remove this filter means every dish attached to a meal event vanishes from the feed.

2. **Stop querying `getMealsForFeed`.** Meal events are no longer feed items — they only surface via the detail screen (L7) reached from cook cards that link to them. Remove the call and the meal stream from the combined query.

3. **Replace `CombinedFeedItem` type union with `FeedGroup[]`.** The feed is now a list of FeedGroup objects (from `buildFeedGroups`), each either solo or linked.

4. **Replace `groupPostsForFeed` call with `buildFeedGroups`.** New service signature takes `(cookPosts, viewerId, followingIds)`.

5. **Rewrite `renderFeedItem`** to dispatch on `FeedGroup.kind`:
   - `'solo'` → render `<CookCard>` with optional `<MealEventPrehead>` above
   - `'linked'` → render `<LinkedGroupContainer>` with `<LinkedGroupHeader>` and N `<CookCard>` children

6. **Keep all likes/comments/highlights loading** but pass to CookCard via the new group shape. `loadLikesForPosts` and `loadCommentsForPosts` continue to hydrate by post ID — no change to hydration logic, just the render path changes.

7. **Retire PostCard/MealPostCard/LinkedPostsGroup from the feed render path.** They stay in the repo as reference/fallback but FeedScreen no longer imports or calls them. Delete in Checkpoint 7.

**Polish items bundled into Checkpoint 4:**
- Frigo logo tap → scroll feed to top (add FlatList ref, wire `onPress` on the Logo TouchableOpacity in the header to call `scrollToOffset({ offset: 0, animated: true })`)
- Investigate pull-to-refresh ~15s hang (add timeout logging to `loadFeed()` to identify where it's stuck; if the fix is obvious, apply it; otherwise report back in SESSION_LOG with the hang location)

**Verify thoroughly:** scroll through the feed looking for ordering issues, missing posts (especially meal-attached dishes that were previously hidden), visual breakage in indented groups, connector line rendering, and the degraded cases (Rule C drop-to-solo when only one linked post is visible).

#### Checkpoint 5 — CookDetailScreen + narrow-scope editing

**Goal:** Build the new screen reached by tapping any cook card, title, or photo. Matches wireframe L6. Bundles a minimal set of edit affordances that prevent regression from today's MyPostDetailsScreen and unblock Tom's own testing workflow during Checkpoints 5-7 (seeding test data, fixing typos, attaching cook partners after the fact, etc.).

**Scope — detail screen:**
- New `screens/CookDetailScreen.tsx`
- Full L6 structure: back nav, hero photo carousel (with tapped photo centered via route param), author block, full title, full description, recipe line with cookbook page number, stats grid (Cook time / Rating / Times cooked), Highlights card, Modifications & notes block, "Your history with this recipe" section, Photos gallery, Comments, sticky engagement bar
- Navigation wiring: CookCard's `onPress` and photo `onPress` both navigate here, with photo index passed as a param
- Chef name in recipe line taps to existing `AuthorView` (audit whether it works as expected)
- "Your history with this recipe" calls `getCookHistoryForUserRecipe` from Checkpoint 2
- Modifications block maps to `posts.modifications`. Notes block maps to `posts.notes`. Show only sections with content.
- Respects the D4 distinction: `posts.description` is cook-time description (rendered in the main description), `posts.notes` is cook-time thoughts (rendered in the notes block).

**Scope — narrow editing (viewable only to post author):**
- Three-dot overflow menu in the CookDetailScreen header (same pattern as MyPostDetailsScreen). Menu visible only when the viewer is the post's author.
- Menu items:
  - **Add photos** — routes to existing `EditMediaScreen` with the post ID. Zero new code for the screen itself; this is just a navigation wire-up.
  - **Edit title** — inline text input replaces the title Text component, save on blur or return key. Writes to `posts.title` via `postService.updatePost` (verify the service function exists; if not, add a minimal one that takes `(postId, { title })`).
  - **Edit description** — inline multi-line text input, save on blur. Writes to `posts.description`.
  - **Manage cook partners** — opens an extended version of the existing `AddCookingPartnersModal`. See "Interface extension" below. Returns the complete new set of cook partner user IDs; CookDetailScreen diffs against the current set and calls `postParticipantsService.addParticipants()` / `removeParticipants()` accordingly.
  - **Change meal event** — opens a simple picker that reuses `SelectMealModal` or `SelectMealForRecipeModal` (whichever is simpler; audit both). Includes a "Not attached to a meal event" option at the top of the list. Writes to `posts.parent_meal_id`. When cleared, the post transitions from L4 (prehead above card) to L1 (solo cook) on next feed load.
  - **Delete post** — confirmation Alert dialog. Calls existing `postService.deletePost` which handles cascade cleanup of `post_likes`, `post_comments`, `post_participants`, `dish_courses`. After delete, navigate back to the feed.

**Interface extension — `AddCookingPartnersModal`:**
- Current interface: `onConfirm(selectedUsers: string[], role: ParticipantRole)` — only handles adding new partners.
- Extended interface: accept a new `existingParticipantIds?: string[]` prop. When present, the modal pre-selects those users in the list. Users can deselect existing participants to remove them. `onConfirm` returns the complete new set of selected user IDs (not a diff). The parent component computes add/remove operations.
- **NEEDS REVIEW during execution:** the existing modal is used in several places. CC must audit other call sites (`AddMealParticipantsModal`, `QuickAddModal`, `LogCookSheet`, anywhere in `screens__`) and either:
  - Update all call sites to use the new optional prop (preferred — backward compatible since the prop is optional), or
  - If any call site has a conflict, create a separate `ManageCookPartnersModal` component instead and leave `AddCookingPartnersModal` alone.
- The goal is the smallest footprint change that supports the "manage existing partners" use case.

**What narrow scope does NOT include (deferred to 7M):**
- Recipe link editing (swap or clear `posts.recipe_id`) — requires deciding what happens to `times_cooked` on old vs new recipe
- Rating changes (`posts.rating`)
- Modifications and notes editing (`posts.modifications`, `posts.notes`)
- Visibility changes (`posts.visibility`)
- Cooking method changes (`posts.cooking_method`)
- Dietary badge edits
- Any UX polish around unsaved-changes handling, dirty state, save confirmations

The narrow scope is explicitly scaffolding. When 7M ships, the CookDetailScreen overflow menu collapses to a single "Edit post" item that opens the full `EditPostScreen`, and the inline edits become part of that unified screen (matching Strava's Edit Activity pattern). The narrow-scope work in Checkpoint 5 is throwaway — the goal is to unblock testing and prevent regression, not to build permanent UX.

**Deferred for later phases:**
- "Related cooks from friends" section at the bottom
- Personalized chef-page lens
- Cookbook page number deep-linking into cookbook detail
- Full post editing UX (→ 7M)

#### Checkpoint 6 — MealEventDetailScreen + host editing

**Goal:** Replace MealDetailScreen with the new shared-event-detail model. Matches wireframe L7. Bundles narrow-scope host editing so hosts can fix typos and manage attendees on meal events during testing.

**Scope — detail screen:**
- Rewrite `screens/MealDetailScreen.tsx` in place (or create `MealEventDetailScreen.tsx` and deprecate the old one — CC decides which is cleaner given the existing code)
- Full L7 structure: back nav with context-sensitive right action, host's highlight photo hero, event metadata block, stats grid, "What everyone brought" dish rows using F1e+ pattern with private eater ratings, "At the table" attendees list, "Shared media" photo gallery with Add Photo action, "About the evening" event-level comments
- Navigation: dish rows tap through to CookDetailScreen (L6). Meal event detail reached from L4 prehead or L5 group header.
- Eater rating affordances carry over from F1e+ (D43) without redesign

**Scope — host editing (viewable only to meal event creator):**
- Three-dot overflow menu in the MealEventDetailScreen header. Visible only when the viewer's `user_id` matches the meal_event post's `user_id` (the creator/host).
- Host menu items:
  - **Edit title** — inline text input, writes to `posts.title` on the meal_event row.
  - **Edit date/time** — opens existing `DateTimePicker` component, writes to `posts.meal_time`.
  - **Edit location** — inline text input, writes to `posts.meal_location`.
  - **Edit highlight photo** — opens a photo picker sourced from `meal_photos` (the shared media pool) plus any photos attached to dish posts linked to this meal event. Selected photo gets its `is_highlight` flag set to true; previously-highlighted photo (if any) gets its flag cleared. The highlight photo is what renders as the L7 hero on the detail screen.
  - **Manage attendees** — same extended `AddCookingPartnersModal` from Checkpoint 5, but operating on `role='ate_with'` participants instead of `role='sous_chef'`. Preloads existing attendees, allows add/remove, writes to `post_participants` with the meal_event's post ID.
  - **Delete event** — confirmation Alert dialog. **Cascade behavior (option b):** does NOT delete linked cook posts; instead, `UPDATE posts SET parent_meal_id = NULL WHERE parent_meal_id = $meal_event_id` before deleting the meal_event row. This is non-destructive — other cooks' posts remain intact as solo cook posts (L1 shape) and stop rendering as part of the linked group. The deletion confirmation dialog should make this explicit: "Deleting this event will remove it, but the X cook posts from attendees will remain as solo posts. [Cancel] [Delete event]". If there are linked cook posts from other users, show the count in the dialog. If the only linked cook posts are the host's own, the dialog can use simpler language.

**Scope — attendee editing (viewable to confirmed attendees who are not the host):**
- Non-host attendee overflow menu is simpler:
  - **Add photo to shared media** — opens photo picker, uploads to `meal_photos` with `user_id` set to current user. Writes the new row and refreshes the shared media section.
  - **Add event comment** — focuses the "About the evening" comment composer. No new code needed beyond making the composer focusable from the menu.
  - **Leave event** — removes the current user's `post_participants` row for this meal_event. Confirmation dialog: "Leave [event title]? You'll still keep any cook posts you made for this event, but they'll no longer appear as linked to this event." Option to keep or remove the `parent_meal_id` on the user's linked cook posts — default to keeping it (the user stays linked to the event via their cook post's parent_meal_id even if they're removed from the attendees list). **NEEDS REVIEW** during execution — this is a subtle UX decision and may want a simpler "remove me + don't touch my posts" default.

**What host editing does NOT include (deferred to 7M or future meal event polish):**
- Changing the meal event's description (add to 7M)
- Full visibility model changes for meal events
- Transferring host ownership to another attendee
- Editing individual dish rows from the meal event detail (those are edited on their own CookDetailScreen)

**Planned-dish hybrid (DEFERRED_DECISION):** the L7 wireframe shows italic greyed-out rows for dishes planned but not yet posted. Scope to CC: build if trivial, flag if complex. Revisit after Checkpoint 6 execution.

**Deferred:**
- RSVP flow redesign (separate work)
- Notifications for shared media / planned-dish posts / event comments
- Sound notifications when attendees add media
- Full post-editing screen (→ 7M)

#### Checkpoint 7 — Final polish + cleanup

**Goal:** Catch remaining items and delete deprecated code.

**Scope:**
- Delete `components/LinkedPostsGroup.tsx` (no longer referenced)
- Delete `components/PostCard.tsx` and `components/MealPostCard.tsx` (no longer referenced from FeedScreen)
- Delete old `feedGroupingService.ts` exports (`groupPostsForFeed`, `GroupedPost`, `SinglePost`, `FeedItem`) — keep the file if other code imports the union-find helper, otherwise delete entirely
- Chef name tappability audit — does `AuthorView` exist and work? Build a minimal chef page if it's broken
- Any visual regressions or small fit-and-finish items that emerged during Checkpoints 1-6 testing
- Remove `'meal'` from the `PostType` union (all rows have been migrated to `'meal_event'`; backward-compat is no longer needed)
- Update `FRIGO_ARCHITECTURE.md` to reflect the new component structure

### Ordering and Shippable Milestones

Per the 2026-04-13 planning session (updated later that day to add 7M and narrow-scope editing), the recommended ordering is:

1. **7I Wave 1** — Checkpoints 1-4 (migration + services + CookCard + FeedScreen rewrite). The new feed is live. Detail screens still use the old MealDetailScreen temporarily.
2. **7G** — Historical cook logging with backdated posts. Small sub-phase (1-2 sessions). Safe to ship here because backdated cook posts render via the new CookCard immediately.
3. **7H** — My Posts in You tab. Very small IA change (1 session). Orthogonal to everything else.
4. **7I Wave 2** — Checkpoints 5-7 (CookDetailScreen with narrow-scope editing + MealEventDetailScreen with host editing + cleanup). Wave 2 is larger than originally scoped because it bundles the narrow editing affordances that unblock testing and prevent regression from today's MyPostDetailsScreen capabilities.
5. **7J** — Recipe sharing.
6. **7K** — Chef attribution backfill.
7. **7L** — Settings UI for visibility defaults + `meal_tagged` visibility + polish.
8. **7M** — Full post editing pass. Builds a single unified `EditPostScreen` modeled on Strava's Edit Activity pattern that handles all editable fields (title, description, recipe link, rating, modifications, notes, visibility, cooking method, photos, cook partners, meal event attachment). Replaces the narrow-scope overflow menu on CookDetailScreen with a single "Edit post" entry point. 3-5 sessions. Covers the real editing UX that 7I deliberately left as scaffolding.

**Why this ordering:** Wave 1 gets the riskiest architectural change out of the way first. 7G/7H slip in between the two 7I waves because they're small, safe, and don't depend on the detail screens. 7I Wave 2 then finishes the detail screens (including narrow editing that prevents regression). 7J/7K/7L continue Phase 7 proper. 7M is last because full post editing benefits from having the new detail screens stable and from the feed infrastructure being settled — it's polish that works best on solid foundations.

**Four shippable milestones inside Phase 7I/7M:**
- **Milestone A** (after 7I Wave 1): new feed model live, old meal cards retired from feed. Detail screens temporarily use old code.
- **Milestone B** (after 7G + 7H): historical logging works, My Posts lives in You tab.
- **Milestone C** (after 7I Wave 2): new detail screens live with narrow-scope editing, old components deleted.
- **Milestone D** (after 7M): full post editing shipped, narrow-scope scaffolding replaced by unified EditPostScreen.

**Session estimate update:** 7I grew from 7-10 sessions to **9-13 sessions** due to Checkpoint 5/6 scope expansion (narrow-scope editing). 7M is new at **3-5 sessions**. Total new work: 12-18 sessions across 7I + 7M compared to the original 7-10 session estimate for just 7I.

### Original 7M Scope (as planned)

The 7M scope below is captured as it was originally planned during the 4/13 session. Compare against the "7M" row in the Build Phases table for what actually shipped — the gap (if any) is documented in the SESSION_LOG entries for 7M CP1-CP3 and the two fix passes. Useful for future reference if 7M scope is ever extended (e.g., when meal-event editing surfaces from D286/P7-50).

Phase 7M is not part of 7I's checkpoint structure, but the narrow-scope work in Checkpoints 5 and 6 is explicitly designed to be replaced by 7M. Capturing the intended 7M shape here so the throwaway nature of the narrow scope is clear.

**7M goal:** Ship a single unified `EditPostScreen` modeled on Strava's Edit Activity pattern. One screen handles all editable fields on a cook post.

**7M scope:**
- New `screens/EditPostScreen.tsx` — single screen with form fields for every editable property of a cook post
- Fields covered:
  - Title (text input)
  - Description (multi-line text)
  - Recipe link (picker — select from user's recipes, or clear to make freeform). Handles derived-stat implications: if recipe_id changes, `times_cooked` decrements on the old recipe and increments on the new one. If cleared, old recipe decrements and new value is null.
  - Rating (star selector, 1-5)
  - Modifications (multi-line text)
  - Notes (multi-line text, private-to-author per D4)
  - Visibility (dropdown: Everyone / Followers / Just me / Meal tagged — D34/D35)
  - Cooking method (dropdown)
  - Photos (embedded photo grid with add/remove/reorder, reuses existing `EditMediaScreen` capabilities but inline)
  - Cook partners (embedded list with add/remove, reuses the extended `AddCookingPartnersModal` from 7I Checkpoint 5)
  - Meal event attachment (embedded picker, reuses the Checkpoint 5 pattern)
  - Delete post (footer button, same cascade behavior as Checkpoint 5)
- Unsaved-changes handling: dirty state indicator, confirmation on back nav, save vs. discard flow
- Save action: writes all changed fields in a single transactional service call
- Entry points:
  - CookDetailScreen overflow menu → "Edit post" (replaces the narrow-scope inline edits from 7I Checkpoint 5)
  - Feed card overflow menu → "Edit post" (new — feed cards don't currently have overflow menus, but `PostActionMenu` component exists and can be wired in)
  - My Posts list → tap post → CookDetailScreen → Edit post (via overflow menu)
- Derived-stat recalculation: when recipe_id or rating changes, trigger appropriate downstream updates (`recipes.times_cooked`, aggregate dish ratings on any linked meal event, Highlights pill signals that depend on these values)
- Wireframe the edit mode UX before building — could be modeled on Phase 11's recipe editing pattern if that ships first, or on Strava's Edit Activity layout directly

**7M explicitly does NOT include:**
- Editing someone else's post (author-only)
- Editing meal events (that's Checkpoint 6 host editing in 7I; 7M might extend it, TBD during 7M scoping)
- Bulk edit operations (edit multiple posts at once)
- History/versioning of edits (no undo, no "edit history" audit trail)

**Target phase position:** After 7L, before Phase 8 begins. Roughly 3-5 sessions.

## Changelog

| **Date** | **Change** |
|----|----|
| 2026-03-17 | Created scaffold during F&F planning session. Scope defined with 6 sub-phases, rating UX options captured, group meal photo design flagged as needing discussion. |
| 2026-03-24 | Phase entered active development. 7A bug fixes shipped. 7B components and wiring shipped. Failed user testing surfaced critical issues. |
| 2026-04-06 | 7B Revision pass shipped and tested ✅. Document fully rewritten to reflect actual sub-phase structure (7A through 7J), populated Decisions Log with 20 entries, added Work Completed and Testing Results sections. Sub-phase 7C (Meal Plan wiring fix) became active. Group meal photos folded into 7D. Phase kept as one big phase rather than splitting per Tom decision. Added Deferred Items section per project convention. |
| 2026-04-07 | **Major scoping reframing for 7D.** Discovered during code review that the existing meal model (posts.parent_meal_id + dish_courses + post_participants + meal_participants + meal_photos + mealService.ts + MealPostCard.tsx) already implements multi-dish multi-cook meals. D12 (build a post_dishes junction) retired as D21. 7D reframed as "close the gaps in Model 1," not "build a replacement." Phase split: 7D (data + service) / 7E (cook→meal handoff) / 7F (feed rendering). Old 7E–7J renumbered to 7G–7L. 7C marked done. Added decisions D21–D31 capturing: Model 1 reframing, multi-cook framing, freeform dishes, highlight photo model, contextual privacy defaults, Option γ wrap pattern, external participants, like/comment attribution constraint, Strava enrichment direction, scope split, Meals tab future. Architecture section rewritten to accurately describe what already exists. Added P7-14 through P7-20 deferred items. New companion doc \_SCOPING_NOTES_7D.md created with raw conversation findings. New stub PHASE_RECIPE_DISCOVERY.md created for the dish-tap-discovery feature surfaced during scoping. Master plan, PROJECT_CONTEXT, FRIGO_ARCHITECTURE, and DEFERRED_WORK updated to reflect new structure. |
| 2026-04-07 | **Wireframe review session — 7D/7E locked, build prompt issued.** Produced an interactive wireframe artifact (frigo_phase_7d_7e_wireframes.html) covering 11 states across 3 flows (LogCookSheet enrichment, Made other dishes too, dish→meal wrap). Reviewed across multiple iteration passes, surfaced 20 design questions, locked all of them. Added decisions D32-D40: Pattern Y publishing model (refines D29), smart-detect tiered fallback with high/low confidence split, retired D25 in favor of global+contextual visibility model with user-configurable settings, four-value visibility enum with meal_tagged for meal-context posts, in-sheet meal creation with inline tagging picker (no AddCookingPartnersModal escape hatch — free-text search instead), external participant tagging via the same input, cross-meal deduplication deferred to Phase 9, after-wrap landing as "stay on dish detail with toast," "Made other dishes too?" hybrid pattern (planned suggests vs unplanned recommends). Updated P7-20 (superseded by D34) and added P7-21 (user-configurable contextual rules deferred). Bumped 7L scope from 0.5-1 sessions to 2-3 sessions. Updated total estimate from 14-21 to 16-23 sessions. Issued combined 7D+7E build prompt as CC_PROMPT_7D_7E.md with five hard-stop checkpoints. |
| 2026-04-07 | **Checkpoint 1-4 build session and fix passes (full day).** Checkpoint 1: 7D audit + migration spec, run by Tom in Supabase. Checkpoint 2a: chip + visibility + override overlay. Checkpoint 2b: smart-detect + banner states with three bugfix rounds (parent meal type inheritance, solo lunch defaults, time band tightening). Checkpoint 3: meal picker + in-sheet meal creation + Tag chip wiring with four bugfix rounds (sibling Modal stacking, sheet height, picker flex, Tag chip data flow taking three prompt attempts). Checkpoint 4 initial pass: MadeOtherDishesSheet + wrapDishIntoNewMeal + RecipeDetailScreen overflow + parent meal banner + after-wrap toast + comments label. Fix Pass 1 surfaced 6 issues from review (freeform meal_type, parent meal banner hardcoded title, time band regression in detectPlannedMealForCook, "Add to meal" gating, CommentsScreen header, recommendation label) — all fixed with the new shared computeMealTypeFromHour helper. Fix Pass 2 added 2 fixes from testing (JSX unicode escapes including one CC found via grep sweep that manual review missed, silent error swallowing in handleDone) — verified via break-and-revert manual test. Direct-in-Supabase DDL migration ran for get_meal_dishes and get_meal_plan_items RPC return-type drift (root cause: 7B-Rev rating column type change didn't propagate). Tests 1-6 of 9 verification items pass. SQL inspection during Test 7 setup surfaced a months-old createDishPost drift bug — parent_meal_id written but dish_courses and post_relationships missed. Tests 7-9 deferred pending Fix Pass 3 tomorrow. Added P7-22 through P7-27 deferred items. Reframed P7-14 with reference to P7-25. Added Direct DB Migrations section. Added Cross-Cutting T3 to DEFERRED_WORK (schema change propagation discipline). Bumped total session count for 7D+7E to ~7-8 sessions completed. |
| 2026-04-09 | **Phase 7F wireframe session complete.** Six iteration passes, 44 questions resolved. Decisions D41-D46 captured. Philosophy (c) hybrid stat-row framing locked (3 quantitative stats + Highlights slot + conditional vibe pill row). Cooked-vs-ate byline split (D45). Two-level photo model (D46). Comment attribution refinement (D41). Notification scope tiered model (D42). Eater rating model — schema α + privacy ζ + orthogonal to yas chefs (D43). M3 architecture deferral with G4rr-b grouped meal pattern as locked target for 7I (D44). 14 new deferred work items added (P7-28 through P7-42) covering 7I scope expansion (P7-28 through P7-31), future eater-ratings sub-phase (P7-32 through P7-35), future comments sub-phase (P7-36 through P7-38), small follow-up for LogCookSheet dish-photo tagging (P7-39), personalization sub-phase (P7-40 through P7-41), and parked flip-card concept (P7-42). Phase 7I scope expanded from 1-2 sessions to 3-5 sessions to absorb G4rr-b implementation. Total Phase 7 estimate grew from 16-23 to 18-26 sessions. 7F status flipped from 🔲 to 🟡 ready-for-build. Build prompt issued as CC_PROMPT_7F.md. Three new docs added to project: PHASE_7F_DESIGN_DECISIONS.md (source of truth for 7F design rationale), frigo_phase_7f_wireframes.html (6-pass wireframe artifact), CC_PROMPT_7F.md (build prompt for Claude Code). |
| 2026-04-13 | **Phase 7I planning session + D47 supersession.** Cook-post-centric feed model replaces D44's M3/G4rr-b framing. 7 checkpoint structure defined across 2 waves. Wireframes L1-L7 locked in frigo_phase_7i_wireframes.html. Master plan created as PHASE_7I_MASTER_PLAN.md. D47 supersedes D44 and partially supersedes D41/D45/D46. Scope expanded later same day to include narrow-scope editing in Wave 2 CPs 5-6. Phase 7M added as new sub-phase for full Strava-style Edit Activity screen. |
| 2026-04-13/14 | **7I Wave 1 complete (Checkpoints 1-4 + 4.5).** CP1: SQL migration. CP2: services layer (cookCardDataService, feedGroupingService rewrite, mealService extensions). CP3: CookCard component + grouping primitives + test harness. CP3.5: shared-recipe merged groups (D48). CP4: FeedScreen rewrite (~980 lines, CookCardData model, 4-type group dispatch). CP4.5: photo rendering fix pass (posts.photos normalization, optimizeStorageUrl guard). Feed is live with the new cook-post-centric model. |
| 2026-04-14/15 | **7I Wave 2 complete (Checkpoints 5-7).** CP5: CookDetailScreen (L6) with 14 content blocks + 6 narrow-scope editing items (add photos, edit title/desc, manage partners, change meal, delete). D49 (same-author collapse nav contract), D50 (no-image state). CP6: MealEventDetailScreen (L7) with 8 content blocks + eater_ratings schema + host editing (6 items) + attendee editing (3 items). D51 (meal-event engagement via existing infrastructure). CP7: delete PostCard/MealPostCard/LinkedPostsGroup, remove test harness, PostType union cleanup (fixed latent Meals tab bug from CP1 migration), AuthorView audit (functional), FRIGO_ARCHITECTURE.md v3.2 update. |
| 2026-04-15 | **Phase 7I formally closed.** All 7 checkpoints + 3 fix passes shipped. Cook-post-centric feed model fully implemented. Next: 7G → 7H → 7N (detail screen polish, formerly CP 5.5) → 7M (full Edit Cook screen). |
| 2026-04-15 | **7G + 7H shipped and verified.** Combined CC prompt, 2 checkpoints. CP1 (7G): cooked_at wiring through createDishPost + LogCookSheet date picker (compact + full modes, reusing DateTimePicker with new quickSelectPreset='past' prop) + feed/CookCard/CookDetailScreen/feedGroupingService sort switch from created_at to cooked_at. CP2 (7H): StatsScreen My Posts navigation target → CookDetailScreen, cooked_at sort/display, CookDetail route registered in StatsStack, freeform dishes now tappable. All 13 verification items passed on device. 4 deferred items: P7G-1 (cook partner temporal window), P7G-2 (legacy groupPostsForFeed cleanup), P7H-1 (cross-stack nav audit), P7H-2 (legacy MyPostDetails/MyPosts route cleanup). |
| 2026-04-15/17 | **7N shipped and verified.** CP1 (5 items): CommentsScreen keyboard fix via useHeaderHeight (P7-85), photo carousel peek with 88% width clamp + "N/M" count pill (P7-87), CookDetailScreen header title (P7-90), rating label ternary for own vs. other's post (P7-96 label half), swipe reliability unstable_pressDelay (insufficient — escalated in CP2). CP2 (6 items): swipe restructure — split CookCardInner into 3-zone layout with PhotoCarousel outside Pressable + onPhotoPress prop on PhotoCarousel (definitive fix), multi-photo select via additive pickMultipleImages/chooseImageSourceMulti (P7-88), star picker stay-open (P7-97), inline engagement bar on both detail screens (P7-98), CommentsScreen return key, header title truncation with flex:1. Fix pass (3 items): back button tintColor changed to brand teal globally via headerTintColor on all 7 stack navigators + custom header arrows, star picker × button replaced with full-screen tap-outside dismiss overlay, engagement bar justifyContent: space-between for like-left/comment-right layout. 7 deferred items remain in Phase 7: P7-89, P7-91, P7-93, P7-94, P7-95, P7-96 affordance half, P7-99. |
| 2026-04-17 | **7M shipped and verified.** CP1: EditPostScreen scaffold (893 lines) + StarRating component extraction (126 lines) + constants/cookingMethods.ts + route registration in FeedStack + StatsStack + temp menu item on CookDetailScreen. CP2: UpdatePostPatch extended with 6 fields, dirty state via initialValues ref, save handler with partner diff, cancel-with-unsaved-changes, delete navigates to FeedMain. CP3: CookDetailScreen overflow collapsed to 2 items ("Edit post" + "Delete post"), 508 lines removed (2035 → 1527), meal picker enhanced (dates + chronological + create new), eating partners stub row. Fix pass 1: cooking method values matched to DB CHECK constraint (cook, bake, bbq, etc.), CookDetailScreen useFocusEffect fixed with focusCountRef, FeedScreen stale-data refetch (5s threshold), KeyboardAvoidingView on EditPostScreen, recipe line made non-tappable. Fix pass 2: partner chip immediate update via userProfileCacheRef (no DB refetch in onConfirm), bottom bar moved from absolute positioning to flex child for keyboard rise. Deferred: P7M-1 (cook partner diff extraction to service), P7M-2 (StarRating/ScrollView gesture conflict), EditMedia Strava-style redesign (P7-86), feed card overflow entry point. |
| 2026-04-20 | **Doc maintenance — absorbed `PHASE_7I_MASTER_PLAN.md` content as a new "Phase 7I Detailed Reference" appendix.** Per-decision supersession breakdown for D44/D41/D45/D46/D43/D42, the 9 pre-build "Grounding in Code" findings, granular per-checkpoint scope (CP1–CP7) including explicit deferrals, the Ordering / Milestones A-D framing, and the original 7M scope reference all moved into the appendix. Added P7-44 through P7-59 deferred items from the 4/13 Phase 7I planning session that had never been transferred to the phase doc, plus the four reframings (P7-28/29/30/31) from the same session. Header reference updated to point at the new appendix. `PHASE_7I_MASTER_PLAN.md` can now be deleted from both repo and project knowledge. |
