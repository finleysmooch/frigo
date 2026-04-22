# Phase: Recipe Discovery (Unscheduled)

**Status:** 🔲 Unscheduled — likely post-F&F or its own dedicated phase
**Created:** 2026-04-07
**Origin:** Surfaced during Phase 7D scoping session (see `_SCOPING_NOTES_7D.md`, Q21 response)
**Linked from:** `FF_LAUNCH_MASTER_PLAN.md`, `DEFERRED_WORK.md` (R7), `PHASE_7_SOCIAL_FEED.md` (Gap 7 / 7F deferral note)

---

## Why this doc exists

During the Phase 7D scoping session on April 7, 2026, Tom was asked what should happen when a user taps a dish on a meal card in the feed (Q21). His answer pointed at a feature that doesn't currently exist as a phase: a **recipe discovery preview** that turns the social feed into a discovery loop for recipes themselves.

Tom's answer (verbatim, from `_SCOPING_NOTES_7D.md`):

> "Tapping specifically on a recipe or a dish I think could go to a recipe detail screen maybe with like how many times the person who cooked it has cooked it, what their average rating is, some nutrition facts, etc. The idea I think would be adding to the discovery aspect of these recipes and things for other users (and yourself). Give the user something to see — while probably hiding the recipe and steps specifically (especially if they shouldn't have access to the recipe because they don't own the cookbook or something). But it should help tease the idea of that being a recipe they may want to purchase or cook or something and they could click deeper in to see more. But seeing high level things like 'oh this is gluten free and the critical ingredients are X and Y and it has high protein and Tom and Mary have cooked it 12 times. Maybe I should give it a try' — and they could save it as like 'want to cook' or something. Or like — 'huh I wonder how Mary and Tom cook rice, let me go into that dish and see how they do it,' and it would show how we rinse our rice every time and then use a ratio of 1:1.8 rice to water for basmati rice."

This doc exists so the idea doesn't get lost. It's not a build plan — it's a stub. When this phase becomes real (likely post-F&F or as a dedicated workstream), this doc gets fleshed out into a real phase plan.

---

## The seed feature: discovery preview

When a user taps a dish thumbnail on a meal card in the feed, instead of taking them straight to the full recipe detail screen, open a **discovery preview** that shows:

- High-level recipe metadata: dietary flags, hero ingredients, vibe tags, cooking concept, course type, estimated nutrition headlines (calories, protein, key dietary qualities)
- Social signal: how many times the cook has made it, their average rating, when they last cooked it
- For recipes the viewer owns (or that are public): "View full recipe" CTA
- For recipes the viewer doesn't own (e.g. behind a cookbook they don't own): teaser only — no ingredient list, no instructions, but enough to make them think "I want to try this" or "I want to buy this cookbook"
- Save-for-later: "Add to Cook Soon" or "Want to cook" affordance from the preview
- Maybe: "Tom and Mary have cooked this 12 times" with avatars of who in your network has cooked it

The point: turn the feed from a passive scroll into an active discovery surface for recipes themselves. People see what their friends are cooking, get curious, save things to try.

---

## Why this is its own phase, not part of 7D

The 7D scoping session was explicit about scope discipline: "rebuild meals" work goes to Phase 9, not 7D. By the same logic, "build a recipe discovery surface" goes to a new phase, not 7D. The reasons:

1. **It's a recipe discovery feature, not a feed feature.** The trigger is from the feed but the experience is about recipes. Putting it in 7D conflates two domains.
2. **It depends on access control we don't have.** The "hide recipe steps if the viewer doesn't own the cookbook" requirement is real recipe access control work — currently there's no concept of recipe-level access (everything is effectively visible to everyone). This is a separate substantial workstream.
3. **It depends on social signal aggregation.** "Tom and Mary have cooked this 12 times" requires queries that join `posts` to `recipes` filtered by following relationships. Builds on stats infrastructure but adds new query patterns.
4. **The design space is large.** What does the preview look like? How is it different from RecipeDetailScreen? Save-for-later interaction? "Buy this cookbook" CTA? All real design decisions that need their own session.

For 7F (the feed rendering sub-phase of the 7D reframing), the basic dish-tap behavior will be: navigate to the existing `RecipeDetailScreen` for that recipe, full stop. No discovery preview, no access control, no social signal. That's a small fix; the discovery preview is a big feature.

---

## What needs to be built (sketch, not a plan)

When this phase becomes real, the work probably includes:

**Recipe access control (foundational):**
- A real model for "who can see this recipe in detail" — owner, cookbook ownership, public/private flag
- Backend changes: RLS policies on `recipes` and `recipe_ingredients` based on ownership
- Frontend: handle "no access" states gracefully (preview-only mode)

**Discovery preview screen:**
- New screen/component (DiscoveryPreviewScreen or similar)
- Layout that's clearly different from RecipeDetailScreen — preview, not detail
- Hero metadata block (dietary, hero ingredients, nutrition headlines)
- Social proof block ("X friends have cooked this Y times")
- Conditional ingredient/instruction visibility based on access
- Save-for-later affordance
- "View full recipe" CTA for owned recipes; "Find this cookbook" CTA for unowned

**Feed integration:**
- Tap handler on dish thumbnails in `MealPostCard` and (eventually) `PostCard` routes to discovery preview instead of full recipe detail
- Maybe: a "discoverable" indicator on dishes that the viewer doesn't own

**Social signal queries:**
- "How many times has [user] cooked this recipe?" — already supported by `recipes.times_cooked` per user
- "How many of my followed users have cooked this recipe?" — new query, needs index
- "What's the average rating from my network?" — new aggregation

**Save-for-later integration:**
- Hook into the existing `Cook Soon` queue
- Possibly a new "Discovered" or "Want to cook" list separate from Cook Soon

---

## Open questions for when this phase gets planned

These come from the original Q21 conversation and would need real answers before building:

1. **Access control model.** Should recipes have an explicit `is_public` flag (some already do), should it be tied to `book_id` ownership, or should there be a more granular per-recipe sharing model? Today there's effectively no access control — anyone can see any recipe. Adding it is a real schema decision.

2. **Cookbook ownership signal.** How does the app know whether a viewer "owns" a cookbook? `user_books` table exists. Is owning the book the right gate, or is it cookbook-purchase tracking, or is it something looser?

3. **What does the preview hide vs show for unowned recipes?** Probably: title, hero ingredients, dietary, vibe, social signal → show. Full ingredient list, instructions, photos that include the food → ?? Maybe show a single hero photo and the metadata block, hide the rest.

4. **Save-for-later semantics.** If a viewer saves an unowned recipe to "Want to cook," what happens when they later cook it? Do they need to acquire the cookbook first? Does the saved item nudge them toward purchase/import?

5. **Does this connect to NYT Cooking integration (if that ships)?** NYT recipes might be the natural test bed for the access control model — owned via NYT subscription, viewable as preview otherwise.

6. **Discovery via search/browse vs discovery via feed?** The original framing was feed-driven (tap a dish on a meal card). But "discovery" might also mean browsing other users' cookbooks, search results from across the network, etc. Out of scope for the seed feature, but worth thinking about for the larger phase.

7. **What's the relationship to `RecipeListScreen`?** Today's recipe browse is "my recipes." A discovery surface might be "recipes my network is cooking." Could be a new tab, a new mode of RecipeListScreen, or a separate entry point.

---

## Dependencies

**Hard dependencies (this phase can't ship without these):**
- Recipe access control model — currently nonexistent, foundational
- Some baseline 7D/7E/7F shipped — need real meal posts in the feed before tapping into them is a meaningful interaction

**Soft dependencies (this phase is much better with these):**
- Phase 11 concept cooking — concept tags become a discovery dimension
- Phase 10 nutrition depth — micronutrient headlines on the preview
- More populated cookbook content — discovery loops are dull when there's only one Ottolenghi book in the system

---

## Estimated effort

Unknown until the phase gets real planning. Rough order: probably 5-10 sessions, comparable to Phase 9 or Phase 11 in scope. Maybe more if the access control work is hairy.

---

## How this connects to Phase 7

Phase 7F (the feed rendering sub-phase of the multi-cook reframing) ships **basic** dish-tap navigation to `RecipeDetailScreen`. That's the minimum viable behavior. When this phase eventually ships, it replaces that basic behavior with the discovery preview. The 7F implementation must not paint us into a corner — the dish thumbnail tap handler should be a single code path that's easy to swap out.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-07 | Created as stub during Phase 7D scoping session. Captures the seed feature from Tom's Q21 answer, the rationale for it being its own phase (not part of 7D), the rough sketch of what would need building, and the open questions for whoever picks this up. |