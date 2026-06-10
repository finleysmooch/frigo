# Cookbook Recipe-Delivery — Build Scope (for the execution instance)

**Status:** scope locked by oversight · 2026-06-09 · author CC prompts from this
**Owner of this doc:** oversight/spec. **You (execution instance):** turn this into CC prompt(s); propose doc updates via SESSION_LOG; do not edit the anchor/spec directly.
**Feeds:** the cookbook section of anchor **v0.3.2** (oversight is landing that in parallel — this scope and that section are the same model).
**Read first:** `ONBOARDING_BUILD_SPEC.md` §S3/T8/§5.4 · `MIGRATIONS.md` · the books/user_books/recipes schema CSVs · the CP1 + CP4 SESSION_LOG entries.

---

## 1. The locked model (one paragraph)

A user finds cookbooks they own in a **global catalog** (search), proves ownership via a **verification image**, and on approval the book's **full transcribed recipe set is copied into their own account** as independent, editable recipes. Delivery is **copy-on-verify** (not reference/grant) for F&F. The gate is **ownership**, not transcription-readiness. Every delivered recipe carries **provenance** (machine-extracted by a named Claude model, extraction date, **not** author-authenticated). Each user's copies are **theirs to edit/comment on** — never the canonical "mother" recipe.

### Two catalog tiers (determined by recipes-exist, not `toc_extracted_at`)
- **Recipe-windfall** — catalog book that has real recipes in the `recipes` table (`EXISTS recipes WHERE book_id = X`). Verify → copy-on-verify delivers the full set.
- **Shelf-only** — catalog book with no recipes yet (net-new CSV titles). Verify → added to the user's shelf; recipes arrive later as transcription catches up (fast-follow delivery).

The honest signal is **recipes-exist**, never `toc_extracted_at` (the audit confirmed TOC-processed ≠ recipes-in-table). Never label anything "recipes ready" off `toc_extracted_at` alone.

---

## 2. Decomposition (CP4 is already handed off)

| CP | Scope | Tier / gate | Depends on |
|----|-------|-------------|-----------|
| **CP4** *(done — handed off)* | `is_catalog` column + net-new CSV seed + `searchBookCatalog(is_catalog=true)` | mechanical | — |
| **CP4b** | Promote ready transcribed books into the catalog | **sensitive — oversight gates** (writes rows the assembly workstream owns) | CP4, v0.3.2, assembly-owner sign-off |
| **CP6a** | Ownership-verification capture + approval flow + verified record/storage | **sensitive — oversight gates** | v0.3.2, **O1** (open), CP4 |
| **CP6b** | Copy-on-verify delivery engine + provenance stamping + per-user editable copies | **sensitive — oversight gates** | CP6a, CP4b (for windfall books) |

You may split CP6a/CP6b further or recombine if the code argues for it — flag the split in your prompt. CP6's screens are the T8 surface from the wireframes; this scope is the backend + capture/approval, not the final screen polish.

---

## 3. Per-CP scope

### CP4b — Catalog promotion (sensitive, gated)
**Goal:** make the already-transcribed books findable in catalog search so verified owners can pull their recipes.
- `UPDATE books SET is_catalog = true` **only** on books that pass a **recipes-exist check** (`EXISTS (SELECT 1 FROM recipes WHERE book_id = X)` / a count threshold you define) **and** are **per-book confirmed by the assembly-workstream owner** as genuinely ready. Never `toc_extracted_at` as the gate.
- **Exclude the 3 junk rows** (Cooked Veg / Cook's Veg / lowercase "More is more").
- **Boundary:** this is the one CP that writes rows another active workstream owns → **hard coordination block**, not a courtesy. Confirm the per-book list with the assembly owner before the UPDATE runs. Touch no assembly artifact (`book_page_scans`, `book_recipe_assembly`, `book_assembly_runs`, assembler edge functions, `recipe_extraction_queue`).
- **Verification:** the promoted set matches the owner-confirmed list exactly; junk excluded; `searchBookCatalog` now returns them; no recipe/assembly row mutated; `migration list` parity; `db diff` clean modulo known 3-CHECK noise.

### CP6a — Ownership verification (sensitive, gated, **O1-dependent**)
**Goal:** capture proof of ownership and an approval that flips a verified flag.
- A **verification record** keyed on `(user_id, book_id)` — recommend a dedicated table (`book_ownership_verifications`: status `pending|verified|rejected`, image ref, `verified_at`, `reviewed_by` nullable) rather than overloading `user_books`, since verification has its own lifecycle. Confirm against the code before deciding.
- **Image storage** reuses `imageStorageService` (don't build new upload infra).
- **Approval flow:** manual review for F&F (admin/Tom approves) — **note in DEFERRED that manual doesn't scale**; auto/assisted approval is a known fast-follow.
- **O1-gated:** the *proof type* (holding-the-book photo / cover / receipt) and the *approval mechanism* are O1 — see §4. Build the record + storage + flag now; the capture UI specifics and the approve action wait on O1's confirmation.
- **Verification:** a pending verification can be created; approval flips status to `verified`; rejection path works; image stored + retrievable; nothing delivers recipes yet (that's CP6b).

### CP6b — Copy-on-verify delivery (sensitive, gated)
**Goal:** on verified ownership, deliver the book's recipes as the user's own editable copies.
- **Trigger:** verification status → `verified` (CP6a).
- **Delivery logic:** if recipes exist for the catalog `book_id` → **deep-copy** each into the user's account; else → shelf-only (user_books link, no recipes; recipes arrive on a later fast-follow when transcription lands).
- **Deep copy = a fully independent recipe**, reusing the established **copy-on-import pattern** (the NYT work set the precedent: per-user rows intentionally duplicating a source). Each copy is its own `recipes` row **+ all child rows** (`recipe_ingredients`, `instruction_sections`, source notes) under the user's `user_id`. **No write-path FK to the canonical book recipe.** Use `saveRecipeToDatabase` as the single owner of child-row saving (the SESSION_LOG flagged a double-save bug when callers also saved sections — don't reintroduce it).
- **Library linkage (resolve from code, confirm with oversight):** how does a delivered book appear in the user's library — a `user_books` link to the catalog `book_id`, or a copied user-owned `books` row (`is_catalog=false`)? The copied recipes' `book_id` must point at whatever `getUserBooks` / `getBooksForIndex` use so the user's "Plenty" shows its recipes and catalog rows still don't leak into anyone's library. **Flag your chosen structure for oversight before building.**
- **Provenance stamping (required, §5):** each delivered copy carries model/version (`models.ts`), extraction date, and a **not-author-authenticated** marker. Copied onto every instance.
- **Verification:** verified user receives N independent recipes (N = canonical count) under their `user_id`; canonical rows unchanged; the copies appear in the user's library + recipe list; catalog rows still isolated from non-verified users; provenance present on every copy; a shelf-only book delivers a shelf entry with zero recipes and no error.

---

## 4. O1 — open input (Tom owns; recommended defaults to confirm)

CP6a's capture UI + approve action **cannot be finalized until O1 lands.** Everything else above is O1-independent. O1 decides:
- **(a) Sufficient ownership proof** — recommend **holding-the-book photo** (stronger than cover; weak proof is fine for F&F's trust level). Confirm.
- **(b) Approval flow** — recommend **manual review for F&F**, auto/assisted as a tracked fast-follow (manual won't scale).

Relay O1 to oversight when decided; the execution instance prepares CP6a's record/storage/flag in the meantime and only gates the capture-UI + approve-action specifics on it.

---

## 5. Cross-cutting requirements

**Provenance (Tom's locked add).** Every delivered/copied recipe must carry, queryably: machine-extracted by an AI model (which model/version), the extraction date, and **NOT an author-/publisher-authenticated copy.** Post-launch goal recorded: compare extracted → authenticated and flag divergence. **Before encoding a provenance field, confirm what `raw_extraction_data` and the `recipe_extraction_comparison` table already capture** — this is likely surfacing existing data, not new infra. Provenance rides with CP6b and is retro-applied to already-transcribed books.

**Per-user editable copies (locked).** A verified owner edits/comments on **their copy only**, never the canonical recipe. Copy-on-verify gives this by construction (independent rows). Confirm `annotationService` / `recipeAnnotationsService` / `commentsService` key off `recipe_id + user_id` so they target the copy automatically. **Recorded trade-off:** copies are frozen at copy-time — user edits preserved, canonical corrections do **not** propagate. Accepted for F&F; the post-F&F reference/grant model must solve canonical-vs-local (layered overrides, not edit-in-place).

**IP / legal assumption (on the record, not an engineering default).** Full-recipe-set delivery is premised on the user owning the physical book (personal-use / digital-shelf framing); the recipes are **machine-extracted, not licensed/authenticated**. Whether photo-of-ownership is sufficient and how this sits with cookbook-author IP is an **open legal assumption flagged for Tom/counsel** — a CP must not encode a position silently. Pairs with the existing pre-launch legal-review item.

**Architecture note (recorded).** Copy-on-verify is the F&F choice for isolation + reuse of user-scoped machinery; **reference/grant is the post-F&F target** (no duplication, propagates, but a recipe-surface-wide read-scope change). `is_catalog` (membership) and `user_books` (ownership) stay **orthogonal** — a delivered book is `is_catalog=true` and gains a `user_books` link.

---

## 6. Sequencing & gates

- **CP4** ships independently (mechanical, already handed off). Until CP4b runs, catalog search returns only net-new shelf-only titles — the windfall books aren't searchable yet. Correct interim state.
- **CP4b / CP6a / CP6b wait on v0.3.2** (oversight landing now) and, for CP6a's capture specifics, **O1**.
- All three are **sensitive tier → oversight reviews the prompt before run and the result after.** CP4b additionally blocks on the assembly-workstream owner's per-book sign-off.
- **Clean tree before the sensitive CPs.** Close out CP2 and commit the per-CP slices (pantry / CP2 / CP3 / CP4) before any row-touching sensitive migration runs — do not run CP4b/CP6/CP5 against a dirty working tree.
- **CP5 (auth trigger)** is a separate gated workstream; the same clean-tree rule applies.

---

## 7. Confirm-from-code before drafting prompts

1. `getUserBooks` / `getBooksForIndex` / `getChefsForIndex` scoping — so catalog rows never leak into a library, and so you can choose the delivery library-linkage structure (§3 CP6b).
2. The copy-on-import / `saveRecipeToDatabase` deep-save path — reuse it; don't reintroduce the double-save-sections bug.
3. `annotationService` / `recipeAnnotationsService` / `commentsService` are `recipe_id + user_id`-scoped.
4. What `raw_extraction_data` + `recipe_extraction_comparison` already capture (provenance surfacing vs new field).
5. `imageStorageService` for the verification image.

Anything that contradicts this scope when you hit the code: flag it in SESSION_LOG and route to oversight — don't silently re-decide.
