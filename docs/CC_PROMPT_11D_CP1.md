# CC PROMPT — 11D-CP1: Data foundation for chef/book pages

> **Foundational, non-visual CP.** Mirrors 11A-CP1's role: lay the data layer that CP2–CP4 will render, with no UI changes. Pure data layer — no React, no screen edits, no navigation work.

## Context

11D adds a chef/book browse axis to the app: new Books and Chefs index screens (CP2/CP4), redesigned Book/Chef Detail screens as curated discovery surfaces (CP3/CP4), and BookView/AuthorView screens enhanced with the unified browse model (CP3/CP4). All of that needs a data layer that doesn't exist yet — curated section queries, compound sorts, chef-index queries. CP1 builds that layer so the UI CPs are straight rendering work.

Important schema context found in investigation:
- `books` table is real with `id`, `title`, `author`, `cover_image_url`, `chef_id` (FK → `chefs.id`), `user_id`, plus ISBN/publisher/year.
- `chefs` table has `id`, `name`, `first_name`, `last_name` (last_name exists as a separate column — clean sort path), `image_url`, plus social fields.
- `recipes.book_id` is a real FK → `books.id` (SET NULL on delete). `recipes.chef_id` is a real FK → `chefs.id`. The `recipes.book_name` text column is a legacy denorm; the FKs are the truth.
- `user_recipe_tags` table backs the bookmark concept via `tag = 'saved'`; service is `lib/services/userRecipeTagsService.ts`. Use that — do not create a new bookmark mechanism.
- `is_pinned` on the Recipe TypeScript type is **dead** — column doesn't exist in schema. Don't read it, don't write it. Out of scope to remove the type field in this CP.
- Existing service `lib/services/bookViewService.ts` already has 12 functions covering most book + author + chef-by-id queries (`getAllBooks`, `getBook`, `searchBooks`, `getRecipesByBook`, `getAllAuthors`, `getRecipesByChef`, `getChefBooks`, etc.). **Extend it; don't replace it.** AuthorViewScreen and BookViewScreen currently bypass this service with inline Supabase queries — that refactor is a CP3/CP4 concern, not CP1.
- `recipeHistoryService.ts` exports `getCookingHistory` (`times_cooked`, `last_cooked`, `avg_rating`) and `getFriendsCookingInfo` (`friends_cooked_count`). These are the metric sources for the curated sections.

## What you're building

All work happens in `lib/services/bookViewService.ts` plus new type definitions. No screens, no components, no navigation.

### 1. Curated-section queries (book and chef variants)

Add two new exports:

```ts
export interface CuratedRecipe {
  id: string;
  title: string;
  image_url: string | null;
  chef_name: string | null;       // useful when not implicitly scoped to one chef
  book_title: string | null;      // useful when not implicitly scoped to one book
  // Section-specific metric — exactly ONE is populated per row, matching the section the row came from:
  times_cooked?: number;          // 'mostCooked'
  last_cooked_at?: string;        // 'recentlyCooked'  (ISO)
  friends_cooked_count?: number;  // 'friendsFavorites'
  saved_at?: string;              // 'bookmarked'      (ISO; from user_recipe_tags.created_at)
}

export interface CuratedSections {
  mostCooked: CuratedRecipe[];
  recentlyCooked: CuratedRecipe[];
  friendsFavorites: CuratedRecipe[];
  bookmarked: CuratedRecipe[];
}

export async function getCuratedBookSections(
  bookId: string,
  userId: string,
  limit?: number,           // default 5
): Promise<CuratedSections>;

export async function getCuratedChefSections(
  chefId: string,
  userId: string,
  limit?: number,           // default 5
): Promise<CuratedSections>;
```

Semantics per section:
- **mostCooked**: top N recipes in this book/chef where `cooking_history.times_cooked > 0`, sorted desc by `times_cooked`, tie-break by `last_cooked` desc. Empty array when user has cooked nothing from this scope.
- **recentlyCooked**: top N recipes in this book/chef where `cooking_history.last_cooked IS NOT NULL`, sorted desc by `last_cooked`. Empty array when user has cooked nothing here.
- **friendsFavorites**: top N recipes in this book/chef where `friends_cooked_count > 0` (uses `getFriendsCookingInfo`), sorted desc by `friends_cooked_count`. Empty array when no friend has cooked anything from this scope.
- **bookmarked**: recipes in this book/chef where the user has the `'saved'` tag in `user_recipe_tags`. Sorted desc by tag `created_at` (most recently saved first). Empty array when the user has no saved recipes in this scope. **Use `userRecipeTagsService` for this — don't query `user_recipe_tags` directly.**

Empty arrays — not nulls, not errors — are the contract for "no content." CP3/CP4 will conditionally hide empty sections from rendering. The service should never throw on a valid bookId/chefId/userId combination just because one section is empty.

A single call returning all four sections is preferred over four separate exports — fewer round-trips when the Detail screen opens, and the cost shape is similar (each query is small, scoped by FK).

### 2. Books index query with compound sort

The Books index screen (CP2) needs all books in the user's library with:
- `id`, `title`, `author` (the books.author text column, often redundant with chef join but useful as fallback), `cover_image_url`
- `chef_id`, `chef_first_name`, `chef_last_name`, `chef_name` (LEFT JOIN chefs so books without a `chef_id` still surface)
- `recipe_count` (count of recipes with `book_id = books.id`)
- `cooked_count` (distinct recipes in this book the user has cooked, derived from `cooking_history`)

Compound default sort:
```sql
ORDER BY chefs.last_name ASC NULLS LAST,
         chefs.first_name ASC NULLS LAST,
         books.title ASC
```

Books without a linked chef sort to the bottom by author last name (NULLS LAST), then alphabetically by title — defensive against incomplete data.

Other sort options to support (callers pass an enum/string):
- `'title_asc'` — books.title ASC
- `'recipes_desc'` — recipe_count DESC, books.title ASC
- `'recently_added'` — books.created_at DESC
- `'most_cooked'` — cooked_count DESC, recipe_count DESC

Type:
```ts
export type BookSortOption =
  | 'author_then_title'   // default
  | 'title_asc'
  | 'recipes_desc'
  | 'recently_added'
  | 'most_cooked';

export interface BookWithStats {
  id: string;
  title: string;
  author: string | null;
  cover_image_url: string | null;
  chef_id: string | null;
  chef_first_name: string | null;
  chef_last_name: string | null;
  chef_name: string | null;
  recipe_count: number;
  cooked_count: number;
}

export async function getBooksForIndex(
  userId: string,
  sort?: BookSortOption,   // default 'author_then_title'
): Promise<BookWithStats[]>;
```

The existing `getAllBooks` stays; `getBooksForIndex` is the new one with stats and compound sort. CP3's Book Detail will still use `getBook(bookId)` for the single-book fetch.

### 3. Chefs index query

New for CP4. Mirror structure to `getBooksForIndex`:

```ts
export type ChefSortOption =
  | 'name'           // default — last_name → first_name → name fallback
  | 'recipes_desc'
  | 'most_cooked'
  | 'recently_added';

export interface ChefWithStats {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  recipe_count: number;
  cooked_count: number;
  book_count: number;     // count of distinct books in user's library by this chef
}

export async function getChefsForIndex(
  userId: string,
  sort?: ChefSortOption,   // default 'name'
): Promise<ChefWithStats[]>;

export async function searchChefs(query: string, userId: string): Promise<ChefWithStats[]>;
```

The `'name'` sort:
```sql
ORDER BY chefs.last_name ASC NULLS LAST,
         chefs.first_name ASC NULLS LAST,
         chefs.name ASC
```

`name` fallback handles chefs with only a single-name display (e.g., "Ottolenghi" when first/last aren't split).

### 4. Wire-up notes

- `recipe_count` for both Books and Chefs index: count is scoped to recipes the user has access to — match the pattern `getAllBooks` already uses for user-scoping.
- `cooked_count`: distinct recipes in this scope that have `times_cooked > 0` in the user's cooking history. Reuse `getCookingHistory` or query `cooking_sessions` / `posts` directly per the existing pattern — match what `recipeHistoryService` does so the semantic is consistent.
- For `getCuratedChefSections`, the scope is "recipes where `chef_id = X`" — does NOT include recipes from books authored by that chef unless those recipes also have the chef set directly. (The data model lets the same chef appear via `recipes.chef_id` or via `recipes.book_id → books.chef_id`.) Use the simpler scope — direct `chef_id` match — for v1. The Chef Detail's "Browse all" can use a broader query later if it turns out to under-surface recipes.
- Search queries (existing `searchBooks` and new `searchChefs`) should be ILIKE-based against the relevant text columns — match the existing `searchBooks` implementation pattern.

## Explicitly OUT of scope (later CPs)

- **CP2:** Books index screen + Mode A "Browse by →" text-row entry.
- **CP3:** Book Detail redesign (stats → curated sections) + BookView enhancement (unified chip + RefineSheet + searchService).
- **CP4:** Chefs index + Chef Detail redesign + AuthorView enhancement.
- Refactoring AuthorViewScreen and BookViewScreen away from inline Supabase queries — that lands as part of CP3/CP4 when those screens are touched anyway.
- Removing `is_pinned` from the Recipe TypeScript type — separate cleanup, low priority.
- Investigating whether Cook Soon (`tag = 'cook_soon'`) should also drive a curated section — not in CP1's scope; the bookmark section uses `'saved'`. If the design later calls for a "Want to cook from this book" section, it's an additive query and easy to add.

## Inputs to read first

- `lib/services/bookViewService.ts` — the file you're extending; understand its existing patterns (user-scoping, query shape, return types) before adding to it.
- `lib/services/recipeHistoryService.ts` — `getCookingHistory` and `getFriendsCookingInfo` are the cooking-metric sources; use them rather than reimplementing.
- `lib/services/userRecipeTagsService.ts` — `getRecipesWithTag(userId, 'saved')` is the bookmark source.
- `Supabase_Snippet_Schema_Column_Metadata_with_Key__FK_Info.csv` (if present in repo) or your live schema knowledge for `books`, `chefs`, `recipes`, `user_recipe_tags`, `cooking_sessions` column shapes.

## Constraints

- Pure data layer. No React imports. No screen edits. No navigation work.
- Type-strict — every export has explicit input/output types defined in the same file or a co-located types file.
- RLS-friendly — `user_id` filtering on every query that scopes to user library.
- Defensive on nulls — `chef_id`, `last_name`, `cover_image_url`, `image_url` are all nullable in the schema; queries and sorts must handle nulls gracefully (NULLS LAST on sort keys; nullable fields on the return types).
- Default sort for `getBooksForIndex` = `'author_then_title'` (per locked design decision).
- Default sort for `getChefsForIndex` = `'name'` (last_name → first_name → name fallback).
- Empty arrays — never throw, never return nulls — for "no content" cases on curated sections.

## Verification

1. `getCuratedBookSections(bookId, userId)` returns a `CuratedSections` object with the four arrays, each correctly populated or empty per their semantics. Spot-check against a known book in the dev account.
2. `getCuratedChefSections(chefId, userId)` likewise.
3. `getBooksForIndex(userId)` with default sort: returned books cluster by chef last name (NULLS LAST), then chef first name, then book title — visible alphabetical-by-author grouping.
4. `getBooksForIndex` with each non-default sort option returns sensibly ordered results.
5. `getChefsForIndex(userId)` with default sort: chefs alphabetical by last name, NULLS LAST, then first name, then name. Recipe count and book count populated correctly.
6. `searchChefs('otto', userId)` returns chefs whose name/first_name/last_name contains the substring.
7. Empty-state cases — a book the user has never cooked from returns `mostCooked: []`, `recentlyCooked: []`; a user with no `'saved'` tags returns `bookmarked: []` for every book/chef; a user with no friends returns `friendsFavorites: []`. No errors thrown.
8. Type-check clean on `bookViewService.ts` (no new TS errors) and the new types compile.
9. No changes to any screen, component, navigation, or other service file.

## SESSION_LOG entry format

Append to `docs/SESSION_LOG.md`:

```
### 11D-CP1 — Data foundation for chef/book pages — <date>

**Shipped:** lib/services/bookViewService.ts extended with curated-section queries (getCuratedBookSections, getCuratedChefSections), Books index query with compound author-last-name → title sort (getBooksForIndex), and Chefs index queries (getChefsForIndex, searchChefs). New types: CuratedRecipe, CuratedSections, BookWithStats, ChefWithStats, BookSortOption, ChefSortOption. No screen, component, or navigation changes — pure data foundation. Bookmark concept backed by user_recipe_tags 'saved' tag via userRecipeTagsService.

**Files:** lib/services/bookViewService.ts (extended).

**Key decisions / deviations:** <single getCuratedBookSections call vs four separate queries; how cooked_count is computed; how the user-scoping pattern was matched from existing getAllBooks; chef-scope decision (direct chef_id match for v1, not books.chef_id derived); anything else that took judgment>

**Verification:** <results against the 9 checks; spot-check results from the dev account; type-check status; any queries that hit edge cases worth noting>

**Deferred / notes for CP2+:** Books index screen and Mode A "Browse by →" entry are CP2. Book Detail redesign (curated layout consuming getCuratedBookSections) and BookView enhancement are CP3. Chef counterparts are CP4. The AuthorViewScreen/BookViewScreen inline-Supabase refactor happens in CP3/CP4 when those screens are touched anyway.

**Recommended doc updates:** <FRIGO_ARCHITECTURE — extension to bookViewService (new exports, new types); PHASE_11_RECIPE_POLISH.md — 11D-CP1 marked shipped, CP2 next>
```
