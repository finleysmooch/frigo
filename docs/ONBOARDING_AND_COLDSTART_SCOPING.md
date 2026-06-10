# Onboarding & Cold Start — Scoping (Anchor)

**Version:** v0.3.6 · **Status:** 🟢 reconciled to the live build model · 2026-06-10
**Canonical location:** repo `docs/ONBOARDING_AND_COLDSTART_SCOPING.md` (no suffix), committed; dated copy in `_pk_sync/` for PK upload.
**Owner:** oversight/spec (canonical). Executing instance proposes changes via SESSION_LOG; oversight merges.
**Companion docs:** `ONBOARDING_BUILD_SPEC.md` (build-actionable) · `COOKBOOK_DELIVERY_SCOPE.md` (cookbook workstream) · `docs/wireframes/frigo_onboarding_coldstart_wireframes_v4.html` (15 screens).
**Relationship:** this anchor owns *scope + decisions of record*. The build spec owns *what to build, in what order, with which existing pieces*. Where this doc and a CP conflict, **this doc wins on scope**; where the schema/code contradicts this doc, the executing instance flags via SESSION_LOG and oversight reconciles.

> **v0.3.1 → v0.3.2 changelog.** Folds S1–S8 (locked); locks O1 (ownership proof + approval); **rewrites the cookbook section** around the catalog + copy-on-verify recipe-delivery model (was shelf-builder-only); corrects the `toc_extracted_at` tier semantics; records S9 as a non-spine proposal; lands the **no-default-Space-at-signup dependency** (load-bearing for CP3/CP9); consolidates DEFERRED items. This is the first reconciliation since the build began — prior versions trailed the live decisions by several deltas.
>
> **v0.3.3 update.** Adds the **IP field-level carve-out** (copy ingredients + steps; exclude the protected description prose) as a HARD CONSTRAINT on CP6b; records CookShelf as a competitor data point + the metadata-model fallback; resolves CP6b **library-linkage** from code; reconciles **status** (CP2/CP5/CP6a-1 shipped; CP6a split into CP6a-1 done + CP6a-2 in pre-review); records the **anchor-canonicalization** repo fix.
>
> **v0.3.4 update.** Copy scope **reversed per Tom** (risk accepted): full recipe copied for F&F **including protected prose + images** — carve-out removed. Reversibility preserved as non-negotiable (parameterized copy-set + purge-identifiability). §3 IP elevated to a **hard counsel gate before public launch**.

---

## 1. Goal & model

Frigo onboarding is a **routed value-exchange model**: a short critical-path spine, then a cook-style router that forks into a Recipe path or a (currently shelved) Freehand path, with find-friends elevated early. Every step either routes or returns visible value; the router is the one deliberate route-only exception.

**F&F definition of done:** a brand-new tester, unaided, reaches — in (invite code + account), a real name (no email-as-handle), ≥1 piece of their own data, ≥1 friend (seeded or found), and lands on populated-or-nudging surfaces, never a blank dead-end. Ongoing in-app guidance (W4) is explicitly out of this bar.

Full screen-by-screen spec is in `ONBOARDING_BUILD_SPEC.md` §4, keyed to wireframes v4.

---

## 2. Decision register

### Original anchor decisions
| ID | Decision | Status |
|----|----------|--------|
| D-ON-1 | Minimum onboarding = full-surface routed critical path | ✅ resolved |
| D-ON-2 | Pantry seed v1 = staples checklist, default in-stock | ✅ resolved |
| D-ON-3 | Vehicle = 3-tier operating model (spec/oversight · execution-planning · CC); master-plan **placement/numbering** | ⚪ open (non-blocking) |
| D-ON-4 | Invite codes (#69) owned by this project | ✅ resolved (CP2 built) |
| D-ON-5 | First value = cook-style router → Recipe / Freehand | ✅ resolved |
| D-ON-6 | Ongoing in-app guidance (W4) out of the F&F minimum | ✅ resolved (out of scope) |

### Session locks (S1–S8)
| ID | Decision | Status |
|----|----------|--------|
| S1 | **No username.** Display name = first+last; editable later in Settings | ✅ resolved + implemented (CP5) — see §5 |
| S2 | Google + Apple sign-in + native strong password | ✅ decided · **not built** (OAuth not wired today; future CP; Apple 4.8 obligates Apple if Google offered) |
| S3 | Cookbooks: search + shelf + verify + title catalog | ✅ resolved, **expanded** into the §4 recipe-delivery model |
| S4 | L1 sources = single-column checklist, gated-by-selection; sources: Cookbooks · NYT · Saved links · Instagram/TikTok · YouTube · Reddit · Substack · In my head · Other (free text). Removed Screenshots + Chefs-as-source. Social/video = route+personalize, not extraction promise | ✅ resolved |
| S5 | Tab-9 value steps split into lean L1-gated sub-steps (paste / signature / chefs); chefs offered to all recipe-path users | ✅ resolved |
| S6 | Freehand path **shelved** → placeholder; router "by feel" points there; revisit later | ✅ resolved (shelved) |
| S7 | Dedicated empty-state screens (feed ×2, recipes, pantry); skipper/partial framing; "start a grocery list" exit on empty pantry | ✅ resolved |
| S8 | Verbiage source = `cookfrigo.com` ("A home for your home cooking", sous-chef framing); request-access fallback; domain `cookfrigo.com` | ✅ resolved |

### O1 — ownership verification (now locked)
- **(a) Sufficient proof:** a photo of the **book together with a handwritten note showing today's date** — a liveness/freshness signal (proves possession *today*, not just that a photo exists). **Subject to change.** This tightens *possession* proof only; it does **not** resolve the IP/license question under full-recipe delivery (see §3 IP open).
- **(b) Gate = verify-first.** No recipes delivered until ownership is approved. Access-first and view-first were both considered and **rejected**: both move full machine-extracted copyrighted transcriptions through the weakest gate on the one feature with an OPEN IP basis (§3), and access-first makes denial a destructive claw-back of edited user copies. **Deny = "don't deliver"** (verify-first has nothing to revoke) **+ flag the user.**
- **(c) Approval = manual review by Tom for F&F**, via a review portal (CP6a). **Immediacy lever = a trusted-user allowlist that auto-grants on submit** (skips the manual wait for known testers) — a *policy* lever, not an architectural inversion. Allowlisted users still get a verification record (audit), auto-approved.
- **(d) AI review is deferred + phased** (§8), gated on the §3 IP conversation before any *auto*-grant goes live — automating the approver is the moment "a human judged this a legitimate owner" stops being true, so it follows counsel, not precedes it.
- **Effect:** CP6a (capture-UI + review portal + approve-action + allowlist) is **fully unblocked**.

---

## 3. Open items
| ID | Item | Owner |
|----|------|-------|
| **IP/legal** | Delivery is premised on the user owning the physical book; recipes are machine-extracted, **not licensed/authenticated**. **Field-level line** (well-supported, fact-specific): ingredients + instruction steps are uncopyrightable (functional); **free-text descriptions/headnotes AND book photography are protected expression**. **Decision of record (Tom — risk accepted, against oversight recommendation):** for F&F, copy the **full recipe including prose + images** — the carve-out is removed. Premise: a personal library of books one owns (prose + images included) is defensible; oversight's noted counter is that Frigo holds **one canonical extraction and distributes copies to every verified owner**, which strains "personal-use format-shifting" toward "a service reproducing publisher content," and the two kept categories (prose, photos) are the highest-protection ones. **Why F&F-acceptable:** ~100–200 known testers (small closed surface), real ownership gate (verify-first + manual approval), and **reversible** — the copy-set is parameterized AND delivered content is purge-identifiable (CP6b Task 4), so a narrowing can both stop *and* claw back. **HARD COUNSEL GATE before any public launch** — F&F is a defensible window to run hot in; GA is not, and the centralized-copy-and-distribute mechanic on protected prose + images is where this gets real. **Competitor signal:** CookShelf runs a similar model with no ownership proof but deliberately withholds the recipe *method* (ingredients + page-number only) — conservatively safe; Frigo is deliberately on the other side of that line for F&F. **Fallback if counsel narrows:** the metadata model (ingredients + page-number) — a config edit via the parameterized copy-set, plus a purge of already-delivered prose/images. **Photos mechanism — CONFIRMED (a) reference, not (b) rehost (CP6b confirm-from-code, 2026-06-10):** `recipe_photos` has zero writers; a canonical recipe's image lives in `recipes.image_url` and `recipe_media.url` as text references, and the deep-copy copies those strings verbatim — one stored image, N pointers. Per-delivery exposure is therefore the canonical's existing exposure, and the purge is **row-scoped**: it deletes delivered rows but must NOT touch the shared stored object. Standing caveat: if the delivery mechanism ever rehosts bytes, this flips to (b) and the §3 posture returns for re-evaluation. NOT resolved by O1 (possession ≠ license). Pairs with the pre-launch cookfrigo.com Privacy/Terms review. | Tom/counsel |
| O2 | Contact-sync in find-friends v1 vs fast-follow (strongest viral + disambiguation lever, but unbuilt) | Tom |
| S9 | "Who do you normally cook with?" → shared Space — **proposed, explicitly NOT a spine step.** If built for F&F: on-app-only, off-app gated behind CP8. **Oversight recommendation: keep out of F&F onboarding;** nudge post-hand-off / on the Pantry-Spaces surface | Tom |
| O3 | Name editable in Settings (assumed **yes**) | Tom (confirm) |
| O4 | Cook-type chips emoji vs text — moot while Freehand shelved | deferred |
| D-ON-3 | Master-plan phase placement/number for onboarding | oversight/master-plan |

---

## 4. Cookbook recipe-delivery model (rewritten)

The cookbook step is no longer shelf-builder-only. **Verified book owners receive the book's full recipes — ingredients, steps, descriptions, and photos — into their account as independent, editable recipes.** Delivery is **copy-on-verify**, gated on **ownership**, with **provenance** stamped on every copy. The full-content copy (including protected prose + images) is **Tom's risk-accepted decision for F&F**; it is reversible (parameterized copy-set + purge-identifiable, §4.3) and **gated on counsel before public launch** (§3 IP).

### 4.1 Catalog
- `books.is_catalog boolean NOT NULL DEFAULT false` (added CP4). **Orthogonal to `user_books`:** `is_catalog` = catalog membership; `user_books` = ownership. A delivered book is `is_catalog=true` *and* gains a `user_books` link.
- `searchBookCatalog` returns **only `is_catalog=true`** rows (never "search all books" — that would surface dev junk + half-transcribed workstream books).
- **Two tiers, keyed on recipes-exist** (`EXISTS recipes WHERE book_id=X`), **not `toc_extracted_at`**:
  - **Recipe-windfall** — has real recipes → verify delivers the full set.
  - **Shelf-only** — net-new CSV titles, no recipes yet → verify adds to shelf; recipes arrive on a later fast-follow.
- **Tier-wording rule:** `toc_extracted_at` means *TOC-processed*, **not** recipes-in-table (the scan→recipes importer is the separate, unbuilt assembly workstream). Labels are "on shelf" / "transcribed," **never "recipes ready"** off `toc_extracted_at`.

### 4.2 Promotion (CP4b — gated)
`UPDATE books SET is_catalog=true` on transcribed books that pass the recipes-exist check **and** are per-book confirmed by the assembly-workstream owner; exclude the 3 junk rows. Sensitive tier (writes rows another workstream owns) → oversight gates + assembly-owner sign-off.

### 4.3 Delivery (CP6 — gated)
- **Gate:** **verify-first** — O1 ownership verification (CP6a) → manual approval by Tom via the review portal (F&F), or auto-grant for trusted-allowlist users. No recipes delivered pre-approval; **deny = don't-deliver + flag** (nothing to claw back).
- **Copy-on-verify (F&F choice):** on approval, **deep-copy** the book's recipes into the user's account — independent `recipes` rows + their real `recipe_id` children (per the ratified copy-set, copy-scope bullet below). **Mechanism (ruled 2026-06-10, superseding the earlier `saveRecipeToDatabase` mandate):** a dedicated, isolated **`recipeDeliveryService`** row-level deep-copier — reads the canonical `recipes` row plus allow-listed children directly from the DB and re-inserts them under the new `user_id`, driven entirely by the §4.3 config allow-list. `saveRecipeToDatabase` is the *extraction* path and cannot faithfully copy (extraction-shaped input, curated field subset, stale child-savers); the sole-child-saver rule protects that path, which the delivery service must neither touch nor be imported by. Read-canonical-never-mutate.
- **Copy scope (Tom's decision of record — risk accepted, against oversight rec):** for F&F, copy the **full recipe** — functional fields **plus** the protected categories (`description`, `recipe_notes`, `recipe_photos`, `recipe_media`). The carve-out is **removed** for F&F. **Ratified copy-set (2026-06-10).** COPY: `instruction_sections` (+ steps), `recipe_ingredients`, `recipe_media` (reference copy per §3), `recipe_photos` (copy-if-present; expected empty — zero writers, vestigial), `recipe_source_notes` (canonical source-derived content; note it is third-party UGC from the source site — inside the F&F posture and the counsel gate). EXCLUDE: `recipe_annotations`, `user_recipe_tags`, `user_recipe_preferences`, **`recipe_step_notes`** (user content — `user_id NOT NULL`, carries voice notes, sole writer `cookingService`), **`user_ingredient_choices`** (user content — records the user's "or"-option pick per cooking session; grandchild of recipe_ingredients), `recipe_references` (leak/dangle; config hook if overruled), user-activity tables (`cooking_sessions`, `posts`, `meal_dish_plans`, `needs_recipes`), QA/operational artifacts (`extraction_*`, `recipe_extraction_comparison`/`queue`, `recipe_image_mapping`, `or_pattern_decisions`; `gold_standard_notes` column). **Completeness guard:** the engine CP runs a live FK scan (`pg_constraint` where `confrelid = 'recipes'::regclass`) and STOPS if any child table appears that is not classified here — the allow-list is verified against the live schema, never asserted (the PK schema CSVs were found stale pre-June). **Transitive-closure inventory (live FK scan, 2026-06-10):** descendants of copied children are exactly instruction_sections → instruction_steps (COPY, re-parented) and recipe_ingredients → user_ingredient_choices (EXCLUDE); no deeper descendants. **Two reversibility requirements are NON-NEGOTIABLE:** (1) the copy-set is a **parameterized config allow-list** the deep-copy reads — a counsel/GA narrowing (→ metadata model) is a config edit, not an engine rebuild; (2) delivered content is **purge-identifiable as a set** (`parent_recipe_id NOT NULL` + provenance stamps make every CP6b-delivered row + children queryable) — so a narrowing can claw back already-delivered prose/images, not just stop forward delivery. These two make the risk acceptance reversible in practice; without them it's a one-way door.
- **Lineage:** set `recipes.parent_recipe_id` → the canonical recipe. **Read-only lineage pointer only** — no read of a user's recipe may resolve through it (that would recreate reference/grant by accident).
- **Reference/grant** (no duplication, propagates corrections) is the **post-F&F** target; copy-on-verify's trade-off — copies frozen at copy-time, canonical fixes don't propagate — is accepted for F&F.
- **Library linkage (RESOLVED from code):** both `getUserBooks` variants (recipeExtraction/bookService — the one the library UI / BookSelectionModal calls — and bookViewService) scope a user's library through the `user_books` join; neither uses `books.user_id` or `is_catalog`. So delivery = create a `user_books(user_id, catalog_book_id)` row via the **existing `createUserBookOwnership`** (don't invent a second path) + deep-copy recipes with `book_id = catalog_book_id` under the user's `user_id`. `is_catalog` stays true (orthogonal to ownership). No leakage (recipes user-scoped, books `user_books`-scoped); no new structural decision needed.

### 4.4 Per-user editable copies (locked)
A verified owner edits/comments on **their copy only**, never the canonical recipe — satisfied by construction (independent rows). Annotations/comments target the copy's `recipe_id` (`annotationService`/`recipeAnnotationsService`/`commentsService` confirmed `recipe_id+user_id`-scoped). Provenance is copied onto each instance.

### 4.5 Provenance (locked — queryable, not JSON-only)
New queryable fields on `recipes` (small column-add, not surfacing): `extraction_method` (e.g. `'ai_model'`), `extraction_model` (model/version from `models.ts`), `is_author_authenticated boolean NOT NULL DEFAULT false`. Extraction date = `created_at`. Best-effort backfill of existing transcribed books (`is_author_authenticated=false`, method/model from `raw_extraction_data` where recoverable, else `'unknown_legacy'`). **Post-launch goal:** compare extracted → authenticated and flag divergence (the `parent_recipe_id` lineage + `recipe_extraction_comparison` give the join path).

### 4.6 IP/legal
Stated as an **open assumption on the record** (§3), never encoded silently by a CP.

---

## 5. Auth / S1 implementation (CP5, cleared)

`handle_new_user` (public schema) replaced: **username made NULLABLE** (not dropped — column-drop is post-F&F cleanup); new profiles get `username NULL`; `display_name` = OAuth metadata (`display_name`/`full_name`/`name`) else **email-prefix** (never NULL); `avatar_url` from metadata when present. SECURITY DEFINER + locked `search_path`. Auth-schema trigger binding untouched. LoginScreen's `username=email` write **removed** (it would have re-introduced the handle on next login and undone S1). OAuth is **not wired** today — the function is metadata-*ready* but the live OAuth flow is untested (owed when S2 ships).

---

## 6. ⚠️ Load-bearing dependency — no default Space at signup

**`handle_new_user` does NOT create a Space** (CP5 finding — closes the prior space-timing question). Spaces are created **lazily by app/RPC**, not at signup.

**Therefore, a hard build constraint for the onboarding flow:** any step that writes space-scoped data — **CP3 staples → supplies, the T11 pantry seed, and any space-scoped write in the CP9 spine** — **must first ensure the user's space exists by calling the existing lazy space-create path.** Do not invent a second create path; find and call the one that exists. Ordering: **space-ensure before the first supply/space-scoped write.** Missed, this silently no-ops or errors. CP3/CP9 drafters: read this before drafting.

---

## 7. Build sequence & status

3-tier operating model and full CP detail in the build spec. Current state:

| CP | Scope | Tier | Status |
|----|-------|------|--------|
| CP1 | `supabase/migrations/` tracking | mechanical | ✅ shipped |
| CP2 | Invite codes (#69) | mechanical | ✅ shipped + closeout committed |
| CP3 | Staples checklist (D-ON-2) | checkpoint | ⏳ **must ensure space exists before supply write (§6)** |
| CP4 | `is_catalog` column + `searchBookCatalog` | mechanical | ✅ shipped |
| CP4-seed | Net-new catalog CSV seed | mechanical | ⏳ part-1 committed; **waits on Tom's `docs/seed/cookbook_titles.csv`** |
| CP4b | Promote transcribed books into catalog | **gated** | ⛔ waits on assembly-owner per-book list |
| CP5 | Auth trigger (no-username + metadata-ready) | **gated** | ✅ **shipped — pushed + live-verified** (real signup: username NULL, display_name from metadata, defaults) |
| CP6a-1 | Verification table + private bucket + capture/submit | checkpoint | ✅ **shipped + verified** |
| CP6a-2 | Admin gate + review RPCs + allowlist + in-app portal + CP6b seam | **gated** | 🟢 in oversight pre-review → CC authors |
| CP6b | Copy-on-verify delivery + provenance (full-recipe copy per §4.3; recipeDeliveryService) | **gated** | 🟡 provenance migration authored (held — pushes with the engine); engine cleared to author on v0.3.5 landing; **post-push gate:** a fixture smoke through the real recipeDeliveryService (deliver → verify per §4.3 → clean up; real-corpus counts before==after) must PASS before CP4b promotes any catalog book or any real-user delivery occurs (the pre-push de-risk is a SQL mirror, ratified 2026-06-10 — it validates logic, not the shipped path) |
| CP8 | Claim-by-email | **gated, high-risk** | ⛔ isolated, own verified CP |
| CP9 | Spine + router + recipe value steps + empty states | checkpoint | ⏳ **§6 constraint applies** |

**Clean-tree rule:** sensitive row-touching CPs (CP4b, CP6b, CP8) run against a clean tree, per-CP commits. (CP2 closeout + CP5 push + CP6a-1 already landed clean.)

---

## 8. DEFERRED (consolidated)
- Username **column drop** (post-F&F; nullable for now).
- OAuth **app-smoke** when S2 ships (+ Apple 4.8 obligation).
- Pre-F&F **bare-"@" cleanup** — ~6 surfaces render a bare "@" for NULL-username users; fix to show `display_name` (or drop the affordance). Its own small CP, **before F&F**, not post-launch.
- `getUserBooks` **consolidation** — two copies (bookViewService + recipeExtraction/bookService); tech debt, not fixed inside CP6b.
- **Reference/grant** delivery model — post-F&F (no duplication, propagates; recipe-surface-wide read-scope).
- **Metadata-model fallback** (ingredients + page-number, no method/description) — the CookShelf-style de-risked alternative if counsel narrows functional delivery; cheaper (no transcription dep, no copy-on-verify). §4.3's scoped copy-set makes the switch a field-set change.
- `user_books.ownership_*` **consolidation** — `ownership_claimed` + `ownership_proof_image_url` are live (written by `createBook`); the new `book_ownership_verifications` table is canonical; deprecate the old fields post-F&F (don't read them as truth meanwhile).
- **AI ownership-verification review — phased fast-follow:** phase 1 = AI **triage/recommend** (scores book-present / handwritten-dated-note / title-match; human confirms); phase 2 = **auto-approve a high-confidence band** + manual queue for the rest. **Gated on the §3 IP conversation before any auto-grant goes live** (auto-approval removes the human checkpoint sitting in front of an unresolved legal question). Reuses the existing vision path + `models.ts`; surfaces in the CP6a portal. (Manual + trusted-allowlist is F&F-only.)
- **Contact-sync** find-friends — if O2 → fast-follow.
- **Shared library** (recipes/books/favorites space-scoping with shared-vs-private split) — post-F&F workstream; precedent: 8R `for_user_ids`; ancestor: SHARED_PANTRIES_FEATURE_SPEC.

---

## 9. Risks / watchpoints
- **Empty states untested at zero data** — the #1 drop-off risk; the W2 screens are the mitigation, need real zero-data testing.
- **Social/video extraction unproven** — Reels/TikTok/YouTube/Reddit route+personalize only.
- **Name collisions** in find-friends (no handle) — lean on contacts/invite-link/QR/seeded; name search is the weak fallback.
- **IP/legal** (§3, §4.3) — F&F runs the full-recipe copy including protected prose + images (Tom's risk-accepted decision). The defensible window is the small closed test + verify-first gate + reversibility (parameterized copy-set, row-scoped purge). **Hard counsel gate before any public launch.** Metadata-model fallback (§8) is the retreat if narrowed.
- **Shared DB** — schema/trigger edits aren't branch-isolated; sequence deliberately, isolate claim-by-email.
- **Manual ownership approval** — a Tom bottleneck at any real volume; F&F-only by design.

---

## Changelog
| Date | Version | Change |
|------|---------|--------|
| 2026-06-10 | 0.3.6 | Completeness guard fired on first run: user_ingredient_choices classified EXCLUDE (user content). recipe_image_mapping typo fixed. Closure inventory recorded (scan now reconciles cleanly). De-risk model ratified: pre-push SQL mirror + binding post-push real-service fixture smoke as a gate before CP4b promotion / first real delivery. |
| 2026-06-10 | 0.3.5 | Photos mechanism confirmed (a) reference (purge row-scoped). Copy mechanism ruled: dedicated recipeDeliveryService (supersedes saveRecipeToDatabase mandate — extraction path cannot faithfully copy). Copy-set ratified: recipe_step_notes EXCLUDED (user content), recipe_source_notes COPIED (source content), live-FK-scan completeness guard added. §7/§9 v0.3.3 carve-out leftovers corrected. CP6a RLS backstop verified post-push (PASS, 2026-06-10). |
| 2026-06-10 | 0.3.4 | Copy scope reversed per Tom (risk accepted, against oversight rec): **full recipe copied for F&F including protected prose + images** (carve-out removed). Reversibility kept as non-negotiable: parameterized copy-set + **purge-identifiability** (CP6b Task 4) so a counsel/GA narrowing can both stop *and* claw back. §3 IP elevated to a **hard counsel gate before public launch**, both protected categories (prose + images) named. |
| 2026-06-10 | 0.3.3 | IP field-level carve-out (copy ingredients + steps; exclude protected `description` prose) as a HARD CONSTRAINT on CP6b; CookShelf recorded as competitor data point + metadata-model fallback (§3/§8); CP6b library-linkage resolved from code (§4.3, reuse `createUserBookOwnership`); status reconciled (CP2/CP5/CP6a-1 shipped; CP6a split → CP6a-1 done + CP6a-2 in pre-review; CP4-seed waits on CSV); anchor-canonicalization repo fix recorded (§7). |
| 2026-06-10 | 0.3.2 | First build-era reconciliation. Folded S1–S8; locked O1 (book+handwritten-date photo, manual approval); rewrote §4 cookbook model (catalog/`is_catalog`, copy-on-verify delivery, provenance, `parent_recipe_id`, per-user copies, tier correction); recorded S9 non-spine; added §6 no-default-Space dependency; consolidated §8 DEFERRED; IP/legal flagged open. **Finalized the delivery gate: verify-first (access-first + view-first considered and rejected); manual approval + trusted-user allowlist auto-grant as the immediacy lever; deny = don't-deliver + flag; review portal in CP6a scope; AI review deferred/phased, gated on IP counsel.** |
| (prior) | 0.3.1 | Pre-build scoping (routed model, tagged questions, find-friends + admin seeding, execution setup). |
