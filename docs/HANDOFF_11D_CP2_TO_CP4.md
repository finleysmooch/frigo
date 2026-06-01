# HANDOFF — Frigo 11D continuation (CP2, CP3, CP4)

**Created:** 2026-05-29 by the prior Claude.ai planning instance, in response to Tom's request to hand off context to a fresh instance rather than push the current conversation past comfortable limits.

**Audience:** The next Claude.ai instance picking up 11D within the same project.

---

## Mission

11D = Cookbook / Chef pages sub-phase of Phase 11. Foundation CP (data layer) is drafted. Three more CPs to design and prompt: Books index + Mode A entry (CP2), Book Detail redesign + BookView enhancement (CP3), Chefs index + Chef Detail redesign + AuthorView enhancement (CP4). You're the planning brain; same workflow as the rest of the project — wireframe-first, lock decisions with Tom, generate CC prompts as standalone `.md` files in `/mnt/user-data/outputs/`.

---

## Status at handoff (2026-05-29)

### 11A (Browse rebuild) — shipped except for one piece
CP1 through CP5a all shipped 2026-05-28. **CP5b is still owed** — scope: card low-stock chips (8E-CP4), match-badge integration on RecipeCard, WhatCanICook screen absorption + nav cleanup, pantry-match threshold refinement (50%+/75%+/90%+/Any), PantryScreen "What can I cook?" CTA redirect. Not 11D's concern — Tom said CP5b and 11D could run parallel since they touch different files (CP5b: RecipeCard + WhatCanICook + Pantry; 11D-CP1: bookViewService only). Same independence holds for CP5b vs 11D-CP2/3/4. **Confirm with Tom whether he wants CP5b drafted before/during/after 11D's remaining CPs.**

### 11D (Chef/Book pages) — 4-CP spine

| CP | Status | Notes |
|---|---|---|
| **CP1** — Data foundation | **PROMPT DRAFTED**, not yet known if executed | File: `/mnt/user-data/outputs/CC_PROMPT_11D_CP1.md`. Pure service layer on `bookViewService.ts`. **Check with Tom whether he's run it.** |
| **CP2** — Books index + Mode A entry | Design mostly locked; needs Q&A confirm + prompt | One new screen + small Mode A addition. Wireframe done in prior session (was titled `books_index_to_detail_flow` — re-render if needed). |
| **CP3** — Book Detail redesign + BookView enhancement | Design partially locked; needs additional decisions | Biggest remaining CP. Two screens touched. |
| **CP4** — Chefs index + Chef Detail redesign + AuthorView enhancement | Mostly mechanical mirror of CP2/CP3 | One chef-specific decision (avatar fallback). Could split into CP4a/CP4b if it bogs down. |

### Other outstanding work
- **`CC_PROMPT_PHASE11_DOC_CREATION.md`** at `/mnt/user-data/outputs/` — creates `docs/PHASE_11_RECIPE_POLISH.md` + updates FRIGO_ARCHITECTURE / PROJECT_CONTEXT / DEFERRED_WORK / master plan. **Check with Tom whether he's run it.** If not, recommend running before substantive CP2 work so the phase doc anchors the rest.

---

## Locked design decisions — DO NOT re-litigate

These came out of extended Q&A and wireframing in the prior session. Tom can reopen any of these proactively, but don't surface them as questions:

### Architecture
- **Keep `AuthorViewScreen` and `BookViewScreen` as separate screens.** Tom likes their existing visual patterns and wants filter/search added in-place. Do NOT absorb them into Mode B with a view-mode toggle.
- **Two existing Detail screens pivot from stats dashboards → curated discovery surfaces.** `ChefDetailScreen` and `BookDetailScreen` are no longer "show me stats about this book/chef" — they're "here are some recipes from this book/chef worth diving into" with curated sections. Detail-level stats visuals explicitly punted to v2.
- **Two new index screens** to build from scratch: `BookListScreen` (or `BooksIndexScreen` — name your call, follow project conventions), `ChefListScreen`. Don't exist today.
- **Books and chefs are parallel entities with a relational link.** `books.chef_id → chefs.id` is a real FK. Each gets its own index + detail + view triplet. Books can be filtered/sorted by author.
- **Mode A entry to Books/Chefs:** a small text row "**Browse by →** Books · Chefs" below the 6-tile grid, above the existing "Browse all N →" link. NOT new tiles. NOT a separate bottom-tab.

### Curated sections (Book Detail + Chef Detail)
- **Four sections:** Most cooked / Recently cooked / Friends' favorites / Bookmarked, then a "Browse all N recipes" CTA at the bottom routing to the View screen.
- **Empty sections hide entirely** (conditional render — not "empty state" copy).
- **"Bookmarked"** is backed by `user_recipe_tags WHERE tag='saved'` via `lib/services/userRecipeTagsService.ts`'s `getRecipesWithTag(uid, 'saved')`. Etymological closest match to the bookmark concept. If Tom later wants `'favorites'` instead, it's a one-line swap.

### Sort defaults
- **Books index default sort:** compound — `chefs.last_name ASC NULLS LAST, chefs.first_name ASC NULLS LAST, books.title ASC`. Clusters by author last name; alphabetical within each. Other sort options (Title A→Z, Most recipes, Recently added, Most cooked) live under a single "Sort" dropdown. **Single dropdown, not separate chips** — Tom: "not too many filter chips."
- **Chefs index default sort:** `last_name → first_name → name fallback`.

### Library scale
- Current: 5 books. Expected for high-usage users: 10–20. Index treatments should scale across that range without re-design.
- Tile counts in screenshot (`Quick tonight 718`, `Recently added 347`, etc.) suggest Tom's library has grown to ~700+ recipes vs the 475 baseline. Worth knowing for resolver-cost mental model. Not blocking.
- **Book covers** exist as `books.cover_image_url` — some populated, some missing. Tom will populate over time. CP2 needs a **fallback treatment** for missing covers.

---

## Schema findings (from prior investigation — don't re-investigate)

- **`books` table** is real and rich. Columns: `id`, `title`, `author` (text fallback when chef_id is null), `cover_image_url`, `chef_id` (FK → chefs.id), `user_id` (FK → user_profiles.id), `isbn`, `isbn13`, `publisher`, `publication_year`, `is_verified`, `style_metadata` (jsonb), `toc_data`, `toc_image_path`.
- **`chefs` table:** `id`, `name`, `first_name`, `last_name` (separate columns — clean sort path), `image_url`, `bio`, `website`, `instagram`, `youtube`, `tiktok`, `twitter`, `substack`, `verified`, `specialty` (text array), `chef_type`.
- **`recipes.book_id`** is a real FK → `books.id` (SET NULL on delete). `recipes.chef_id` is a real FK → `chefs.id`. The `recipes.book_name` text column is **legacy denorm** — the FKs are truth. Use them.
- **`user_recipe_tags`** table backs the tag system. Registered tags include `cook_soon`, `saved`, `favorites`. Service: `lib/services/userRecipeTagsService.ts`.
- **`is_pinned`** on the TypeScript Recipe type (`screens/RecipeListScreen.tsx` line 84, with a pinned-count computation at line 1205 that always returns 0) is **dead code** — the column doesn't exist in the schema. Out of scope for 11D, but flag for cleanup if it surfaces. The next instance should NOT use `is_pinned` for the bookmark concept — use `userRecipeTagsService` + `'saved'` tag instead.
- **Existing `lib/services/bookViewService.ts`** has 12 functions covering most book/author/chef-by-id queries: `getAllBooks`, `getBook`, `getBookByISBN`, `searchBooks`, `getRecipesByBook`, `getUserBooks`, `getAllAuthors`, `getAuthor`, `getRecipesByAuthor`, `getRecipesByChef`, `getChefBooks`, `getBookStats`. **Extend it, don't replace it.**
- **`AuthorViewScreen` and `BookViewScreen` bypass `bookViewService`** and do their own inline `supabase.from(...).select(...)` queries. That refactor is a CP3/CP4 concern, not CP1.
- **`recipeHistoryService`** exports `getCookingHistory` (returns `times_cooked`, `last_cooked`, `avg_rating` per recipe) and `getFriendsCookingInfo` (returns `friends_cooked_count`). These are the metric sources for the curated sections — don't reimplement.

---

## CP1 contract (what CP2–CP4 will consume)

Assuming Tom has run `CC_PROMPT_11D_CP1.md`, `lib/services/bookViewService.ts` will have these new exports:

```ts
// Curated sections (one call returns all four arrays)
getCuratedBookSections(bookId: string, userId: string, limit?: number): Promise<CuratedSections>
getCuratedChefSections(chefId: string, userId: string, limit?: number): Promise<CuratedSections>

// Index queries
getBooksForIndex(userId: string, sort?: BookSortOption): Promise<BookWithStats[]>
getChefsForIndex(userId: string, sort?: ChefSortOption): Promise<ChefWithStats[]>
searchChefs(query: string, userId: string): Promise<ChefWithStats[]>
```

Where:
```ts
interface CuratedRecipe {
  id, title, image_url, chef_name, book_title,
  // Exactly ONE of these populated per row, matching the section it came from:
  times_cooked?, last_cooked_at?, friends_cooked_count?, saved_at?
}
interface CuratedSections { mostCooked, recentlyCooked, friendsFavorites, bookmarked: CuratedRecipe[] }
interface BookWithStats { id, title, author, cover_image_url, chef_id, chef_first_name, chef_last_name, chef_name, recipe_count, cooked_count }
interface ChefWithStats { id, name, first_name, last_name, image_url, recipe_count, cooked_count, book_count }
type BookSortOption = 'author_then_title' | 'title_asc' | 'recipes_desc' | 'recently_added' | 'most_cooked'
type ChefSortOption = 'name' | 'recipes_desc' | 'most_cooked' | 'recently_added'
```

Empty arrays (not nulls, not errors) for "no content." Service is RLS-friendly with user_id scoping throughout.

See `CC_PROMPT_11D_CP1.md` for exact signatures and constraints.

---

## CP2 — Books index + Mode A entry

**Open questions for Tom before drafting:**

1. **Empty state** — what shows when a user has 0 books in their library? Recommendation: a simple "Your library is empty — recipes added from a cookbook will appear here" with maybe an "Add recipe" CTA. Confirm.
2. **Cover fallback for missing covers** — the prior wireframe used gradient-colored placeholder with title overlay. Other options: book-spine SVG with title, generic book icon, blank with title text. Recommendation: gradient + title, matches the visual richness Tom said he likes.
3. **Chefs link in the "Browse by →" row** — CP4 hasn't built `ChefListScreen` yet. For CP2: disable the Chefs link (visibly muted), stub it to a placeholder screen, or build `ChefListScreen` ahead of CP4 schedule? Recommendation: disabled+muted; ships connected when CP4 lands.
4. **Book tap behavior in CP2 specifically** — when a user taps a book in the new index, do they land on `BookDetailScreen` (still stats-style until CP3 redesigns it) or `BookViewScreen` (current browse-style)? Recommendation: `BookDetailScreen`. When CP3 redesigns Detail, the link naturally improves. Confirm.
5. **Mode A "Browse by →" row visual** — plain text link with arrow? Each entity name as a small chip? Recommendation: plain text, "Browse by →" prefix + "Books · Chefs" as tappable text links separated by a dot. Confirm.

**Files touched in CP2:**
- NEW: `screens/BookListScreen.tsx` (or your chosen name) — Books index
- MODIFIED: `screens/RecipeListScreen.tsx` — add "Browse by →" row in Mode A render
- MODIFIED: `App.tsx` — register `BookListScreen` route in RecipesStack

**Cost shape:** Moderate. One new screen + one small Mode A addition. CC should handle in one prompt without splitting.

---

## CP3 — Book Detail redesign + BookView enhancement

**Open questions for Tom before drafting:**

1. **Section "See all N →" link behavior** — does tapping "See all 5 →" on a section header navigate to BookView with a sort preset (e.g., Most cooked → BookView sorted by times_cooked desc)? Or informational only (count, no nav)? Recommendation: route to BookView with the section's natural sort applied. Confirm.
2. **RefineSheet contents on BookView** — when opened from BookView with a book lens preset, does the cuisine facet still surface? Hero ingredient? The "Quick refine" section at the top? Recommendation: yes to all — book lens is just another lens, facets are universal. But the Cookbook facet itself should hide since the cookbook is already locked. Confirm.
3. **Search behavior on BookView** — scope to current book (search "chicken" → chicken recipes in *this* book) or escape to global search? Recommendation: scope to book. Escaping is surprising.
4. **Lens chip ✕ on BookView** — back navigation (pop), or "clear lens in place" within BookView? Recommendation: pop. The book IS the screen's primary identity; clearing in place doesn't make sense here.
5. **Bookmarked count in the header** — Tom's prior approval was "12 recipes · 8 cooked · 3 bookmarked" as the meta line. Confirm the bookmarked count surfacing in the header makes sense for chef pages too (some chefs may have many bookmarks; the count is informative).

**Files touched in CP3:**
- REWRITE: `screens/BookDetailScreen.tsx` (361 lines today, stats-dashboard) → curated discovery layout
- ENHANCE: `screens/BookViewScreen.tsx` (359 lines today, inline Supabase) — add unified browse model, refactor queries to `bookViewService.getRecipesByBook` + `getBook`
- Likely small additions to `components/RefineSheet.tsx` if the book-lens case needs special handling
- Possibly `screens/RecipeListScreen.tsx` if Mode A's "Browse by →" row needs adjusting based on CP3 learnings

**Cost shape:** Biggest of remaining CPs. Two screens. Probably warrants its own session if the next instance's context is tight.

**Consider:** CP3 might be drafted as two CPs (CP3a = BookDetail redesign, CP3b = BookView enhancement) if the prompt gets too long or if Tom prefers smaller verification surfaces. The two are independent enough that splitting works cleanly. Default plan is one CP — split only if it gets unwieldy.

---

## CP4 — Chefs index + Chef Detail redesign + AuthorView enhancement

**Open questions for Tom before drafting:**

1. **Chef avatar fallback for chefs without `image_url`** — initials in a hashed-color circle (color hashed from name for stability), or a generic chef-hat icon? Recommendation: initials. Personal, stable, more visual variety in the grid. Confirm.
2. **Chefs index layout** — 2-column grid (matches Books index visual rhythm), or denser list (avatar + name + recipe count per row)? Recommendation: 2-column grid for consistency with Books. Tom may prefer list if expecting 50+ chefs eventually.
3. **Chef specialty search** — `chefs.specialty` is a text array column. Should index search match against specialty too? Recommendation: not in CP4 — name search only for v1. Specialty search post-F&F if it becomes a need.
4. **Split CP4 into CP4a + CP4b?** — depends on CP3's actual cost. Default plan: one CP, mirroring CP2/CP3 patterns. Split at execution time if needed.

**Files touched in CP4:**
- NEW: `screens/ChefListScreen.tsx` — Chefs index
- REWRITE: `screens/ChefDetailScreen.tsx` (347 lines today, stats-dashboard) → curated discovery layout
- ENHANCE: `screens/AuthorViewScreen.tsx` (417 lines today, inline Supabase) — unified browse model, refactor to `bookViewService.getRecipesByAuthor` or chef-id-based equivalent
- MODIFIED: `screens/RecipeListScreen.tsx` — connect the "Chefs" link in the "Browse by →" row (was disabled in CP2)
- MODIFIED: `App.tsx` — register `ChefListScreen` route

**Cost shape:** Largely mechanical once CP2/CP3 land. The chef screens mirror their book counterparts.

---

## Project workflow conventions (do this, not that)

### Planning brain workflow
- **Wireframe-first** for any visual change. The `visualize:show_widget` tool with the mockup module renders inline. Two-phone side-by-side comparisons land well for showing flows or alternatives.
- **Lock direction with Tom before drafting CC prompts.** Numbered clarifying questions. Don't assume.
- **CC prompts** are standalone Markdown files in `/mnt/user-data/outputs/`. Naming convention so far: `CC_PROMPT_<phase>_<cp>.md` (e.g., `CC_PROMPT_11D_CP2.md`).
- **After CC executes**, Tom shares the SESSION_LOG entry. Read it, reconcile findings into living docs (or queue a doc-recon CC prompt for batched updates).
- **DO NOT use the `ask_user_input_v0` widget tool.** Ask clarifying questions in chat text with numbered labels.

### CC prompt structure (use `CC_PROMPT_11D_CP1.md` as a template)

Sections, in order:
1. Header with dependency callout (depends on which prior CPs, what state assumed)
2. **Context** — why this CP, what changes after, what stays the same
3. **What you're building** — numbered list of concrete changes, with type signatures / specific render targets / exact behavior
4. **Explicitly OUT of scope** — pin what the CP doesn't touch, so CC doesn't over-reach
5. **Inputs to read first** — files CC must view before editing, with one-line reason per file
6. **Constraints** — type-strict, never-lose-a-capability, pure-data-layer-no-React, etc.
7. **Verification** — numbered checks CC should perform before claiming done
8. **SESSION_LOG entry format** — exact template for CC to fill in

### Tom's style
- Direct, pragmatic. Values evidence over assumptions. Pushes back if he disagrees.
- BME background; reads code, doesn't write. Don't dump unnecessary code into chat.
- Numbered clarifying questions.
- Concise responses. Flag uncertainty explicitly.
- Appreciates being challenged on directional calls.

### CC behavior notes (from prior 11A work)
- CC executes prompts reliably across CP1–CP5a of 11A. Type-checks reliably, runs smoke tests, follows the SESSION_LOG format.
- CC has shown a tendency to second-guess platform-API edge cases (e.g., the React Navigation `tabPress` getParent() level took two attempts in 11A-CP5a). **When a first attempt at a framework API doesn't fire, nudge CC toward checking the framework docs before iterating.**
- CC is good at flagging pre-existing issues (e.g., the `CookSoonSection.tsx` + `DayMealsModal.tsx` JSX parse errors flagged across all 11A SESSION_LOGs). Honor those flags; they accumulate.

---

## Reference files (PK / repo)

### Living docs
- `PROJECT_CONTEXT.md` — overall project state
- `FRIGO_ARCHITECTURE.md` — codebase map
- `FF_LAUNCH_MASTER_PLAN.md` — sequencing across phases
- `PHASE_11_RECIPE_POLISH.md` — may or may not exist yet (created by `CC_PROMPT_PHASE11_DOC_CREATION.md` if Tom has run it; if not, run that prompt before substantive CP2 work)
- `DEFERRED_WORK.md` — running backlog
- `SESSION_LOG.md` — CC's checkpoint log

### Code files particularly relevant to 11D
- `lib/services/bookViewService.ts` — extended in CP1; the layer all 11D screens consume
- `lib/services/recipeHistoryService.ts` — cooking metrics source for curated sections
- `lib/services/userRecipeTagsService.ts` — bookmark source (`tag='saved'`)
- `lib/services/recipeBrowseService.ts` — 11A unified browse model; reusable for book/chef lenses in CP3/CP4
- `components/recipe/BrowseLensChip.tsx` — reusable lens/refinement chip from 11A-CP3 (used by CP3/CP4 for the lens chip on BookView/AuthorView)
- `components/RefineSheet.tsx` — long-tail refine sheet from 11A-CP4 (renamed from FilterDrawer; consumed by BookView/AuthorView via the Refine button)
- `screens/RecipeListScreen.tsx` — Mode A/B split from 11A-CP5a; receives the "Browse by →" row addition in CP2
- `screens/AuthorViewScreen.tsx` — 417 lines, browse-focused chef view, inline Supabase queries (enhanced in CP4)
- `screens/BookViewScreen.tsx` — 359 lines, browse-focused book view, inline Supabase queries (enhanced in CP3)
- `screens/ChefDetailScreen.tsx` — 347 lines, stats-focused chef view (rewritten in CP4 → curated)
- `screens/BookDetailScreen.tsx` — 361 lines, stats-focused book view (rewritten in CP3 → curated)
- `App.tsx` — navigation registration (RecipesStack); CP2 + CP4 add routes here

### Outputs already on disk
- `/mnt/user-data/outputs/CC_PROMPT_11D_CP1.md` — drafted, may or may not have been executed
- `/mnt/user-data/outputs/CC_PROMPT_PHASE11_DOC_CREATION.md` — doc reconciliation prompt, may or may not have been executed
- `/mnt/user-data/outputs/CC_PROMPT_11A_CP5a.md` — already executed (11A mode split)
- (Earlier CP prompts also exist but are already executed)

---

## First moves in the new conversation

1. **Verify status with Tom** — has `CC_PROMPT_11D_CP1.md` been run? Has `CC_PROMPT_PHASE11_DOC_CREATION.md` been run? Is CP5b (11A) still pending or has it slotted in?
2. **If `PHASE_11_RECIPE_POLISH.md` doesn't exist yet**, recommend running the doc-recon prompt before substantive CP2 work.
3. **Confirm CP5b sequencing** — Tom said in the prior session that CP5b could run parallel to 11D. If he hasn't kicked off CP5b yet, ask whether he wants it drafted now or later.
4. **Move into CP2 design lock** — confirm the 5 open questions in the CP2 section above with Tom. Wireframe only if Tom wants to revisit visuals; otherwise the prior wireframe direction stands (2-column cover grid, single sort dropdown, search bar at top, "Browse by → Books · Chefs" text row on Mode A).
5. **Write `CC_PROMPT_11D_CP2.md`** using `CC_PROMPT_11D_CP1.md` as a structural template.
6. **Then CP3, then CP4**, with design-lock Q&A before each.
