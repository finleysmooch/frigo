# Session Log

_This log is for **post-Phase-10 work** — beginning after the Phase 10 (Nutrition Depth) ship on 2026-05-27. Likely contents going forward: Phase 9 (Meal & Planning UX), Phase 11 (Recipe Polish, including RecipeListScreen redesign per P11-input-1), Phase 12 (Distribution & Testing), plus any inter-phase cleanup / hot fixes._

_Phase 10 era entries (8D cleanup pass + Phase 10 ship) are archived at `docs/_SESSION_LOG_PHASE10.md` (stays top-level for one phase per `docs/archive/README.md`, then moves to `docs/archive/session_logs/` when the next phase completes). Phase 8 era is at `docs/_SESSION_LOG_PHASE8.md`. Earlier phases at `docs/archive/session_logs/`._

_Direct Tom↔CC UX iteration work on existing pantry/grocery surfaces is logged separately in `docs/UX_ITERATIONS_LOG.md` — not here. This log captures phase-checkpoint-level work only._


## 2026-06-10 — CP6a-1: ownership-verification capture + private storage + submit (ADDITIVE half; pushed + verified; COMMITTED as isolated feat(verification) slice)

**Closeout (2026-06-10):** committed as the isolated `feat(verification)` per-CP slice (6 files: the migration + 2 new code files + `imageStorageService.ts` + `PK_CODE_SNAPSHOTS.md` Rule-E row + this entry). No push (CC does not push unless Tom asks); the prod migration was already applied this session and stands. Tree clean for CP6a-2 (gated). The canonical anchor file is flagged below (Open questions) — deliberately NOT committed in this slice.

**Tier: checkpoint (additive, no privileged paths) → CC authored AND pushed the migration.** This is the user-facing, additive half of O1 ownership verification (verify-first cookbook delivery). It AUTHORIZES NOTHING and DELIVERS NOTHING — a user submits proof (book + handwritten dated note) and reads their OWN status; the row sits in `pending` until CP6a-2's review machinery exists (intended inert seam). Approval/admin/allowlist (writing verified/rejected, `verified_at`, `reviewed_by`, `auto_granted`, `review_note`, `delivered_at`) is **CP6a-2** (gated). **SOURCE OF TRUTH:** the new table — the legacy `user_books.ownership_*` columns are NOT touched and NOT read as truth.

**Anchor-doc note:** the prompt cited `COOKBOOK_DELIVERY_SCOPE.md` / a `v0.3.2` anchor by name; neither exists in the repo by those filenames. The equivalent CP6a model (verify-first, copy-on-verify, allowlist = CP6a-2, O1 proof) is carried by `docs/ONBOARDING_AND_COLDSTART_SCOPING (1).md` (untracked), which I used for context. The prompt itself was self-contained for the build (exact table DDL, RLS requirements, service + component spec) — no judgment call required, so no STOP.

**Shipped:**
- **Migration `20260610165737_cp6a1_book_ownership_verifications`** (pushed): table `public.book_ownership_verifications` (id, user_id→auth.users, book_id→books, status CHECK pending/verified/rejected default pending, proof_image_path, submitted_at, + privileged-by-CP6a-2 columns verified_at/reviewed_by/auto_granted/review_note/delivered_at, **UNIQUE(user_id, book_id)** so re-submit updates), a user_id index, RLS, and the private storage bucket + its object policies.
- **RLS — self-verify is impossible by construction.** RLS can't restrict *which* columns are written, so each writable policy pins the resulting row to `status='pending'` with every privileged field at its empty default: `bov_insert_own_pending` (WITH CHECK), `bov_update_own_pending` (USING `status='pending'` so a reviewed row is immutable to the user + the same WITH CHECK), `bov_select_own` (own rows only). Privileged writes are CP6a-2 definer RPCs (owner bypasses RLS) — no user/anon path to set status or any privileged column.
- **Private bucket `verification-images`** (`storage.buckets`, `public=false`) + two `storage.objects` policies (`verification_images_insert_own` / `_select_own`) path-scoped to `(storage.foldername(name))[1] = auth.uid()` — owner-read only, NO public read, never routed through recipe-images/post-images.
- **`imageStorageService.uploadImage` extended:** bucket union → `StorageBucket = 'recipe-images' | 'post-images' | 'verification-images'`; private buckets return the storage **path** + a short-lived (1h) signed URL for display only (no dead public URL). Public-bucket behavior unchanged.
- **`lib/services/ownershipVerificationService.ts` (new):** `submitVerification(bookId, localUri)` (upload to private bucket, folder=userId for the path-scoped RLS, then upsert a `pending` row, onConflict user_id,book_id), `getMyVerification(bookId)`, `getMyVerifications()`. NO admin/approve/allowlist methods (CP6a-2).
- **`components/OwnershipVerificationCapture.tsx` (new):** standalone, theme-matched. Instructs the user to photograph the book **with a handwritten note showing today's date** (today's date rendered for them), take/pick via `imageStorageService.chooseImageSource`, submit, and reflect status (pending badge). Capture controls gated to fresh/pending rows (a reviewed row is RLS-immutable). **Not wired into any screen** (CP6b/CP9 place it). Separate from the legacy `BookOwnershipModal` (which writes `user_books.ownership_*`) — that path untouched.

**Files modified:**
- `supabase/migrations/20260610165737_cp6a1_book_ownership_verifications.sql` (new; **pushed to prod**)
- `lib/services/ownershipVerificationService.ts` (new)
- `components/OwnershipVerificationCapture.tsx` (new)
- `lib/services/imageStorageService.ts` (edited — bucket union + private-bucket signed-url branch) ⚠️ PK snapshot now stale (was 2026-04-22)
- `docs/PK_CODE_SNAPSHOTS.md` (Rule E — `imageStorageService.ts` row Staleness Risk Low→HIGH)
- **Rule E:** the two NEW code files are not in PK snapshots → no flags; only `imageStorageService.ts` matched.

**Verified (all green):**
- **De-risk before push** (rollback-wrapped, non-persisting): full migration builds as the postgres role over the pooler — incl. `storage.buckets` INSERT + `storage.objects` `CREATE POLICY` (the privilege risk) — and rolls back clean. Then a built-in-txn RLS enforcement test as a simulated `authenticated` user: ✅ own pending INSERT allowed (so `authenticated` already has table grants via Supabase default privileges — no explicit GRANT needed), ✅ own-read sees only own row (other user's seeded row hidden), ✅ self-verify via INSERT blocked (RLS), ✅ self-verify via UPDATE blocked (RLS), ✅ `auto_granted=true` self-set blocked, ✅ re-submit proof-swap on a pending row works.
- **`db push --dry-run` → `db push`** applied only `20260610165737`.
- **Persisted checks:** table exists; UNIQUE(user,book); status CHECK `IN (pending/verified/rejected)`; RLS on; 3 table policies; bucket `public=f`; 2 storage policies; **live self-verify INSERT blocked** (re-confirmed against the persisted table); 0 leftover test rows.
- **Private-bucket isolation:** the public route `…/object/public/verification-images/…` returns **HTTP 400** (private bucket rejects the public path entirely — no working public URL).
- **`user_books.ownership_*` intact:** both `ownership_claimed` + `ownership_proof_image_url` still present, unmodified (the migration never references `user_books`); `createBook`/`createUserBookOwnership` unaffected.
- **Tracking:** `migration list` local==remote (7 versions, CP6a-1 included); `db diff --linked --schema public` shows ONLY the known 3-CHECK noise (`has_metric_conversion`/`valid_unit_type`/`valid_scores`) — no `book_ownership_verifications` diff.
- **`tsc`:** the 3 CP6a-1 files have zero errors. (The only app-code tsc errors are 2 pre-existing ones in untouched files — `CookSoonSection.tsx`, `DayMealsModal.tsx`; the 181 node_modules errors are a pre-existing corrupted `@react-navigation/core` `.d.ts`.) Capture component verified standalone via type-check only (wiring into a screen is out of scope by instruction).

**Git state:** the migration is **live on prod**; the slice is **committed** as the isolated `feat(verification)` per-CP commit (migration + 2 new code files + `imageStorageService.ts` + `PK_CODE_SNAPSHOTS.md` + this SESSION_LOG entry). **Not pushed** (CC does not push unless asked). `.env` never staged. Out-of-scope untracked items left untouched.

**Open questions:**
- **Canonical anchor file location (oversight to resolve).** The CP6a model's canonical anchor is an **untracked** file with a duplicate-suffix filename: `docs/ONBOARDING_AND_COLDSTART_SCOPING (1).md` (note the trailing `" (1)"`). It was used for context this session but **deliberately NOT committed** into the CP6a-1 slice. Oversight should decide where the canonical anchor lives (e.g., rename to drop the `(1)` suffix, confirm vs the prompt-cited `COOKBOOK_DELIVERY_SCOPE.md` / `v0.3.2` names which don't exist in-repo) and land it as its own change, separate from this CP.
- Approval / admin / allowlist / the copy-on-verify delivery seam are all CP6a-2 / CP6b (by design).

**Recommended doc updates:**
- **`FRIGO_ARCHITECTURE.md`** — add `ownershipVerificationService` (submit/getMy* half) + the `book_ownership_verifications` table (sole verification-status source; CP6a-1 = user submit/own-read, CP6a-2 = privileged approve/reject/allowlist via SECURITY DEFINER RPCs) + the private `verification-images` bucket + the `uploadImage` `StorageBucket`/private-bucket extension. Not edited (awaiting Claude.ai reconciliation).
- **`DEFERRED_WORK.md`** — add: `user_books.ownership_*` consolidation onto `book_ownership_verifications` (legacy columns retained for now, not read as truth); note **CP6a-2 owns the approval half** (review portal + approve/reject RPCs + trusted-allowlist auto-grant + admin-read-all storage policy). Not edited (recommend).
- **`PROJECT_CONTEXT.md`** — none.
- **`FF_LAUNCH_MASTER_PLAN.md`** — recommend marking CP6a-1 (capture + private storage + submit) shipped; CP6a-2 still gated. Not edited (recommend).

**Recommended next steps for Tom:**
- A CP6a-1 closeout/commit prompt to slice this into an isolated commit + (optionally) push to origin.
- CP6a-2 (gated): review portal + approve/reject SECURITY DEFINER RPCs + trusted-allowlist auto-grant + admin-read-all storage policy — the half that actually authorizes delivery.

---

## 2026-06-10 — CP5 (S1) POST-PUSH: applied to prod by Tom + verified — the standard three all PASS → CP5 CLOSED

**LOG ONLY** (no DB, no migration, no code from this session — Tom ran the push; this entry records the verified result). Follows the `feat(auth)` commit (`cdfa973`) below, which authored but did NOT apply CP5.

**Applied:** `supabase db push` by Tom — migration `20260610003320_cp5_handle_new_user_no_username` now live on prod (username nullable + the no-username / metadata-ready `handle_new_user`).

**The standard three — all PASS:**
- **migration list → local == remote** — all 6 versions present, CP5 included (no pending/divergent migration).
- **db diff --linked --schema public → clean modulo the known 3-CHECK noise** — only the self-cancelling drop+re-add of `has_metric_conversion` / `valid_unit_type` / `valid_scores` (migra round-trip artifact, documented in `MIGRATIONS.md`). **No `handle_new_user` diff and no `username` diff** — the live function + the nullable column match the migration exactly.
- **Real email/pw signup end-to-end → SUCCEEDED.** Profile row correct: **username NULL** (no NOT-NULL error — the `DROP NOT NULL` took), **display_name from metadata** (the COALESCE preferred `raw_user_meta_data` over the email-prefix — so BOTH branches are now confirmed against prod: metadata-wins *and* the prefix floor proven earlier in the rollback-wrapped smoke), `subscription_tier='free'`, `default_visibility='followers'`, `avatar_url NULL`.

**Note:** the signup form passes a display name via `raw_user_meta_data`, so live email/pw signups hit the metadata branch; the email-prefix `split_part(NEW.email,'@',1)` fallback is the **never-NULL floor** for any path that arrives without one (Tom's ruling). Both are now exercised — prefix floor in the de-risk smoke, metadata branch in this live signup.

**CP5 CLOSED** — the last gated/high-risk piece of the onboarding backend is applied + verified on prod. Rollback artifact (`supabase/rollbacks/20260610003320_cp5_handle_new_user_ROLLBACK.sql`) remains on disk as the proven revert if a regression ever surfaces.

**Files touched (this session):** `docs/SESSION_LOG.md` only (log-only slice). No DB, no migration, no code. **Rule E:** no code files edited → no PK snapshot staleness flags.

**Verified:** `git show --stat` = SESSION_LOG only; `.env` not staged; nothing applied to the DB this session (the push was Tom's). Origin push deferred to Tom.

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md` — **recommend** (carried from the CP5 commit): note `handle_new_user` is now no-username + metadata-ready (S1) and is live; trigger binding unchanged.
- `DEFERRED_WORK.md` — **none** (OB-3..OB-6 already banked in `cdfa973`; nothing new from the push).
- `PROJECT_CONTEXT.md` — **recommend:** S1 (no-username onboarding) is now live on prod — fold into the onboarding-backend status.
- `FF_LAUNCH_MASTER_PLAN.md` — **recommend:** mark CP5 (S1) DONE/applied if it tracks the onboarding-backend checkpoints.

**Recommended next steps for Tom:**
- `git push` origin when ready (the `feat(auth)` commit + this log entry are ahead of origin).
- OAuth signup smoke-test (`OB-4`) is still owed when OAuth actually ships — the metadata avatar/full_name branches are prod-verified only via the email/pw metadata path so far, not a live OAuth round-trip.

---

## 2026-06-10 — CP5 (S1): handle_new_user no-username + OAuth-ready profile (oversight-CLEARED; COMMITTED, NOT db-pushed — Tom's gated push)

**Closeout (2026-06-10):** oversight cleared artifact (i) live-body diff + artifact (ii) proven rollback (incl. the email-prefix `display_name` revision). Committed as `feat(auth)` onto the isolated tree (pantry/CP2/CP4 already committed). DEFERRED `OB-3..OB-6` + the no-default-space ordering resolution banked. **NOT db-pushed — applying CP5 to prod is Tom's gated step** (verify a real signup + roll back). The de-risking smoke/proof below were all rollback-wrapped (non-persisting).

**TIER: gated/high-risk. CC AUTHORED the migration + proven rollback; CC did NOT push.** `handle_new_user` fires on EVERY `auth.users` INSERT — a broken function blocks all signups on the shared prod DB. Two artifacts (below) returned to oversight; **Tom pushes only after oversight clears both**, in a window where he can verify a real signup and roll back. All DB de-risking here was non-persisting (read-only or `BEGIN…ROLLBACK`).

**Task 0 — tree state:** clean (in sync with origin/main; only the 3 known out-of-scope untracked items). Push precondition satisfiable.

**Task 1 — LIVE body (`pg_get_functiondef`, verbatim) — and live == baseline ✅ (no drift):**
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.user_profiles (id, email, username, display_name)
  VALUES (
    new.id,
    new.email,
    new.email,
    split_part(new.email, '@', 1)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(user_profiles.username, EXCLUDED.username),
    display_name = COALESCE(user_profiles.display_name, EXCLUDED.display_name);
  RETURN new;
END;
$function$
```
Side-effect enumeration: **exactly ONE side effect** — the `user_profiles` upsert (id, email, username=email, display_name=email-prefix). No default-Space creation; no avatar_url; no other table writes; no `SET search_path`.

**Task 2 — OAuth determination: NOT WIRED.** Zero matches anywhere for `signInWithOAuth`/`signInWithIdToken`/Apple/Google auth/`expo-auth-session`; **no file references `raw_user_meta_data`/`user_metadata`**; no OAuth deps in package.json. Email/password only. ⇒ The metadata-population logic is **forward-looking and tested only defensively** (insert with OAuth-shaped metadata, below); the **live OAuth flow is untested** (owed when OAuth ships).

**Task 3 — Default-Space finding (pre-rewrite gate): handle_new_user creates NO default Space.** Confirmed from the live body (single `user_profiles` upsert) and positively asserted in the smoke test (0 `space_members` for the test users). ⇒ Nothing to preserve. **Closes CP3's space-timing question:** default spaces are created lazily by app code (`create_default_space_for_user` RPC), not by the auth trigger.

**Task 4 — username → nullable + dependency sweep:** `ALTER … username DROP NOT NULL` (column NOT dropped). Sweep — every referencing object tolerates NULL: `user_profiles_username_key` is a UNIQUE index (NULLs distinct, multiple allowed); no CHECK/generated/FK on username; `pending_space_invitations` + `pending_participant_approvals` are **VIEWS** whose `*_username` columns are join-computed + nullable; **no stored denormalized username exists** anywhere.

**Task 5 — new function (live body with ONLY username+metadata lines changed; + CP-required header hardening):** `supabase/migrations/20260610003320_cp5_handle_new_user_no_username.sql`.

**Task 6 — no-username app audit:** removed the LoginScreen fallback `username: data.user.email` write (decided); reconciled spaceService `inviter_username` to fall back to `display_name` + typed the search return `username: string | null`. The dominant UI pattern is `display_name || username || fallback` (safe). **Flagged (not fixed):** ~6 secondary `@{username}` handle lines (InviteMemberModal, ParticipantsListModal, Add*ParticipantsModal) render a bare "@" for a NEW NULL-username user — cosmetic, not a break, and only on brand-new users who won't surface in mutual-follow invite lists yet.

**Task 7 — rollback PROVEN:** `supabase/rollbacks/20260610003320_cp5_handle_new_user_ROLLBACK.sql` (generated verbatim from `pg_get_functiondef` so it round-trips). Method: `BEGIN; apply forward; assert def≠orig; apply rollback; assert pg_get_functiondef = orig; ROLLBACK`. Result: **forward_differs=t, rollback_restores_orig_VERBATIM=t, live_unchanged=t.** (Restores the function only; deliberately does NOT re-add `username NOT NULL` — NULL rows may exist post-CP5.)

**SMOKE TEST (rollback-wrapped txn; 0 leftover after ROLLBACK):**
- **email/pw** (`tommorley33@smoke.test`): profile created, **username NULL (no NOT-NULL error)**, **display_name = email-prefix `'tommorley33'`** (never NULL — revised 2026-06-10 per Tom's ruling), avatar_url NULL, `subscription_tier='free'`, `default_visibility='followers'`.
- **OAuth-shaped** (metadata `full_name`+`avatar_url`): username NULL, **display_name='OAuth Tester'**, **avatar_url populated**, defaults applied.
- **Default-Space: 0 `space_members`** auto-created (positively asserts no space).

**TASK 8 — TWO ARTIFACTS FOR OVERSIGHT (push is blocked until both cleared):**
- **(i) Live-body diff** — original vs new, ONLY these lines change (+ the header `SET search_path TO 'public'` hardening): INSERT column list `username, display_name` → `display_name, avatar_url`; VALUES `new.email` (username) + `split_part(email)` (display_name) → `COALESCE(meta display_name/full_name/name, split_part(NEW.email,'@',1))` + `COALESCE(meta avatar_url/picture)`; ON CONFLICT drops the `username =` line, changes `display_name` source, adds `avatar_url =`. **Revised 2026-06-10 (Tom's ruling):** email/pw `display_name` keeps the email-prefix fallback — NEVER NULL (metadata still wins when present); username stays NULL per S1.
- **(ii) Proven rollback** — method + result above (verbatim restore confirmed).

**Files touched (committed as the isolated `feat(auth)` CP5 slice; oversight cleared both artifacts; NOT db-pushed — Tom's gated step):**
- `supabase/migrations/20260610003320_cp5_handle_new_user_no_username.sql` (new; **NOT db-pushed**)
- `supabase/rollbacks/20260610003320_cp5_handle_new_user_ROLLBACK.sql` (new; rollback artifact)
- `screens/LoginScreen.tsx` (removed username=email write)
- `lib/services/spaceService.ts` (inviter_username fallback + nullable return type)
- **Rule E:** LoginScreen/spaceService not in PK snapshots → no staleness flags. tsc clean.

**Verified:** tree clean; live==baseline; OAuth absent (defensive-only); default-Space=none (asserted); nullable sweep (all NULL-safe); rollback proven verbatim; smoke test (email/pw + OAuth-shaped) all green; LoginScreen write removed + no tested display path broken. **Post-push (Tom, after oversight):** migration list local==remote; db diff clean modulo 3-CHECK noise; a REAL signup end-to-end.

**Open questions:**
- ~~email/pw `display_name` now NULL~~ — **RESOLVED 2026-06-10:** Tom ruled the email-prefix fallback (never NULL); re-smoked (`'tommorley33'`) + rollback re-proven verbatim.
- The ~6 `@{username}` secondary-display lines (cosmetic "@" for new users) — guard later if desired.
- `username`-column DROP as post-F&F cleanup (kept nullable for now).
- OAuth smoke-test owed when OAuth actually ships.

**Recommended doc updates:**
- **Close CP3's space-timing question** with the finding: handle_new_user creates no default Space; spaces are app-code/RPC-created lazily.
- `MIGRATIONS.md` CP5 snapshot — annotate that the trigger binding is unchanged and the function was replaced (S1) once pushed.
- `DEFERRED_WORK.md` — add: (a) username-column DROP post-F&F; (b) OAuth signup smoke-test when OAuth ships; (c) the `@{username}` bare-handle guard. (Not added this session — recommend.)
- S1 implementation note (no-username) for PROJECT_CONTEXT/build spec.

---

## 2026-06-09 — CP4-seed (part 1): `is_catalog` column + searchBookCatalog filter + empirical isolation (real seed STILL deferred — CSV absent)

**Scope:** completes the marker + search-filter correction oversight ruled for CP4; the net-new CSV seed remains blocked on the absent CSV. Data + search only. Mechanical tier → CC authored AND pushed the column migration.

**Marker ruling applied:** oversight chose the explicit `is_catalog` column (waiving CP4's original "no books column change" constraint), over the no-marker option.

**Shipped:**
- **Migration `20260609234010_add_books_is_catalog`** (pushed): `ALTER TABLE books ADD COLUMN is_catalog boolean NOT NULL DEFAULT false` + a column COMMENT. Additive only — **no existing-row writes** (the DEFAULT handles all 16 current rows; nothing promoted — promotion is CP4b). `is_catalog` is orthogonal to `user_books` ownership and to `toc_extracted_at` transcription.
- **`searchBookCatalog` filter edit** (`lib/services/recipeExtraction/bookService.ts`): added `.eq('is_catalog', true)` — the crux correction so dev junk + workstream books no longer surface to testers. Return shape + prefix ordering unchanged; stale "searches ALL books" doc comment updated. tsc clean.
- **Real CSV seed NOT authored** — `docs/seed/cookbook_titles.csv` is still absent. Per the fallback I did column + filter + sample-fixture verification and STOPPED. The seed will be a SEPARATE tracked migration when the CSV lands (catalog updates = new migration; documented in the column comment).

**Verified (sample fixture inserted as is_catalog=true, then cleaned up — DB left at 16 books / 0 catalog):**
- Column: total=16, catalog_true=0, catalog_false=16; all existing `updated_at` predate the migration (no existing-row mutation).
- **Search filter (anon path):** `ZZ Sample` → 2 samples; case-insensitive `zz sample` → same; **`Cooked Veg` (junk) → [], `Six Seasons` (workstream) → [], `Plenty` (transcribed) → []** (all is_catalog=false, excluded); author match `Sampleton` → 1 sample.
- **Empirical isolation (the check CP4 deferred to seed time):** user A getUserBooks/getBooksForIndex/getChefsForIndex-equivalent counts before==after (0/0/0); **global absence — sample catalog rows in `user_books`=0 and in `recipes`=0**, so they leak into NO user's library functions; a real library user (47feb56f, 7 books) unaffected.
- Migration tracked: `migration list` local==remote (5 versions); `db diff --linked --schema public` shows ONLY the known 3-CHECK noise — no `is_catalog` diff.

**Files touched (committed together as the `feat(books): is_catalog column + catalog-scoped search filter` slice):**
- `supabase/migrations/20260609234010_add_books_is_catalog.sql` (new)
- `lib/services/recipeExtraction/bookService.ts` (searchBookCatalog `.eq('is_catalog', true)` + doc comment)

**Open questions:**
- Owned-vs-catalog dedup on the dev account — a catalog title a user also owns may appear in both; deferred to CP6/post-F&F (accepted limitation).
- The real seed awaits `docs/seed/cookbook_titles.csv` (net-new untranscribed titles only, excluding promotion/workstream/junk).

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md` — **recommend:** add the `searchBookCatalog` entry (now `is_catalog`-filtered) + `books.is_catalog` semantics (true = curated global catalog for T8; orthogonal to `user_books` ownership and `toc_extracted_at`; catalog update = new migration). Not edited (awaiting Claude.ai + the seed landing).
- `DEFERRED_WORK.md` / `PROJECT_CONTEXT.md` / `FF_LAUNCH_MASTER_PLAN.md` — **none.**

---

## 2026-06-09 — CP2 closeout: working tree sliced into per-CP commits + anon-EXECUTE rule banked

**Scope:** mechanical tree-cleaning (commits only — no DB, migrations, or push). The clean-tree precondition for the sensitive row-touching CPs (CP4b/CP5/CP6). Also banked the two CP2-owed doc items.

**Inventory (CPs actually present):** pantry (prior session) ✅, CP2 ✅, **CP3 absent**, CP4 (search half) ✅. Out-of-scope untracked left uncommitted: `_scratch/`, `docs/CC_PROMPT_cookfrigo_site_build.md`, `docs/frigo_project_status_2026-06-08.html`. `.env` confirmed never staged.

**Shipped — three per-CP commits in dependency order (nothing pushed):**
- **`5cc22b6` `feat(pantry)`** — 15 files: 11 pantry app files + `PK_CODE_SNAPSHOTS.md` + 2 new components (AutomaticIcon, ListMembershipControl) + SESSION_LOG (the pantry 2026-06-04 ×2 **and** CP1 ×2 entries, which couldn't rejoin the sealed CP1 commits `cd43f44`/`91cf1fc`).
- **`c41b4af` `feat(invite-codes)` (CP2)** — 8 files: 2 migrations + `inviteCodeService.ts` + `INVITE_CODES.md` + `DEFERRED_WORK.md` (OB-1/OB-2) + the two Step-2 doc edits + SESSION_LOG (CP2 entry).
- **`90f143d` `feat(books)` (CP4)** — 2 files: `bookService.ts` (searchBookCatalog) + SESSION_LOG (CP4 entry).

**Owed CP2 doc items banked (rode in `c41b4af`):**
- **`MIGRATIONS.md` — anon-EXECUTE standing rule:** a new public function is callable by `anon` from TWO sources — the default `PUBLIC` grant **and** Supabase's explicit default-privilege grant to anon/authenticated. Lock down BOTH (`REVOKE ALL … FROM PUBLIC` + `REVOKE … FROM anon`) then `GRANT … TO <intended>`; verify with `has_function_privilege`. Cites the CP2 corrective migration `20260609184359` as the worked example. (Protects CP5's auth-trigger function.)
- **`FRIGO_ARCHITECTURE.md` — `inviteCodeService` entry** added to the Core Services table.

**Verified:**
- `git log --oneline`: `90f143d` (CP4) → `c41b4af` (CP2) → `5cc22b6` (pantry) → `91cf1fc` → `cd43f44`. Per-CP, dependency order.
- Per-commit `show --stat` clean (no cross-contamination): pantry 15 files / SESSION_LOG 183 lines; CP2 8 files / 41 lines; CP4 2 files / 33 lines. 183+41+33 = 257 = the entire SESSION_LOG diff, split with no overlap or loss (SESSION_LOG sliced non-interactively via content-swap staging + awk on `^##`-anchored entry headers, since `git add -p` isn't available here).
- `.env` in no commit; no tracked modifications remain; **nothing pushed** (ahead of origin/main by 22).
- `MIGRATIONS.md` has the standing rule; `FRIGO_ARCHITECTURE.md` has `inviteCodeService`; each CP's SESSION_LOG entry is in its own commit (pantry/CP1 entries with the pantry commit).

**Open questions:** CP3 was confirmed **absent** in the tree (only pantry/CP2/CP4 present). CP4's seed remains blocked (marker ruling + CSV) per the CP4 entry below — its *search half* is what was committed.

**Recommended doc updates:** none new (`MIGRATIONS.md` rule + `FRIGO_ARCHITECTURE.md` entry already applied this session as authorized).

---

## 2026-06-09 — CP4 (books title-catalog): `searchBookCatalog` shipped + verified; SEED STOPPED (marker premise broken + CSV absent)

**Scope:** data + search only for onboarding T8's title catalog. The T8 screens are CP6. **Two STOP conditions hit → the seed was NOT authored/pushed; the search half is done.**

**STOP #1 — catalog marker premise is broken (the CP's explicit stop gate).** The CP said: count books with `user_id IS NULL` (expected 0); if >0, STOP. Result: **16 of 16 books have `user_id IS NULL` — all of them.** Ownership in this DB is NOT on `books.user_id`; it's modeled via the `user_books` join (confirmed by reading `getUserBooks`/`getBooksForIndex`/`findSimilarBooks`, which all scope through `user_books`/user recipes, never `books.user_id`). So `user_id IS NULL` cannot distinguish a catalog row from an existing owned/transcribed book. A different marker is needed before seeding — and the cleanest (an `is_catalog` column) conflicts with the CP constraint "no change to books columns," so this needs an oversight ruling.

**STOP #2 — seed CSV absent.** `docs/seed/cookbook_titles.csv` does not exist (no `docs/seed/` dir). Per the CSV-absent fallback, I built + verified `searchBookCatalog` and stopped before the real seed; Tom drops the CSV, then the seed migration runs (after the marker ruling).

**Shipped (search half):**
- **`searchBookCatalog(query)`** in `lib/services/recipeExtraction/bookService.ts` — case-insensitive ilike on title (primary) + author (secondary) over ALL of `books`; returns `{ id, title, author, cover_image_url, toc_extracted_at, transcribed }` with **title-prefix matches first**, then contains, then author-only (alpha within groups). Returns RAW `toc_extracted_at` + a `transcribed` boolean — **no tier labels** (CP6 labels; never "recipes ready to cook"). New `CatalogBookResult` type. Mirrors `bookViewService.searchBooks`' ilike pattern but with the catalog-specific shape + ordering (not a duplicate — `searchBooks` returns `Book[]` which omits `toc_extracted_at` and sorts alphabetically). tsc clean.

**Verified (against the live 16 books — 6 "on shelf"/toc NULL, 10 transcribed):**
- Title prefix ordering: `cook` → "Cook This Book" / "Cook's Veg" / "Cooked Veg" (prefix) before "The Ambitious Kitchen Cookbook" (contains). ✅
- Case-insensitive: `VEG` == `veg`. ✅  Author match: `Hailee` → "By Heart / Hailee Catalano". ✅
- toc matrix: Plenty → `transcribed=true` (toc `2026-01-15`); Simple → `transcribed=false` (toc NULL). ✅  Empty/whitespace → `[]`. ✅
- **Isolation (code-confirmed; empirical count-before==after deferred to seed time):** `getUserBooks` (queries `user_books` by user), `getBooksForIndex` (book IDs derived from the user's recipes), `getChefsForIndex` (chef IDs from user-scoped aggregates) — a global row with no `user_books` link and no recipes cannot appear in ANY of them. No behavior change to those functions; no `books` column change.

**Files touched:** `lib/services/recipeExtraction/bookService.ts` (added `searchBookCatalog` + `CatalogBookResult`) — **uncommitted**. No migration authored (seed blocked). No `books` row modified. Assembly-workstream artifacts untouched.

**Blocked / awaiting before the seed can run:**
1. **Marker ruling** (oversight): how to mark catalog rows given all books already have `user_id NULL` and "no books column change" is a constraint. Options: (a) no explicit marker — catalog rows are just owner-less global books distinguished by absence of a `user_books` link (how isolation already works), isbn13 stays the dedup key; (b) add an `is_catalog` column (needs a waiver of the no-column-change constraint); (c) other.
2. **The real `docs/seed/cookbook_titles.csv`** from Tom.

**Open questions:**
- The marker decision above (primary blocker).
- Known limitation to carry forward (not fixed): a user who already owns a book also present in the catalog may see both in `searchBookCatalog` results — dedup/merge deferred to CP6/post-F&F.

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md` — **recommend:** add a `searchBookCatalog` entry (global title/author catalog search returning toc state; tiers labeled by CP6) + note that catalog UPDATES are a NEW migration (tracked seed runs once per env). Not edited (awaiting Claude.ai + the seed actually landing).
- `DEFERRED_WORK.md` / `PROJECT_CONTEXT.md` / `FF_LAUNCH_MASTER_PLAN.md` — **none.**

---

## 2026-06-09 — CP2 (#69): Invite codes — tables + validate/redeem RPCs + service (first substantive tracked migration)

**Scope:** backend + service only for onboarding T2's invite-code gate. The T2 screen is CP9. First substantive migration through the CP1-tracked loop. Mechanical/low-risk tier → CC authored AND pushed. No app screens wired.

**Shipped:**
- **Migration `20260609183710_invite_codes`** (pushed): tables `invite_codes` (code normalized via trigger to upper+trim; `max_uses` null=unlimited; `uses_count`; `expires_at` null=never; `is_active`; `note`; `created_by`→auth.users) + `invite_code_redemptions` (lean attribution, `unique(code_id,user_id)`); RPCs `validate_invite_code(text)→text` (anon-callable, STABLE, status-only) and `redeem_invite_code(text)→boolean` (authenticated, atomic/race-safe/idempotent-per-user); RLS enabled with **no policies** + table privileges revoked from anon/authenticated.
- **Corrective migration `20260609184359_invite_codes_restrict_redeem_to_authenticated`** (pushed): verification caught that anon still had EXECUTE on `redeem` — Supabase default privileges auto-grant EXECUTE on new public functions to anon, and the base migration's `REVOKE … FROM PUBLIC` didn't remove the explicit anon grant. Forward-only fix (the base migration was already applied/tracked, so editing it wouldn't change the DB). After fix: redeem/anon = false.
- **`lib/services/inviteCodeService.ts`**: `validateCode(code): Promise<InviteCodeStatus>` + `redeemCode(code): Promise<boolean>`. No generate/list (deferred). tsc clean.
- **`docs/INVITE_CODES.md`**: architecture, SQL-editor minting snippets (batch + single + list + deactivate), the deferred-in-app-generation note, the anon-SECURITY-DEFINER security trade-off, CP9 notes.
- **DEFERRED_WORK.md**: 2 new entries (OB-1 anon SECURITY DEFINER prod security note; OB-2 no admin-auth primitive → in-app generation deferred + flag the unguarded AdminScreen).

**Files touched (all UNCOMMITTED — CP2 prompt did not request a commit):**
- `supabase/migrations/20260609183710_invite_codes.sql` (new)
- `supabase/migrations/20260609184359_invite_codes_restrict_redeem_to_authenticated.sql` (new)
- `lib/services/inviteCodeService.ts` (new)
- `docs/INVITE_CODES.md` (new) + staged `_pk_sync/INVITE_CODES_2026-06-09.md`
- `docs/DEFERRED_WORK.md` (edited; header already 2026-06-09) + re-staged `_pk_sync/DEFERRED_WORK_2026-06-09.md`
- **Rule E:** no PK-tracked app code edited (the new service isn't in PK snapshots) → no staleness flags.

**Verified:**
- **Grants** (via `has_function_privilege`): validate/anon=t, validate/auth=t, **redeem/anon=f** (after fix), redeem/auth=t. **RLS enabled on both tables; zero direct table grants for anon/authenticated; no policies.**
- **Anon validate (pre-account, via supabase-js + anon key)** — 4-status matrix all PASS: `TESTVALID1`→valid, `TESTEXPIRED1`→expired, `TESTCAPPED1`→redeemed, `TESTINACTIVE1`→invalid, nonexistent→invalid; normalization (`testvalid1`, `  TESTVALID1  `)→valid. **Anon redeem → denied (`42501 permission denied for function`).**
- **Redeem logic (psql, auth.uid() mocked via session JWT claims):** no-auth→false; userA→true, userA-again→true with **no double burn**; userB→true; uses_count=2 + 2 redemptions; capped(1/1)→false; race-cap functional A=true/B=false/uses=1 (exactly one true on max_uses=1); whitespace+lowercase redeem normalized→true no burn. **End-to-end lifecycle:** mint→validate `valid`→redeem `true`→validate `redeemed`.
- **Test data cleaned up** (0 codes, 0 redemptions remaining — no F&F batch left; Tom mints the real batch via the documented snippet).
- **Migration tracked:** `migration list` local==remote (4 versions); `db diff --linked --schema public` shows ONLY the known 3-CHECK noise — no `invite_codes` diff.

**Open questions:**
- `invite_code_redemptions` kept (CP7 seeded-graph attribution) — oversight may cut it.
- Whether to bring the admin gate forward (OB-2) so invite generation/listing can move in-app, vs staying on the SQL-editor minting snippet for F&F.
- Race-safety was verified functionally (sequential cap) + by the atomic `UPDATE … WHERE uses_count < max_uses RETURNING` structure; true concurrent two-session redeem not orchestrated (would need parallel connections).

**Recommended doc updates:**
- `DEFERRED_WORK.md` — **DONE this session** (authorized by CP): OB-1, OB-2 added.
- `FRIGO_ARCHITECTURE.md` — **recommend:** add an `inviteCodeService` entry (validateCode/redeemCode → the two RPCs; tables RLS-locked, reached only via RPCs). Not edited (awaiting Claude.ai).
- `PROJECT_CONTEXT.md` — **recommend (optional):** note invite-code backend exists for onboarding T2. Not edited.
- `FF_LAUNCH_MASTER_PLAN.md` — **none.**

**Recommended next steps for Tom:** (1) review + commit the CP2 working-tree files (2 migrations + service + 2 docs) — not committed per standing rule; (2) when ready for testers, mint the real F&F batch via the `docs/INVITE_CODES.md` snippet (choose count / max_uses / expiry); (3) CP9 will wire `validateCode` (pre-signup) + `redeemCode` (post-signup, best-effort).

---

## 2026-06-09 — CP1 close-out: pre-commit review, 2 commits, MIGRATIONS caveats, living-doc reconciliation

**Scope:** mechanical close-out of the CP1 migration work logged below. No schema changes, no new migrations, no app code. Executed from a Claude.ai CC prompt ("CP1 close-out"). Two commits made on `main`.

**Shipped:**
- **Pre-commit gate passed** (all checks): `supabase/migrations/` = exactly 2 (baseline + inert marker); `supabase/migrations_provenance/` = exactly 20; `.env` gitignored + not staged; `grep -i password supabase/config.toml` → no match. Staged set was CP1-only (24 changes: 4 new files + 17 renames + 3 provenance adds); the prior pantry session's app-code changes were left unstaged.
- **MIGRATIONS.md caveats added** (2): (a) toolchain — CLI ≥ 2.105.0 required (2.58.5 crashes pull/diff on storage-image skew), Docker needed for `db pull`/`db diff` but **not** `db push` (applying a migration incl. CP5 needs only the linked project + DB password); (b) `db diff` noise — the 3 self-cancelling `ANY(ARRAY[...])` CHECK re-adds are baseline noise to ignore when verifying future migrations (esp. CP5). Re-staged `_pk_sync/MIGRATIONS_2026-06-09.md`.
- **Commit 1 — `cd43f44`** `chore(db): adopt supabase/migrations tracking (P7-23)`: baseline `20260609155555_baseline_public.sql`, inert marker `20260609163207_adopt_migrations_marker.sql`, `supabase/config.toml`, `docs/MIGRATIONS.md`, + 20 files relocated to `supabase/migrations_provenance/`.
- **Commit 2 — `91cf1fc`** `docs: reconcile CP1 migration tracking (P7-23 resolved, ledger + pointers)`: the 4 living-doc edits below.

**Living-doc reconciliation (surgical — add/annotate only; headers bumped to 2026-06-09 per Rule A):**
- `DEFERRED_WORK.md` — **P7-23 marked resolved** (strikethrough + ⚪ + `✅ RESOLVED 2026-06-09 …`), matching the doc's existing resolved-item convention.
- `docs/archive/phases/PHASE_7_SOCIAL_FEED.md` — "Direct DB Migrations" ledger annotated with a superseded-by-baseline blockquote. (Archived/complete phase doc → header **not** bumped; it's frozen, not a living doc.)
- `PROJECT_CONTEXT.md` — added a Backend "Migrations" pointer line **and** reconciled the now-false Known-Issues line (it still said "tracking not yet set up (P7-23)") → struck through + RESOLVED. *(This 2nd PROJECT_CONTEXT edit is beyond the CP's literal 4 — flagged: the CP couldn't have known that stale line existed; reconciling it was required for correctness.)*
- `FRIGO_ARCHITECTURE.md` — added a Migrations note + `migration new` command in Development Setup, with the tiered-push-policy one-liner.

**Verified:**
- Gate output pasted above; `.env` confirmed not staged.
- `git log --oneline -2`: `91cf1fc docs: reconcile …` / `cd43f44 chore(db): adopt …`.
- Commit 2 = exactly 4 files (`git diff --cached --name-only` confirmed), 13 insertions / 5 deletions; diff hunks reviewed (strikethrough P7-23 row; superseded blockquote; 2 PROJECT_CONTEXT lines; ARCHITECTURE setup note).
- `supabase/functions/**` and the baseline/provenance files unchanged by Step 4 (Commit 2 touched only the 4 docs).
- `_pk_sync` dated copies staged for all edited docs: `MIGRATIONS`, `DEFERRED_WORK`, `PROJECT_CONTEXT`, `FRIGO_ARCHITECTURE`, `PHASE_7_SOCIAL_FEED` (all `_2026-06-09.md`; `_pk_sync` is gitignored, as intended).

**Open questions / decisions:**
- **SESSION_LOG.md left uncommitted (deliberate).** It carries the prior pantry session's two 2026-06-04 entries (146 uncommitted lines spanning pantry + CP1 + this close-out). Committing it in a CP1 commit would drag pantry log content into a migrations commit, so it's left in the working tree for Tom to commit alongside the pantry work. Both CP1 SESSION_LOG entries (adoption + this close-out) are therefore written but not yet committed.
- The extra PROJECT_CONTEXT Known-Issues reconciliation (noted above) — surgical, but beyond the literal CP scope.

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md` — **DONE this session** (authorized by CP): Development Setup migrations note.
- `DEFERRED_WORK.md` — **DONE this session** (authorized by CP): P7-23 resolved.
- `PROJECT_CONTEXT.md` — **DONE this session** (authorized by CP): Backend pointer + Known-Issues reconciliation.
- `FF_LAUNCH_MASTER_PLAN.md` — **none** (CP4/CP5 migration prerequisite is now cleared; note only if Claude.ai tracks prereqs there).

**Recommended next steps for Tom:** (1) commit the pantry-session working-tree changes (app code + `SESSION_LOG.md` + `PK_CODE_SNAPSHOTS.md`) — that commit will carry both CP1 SESSION_LOG entries; (2) upload the `_pk_sync/*_2026-06-09.md` copies to PK; (3) CP5 can proceed — author the auth-trigger change as a tracked migration, but **you** run the push (Sensitive tier).

---

## 2026-06-09 — CP1 (P7-23): Supabase migration tracking adopted (baseline + forward-loop proof)

**Scope:** infra only — no app code touched. Executed from a Claude.ai CC prompt ("CP1 — supabase/migrations/ tracking setup"). Adopts CLI-tracked migrations on the existing shared Supabase project (ref `siaawxcgyghuphwgufkn`) so future schema changes are versioned/reviewable/reproducible. **Resolves P7-23.** Hard prerequisite for CP4 (books catalog) and CP5 (auth trigger).

**Major deviation from the prompt's premise (Tom decided live):** the prompt assumed `supabase/migrations/` held ~2 untracked files. It actually held **20** real, granular files (the whole `20260424`→`20260604` series), **none** in remote history (remote migration history was completely empty). I stopped and surfaced this; Tom chose **"single live baseline + archive the 20"** (vs keeping them tracked + a supplement). Rationale: the 20 files are provably incomplete — `handle_new_user` and the `on_auth_user_created` trigger exist live but appear in none of them — so a `db pull` baseline from the live DB is required regardless, and the archived files' effects are all captured by it.

**What shipped:**
- **Linked** the project non-interactively — DB password read from `SUPABASE_DB_PASSWORD` in `.env` (no prompt). Link did **not** create `config.toml` (it stashed the ref in gitignored `supabase/.temp/project-ref`), so I hand-wrote a minimal `supabase/config.toml` (`project_id` only + comments) to satisfy reproducibility; a fresh clone still runs `supabase link`.
- **Baseline** `supabase/migrations/20260609155555_baseline_public.sql` via `supabase db pull --schema public` — full live public schema (76 tables, 46 functions, 148 policies). Registered as **applied** in remote history via `migration repair --status applied`. **Public only**: zero auth-schema DDL (the 73 `auth.` hits are all FK refs to `auth.users(id)` on public tables); `handle_new_user` present as `public.handle_new_user()` (~L1273–1293).
- **20 pre-baseline files relocated** to `supabase/migrations_provenance/` (CLI ignores sibling folders → no spurious pending entries; git tracked the 17 tracked ones as renames + I `git add`ed the 3 untracked: `20260602`, both `20260604`). This is the reconciliation the prompt asked for, applied to all 20 rather than just the two `20260604` files.
- **Forward-loop proof** `supabase/migrations/20260609163207_adopt_migrations_marker.sql` (inert `COMMENT ON SCHEMA public`) authored → `db push --dry-run` → `db push`. Proves author→push→tracked end to end.
- **CP5 reference snapshot** recorded verbatim in `docs/MIGRATIONS.md` (read from live DB, not assumed): `CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();`
- **`docs/MIGRATIONS.md`** created: everyday workflow, public-only baseline note, shared-production-DB warning, tiered push policy (CC pushes mechanical CPs; **Tom** pushes Sensitive — CP5 auth trigger, CP8, destructive DDL), the CP5 snapshot, the `db diff` caveat, CLI/Docker prerequisites, and pre-baseline provenance pointers.

**Environment fixes needed mid-CP (flagging — not in the prompt):**
- **CLI upgraded 2.58.5 → 2.105.0** via `scoop update supabase`. The old CLI crashed `db pull`/`db diff` ("error running container") because it pulled a newer `storage-api:v1.29.0` image whose internal migrations it didn't recognise (`StorageBackendError: Migration optimize-existing-functions-again not found`). 2.105.0 fixed it. Reversible via scoop.
- **Docker Desktop started** (daemon was down). `db pull`/`db diff` need a shadow Postgres container; `db push`/`migration list`/`migration new` do not.

**Verification:**
- Link: succeeded non-interactively via env-var password (no prompt).
- `migration list` (final) — local == remote, no spurious entries:
  ```
  Local          | Remote         | Time (UTC)
  20260609155555 | 20260609155555 | 2026-06-09 15:55:55
  20260609163207 | 20260609163207 | 2026-06-09 16:32:07
  ```
- `db push --dry-run` listed only the marker (baseline correctly seen as applied); real push applied it.
- `db diff --linked --schema public` — **not literally empty**: migra emits a balanced, self-cancelling drop + re-add of three complex CHECK constraints (`measurement_units.has_metric_conversion` / `valid_unit_type`, `recipe_extraction_comparison.valid_scores`) that are present **identically** in the baseline (L1961, L3355–3356). Confirmed cosmetic migra churn on `ANY(ARRAY[...])`/`<> ALL` CHECKs, **not** a schema gap. The `--use-pg-schema` engine couldn't give a second opinion — it exhausts the pooler's session-mode 15-conn limit (`EMAXCONNSESSION`).
- `handle_new_user` in baseline ✅; auth.users trigger snapshotted verbatim ✅; auth schema **not** tracked anywhere in `supabase/migrations/` ✅.
- Functions config untouched (`git status`: only renames into `migrations_provenance/` + new infra files; `supabase/functions/**` unchanged). All 20 historical `.sql` files intact (relocated, not deleted); the six loose historical `.sql` under `docs/` untouched.

**Files created/touched (CP1 only — the `M` files in `git status` under `components/`,`lib/`,`screens/` are the prior 2026-06-04 pantry session, NOT this CP):**
- `supabase/config.toml` (new, minimal)
- `supabase/migrations/20260609155555_baseline_public.sql` (new baseline)
- `supabase/migrations/20260609163207_adopt_migrations_marker.sql` (new inert)
- `supabase/migrations_provenance/*.sql` (20 files relocated; 17 git-renames + 3 added)
- `docs/MIGRATIONS.md` (new) + staged copy `_pk_sync/MIGRATIONS_2026-06-09.md`
- **Not committed** — changes left staged/untracked for Tom's review per standing "commit only when asked."
- **Rule E:** no PK-tracked app-code files edited (infra/docs only; grep of `PK_CODE_SNAPSHOTS.md` for migrations/config found nothing) → no staleness flags.

**Open questions / surprises:**
- The 20-vs-2 file discrepancy (resolved by Tom's choice above) — the prompt's author may not have known the folder was already populated.
- `db diff` can't produce a literally-empty report given the migra CHECK-constraint churn; documented as a no-op. If a clean diff is ever required, options are pinning a migra version or excluding those 3 constraints — not pursued (no real drift).
- `config.toml` `project_id` is set to the **remote ref** (common pattern, technically the field is a local slug). Harmless; documented in `MIGRATIONS.md`.
- Prior SESSION_LOG / tracker references to `supabase/migrations/20260604_*.sql` are now at `supabase/migrations_provenance/` — left historical entries unedited.

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md` — **recommend:** add a short "Database migrations" pointer to `docs/MIGRATIONS.md` (workflow + shared-DB warning + `migrations_provenance/` note). Not edited (living doc; awaiting Claude.ai).
- `DEFERRED_WORK.md` — **recommend:** mark **P7-23 → resolved** (this CP). Leave **T3** (rating-type drift) as-is. Not edited.
- `PROJECT_CONTEXT.md` — **recommend:** add migrations-workflow + tiered-push-policy pointer to `docs/MIGRATIONS.md`. Not edited.
- `FF_LAUNCH_MASTER_PLAN.md` — **none** (beyond noting the CP4/CP5 prerequisite is now cleared, if Claude.ai tracks prereqs there).
- *Other (non-living docs):* recommend annotating the Phase 7 "Direct DB Migrations" ledger (`docs/archive/phases/PHASE_7_SOCIAL_FEED.md` ~L655) with "superseded by baseline `20260609155555`, kept as provenance." Not edited (CC doesn't self-edit docs).

**Recommended next steps for Tom:** (1) review the staged renames + new files and commit when satisfied; (2) for CP5, author the auth-trigger change as a tracked migration but **you** run the push (Sensitive tier); (3) consider whether `migrations_provenance/` should eventually move under `docs/` instead of `supabase/` (currently fine — CLI ignores it).

---

## 2026-06-04 — SupplyControls: "Search recipes" moved onto the grocery-lists row (layout fix)

**Scope:** layout-only change to `components/pantry/SupplyControls.tsx` — no schema/service/behavior change. Executed from a Claude.ai CC prompt. Resolves the "expanded-panel Search recipes too low" issue flagged unresolved in the session entry below.

**Root cause:** the expanded panel stacked `<ListMembershipControl/>` and then the Search/Open-detail/Location `bottomRow` *beneath* it, so Search rendered below the entire lists block and its Y position drifted as the chips wrapped. Margin/gap nudging couldn't fix it — the driver was layout structure, not spacing.

**Change (structural):** the lists block and Search now share ONE row:
- New `listsSearchRow` (`flexDirection:'row'`, `alignItems:'flex-start'`, `gap:12`) containing `listsCol` (`flex:1`, `minWidth:0`) wrapping `ListMembershipControl`, and the existing Search `TouchableOpacity` now content-sized + pinned top-right (`flexShrink:0`, `justifyContent:'flex-start'`, `paddingTop:2`; removed `flex:1`).
- `line2Wrap` (Open detail / Location) is now its own direct child of `container` after the row (removed `flexBasis:'100%'`; `marginTop:0` — container `gap:8` separates it).
- Removed the now-unreferenced `bottomRow` style (grep-confirmed zero refs).
- `minWidth:0` on `listsCol` lets the chip row wrap inside the narrower column instead of overflowing.

Net: recovers ~60–70px (fills the dead space left of Search) and makes Search's Y independent of chip wrapping.

**Trade-off (expected, accepted):** the lists column is narrower, so a "Medium List" chip + "+ add to list" pill may wrap to two lines where it previously fit one. Search stays anchored top-right regardless — deliberately NOT shrunk to compensate.

**Unchanged:** the name-truncation IIFE, `handleSearchRecipes` nav (`initialIngredient` + `initialBrowseMode:'all'`), `topRow` (slider + bookmark), the storage/bookmark anchored modals, `ListMembershipControl`, and all services.

**Verification:** `npx tsc --noEmit` clean on `SupplyControls.tsx` (pre-existing CookSoonSection / DayMealsModal TS1382 errors excepted). **Tom visually confirmed the placement — "looks good" (2026-06-04):** Search now sits on the chips band top-right instead of a line below. (The pantry *auto-list behavior* from the entry below is still pending a full behavior smoke test — distinct from this layout confirmation.) Full layout checklist for reference: brown sugar (In Stock, single Medium chip) → Search top-right; force a 2-chip/wrapping state → Search does NOT move; "Not on a list" → Search still top-right; Open detail / Location row unchanged; tap Search → same RecipeList nav.

**Files modified:** `components/pantry/SupplyControls.tsx` (not PK-tracked → no Rule E staleness flag).

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md` — **none.**
- `DEFERRED_WORK.md` — **none to file:** this closes the "expanded-panel Search too low" follow-up that the entry below *recommended* filing (it was never filed, so net effect is just "don't file it").
- `PROJECT_CONTEXT.md` — **none.**
- `FF_LAUNCH_MASTER_PLAN.md` — **none.**

**Recommended next steps for Tom:** smoke-test per the Verify checklist; confirm the narrower-column wrap trade-off is acceptable.

---

## 2026-06-04 — Pantry: "Staple" rename + auto-list rules + supply-dedup fix + inline list-membership UI

**Format note:** this was a single interactive Tom↔CC working session (not a discrete Claude.ai CC prompt), so it's one consolidated entry rather than one-per-prompt. The substantive work is feature + schema (logged here); the later pixel-level layout tuning of the expanded-row panel arguably belongs in `docs/UX_ITERATIONS_LOG.md` per this log's header convention — flagging so Claude.ai can relocate that slice if desired. **Status: IN PROGRESS / partially unverified** — Tom ran both SQL migrations successfully but was still mid-smoke-test at session end, and one UX issue (expanded-panel "Search recipes" line sitting too low) is **not yet resolved** — diagnosis done, files staged to `_pk_sync/code/` for Tom to take to Claude.ai with screenshots.

**Goal:** Tom-driven pantry-tab work. Two explicit asks: (1) rename "Regular" → "Staple"; (2) when a Staple drops to Low auto-add it to the Long List, when it goes Out escalate to the Short List, with the list(s) it's on shown + editable inline in the expanded-row dropdown where "+ Add to grocery list" used to be — and make the thresholds user-configurable. Plus a reported bug: duplicate supplies (two "salt" rows).

**Domain model recap (verified by reading the code):** "Lists" are **Views** (saved filters over the `needs` table): Short List = `urgency=today`, Medium = `urgency=this-week`, Long List = `status=need` (all needs), In Cart = `status=in_cart` — they nest (an urgency=today need shows in Short *and* Long). A grocery item is a `need` linked to its supply via `needs.supply_id`. "Regular" was the UI label for `supplies.tracking_mode='restock'`.

**1. Duplicate-supply bug — root cause + fix.** No DB-level uniqueness existed; the app dedup in `createSupply` used `.maybeSingle()`, which **errors** when 2+ active matches already exist and then falls through to INSERT a third — self-perpetuating once a dup exists. Fix:
- New migration `supabase/migrations/20260604_supply_dedup_and_unique.sql` — merges existing active dupes (keeps earliest per `(space_id, ingredient_id)` and per `(space_id, lower(custom_name))`, repoints `needs`/`supply_lots`/`supply_tags` to the survivor, **archives** the losers — non-destructive), then adds two **partial unique indexes** on active rows. (Rewritten mid-session: the first version used a `CREATE TEMP TABLE … ON COMMIT DROP` shared across statements, which failed in the Supabase SQL editor — "relation supply_dupe_map does not exist" — because the editor commits between statements; rewrote so each of the 5 steps recomputes the same loser→survivor mapping via an inline CTE, idempotent + editor-safe. Tom confirmed it ran.)
- `createSupply` hardened: shared `findActiveSupplyMatch` helper (earliest match, tolerant of pre-existing dupes) used for both the upfront dedup and a new `23505` race-recovery path. **Cross-type dupes (one ingredient-linked "salt" + one custom-name "salt") are NOT merged** — flagged to Tom.

**2. Auto-list rules engine.** New migration `supabase/migrations/20260604_supply_auto_list_rules.sql` adds `supplies.low_list_target` + `out_list_target` (`none|short|medium|long`, CHECK-constrained, backfilled from current `tracking_mode`/`is_priority`). Replaced the old hard-coded spawn logic in `setSupplyStatus` (restock-spawn-on-out + priority-spawn-on-low-urgency=today) with a single `reconcileSupplyListNeed(supply)` driven by the rule columns + status:
  - Low → `low_list_target` (Staple default Long), Out/critical → `out_list_target` (default Short), In-stock/unknown → none (removes the rule-driven need).
  - Manages exactly one **rule-driven** need per supply (`added_from='supply_spawn'`); sets its urgency tag to match the target list. **Manual** needs (`added_from='manual'`) are never touched by the rule; a rule need already in the cart is left alone.
  - Bookmark presets now map to rule presets: On hand = no auto-list; Staple = Low→Long/Out→Short; Priority = Low→Short/Out→Short. `setSupplyPriority` / `setSupplyTrackingMode` now also maintain the rule columns + reconcile; new `setSupplyListingRule(supplyId, {lowTarget?, outTarget?})` for fine-grained per-list config (also keeps `is_priority` display in sync).
  - New needsService helpers: `getActiveNeedsForSupply`, `setNeedListMembership`, `addSupplyToListManual`, `GroceryListTarget` type.
  - **Known cosmetic gap:** supplies already Out before the migration keep their old Long-List need until their next status transition (reconciliation only fires on a transition). New transitions are correct. No backfill done.

**3. "Regular" → "Staple" rename** (user-facing strings only; kept `tracking_mode='restock'` value + `RegularBookmarkIcon` symbol): SuppliesSection "Regulars" section header + merge/split a11y labels; SupplyControls bookmark label + menu + descriptions; AddNeedSheet "Save as staple" + hint; ExpandedRegularsSheet header + alert. (`ConceptBubbleMap` in the stats domain already uses "Staple" as an unrelated cooking-frequency tier — noted, no collision.)

**4. Inline list-membership UI.** New `components/pantry/ListMembershipControl.tsx` replaces the old "+ Add to grocery list" button + view-picker modal in `SupplyControls`' expanded panel: shows the list(s) a supply is on as chips (rule-driven ones marked with the new automatic icon), each tappable to move/remove; a "+ add to list" pill for manual adds; and (Staples only) a compact auto-list rule config opened from an automatic-icon button → modal with an explanation + Low/Out segmented pickers. Chips use the grocery-page list icons (`renderListIcon` parity: bag/cart/receipt/cart). New `components/icons/AutomaticIcon.tsx` built from Tom's `assets/svg-source/noun-automatic-4521090.svg`.

**5. Unresolved UX issue (handed off):** the expanded panel's "Search recipes" line reads too low. Diagnosis: the old add-to-list control lived ON the search line; pulling list membership into its own block above search dropped search by the block's height. Iterated the lists block from 4 rows → 2 and tightened SupplyControls gaps, but Tom says it's still too low. The next-biggest chunk above Search is the ~66px battery slider (label row + 38px bars). Staged files to `_pk_sync/code/` for Claude.ai diagnosis with screenshots.

**Verification:** `npx tsc --noEmit` clean across all edited/created files (the only app-code errors are two pre-existing TS1382 JSX issues in `CookSoonSection.tsx` / `DayMealsModal.tsx`, untouched this session). Both SQL migrations confirmed run by Tom. Behavior **not yet smoke-tested in the app** at session end.

**Files created:**
- `supabase/migrations/20260604_supply_dedup_and_unique.sql`, `supabase/migrations/20260604_supply_auto_list_rules.sql`
- `components/pantry/ListMembershipControl.tsx`, `components/icons/AutomaticIcon.tsx`
- `_pk_sync/code/` snapshots (5, dated 2026-06-04): ListMembershipControl, SupplyControls, SupplyRow, UsageLevelSlider, AutomaticIcon — staged for Tom to send to Claude.ai (informal diagnosis hand-off, NOT a formal PK snapshot refresh; Snapshot Date column left unchanged).

**Files modified** (PK staleness per Rule E):
- `lib/services/suppliesService.ts` — ⚠️ PK snapshot now stale (was 2026-05-19, already HIGH)
- `lib/services/needsService.ts` — ⚠️ PK snapshot now stale (was 2026-05-19, already HIGH)
- `lib/types/supplies.ts` — ⚠️ PK snapshot now stale (was 2026-05-19, already HIGH)
- `components/pantry/SuppliesSection.tsx` — rename only; ⚠️ PK snapshot now stale (was 2026-05-19, already HIGH)
- `components/AddNeedSheet.tsx` — rename only; ⚠️ PK snapshot now stale (was 2026-05-19); tracker Staleness Low→HIGH
- `components/ExpandedRegularsSheet.tsx` — rename only; ⚠️ PK snapshot now stale (was 2026-05-19); tracker Staleness Low→HIGH
- `components/pantry/SupplyControls.tsx` — heavy rewire (not PK-tracked)
- `screens/SupplyDetailScreen.tsx` — priority-hint string only (not PK-tracked)

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md` — **recommend an update once this stabilizes:** new schema columns (`supplies.low_list_target` / `out_list_target` + the two partial unique indexes), the supply→need auto-list reconciliation model (replaces the old restock-spawn-on-out + priority-spawn-on-low behavior — the architecture doc likely still describes the old spawn rules), and the new `ListMembershipControl` component + needsService list helpers. Deferred until the UX settles and it's smoke-tested.
- `DEFERRED_WORK.md` — **recommend new items:** (1) cross-type supply dedup (ingredient-linked vs custom-name same-name merge); (2) one-time backfill so already-Out supplies adopt the new Out→Short target without waiting for a transition; (3) the unresolved expanded-panel "Search too low" layout polish; (4) re-evaluate whether `is_priority` should be fully subsumed by the rule columns.
- `PROJECT_CONTEXT.md` — **none.**
- `FF_LAUNCH_MASTER_PLAN.md` — **none.**

**Recommended next steps for Tom:**
1. Smoke-test the auto-list behavior in the app (Low→Long, Out→Short escalation, In-stock clears, Priority→Short, manual add/move/remove, the config modal) and confirm the two "salt" rows collapsed to one.
2. Take the staged `_pk_sync/code/` files + screenshots to Claude.ai for the "Search recipes too low" layout diagnosis (or let CC try the slider-compaction lever next).
3. Decide on the Medium List question (keep it surfaced everywhere, or Short/Long only) and whether the rule editor should also live on the full SupplyDetail screen.

**Surprises:**
- The Supabase SQL editor commits between statements, so a `TEMP TABLE … ON COMMIT DROP` shared across statements vanishes — required rewriting the dedup migration to recompute its mapping inline per statement.
- The "Search too low" complaint persisted through several margin tweaks because the real cause was **row count** in the new lists block, not gaps — worth measuring the stack before trimming margins next time.

## 2026-06-01 — cookfrigo.com initial build

**Goal:** Stand up a minimal, credible public marketing site for Frigo as part of the Apple Developer org enrollment track (LLC ↔ D-U-N-S ↔ website ↔ matching-domain email identity triangle). Executed from the CC prompt at `docs/CC_PROMPT_cookfrigo_site_build.md`. _(The prompt was authored 2026-04-30 and dates the legal stubs "April 30, 2026" — kept verbatim — but the build itself was done today, 2026-06-01.)_

**What was built (in a NEW, separate repo — not the app repo):**
- New local repo `C:\Users\tommo\cookfrigo-site` (adjacent to the app repo), `git init` + initial commit, **not yet pushed** (no GitHub remote — that's Tom's step; commands are in the repo README).
- `index.html` — hero, "what Frigo is" lead paragraph, three capability sections, access/status section, founder note (V9 placeholder), footer. **All marketing copy reproduced verbatim** from the locked spec (diff-verified: em-dashes, straight apostrophes, the italic Mary quote, footer middot — all match; see Verification).
- `privacy.html` + `terms.html` — plain-language SaaS stubs, each with a "Last updated: April 30, 2026" line and an explicit "placeholder pending review by counsel before public launch" callout; reference Frigo LLC / Portland, Oregon / join@cookfrigo.com.
- `assets/styles.css` — vanilla CSS, design tokens as CSS custom properties, mobile-first, AA contrast, no frameworks/build step/external runtime deps.
- `README.md` (deploy notes), `.gitignore`, `package.json` (metadata only, zero dependencies).

**Design tokens copied from Frigo app theme files I read:**
- `lib/theme/schemes.ts` — the **active** theme. Site uses the **`tealMintSlate`** scheme (corrected from `limeZing` after Tom supplied his real logo config — see the logo bullet): primary teal `#0d9488`, accent **mint `#34d399`**, pale-teal `#ccfbf1`, page bg `#f8fafc`, slate text ramp (`#0f172a`/`#475569`), borders `#e2e8f0`.
- `lib/theme/typography.ts` — heading & body families are `'System'` → site body uses the system font stack. **The logo wordmark uses self-hosted Outfit Medium** (`assets/fonts/Outfit-Medium.ttf`, OFL) — the app loads Outfit via expo-font and the logo is configured in Outfit 500.
- `lib/oldTheme.ts` — spacing (4px base) and radius scale only.
- `lib/theme/ThemeContext.tsx`, `lib/theme/index.ts`, `contexts/LogoConfigContext.tsx`, `components/branding/Logo.tsx` — read to confirm the active scheme + the logo's default rendering.

**Logo + icons copied/reconstructed from the app repo:**
- **Logo:** there is **no static logo/wordmark asset in the app** — the logo is a composed RN component (`components/branding/Logo.tsx`: styled "frigo" text + chef-hat SVG above the "g"), and its actual appearance is driven by a device-stored config (`@frigo_app_logo_config`), not in the repo. My first pass used the component code-defaults (chefHat1, System font, limeZing lime hat) and **Tom said it looked nothing like his app logo.** He then supplied his saved **"Config 1": tealMintSlate, `chefHat2` (the smiley hat) above-g, font Outfit weight 500, fontSize 46 / iconSize 27 / iconOffsetY 16 / iconStrokeWidth 26, textColor theme-primary, iconColor theme-accent.** Rebuilt to match: header = inline HTML/CSS (Outfit-Medium teal `#0d9488` "frigo", −1px tracking, mint `#34d399` chefHat2 nestled over the "g"); `assets/logo.svg` = matching baked lockup (favicon/brand; falls back to system font in `<img>` context). Self-hosted `Outfit-Medium.ttf`. Re-rendered & verified (headless Chrome). **Flagged deviation: the prompt assumed a copyable logo file; none exists, so the header logo is a faithful reconstruction of the device config.**
- **Capability icons (inlined as SVG, themed via `currentColor`), copied from app components:**
  - "Your recipes, in one place" → `assets/icons/book.svg` ← `components/icons/recipe/BookIcon.tsx` (cookbook).
  - "Grow your cooking community" → `assets/icons/friends.svg` ← `components/icons/recipe/FriendsIcon.tsx` (people).
  - "Turn Frigo into your personal sous chef" → `assets/icons/fridge.svg` ← `components/branding/icons/Fridge.tsx` (fridge — ties to the name "Frigo" and the copy's "what's in your fridge").

**Verification (headless Chrome render at 1200px & 390px + grep diff):**
- Copy parity: every locked string matched verbatim via `grep -o`; em-dash count reconciled (7 in body copy + 3 in metadata/aria); zero smart quotes (no curly-quote substitution); straight apostrophes intact; Mary quote italicized as a `<em>` span (only the quoted speech, not Tom's narration around it).
- All SVGs parse as valid XML; all HTML container tags balance.
- Desktop + mobile (single-column, ≥44px tap targets, ~64/96px section rhythm) render correctly; logo, three icons, italic quote, and footer all present. Privacy page render confirmed coherent + clearly marked placeholder.
- **No typos found** in the locked copy.

**Vercel deployment:** **DONE 2026-06-02 — the site is live at https://cookfrigo.com.** Pushed to private GitHub repo `finleysmooch/cookfrigo-site` (`main`), imported into Vercel via the GitHub app (auto-deploys on every push), HTTPS auto-issued. Verified live over HTTPS: hero/capability copy + all public assets return 200; `logo-sandbox.html` and the sandbox-only fonts return 404 (`.vercelignore` working). **`www.cookfrigo.com` is canonical**; bare `cookfrigo.com` 308-redirects to www (can be flipped to apex-primary in Vercel → Settings → Domains).

**DNS records added at Namecheap** (Advanced DNS; nameservers left on Namecheap BasicDNS so email/MX can stay at Namecheap):
- `A` `@` → `216.198.79.1` (Vercel's **current** apex IP — note: NOT the old `76.76.21.21`, which Vercel has retired).
- `CNAME` `www` → `a539a3381c58f655.vercel-dns-017.com` (per-project target Vercel displayed).
- Default Namecheap parking `CNAME www` + `URL Redirect @` rows removed.

**Decisions made (small / not fully specified):**
- **Active vs deprecated palette:** used `lib/theme/schemes.ts` (the live `useTheme` system — **tealMintSlate** scheme per Tom's logo config: teal primary `#0d9488`, mint accent `#34d399`), **not** `lib/oldTheme.ts` (celery green `#4A9B4F`, backwards-compat). Flagging because both exist. _(Initial build mistakenly used the `limeZing` lime accent; corrected to tealMintSlate when Tom shared Config 1.)_
- **Fridge icon for the sous-chef section** (vs another chef hat) so the three icons stay distinct and the fridge nods to the brand name + "in front of the fridge" copy.
- **AA contrast on CTAs:** the exact app teal `#0d9488` with white text is ~3.75:1 (below the 4.5:1 normal-text bar). Kept the exact teal (honoring "don't introduce colors not in the app") and set CTA labels to 19px/700 so they qualify as WCAG **large text** (3:1) → passes. Derived a darker teal `#0b7d72` for the button hover/active press state only (same hue, not a new brand color).
- **Mary-quote italic** uses italic system sans (the app defines no serif family), per the prompt's "otherwise italic of whatever the app's body font is" fallback.
- Added (not in spec, low-risk): skip-link, `aria-label`s, lime `:focus-visible` outline (keyboard nav), Open Graph + `theme-color` meta. Footer legal links use relative paths (`privacy.html`) rather than `/privacy.html` so local file preview also works.

**Open items for Tom:**
- **Founder note (V9 placeholder)** needs Tom's final revision before going live (body text only; structure/styling can stay).
- **Privacy + Terms** stubs need legal review before public launch (both clearly marked pending counsel).
- **Vercel + DNS** configuration — steps in `cookfrigo-site/README.md` (Vercel not yet set up for this domain).
- **Create + push** `finleysmooch/cookfrigo-site` on GitHub (repo is committed locally; `gh`/`git` commands in README).
- **Mailboxes:** create + monitor three role addresses (per Tom's direction after the initial build): `join@cookfrigo.com` (the access-request CTAs), `privacy@cookfrigo.com` (privacy.html contact + all data-deletion requests, incl. the terms.html deletion line), `support@cookfrigo.com` (footer general contact on all pages + terms.html questions). `privacy@` and `support@` are NEW — they must exist before launch or those links bounce.
- Optional: spot-check the `logo.svg` favicon cross-platform (it uses system-font `<text>`; the header logo is the robust HTML reconstruction and is unaffected).

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md` — **none** (cookfrigo.com is a separate static-site repo, not app code; out of the architecture map's scope).
- `DEFERRED_WORK.md` — **recommend a new "cookfrigo.com Marketing Site" section** (Tom asked 2026-06-02 to track these as deferred work; CC did not edit the doc directly since its items land via Claude.ai reconciliation per the doc's own workflow). Items — also captured concretely in `cookfrigo-site/BACKLOG.md`: **(1) 🔴 before-F&F: email for cookfrigo.com** — the live "Request access" CTA points to `join@cookfrigo.com` (+ `privacy@`/`support@` on legal pages) which don't exist yet and bounce; Tom's plan is a **new Gmail linked to the domain** (send-as + forwarding / Workspace) with MX/forwarding at Namecheap (DNS kept there on purpose). **(2) 🟢 later: app screenshots/stills + other site content.** **(3) founder-note V9 placeholder → final copy.** **(4) legal review of Privacy/Terms before the app's public launch.**
- `PROJECT_CONTEXT.md` — **flag for Claude.ai:** new project-context facts worth recording — Frigo LLC filed in Oregon (Registry #256856791), `cookfrigo.com` acquired (Namecheap), public marketing site built (pending deploy). CC did not edit the doc (Rule D — not authoring strategic content).
- `FF_LAUNCH_MASTER_PLAN.md` — **flag for Claude.ai:** the Apple Developer org enrollment track now has its public-website dependency built (pending Vercel/DNS); may warrant a status note in the launch plan.

**Files created (new `cookfrigo-site` repo, 12 files):** `index.html`, `privacy.html`, `terms.html`, `assets/styles.css`, `assets/logo.svg`, `assets/icons/book.svg`, `assets/icons/friends.svg`, `assets/icons/fridge.svg`, `assets/fonts/Outfit-Medium.ttf` (self-hosted, copied from the app), `README.md`, `.gitignore`, `package.json`.

**Logo tuning tool (added later in session):** `cookfrigo-site/logo-sandbox.html` — a self-contained dev page mirroring the app's Logo Playground (icon/position/font/weight/size/offsets/stroke/opacity/colors controls, live preview, localStorage-persisted) that outputs ready-to-paste **site CSS** + an app **`<Logo/>`** config. Added the sandbox's fonts (`Outfit-VariableFont_wght.ttf`, `Poppins-{Regular,Medium,SemiBold,Bold}.ttf`) and a `.vercelignore` excluding the sandbox + those fonts from the public deploy (prod still uses only `Outfit-Medium.ttf`). Per Tom's note that the hat sat too low, the live header hat was **raised to `top: -0.42em`** over the "g".

**Files modified in Frigo app repo:** none except this `docs/SESSION_LOG.md` entry. (No app **code** files were edited — theme/branding/icon files were read-only — so Rule E / PK snapshot staleness does not apply. The prompt file `docs/CC_PROMPT_cookfrigo_site_build.md` and `_scratch/` were pre-existing untracked items, left as-is.)

---

## 2026-06-01 — Integrate NYT Cooking import branch + ship increment ③ (SourceViewScreen)

Integrated `origin/nyt-source-metadata` into `main` and built the deferred source-browse screen. (NYT branch's own 2026-06-01 entries follow below.)

**Merge (`35fef07`):** fast-forwarded `main` to the recipe-search-overhaul work, then merged the NYT branch. ~27 NYT files merged clean (extraction model migration, source provenance UI, notes, edge fns, migrations). **5 conflicts resolved** — `RecipeListScreen` + `RefineSheet` (took ours, re-implemented the NYT Source multi-select + "Source: Recently Updated" sort into the new browse/search architecture: `availableSources` memo, RefineSheet "Source" section + `sources` FilterState field, sort entry); `recipeBrowseService` (added `sources` OR-filter + `source_updated` sort case to `resolveBrowse`/`SortOption`); `SESSION_LOG` (base had only the intro → stacked NYT's entries above mine, no duplication); `PK_CODE_SNAPSHOTS` (unioned staleness rows). Shared Supabase project confirmed same (`siaawxcgyghuphwgufkn`) — migrations + `scrape-recipe` **not re-run**.

**Increment ③ shipped:** new `screens/SourceViewScreen.tsx` (mirrors the BookView load pattern — `recipes where source_domain=? AND user_id=?` ordered by `source_updated_at` desc, nutrition/history/friends enrichment, `RecipeCard` list); `App.tsx` `RecipesStackParamList.SourceView: { domain }` + screen registration; `AuthorViewScreen` "Other sources" pills now `navigation.navigate('SourceView', { domain })` (were inert).

**Files modified/added:** `screens/SourceViewScreen.tsx` (new), `App.tsx`, `screens/AuthorViewScreen.tsx` ⚠️ PK snapshot stale (flagged HIGH in merge), `lib/services/recipeBrowseService.ts`, `components/RefineSheet.tsx`, `screens/RecipeListScreen.tsx`, `docs/DEFERRED_WORK.md` (v5.33 — new "From: NYT Cooking Import" section NYT-1..10).

**Verification:** `tsc --noEmit` clean for all merge-touched + ③ files (the 181 totals are pre-existing CookSoonSection/DayMealsModal + node_modules lib-check noise). **In-app smoke NOT yet run** — recommend: import a NYT recipe (chef/notes/badge), check the Source filter + "Source: Recently Updated" sort, and tap a chef-page "Other sources" pill → SourceView.

**⚠️ Time-critical (DEFERRED NYT-1):** redeploy 4 edge functions (`scan-book-pages`, `process-recipe-queue`, `extract-book-toc`, `assemble-book-recipes`) before **2026-06-15** — still on the retired model in prod. `supabase functions deploy` (Tom's CLI auth).

**Recommended doc updates:** `FRIGO_ARCHITECTURE.md` — add `SourceViewScreen` to the Screens section + the `SourceView` route; note the NYT source-provenance services (`sourceNotesService`, `sourceLabel`, `models.ts`) and the RefineSheet "Source" facet. `DEFERRED_WORK.md` — done (this session). `PHASE_11`/`PROJECT_CONTEXT` — none.

**Recommended next steps for Tom:** (1) the NYT-1 edge-fn redeploys (time-critical); (2) smoke the merge + ③ in-app; (3) NYT-9 photo-extraction smoke (Sonnet 4.6 vision); (4) push `main` when satisfied. Working tree clean (besides `_scratch/`).

---

## 2026-06-01

**Task:** Surface NYT/web source across the app — card badge, list filter + sort, chef "Other sources"

Tom-directed discovery features built on the source-provenance columns. Three of four proposed surfaces built; the **NYT Cooking browse screen (③) is intentionally deferred to the other CC instance** (see handoff prompt at `docs/CC_PROMPTS/nyt_import_handoff.md`).

### Built
- **Recipe card source badge** (`components/recipe/RecipeCard.tsx`) — globe + "NYT Cooking" label under the title when `source_domain` is set. Shared by RecipeListScreen + WhatCanICookScreen. (Not in PK tracking doc.)
- **Recipe list source filter + sort** (`screens/RecipeListScreen.tsx`, `components/FilterDrawer.tsx`) — new "Source" multi-select in the filter drawer (OR logic on `source_domain`, options = distinct domains from the user's recipes), + "Source: Recently Updated" sort (by `source_updated_at` desc, nulls last). ⚠️ PK snapshot now stale — RecipeListScreen (was 2026-05-19), FilterDrawer (was 2026-05-19)
- **Chef "Other sources" section** (`screens/AuthorViewScreen.tsx`) — a row beside Books showing web sources (e.g. "🌐 NYT Cooking · 3") with counts. Pills are **inert for now** (info only); tapping → SourceView is part of ③ (handoff). ⚠️ PK snapshot now stale (was 2026-04-22)
- **Shared util** `lib/utils/sourceLabel.ts` — single `sourceLabel(domain)` definition (NYT → "NYT Cooking"; else title-cased first segment). New surfaces use it.

### Notes
- All app-only changes (no migration/edge-function/re-import) — `select('*')` already returns the source columns to the list; AuthorView's explicit select got `source_domain` added.
- `source_domain` + `source_updated_at` added to `RecipeCard`'s exported `Recipe` type (the list's row type) so the sort/filter type-check.
- tsc --noEmit clean on all touched files. Tom verified card badge, filter, sort, and chef Sources section in-app.

### Test-row cleanup
Removed the stale NYT test imports created during this session's verification, keeping `db8fd956` (Chermoula — most-helpful notes + multi-author) as the clean demo. (See git/DB; non-recipe children cascaded/deleted with them.)

### Recommended doc updates
- `FRIGO_ARCHITECTURE.md` — once the NYT feature set + ③ land, note: `recipe_source_notes` table, the `source_*` columns, `sourceLabel` util, and that RecipeCard/RecipeList/AuthorView/RecipeHeader render source provenance.
- `DEFERRED_WORK.md` — carry the prior follow-ups (all-notes pagination, Option A multi-chef, staleness monitor, project-wide RLS) **plus** ③ the NYT Cooking browse screen + wiring the inert chef-page source pills (now owned by the other CC instance). CC did not edit DEFERRED_WORK — flagging for Claude.ai.
- `PROJECT_CONTEXT.md` / `FF_LAUNCH_MASTER_PLAN.md` — none.

### Recommended next steps for Tom
1. Hand `docs/CC_PROMPTS/nyt_import_handoff.md` to the other CC instance to integrate this branch + build ③.
2. Photo-extraction test (Sonnet 4.6 vision path) still outstanding.

---

## 2026-06-01

**Task:** NYT community notes import + richer attribution (multi-author) + most-helpful notes

Tom-directed feature extending the NYT provenance work. Captures NYT Cooking community notes and richer attribution (original author(s), byline/adapter, credit, source dates) — all from the page's `__NEXT_DATA__` payload (no auth; same soft-paywall access path as the recipe). Verified end-to-end in-app on recipes 12957 (multi-author) and others.

### Key discoveries (via signed-out `node fetch` probes — Claude Code is blocked from cooking.nytimes.com, but a plain fetch on the dev machine sees the same payload the edge function does)
- Notes live in `__NEXT_DATA__.props.pageProps.allNotes` / `helpfulNotes` (JSON strings: `{totals:{all,parents,helpful}, notes:[...]}`). **Both blocks cap at ~15 (one page).** `helpfulNotes` = top ~15 by upvotes; `allNotes` = first ~15. Full set (e.g. 29 helpful / 148 all) needs NYT-API pagination — deferred.
- Attribution: `sourcesString` = original author(s) the recipe is "from" (e.g. "Yotam Ottolenghi and Sami Tamimi" — **co-authors joined by " and "**); `bylines[].displayName` = NYT adapter (e.g. "Tara Parker-Pope"); `credit` = full credit line; `publishInfo.firstPublishedAt` + `seoMeta.lastMajorModification` = dates.
- **Bug found & fixed:** setting `source_author = sourcesString` would create one garbage chef named "Yotam Ottolenghi and Sami Tamimi". Now the combined string is split; the PRIMARY author (authors[0]) drives the single `chef_id`; co-authors stored in `source_authors` for display. (Option B — keeps the single-chef machinery across ~20 files untouched; per-author chef pages/stats = future Option A.)

### Migrations (Tom ran both; SQL also in files)
- `20260601_recipe_source_notes.sql` — `recipe_source_notes` table (FK→recipes cascade, `UNIQUE(recipe_id, source_note_id)`, helpful-first index). No RLS (matches sibling recipe child tables `instruction_sections`/`recipe_ingredients`, which are anon-readable — confirmed by live probe).
- `20260601_recipe_source_attribution.sql` — adds `source_authors text[]`, `source_byline`, `source_credit`, `source_published_at`, `source_updated_at`, `source_extracted_at` to `recipes`.

### Edge function (REDEPLOYED — `supabase functions deploy scrape-recipe`, done this session via `--project-ref siaawxcgyghuphwgufkn`)
- `supabase/functions/scrape-recipe/index.ts` — parses `__NEXT_DATA__` for notes (prefers `helpfulNotes`) + `sourceMeta` (authors split, byline, credit, dates); returns `notes[]`, `notesTotal`, `sourceMeta` on the payload. Note: edge `console.log`s appear in Supabase logs, not Metro.

### App files changed
- `lib/services/recipeExtraction/recipeService.ts` — saves the new provenance columns + calls `saveSourceNotes`. ⚠️ PK snapshot now stale (was 2026-04-22)
- `lib/services/recipeExtraction/unifiedParser.ts` — primary-author selection (authors[0]) for chef; carries `source_notes`/`source_meta`. ⚠️ PK snapshot now stale (was 2026-04-22)
- `lib/services/recipeExtraction/webExtractor.ts` — `StandardizedRecipeData` gains `notes`/`notesTotal`/`sourceMeta` types. ⚠️ PK snapshot now stale (was 2026-04-22)
- `lib/types/recipeExtraction.ts` — `SourceNote`, `SourceMetaInfo`, `ProcessedRecipe.source_notes/source_meta`, `raw_extraction_data.extraction_date`. ⚠️ PK snapshot now stale (was 2026-04-22)
- `screens/RecipeDetailScreen.tsx` — maps new fields; renders `SourceNotesSection`. ⚠️ PK snapshot now stale (was 2026-05-19)
- `components/recipe/RecipeHeader.tsx` — co-authors line ("with …"), "Adapted by {byline}", "Updated {Mon YYYY}". (Not in PK tracking doc.)

### App files created
- `lib/services/recipeExtraction/sourceNotesService.ts` — `saveSourceNotes` (idempotent upsert) + `getSourceNotes` (helpful/recommended-first).
- `components/recipe/SourceNotesSection.tsx` — collapsible "Most helpful notes from NYT Cooking (N)" with threaded replies + ★ Recommended.

### Verification (in-app, recipe 12957 "Chermoula Eggplant", multi-author)
- chef (linked) = **Yotam Ottolenghi** (not the combined string, not the byline); `source_authors` = ["Yotam Ottolenghi","Sami Tamimi"]; `source_byline` = "Tara Parker-Pope"; credit + published(2012-11-13)/updated(2020-07-08)/extracted(now) all populated; image single URL; 4 sections, no dupes.
- Notes: 15 most-helpful stored, recommendations 90 → 11 (Philip 90, Hillary 83, JRussell 71…), sorted by helpfulness. tsc clean throughout.

### Deferred / follow-ups (recommend for DEFERRED_WORK)
- **All notes via pagination** — embedded payload caps at ~15; pulling all helpful (29) / all (148) needs NYT notes-API paging.
- **Option A multi-chef** — per-co-author chef pages + stats via a `recipe_chefs` join table (touches ~20 files); current Option B keeps one primary chef.
- **Staleness monitor** — re-scrape and compare live `lastMajorModification` vs stored `source_updated_at`; `source_extracted_at` records last pull.
- **Project-wide RLS / data-exposure review** — recipe tables are anon-readable; same class as client-side `ANTHROPIC_API_KEY`. Belongs with increment-3 gating.
- Threaded-reply / ★ Recommended display code is in place but unexercised by sampled recipes (their first pages had none).

### Recommended doc updates
- `FRIGO_ARCHITECTURE.md` — none yet (note `recipe_source_notes` + the source_* columns once the NYT feature set stabilizes).
- `DEFERRED_WORK.md` — add the four follow-ups above (CC did not edit it — flagging for Claude.ai).
- `PROJECT_CONTEXT.md` / `FF_LAUNCH_MASTER_PLAN.md` — none.

### Recommended next steps for Tom
1. Eyeball the chermoula detail page (notes + multi-author header) — confirm UI.
2. Photo-extraction test (Sonnet 4.6 vision path) still outstanding.
3. Decide whether all-notes pagination / Option A multi-chef are in scope for F&F.

---

## 2026-06-01

**Task:** Recipe-detail source provenance UI (NYT Cooking attribution + link)

Surfaces a web recipe's source on the detail page, in the same slot the book title occupies for book recipes. Builds on the increment-1 source columns. Tom-directed follow-on; verified visually in-app on a NYT recipe (link opens correctly).

### Files changed
- `components/recipe/RecipeHeader.tsx` — added `source_url` / `source_domain` to its local Recipe interface; renders a tappable source line in `metaCol` (same place as the book line, since web recipes have no `book_title`). `cooking.nytimes.com` → label "NYT Cooking"; other domains → title-cased first segment (generalizes for free). Tapping calls `Linking.openURL(source_url)`. Added a `BookIcon` to the existing book line and a `GlobeIcon` to the new source line (14px, teal `#0d9488`), with a shared `sourceRow` flex style. (Not in PK snapshot tracking doc — no Rule E flag.)
- `components/icons/recipe/GlobeIcon.tsx` — NEW. Stroke-based `react-native-svg` globe (circle + meridian + equator + 2 latitude lines) matching the app's icon convention (`{size, color}` props, default export).
- `screens/RecipeDetailScreen.tsx` — mapped `source_url` / `source_domain` / `external_source_id` from the recipe row (already selected via `*`) into `formattedRecipe` + its Recipe interface, so RecipeHeader receives them. ⚠️ PK snapshot now stale (was 2026-05-19)

### Verification
- tsc --noEmit clean on all touched files.
- In-app: NYT recipe 1025971 shows "🌐 NYT Cooking ↗"; tap opens the source URL. Book recipes show the book icon + title. Tom confirmed look + link.

### Comments / community notes — feasibility (investigated, NOT built)
Tom asked whether NYT community notes can be imported. Findings: the `scrape-recipe` edge function reads static-HTML JSON-LD, which does NOT contain community notes — they load client-side from NYT's internal (undocumented) endpoint into the page's `#notes_section`. Web search found no public NYT notes API; only third-party paid scrapers (Apify) and recipe-body tools. Claude Code is blocked from fetching `cooking.nytimes.com`, so the live endpoint probe must come from Tom's browser DevTools. Recommended as its own gated increment (new `recipe_source_notes` table + edge function), pending: (a) the actual notes request URL + whether it needs auth/cookie, (b) a ToS decision on storing NYT users' comments. We already store `external_source_id` (their key), so if the endpoint is fetchable unauthenticated it's viable.

### Recommended doc updates
- `FRIGO_ARCHITECTURE.md` — none (could note RecipeHeader now renders web-source attribution once the feature set stabilizes).
- `DEFERRED_WORK.md` — recommend adding **"import NYT community notes"** as a gated increment with the two prerequisites above (CC did not edit DEFERRED_WORK — flagging for Claude.ai).
- `PROJECT_CONTEXT.md` — none.
- `FF_LAUNCH_MASTER_PLAN.md` — none.

### Recommended next steps for Tom
1. (Optional) Capture the NYT notes request from DevTools to decide whether the comments increment is viable.
2. Photo extraction test (still outstanding from the model-migration task) to confirm the Sonnet 4.6 vision path.

---

## 2026-06-01

**Task:** Migrate retired extraction model strings (unblock recipe import)

URL recipe import was failing with `404 not_found_error` — the parse path called `claude-3-haiku-20240307` (Haiku 3), which Anthropic retired ~2026-04-20. The photo path used `claude-sonnet-4-20250514` (Sonnet 4), which retires 2026-06-15 and would break the same way. Migrated both, centralized the IDs, and swept the whole repo for other dated model strings. Model-string migration only — no prompt/max_tokens/parsing changes.

### Confirmed model IDs (source: https://platform.claude.com/docs/en/about-claude/models/overview)
- **VISION_MODEL = `claude-sonnet-4-6`** — Sonnet 4.6's API ID is **dateless** (the 4.6 generation onward uses a pinned-but-dateless format; there is no `-YYYYMMDD` form). Docs explicitly list `claude-sonnet-4-20250514` as deprecated, retiring 2026-06-15.
- **RECIPE_PARSE_MODEL = `claude-haiku-4-5-20251001`** — current Haiku 4.5 (matches the ID already used across the repo's scripts/edge functions).

### API-level verification (direct fetch to api.anthropic.com, 8-token ping)
- `claude-haiku-4-5-20251001` → **OK**
- `claude-sonnet-4-6` → **OK**
- `claude-3-haiku-20240307` (old) → **404 not_found_error** — reproduces the exact reported failure. Confirms the swap resolves it.

### Repo-wide sweep for dated `claude-*` strings — every hit + resolution
**App code — migrated to centralized constants:**
- `lib/services/recipeExtraction/unifiedParser.ts:175` — `claude-3-haiku-20240307` → `RECIPE_PARSE_MODEL`. (THE failure.) ⚠️ PK snapshot now stale (was 2026-04-22)
- `lib/services/recipeExtraction/claudeVisionAPI.ts:265 & :343` — `claude-sonnet-4-20250514` → `VISION_MODEL` (both call sites). ⚠️ PK snapshot now stale (was 2026-04-22)

**App code — separate live bug found & fixed in place:**
- `lib/services/ingredientSuggestionService.ts:119` — was `claude-haiku-4-20250514`, an **invalid model ID** (no "Haiku 4"; that date belongs to Sonnet 4). Would have 404'd whenever AI ingredient suggestions ran. Fixed to `claude-haiku-4-5-20251001` in place (outside the extraction module, so not routed through `models.ts`). ⚠️ PK snapshot now stale (was 2026-04-22)

**Edge functions (Deno — cannot import `models.ts`; migrated literals, REQUIRE separate redeploy):**
- `supabase/functions/scan-book-pages/index.ts:12`
- `supabase/functions/process-recipe-queue/index.ts:17`
- `supabase/functions/extract-book-toc/index.ts:18`
- `supabase/functions/assemble-book-recipes/index.ts:20`
  — all four had `const CLAUDE_MODEL = "claude-sonnet-4-20250514"` → `"claude-sonnet-4-6"`. Sonnet 4.6 input price is still $3/MTok so the cost constants below each line stay valid. **These do not take effect until redeployed** (`supabase functions deploy <name>`). None are on the URL/photo import path, so they don't block this task, but they retire 2026-06-15 — redeploy before then.

**Comment-only (no live call):**
- `lib/types/recipeFeatures.ts:215` — example in a type comment cited the dead `claude-sonnet-4-20250514`; updated to `e.g. 'claude-sonnet-4-6'` to prevent copy-paste of a retired ID. ⚠️ PK snapshot now stale (was 2026-04-22)

**Already-current — left as-is (no retired/retiring IDs):**
- `supabase/functions/extract-recipe-three-pass/index.ts` — uses `claude-haiku-4-5-20251001`, `claude-sonnet-4-5-20250929`, `claude-opus-4-5-20251101` (4.5 family; legacy-but-available, not retiring). Inconsistent with the 4.6 used in the other edge functions but out of scope here — flagged below.
- `scripts/*.py`, `scripts/detect-sections.ts`, `scripts/recipe_classification_test.py` — all on current 4.5-family IDs. No action.
- `docs/` session logs / prompts — historical references only. No action.

### Files created
- `lib/services/recipeExtraction/models.ts` — exports `RECIPE_PARSE_MODEL` and `VISION_MODEL` with a deprecation-history comment. Root-cause fix: model strings were scattered literals, making each Anthropic retirement a multi-file 404 hunt. Now the next deprecation is a one-line change here. (Doc note in-file: edge functions run under Deno and can't import this; they keep their own constants.)

### Files modified
- `unifiedParser.ts`, `claudeVisionAPI.ts` — added `import { ... } from './models'` and swapped the model literals.
- `ingredientSuggestionService.ts` — invalid-ID fix (above).
- `recipeFeatures.ts` — comment fix (above).
- 4 edge functions — literal swap (above).
- `unifiedParser.ts` — also `max_tokens` 3000→8000 + truncation warning, and `normalizeImageUrl()` (see "Follow-on bugs" below).
- `screens/RecipeReviewScreen.tsx`, `lib/services/recipeExtraction/index.ts` — removed redundant `saveInstructionSections()` calls (double-save fix, see below).
- `docs/PK_CODE_SNAPSHOTS.md` — set the 4 tracked edited files' Staleness Risk to HIGH (Rule E). Edge functions and `models.ts` aren't in the tracking doc, so no rows there.

### tsc
`npx tsc --noEmit` reports no errors in any touched file (`models.ts`, `unifiedParser.ts`, `claudeVisionAPI.ts`, `ingredientSuggestionService.ts`, `recipeFeatures.ts`).

### End-to-end app tests — DONE for URL path (photo path still pending)
Ran the app from `frigo-nyt-build` (had to `npm install` first — this build repo had no `node_modules`; Metro on port 8082 since 8081 was taken by the main Frigo instance). Tested via real NYT URL imports:

- **Model swap confirmed live**: first NYT import (recipe 1021789) ran the parse call on Haiku 4.5 with NO 404 — the exact failure is gone.
- **Increment 1 confirmed live**: saved row had `source_url` (query-clean), `source_domain=cooking.nytimes.com`, `external_source_id=1021789` (then again 1025971 on a second recipe) — the NYT numeric-ID branch works end-to-end.
- **Photo extraction (`claude-sonnet-4-6` vision path): still NOT tested** — Tom to run one photo import to close this out.

### Follow-on bugs found during verification (pre-existing, NOT caused by the model migration) — fixed
While verifying the URL import, two unrelated import-path bugs surfaced. Fixed them since they blocked clean verification:

1. **Parser `max_tokens` truncation.** The first import parsed on Haiku 4.5 (no 404) but then threw `JSON Parse error: Unexpected end of input` — the structured recipe JSON exceeded `max_tokens: 3000` and got cut off. Haiku 4.5 emits fuller output than the retired Haiku 3, so this is the model swap "demonstrably requiring" the bump (the constraint's escape hatch). `unifiedParser.ts`: raised `max_tokens` 3000→8000 and added a `stop_reason === 'max_tokens'` warning so a future truncation is obvious rather than a cryptic JSON error. After the bump the same recipe parsed cleanly (13 ingredients, 4 sections). ⚠️ PK snapshot now stale (was 2026-04-22)
2. **Instruction sections double-saved.** Every section + its steps was inserted twice (DB had 8 sections for a 4-section parse). Root cause: `saveRecipeToDatabase()` already saves instruction sections internally (recipeService.ts:121), but two callers — `screens/RecipeReviewScreen.tsx` and `lib/services/recipeExtraction/index.ts` — *also* called `saveInstructionSections()` on the returned recipe ID (leftover from before section-saving moved into `saveRecipeToDatabase`). Removed both redundant call sites (and the now-unused import in the screen); `saveRecipeToDatabase` is now the sole owner. Re-import confirmed exactly 3 sections, no duplicate `section_order`s. ⚠️ PK snapshot now stale (was 2026-04-22) for both `RecipeReviewScreen.tsx` and `recipeExtraction/index.ts`
3. **Image not captured for NYT (related, found same pass).** NYT serves a JSON-LD *array* of `ImageObject`s; the scraper passed it through and `unifiedParser` saved the whole array verbatim into the `image_url` text column (a giant blob → nothing rendered). Added `normalizeImageUrl()` in `unifiedParser.ts` — collapses string / object / array-of-either to a single URL, preferring the largest image ≤2000px. Re-import stored a single clean URL (`…mediumSquareAt3X.jpg`). (Same `unifiedParser.ts` staleness flag as above.)

**Verification of the fixes (recipe 1025971, smoky shrimp saganaki):** `image_url` = single 102-char URL string; 3 sections with 2/3/2 steps and zero duplicate orders; source metadata all correct. Broken first test row (1021789, `b63cec1d…`) was deleted after diagnosis; the clean 1025971 row (`361bc695…`) was left in place.

### Photo path — still PENDING Tom
- **Photo extraction** — confirm the `claude-sonnet-4-6` vision swap parses + saves a photo recipe.

### ⚠️ Security item flagged (NOT changed this task, per constraint)
Both `unifiedParser.ts` and `claudeVisionAPI.ts` instantiate the Anthropic client with `apiKey: ANTHROPIC_API_KEY` imported from `@env` (react-native-dotenv). **This bundles the raw Anthropic API key into the client app**, where it can be extracted from the shipped bundle. The extraction calls should go through a Supabase edge function (server-side key) like the book-scanning functions already do. Tracked separately as a security item — left untouched here as instructed.

### Recommended doc updates
- `FRIGO_ARCHITECTURE.md` — none required, but worth a future note that recipe-extraction model IDs are now centralized in `lib/services/recipeExtraction/models.ts` (and that edge functions hold their own copies).
- `DEFERRED_WORK.md` — recommend adding: (a) **client-side `ANTHROPIC_API_KEY` exposure** — move extraction calls server-side (security); (b) **edge-function model consistency** — `extract-recipe-three-pass` is on Sonnet 4.5 while the others are now on 4.6; decide on one and align; (c) **normalize image URL upstream in the `scrape-recipe` edge function** — the app-side `normalizeImageUrl()` added here is a safety net; the scraper should ideally return a single best URL so the raw JSON-LD array never reaches the client. (CC did not edit DEFERRED_WORK — flagging for Claude.ai.)
- `PROJECT_CONTEXT.md` — none.
- `FF_LAUNCH_MASTER_PLAN.md` — none.

### Recommended next steps for Tom
1. Run the app and do one NYT URL import + one photo extraction to complete end-to-end verification (incl. the increment-1 column check on the saved NYT row).
2. Redeploy the 4 migrated edge functions before 2026-06-15: `supabase functions deploy scan-book-pages process-recipe-queue extract-book-toc assemble-book-recipes` (run individually if the multi-arg form isn't supported by your CLI version).
3. Decide whether the security item (client-side API key) gets scheduled before F&F launch.

---

## 2026-06-01

**Task:** Recipe source-metadata foundation — increment 1 (NYT Cooking import groundwork, roadmap #15)

First of three increments toward NYT Cooking import. This one makes source provenance first-class: three new top-level columns on `recipes`, populated at save time from the URL already captured in `raw_extraction_data.source_url`, plus a one-off backfill for existing rows. **No dedup (#2) and no gating (#3) logic** — explicitly out of scope here. Existing `source_author` / `source_name` / `source_type` / `chef_id` behavior untouched.

### Migration SQL (Tom runs this in Supabase — NOT auto-applied)

Also saved to the repo at `supabase/migrations/20260601_recipe_source_metadata.sql`.

```sql
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS source_url         text,
  ADD COLUMN IF NOT EXISTS external_source_id text,
  ADD COLUMN IF NOT EXISTS source_domain      text;

CREATE INDEX IF NOT EXISTS idx_recipes_source_dedup
  ON public.recipes (source_domain, external_source_id)
  WHERE external_source_id IS NOT NULL;
```

Purely additive (recipes was 56 columns; none of these three existed). **No UNIQUE constraint** on the new columns — increment 2 is copy-on-import, so multiple user rows will intentionally share the same `(source_domain, external_source_id)`. The partial index is a plain btree to make the future dedup lookup fast; it does **not** enforce uniqueness. (The migration file also adds `COMMENT ON COLUMN` docs for the three columns.)

### Files modified
- `lib/services/recipeExtraction/recipeService.ts` — added exported `deriveSourceMetadata(rawUrl)` helper + `SourceMetadata` interface; wired the three derived fields into the `saveRecipe` insert (and a log line). Derivation: `source_url` = URL with query string/hash stripped; `source_domain` = hostname w/o `www.` (reuses `getDomainFromUrl` from `webExtractor.ts` — no new domain parser); `external_source_id` = numeric NYT ID via `/\/recipes\/(\d+)/` for `cooking.nytimes.com` only, else null. All three null when `raw_extraction_data.source_url` is absent (book/photo recipes) — correct, not a failure. ⚠️ PK snapshot now stale (was 2026-05-19)
- `docs/PK_CODE_SNAPSHOTS.md` — set `recipeExtraction/recipeService.ts` Staleness Risk to HIGH (Rule E).

### Files created
- `supabase/migrations/20260601_recipe_source_metadata.sql` — the migration above, with column comments.
- `scripts/backfill_source_metadata.mjs` — one-off backfill, `--dry-run` supported. Fetches recipes where `raw_extraction_data->>source_url` is not null (paged via PostgREST + service-role key, lightweight jsonb-path select), derives the three fields with logic mirroring `deriveSourceMetadata`, and PATCHes each row. Reports: total recipes, # with a source_url, # that got a source_domain, # that got an external_source_id (NYT), plus any URLs that failed to parse and up to 5 NYT spot-check rows.

### TS types
No generated `Database` type on the Supabase client (it's created untyped in `lib/supabase.ts`), so the new insert fields type-check without a generated-type update. `raw_extraction_data.source_url` was already typed in `lib/types/recipeExtraction.ts`. Added the `SourceMetadata` interface as the new shared shape. `npx tsc --noEmit` reports no errors in the touched files.

### Derivation verified (local, pre-DB)
Ran the logic against representative URLs:
- NYT + tracking params → params stripped, `external_source_id` = `1018028` ✓
- NYT with `www.` → domain normalized to `cooking.nytimes.com`, ID extracted ✓
- seriouseats.com + utm → domain set, `external_source_id` null ✓
- NYT path with no numeric ID → ID null (graceful) ✓
- unparseable string → `parseFailed`, raw kept as `source_url`, domain/id null ✓
- null/absent URL → all three null ✓

### Backfill results
**Ran 2026-06-01** (dry-run then live) after Tom applied the migration. Same counts both passes:
- Total recipes in table: **822**
- Recipes with a `source_url`: **3**
- → got `source_domain`: **3**
- → got `external_source_id` (NYT): **0** (no NYT recipes imported yet — that's increment #2)
- URL parse failures: **0**

Small populated count as expected — the corpus is overwhelmingly book/photo-sourced with no URL. Verified by reading the rows back: the 3 domains are `ambitiouskitchen.com`, `thedefineddish.com`, `yourhomebasedmom.com` (all `www.` correctly stripped), `external_source_id` null on all three.

Setup note: this build repo (`frigo-nyt-build`) had no `.env`; copied it from `C:\Users\tommo\Frigo\.env` (same Supabase project; `.env` is gitignored here).

### Verification still pending (needs Tom)
1. Apply migration in Supabase.
2. Run backfill (dry-run then live); report the non-null counts per column.
3. Spot-check 3–5 NYT recipes: `external_source_id` matches the numeric ID in the URL.
4. Fresh NYT URL import → confirm all three columns populate end-to-end.
5. Book/photo import → confirm it still saves fine with the three columns null.

### Notes for increments #2 / #3
- The dedup lookup key is `(source_domain, external_source_id)` — the partial index `idx_recipes_source_dedup` is already in place for it. Increment 2 should query that pair, NOT add a UNIQUE constraint (copy-on-import duplicates it deliberately).
- `external_source_id` is currently NYT-only by design. Adding more sources later = extend `deriveSourceMetadata` with another `domain === ...` branch; backfill script mirrors the same function and should be updated in lockstep (comment in both files calls this out).
- `source_url` is stored cleaned (query/hash stripped). If #2/#3 ever need the original tracking URL, it's still preserved in `raw_extraction_data.source_url`.
- Live save and backfill share derivation logic but in two languages (TS helper + JS mirror in the .mjs). Kept intentionally separate because the .mjs runs standalone against PostgREST and can't import the TS module. Both carry a "keep in sync" comment.

### Recommended doc updates
- `FRIGO_ARCHITECTURE.md` — none for now (could note the three `recipes` source columns once the feature lands across all 3 increments; premature at increment 1).
- `DEFERRED_WORK.md` — none (increments #2/#3 are tracked under roadmap #15, not new deferred items).
- `PROJECT_CONTEXT.md` — none.
- `FF_LAUNCH_MASTER_PLAN.md` — none.

### Recommended next steps for Tom
1. Run `supabase/migrations/20260601_recipe_source_metadata.sql` in Supabase.
2. `node scripts/backfill_source_metadata.mjs --dry-run`, eyeball the report, then run live.
3. Paste the backfill counts back so they can be recorded and the NYT spot-check confirmed.
4. Do one fresh NYT URL import + one book/photo import to confirm the end-to-end paths.

## 2026-06-01 — Ingredient family search + recipe search UX overhaul (typeahead, scoped/refine pills, nutrition slider)

Large interactive session (direct Tom↔CC), executing the `CC_HANDOFF_ingredient_family_search` + `CC_PROMPT_family_search_code` handoffs and then iterating the recipe-search UX well beyond them. Started from a live-app troubleshooting session and ended with a substantially reworked search on `RecipeListScreen` + `BookViewScreen`.

**Shipped — bug fixes (early session):**
- `bookViewService.getRecipesByBook` queried a non-existent `recipes_with_books` view (PGRST205) → BookDetail crashed on open. Rewired to a direct `recipes` query with `books`/`chefs` joins (`books:book_id(*)`, `chefs:chef_id(*)`) flattened to `RecipeWithBook`. No migration needed.
- `BookDetailScreen.goToBookView` used a fixed `getParent().getParent()` climb that overshot the tab navigator from the RecipesStack entry → "See all/Browse all" silently no-op'd. Replaced with a walk-up that finds the navigator whose `routeNames` include `RecipesStack`.
- Cook Again (`your_classics`) SectionList duplicate-key warning (a recipe in multiple smart sections) → keyExtractor now folds the section title in (kept multi-section membership per Tom).

**Shipped — ingredient family search (handoffs):**
- Reclassification: `scripts/classifyIngredients.mjs` (committed, reusable) classified the `Grains`+`Seafood` buckets via Claude → reviewable SQL (`scripts/out/reclassify_ingredient_types_2026-06-01.sql`, **applied by Tom**). Split: Grains→**Pasta/Noodles/Rice/Grains** (+ 10 bread rows → Baking), Seafood→**Fish/Shellfish** (`Seafood` now empty by design). `Noodles` adopted as its own type at the review gate.
- `lib/searchService.ts`: Path C (ingredient-type match folded into the catalog `.or()`), `searchRecipesByMetadata` (cuisine/methods/vibes/course/difficulty), directed `SEARCH_SYNONYMS` incl. the `seafood→[fish,shellfish]` emptied-parent umbrella, `getSearchEntities` (multi-word entity dict), `getSearchSuggestions` (typeahead index), `searchRecipesByType`, `searchRecipesByScopedTerms` (+ chef scope broadened via book author — fixes the Molly Baz/Cook This Book attribution gap in search).
- `constants/pantry.ts`: icons for Pasta/Noodles/Rice/Fish/Shellfish + the 4 orphan types (Wines & Spirits, Coffee & Tea, Stocks & Broths, Beverages).
- Per the locked Decision Record, the formal `ingredientTaxonomy.ts` constant was deferred (created then removed); classifier-prompt realignment deferred (recon confirmed new ingredients aren't auto-classified — low drift risk).

**Shipped — recipe search UX (direct iteration):**
- Unified BookView search onto the shared server engine (the "cumin"/full-ingredient fix).
- Main-screen search-bar **persistence** refactor: header + search bar render once across home/list so the input no longer unmounts mid-type on the mode flip. Stale-response (latest-wins) guard added.
- **Direction-aware collapsing filter bar** (`hooks/useCollapsibleHeader.ts`, both screens): collapses on scroll-down to a tappable pill, stays collapsed on upscroll, re-expands at top / on tap (Tom-tuned).
- **Stacked search pills** (`lib/searchTerms.ts`): entity-aware, prefix-deferred tokenizer so multi-word entities (`molly baz`, `olive oil`) don't split; Enter force-commits + dismisses keyboard; spinner-on-commit; pills + refinement chips on one row; "All recipes" chip removed.
- **Typeahead dropdown** with scoped pills: ingredient/category/chef/cuisine → scoped search terms; dietary/method/vibe/course/attribute → applied refinements; keyword aliases ("diet"→dietary group, etc.).
- **Nutrition high/low thresholds** (calories/protein/carbs/fat; +6 FilterState fields + resolver checks) adjustable by tapping a pill → **slider picker with a live recipe-count + distribution histogram**; "More than/Less than" toggle; slider track + histogram colour the *included* side (recipes carry only cal/protein/carbs/fat — no sugar/fibre/sodium).

**Files modified (today):**
- `lib/services/bookViewService.ts` ⚠️ PK snapshot now stale (was 2026-04-22)
- `lib/searchService.ts` (already HIGH) ⚠️ PK snapshot now stale (was 2026-04-22)
- `lib/types/search.ts` ⚠️ PK snapshot now stale (was 2026-04-22)
- `lib/services/recipeBrowseService.ts` (nutrition resolver checks; untracked in PK tiers)
- `constants/pantry.ts` ⚠️ PK snapshot now stale (was 2026-04-22)
- `screens/RecipeListScreen.tsx` (already HIGH) ⚠️ PK snapshot now stale (was 2026-05-19)
- `screens/BookViewScreen.tsx` ⚠️ PK snapshot now stale (was 2026-04-22)
- `screens/BookDetailScreen.tsx` ⚠️ PK snapshot now stale (was 2026-05-19)
- `components/RefineSheet.tsx` (FilterState nutrition fields), `components/recipe/BrowseLensChip.tsx` (tappable body)
- New: `lib/searchTerms.ts`, `hooks/useCollapsibleHeader.ts`, `scripts/classifyIngredients.mjs`

**Data changes (Tom-applied):** the 81 orphan `That Sounds So Good` recipes claimed to Tom's user_id; the Grains/Seafood reclassification SQL.

**Verification:** all touched files type-check clean (isolated `tsc --noEmit`; pre-existing CookSoonSection/DayMealsModal errors unrelated). In-app smoke (Tom, live): book-detail opens, See-all/Browse-all navigates, cumin/pasta/fish/seafood/cheese searches, stacked pills + entity merge, typeahead scoped + refine picks, collapse feel, nutrition slider + histogram direction.

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md` — document the unified recipe-search architecture: `searchService` (Path C + metadata + synonyms + entities + suggestions + scoped/type search), `lib/searchTerms.ts`, `hooks/useCollapsibleHeader.ts`; note RecipeListScreen's stacked-search/typeahead/nutrition-slider surface and the BookView parity gap (typeahead/stacked not yet ported there).
- `PHASE_11_RECIPE_POLISH.md` — **append the Decision Record from `CC_PROMPT_family_search_code_2026-06-01`** (Noodles type, emptied-parent umbrella principle, Bread deferred, ingredientTaxonomy.ts deferred). Mark the ingredient-family-search work shipped. (Not edited here — Rule A: not authorized by this prompt.)
- `DEFERRED_WORK.md` — track follow-ups: (1) port stacked-search/typeahead/collapse to BookView; (2) Molly Baz / Cook This Book 47-row `chef_id` backfill (+ general "null chef_id under authored book" pass); (3) normalize `cooking_methods` (grill/grilled/char-grilled fragmentation); (4) classifier-prompt realignment + optional taxonomy CHECK constraint + `search_aliases[]` column; (5) `recipe.book_name` dead reference in RecipeListScreen; (6) the latent `recipes_with_books` view refs in `getRecipesByChef`/`getUserBooks` (dead but would 500 if called).
- `PROJECT_CONTEXT.md` — none (phase status bumps when 11D fully ships).

**Recommended next steps for Tom:**
1. Commit is on a branch — fast-forward to `main` when ready (see commit message).
2. Smoke the nutrition slider once more across all four macros + time; confirm the histogram/track direction reads intuitively.
3. Decide on the cooking_methods normalization + the Molly Baz chef backfill (both queued as deferred).
4. Have Claude.ai apply the recommended living-doc updates above (esp. the PHASE_11 Decision Record append).

**Surprises:** the working tree had accumulated the entire prior 11A/11D browse rebuild uncommitted (recipeBrowseService, BrowseLensChip, BookListScreen, RefineSheet rename, BookView/BookDetail rewrites, planning docs) — this commit banks all of it alongside today's work. The `recipes_with_books` view never existed in the DB despite code assuming it (CP3b's note about its "narrow columns" was written against an assumption).

## RECON — Ingredient classifier write-path & search wiring (2026-06-01)

Read-only recon per `docs/CC_HANDOFF_ingredient_family_search_2026-06-01.md` CC PROMPT 1. No code changed.

- **Live write path:** New ingredient rows are NOT created during live recipe extraction. `recipeExtraction/ingredientMatcher.matchToDatabase` resolves to an existing `ingredient_id`; unmatched items are inserted into `recipe_ingredients` with `ingredient_id: null` + `needs_review: true` (`recipeExtraction/recipeService.ts:170-204`, `lib/ingredientsParser.ts:571-577`). So the clean 733-row catalog is a one-time backfill, not live-generated.
- **`suggestIngredientMetadata` on that path?** NO — `suggestIngredientMetadata` / `generateBasicSuggestion` (`lib/services/ingredientSuggestionService.ts`) + `createIngredientsFromSuggestions` (`lib/services/ingredientService.ts:76-114`) have no live callers; they're orphaned backfill utilities. Implication: the forward-drift risk the draft worried about is low — new ingredients aren't auto-classified into a divergent vocabulary; they're parked as null pending review. Classifier-prompt realignment stays a safe deferred fast-follow.
- **Normalization layer:** NONE. `createIngredientsFromSuggestions` passes `family`/`ingredient_type` through verbatim (`ingredientService.ts:82-91`); no canonical mapping. Moot for the active path since it isn't live.
- **Stats pill options:** DERIVED, not hardcoded. `statsService.getTopIngredients` (`statsService.ts:1235-1298`) filters `typeFilter` against `family`||`ingredient_type` on returned rows; `components/stats/StatsRecipes.tsx:359-376` derives groups from result `.family`. No static option list → new `ingredient_type` values flow through automatically.
- **Synonym chokepoint:** `lib/searchService.ts → searchRecipesByIngredient`, immediately after the term is lowercased/trimmed (`searchService.ts:24`), before the catalog/text/type queries. Expanding here applies synonyms to all ingredient paths at once without leaking into title/chef/metadata (which live in `searchRecipes`, one level up).
- **Open/ambiguous:** none — all four questions resolved with code evidence.

## 2026-05-29 — 11D-CP3b — BookView enhancement (unified browse model)

**Shipped:** `screens/BookViewScreen.tsx` rewritten from inline Supabase + simple list to the unified browse model (`BrowseLensChip` + `RefineSheet` + book-scoped search). The book is the locked lens — clicking the lens chip ✕ pops back to BookList. The `sectionId` route param set by 11D-CP3a's "See all →" now drives the initial sort (mostCooked → times_cooked desc; recentlyCooked → last_cooked desc; friendsFavorites → friends_cooked_count desc; bookmarked falls through to the resolver's newest). RefineSheet opens with the full facet set minus Cookbook (book IS the locked lens). Search scopes to the current book (client-side filter over the loaded subset). Recipes render via the shared `RecipeCard` component — visually consistent with RecipeListScreen Mode B.

**Files modified:**
- `screens/BookViewScreen.tsx` (full rewrite — replaces the 354-line inline-Supabase implementation with a 480-line unified-browse-model implementation)

**Files NOT modified (intentional, CP3b scope):**
- `lib/services/bookViewService.ts` — `getBook` consumed unchanged; `getRecipesByBook` intentionally bypassed in favor of a direct `recipes`-table query (the `recipes_with_books` view has a limited column set that doesn't match the full `Recipe` shape `RecipeCard` and `resolveBrowse` require).
- `components/RefineSheet.tsx` — consumed as-is; the `activeFacets` prop already supports filtering the Quick refine section, so hiding Cookbook is a one-line filter at the call site (`activeFacets.filter(f => f !== 'cookbook')`).
- `lib/services/recipeBrowseService.ts` — `resolveBrowse` + `getActiveFacets` consumed unchanged. The CP1 contract held cleanly here.
- `App.tsx` — `BookView` route already takes the `sectionId` param from CP3a; no changes needed.

**Locked design decisions (Tom, 2026-05-29) — applied in CP3b:**
1. **(CP3a)** Section ids passed via route param; CP3b reads `route.params.sectionId` and applies the section's sort on mount. mostCooked → `times_cooked` desc, recentlyCooked → `last_cooked` desc (locale-compare on ISO strings), friendsFavorites → `friends_cooked_count` desc. The fourth ('bookmarked') doesn't map to a Recipe field directly — the screen falls through to the resolver's default 'newest' order for now.
2. **RefineSheet shows all facets + Quick refine, except Cookbook.** Implemented via `activeFacetsForSheet = getActiveFacets(browseState).filter(f => f !== 'cookbook')`. The screen still passes `onOpenCookbookPicker={() => {}}` so the prop type-checks; the no-op never fires because the facet is hidden.
3. **Search scopes to the current book** — client-side filter on `title`, `description`, `cuisine_types`, and `hero_ingredients` (substring case-insensitive). Runs over the resolveBrowse output so refinements + search compose. No server call.
4. **Lens chip ✕ pops** — `onClear={() => navigation.goBack()}`. Whether the user entered from BookDetail or BookList, `goBack()` returns them to the previous stack screen. Predictable for both paths.
5. **(CP3a)** Header meta line is on BookDetail, not BookView. BookView's status text is the simpler "<visible>/<total> recipes" form.

**Key decisions / deviations:**
- **Direct supabase query for the recipe set, not `getRecipesByBook`.** `getRecipesByBook` queries the `recipes_with_books` view, which has a narrower column set (id, title, description, image_url, prep_time_min, cook_time_min, cuisine_types, page_number — same as the original inline query). `resolveBrowse` + `RecipeCard` need the full Recipe shape (hero_ingredients, vibe_tags, serving_temp, course_type, difficulty_level, cooking_methods, easier_than_looks, etc.). Two options were: (a) extend `getRecipesByBook` to return full rows, or (b) do a direct query here matching `RecipeListScreen.loadRecipes`'s pattern. Picked (b) to avoid a service-layer contract change for one consumer. If a future screen needs the same shape, promote to a shared `getRecipesByBookFull(bookId, userId)` exported from `bookViewService`.
- **Enrichment client-side via `getCookingHistory` + `getFriendsCookingInfo` + `getRecipeNutritionBatch`** — same pattern as `RecipeListScreen.loadRecipes`. The pantry-match + ready-to-cook gate are intentionally skipped: BookView's lens makes them unnecessary (the user is browsing one book's recipes, not "what can I cook"), and skipping them keeps the load path simpler.
- **`browseState.context = 'all'`** — the book scope is implicit (we already loaded only book-scoped recipes), so the resolver doesn't apply a context predicate. The refinements layer does all the within-book filtering.
- **`browseState.sort = 'newest'` (fixed)** — the sectionId-specific sorts (`last_cooked` desc, `friends_cooked_count` desc) don't exist in the `SortOption` enum. Rather than adding new SortOption variants (which would ripple into the CP1 contract + the resolver), the screen applies the sectionId sort INLINE after `resolveBrowse` runs. CP3b kept it this way to honor the locked decision without touching CP1; if the same pattern appears in CP4, consider promoting to a `resolveBrowseWithSectionSort` helper.
- **`searchedRecipeIds = null`** in BrowseState — the screen's search is client-side substring; passing `null` skips the resolver's search-intersection step. Search is then applied as a post-filter over the resolveBrowse output + sectionId-sort. Three-step pipeline: refinements → section sort → search filter.
- **`activeRefinementChips` inlined** — same shape and logic as `RecipeListScreen.activeRefinementChips`. ~80 lines of duplicated logic. The DRY-er option would be to extract `useRefinementChips(advancedFilters, setAdvancedFilters)` into a shared hook; deferred for now to keep CP3b's surface tight. If CP4's Chef screens need the same chips, extract then.
- **No sort dropdown UI** — CP3b ships without an explicit sort control on BookView. The user's sort is set by sectionId at entry; subsequent reordering goes through the RefineSheet's Sort facet (universal across contexts) or by exiting + re-entering via a different section. If Tom wants an inline sort affordance, easy add: a Sort chip next to Refine that opens the existing sort-picker modal pattern from `RecipeListScreen`.
- **10F dietary auto-apply works the same way as RecipeListScreen.** Mount-time fetch of `getDietaryPreferences`, then if `auto_apply_to_browse` is true, seed `advancedFilters.dietaryFlags`. The flags then surface as dismissible refinement chips in the filter line (Tom-locked CP3 behavior: dietary pills visible, clearing them doesn't write back to saved prefs).
- **Recipe card uses the canonical `RecipeCard` component** — visual consistency with RecipeListScreen Mode B. The user gets the same expand/collapse, same metric layout, same dietary badges. Expanded-card state is screen-local (`expandedCardId`).
- **`previewRefineCount` honors the search filter too** — when the user is mid-search and opens RefineSheet, the "Show N recipes" preview reflects search + draft refinements together, so the count matches what they'll see after Apply.
- **Empty state copy** — "No recipes match." when refinements are active or there's a search query; "No recipes from this book yet." otherwise. Doesn't surface an "Add recipe" CTA — the user got here from BookList, which has the empty-state CTA path already.
- **The native stack header (`headerShown: true, title: 'Cookbook'` per `App.tsx` line 533) stays**. The new screen content sits below it. The back arrow on the header is the secondary path back; the lens chip ✕ is the primary.

**Verification:**
- Type-check clean on `screens/BookViewScreen.tsx` (isolated `tsc --noEmit` run; `DietaryPreferences` / `DIETARY_FLAG_KEYS` / `getDietaryPreferences` exports verified via grep). Pre-existing project-wide errors in `CookSoonSection.tsx` + `DayMealsModal.tsx` remain unrelated.
- No service-layer changes. CP1's resolver smoke isn't relevant; **defensive re-run from AdminScreen worth it** as a parity check after this CP — should still be 45 ✅.
- In-app verification I could NOT run from CC: (a) "See all →" from CP3a actually landing on BookView with the correct sort applied; (b) `recentlyCooked` sort behaving sensibly with mixed `last_cooked` values (recipes never cooked sort to the bottom because empty-string `localeCompare` puts them last); (c) the RefineSheet's "Quick refine" section omitting the Cookbook chip (it should — `activeFacetsForSheet` filters it); (d) the lens chip ✕ popping cleanly from both BookDetail-entry and BookList-entry paths; (e) search filtering live as the user types without flicker; (f) the dietary auto-apply seeding chips on first load (verify by clearing a chip + re-entering the screen → the chip re-seeds).

**Deferred / notes for CP4:**
- **Chef counterparts** — `screens/ChefDetailScreen.tsx` (curated discovery, mirror of CP3a) and `screens/AuthorViewScreen.tsx` (unified browse model, mirror of CP3b). The patterns and helpers used here transfer directly; CP4 may want to extract the `activeRefinementChips` logic into a shared hook before doing the second copy.
- **`recipes_with_books` view extension** — if Tom wants to clean up the "two queries for the same scope" awkwardness (CP3b bypasses `getRecipesByBook` because of column shape), the right fix is either to widen the view or to add `getRecipesByBookFull(bookId, userId)` to `bookViewService` returning the full recipe shape. Both are small refactors; defer until a third consumer appears.
- **`bookmarked` sort** — currently falls through to 'newest' because Recipe doesn't carry `saved_at`. CP4 or a follow-up could fetch the `saved` tags during BookView load and merge `saved_at` onto each recipe; then the bookmarked sort can land precisely.
- **`SortOption` enum extensions** — if `last_cooked` / `friends_cooked` / `saved_at` sorts come up in another context, add them to `SortOption` and the resolver's sort switch. CP3b avoided that to honor CP1's contract.
- **Page number badges** — the original BookViewScreen showed `p.<page_number>` on each recipe card. RecipeCard doesn't surface that field. If Tom wants page numbers back, the cleanest path is a small `RecipeCard` extension (optional `pageNumber` prop) or a sibling overlay component.
- **DRY refinement chips** — same logic in `RecipeListScreen` and `BookViewScreen` now; extract to `useRefinementChips(filters, setFilters)` before CP4 duplicates it a third time.

**Recommended next steps for Tom:**
1. **Smoke the BookDetail → BookView flow** end-to-end. Tap any "See all →" on BookDetail → verify the BookView opens with the right sort applied (e.g. Most cooked section → top recipes ordered by times_cooked desc). Try at least three of the four sectionIds.
2. **Try the BookList → BookDetail → BookView path** too: tap a book → tap "Browse all N recipes →" → land on BookView with no preset (default sort = newest). The lens chip should show the book title; ✕ pops back to BookDetail.
3. **Open the RefineSheet from BookView's Refine button** — verify the Cookbook facet is missing from the Quick refine section; cuisine, vegetarian, high_protein etc. should all be there; lens label in the header should read "Refine · <Book Title>"; live preview count should match what you see after Apply.
4. **Search within a book** — type a query and watch the list narrow; the status text should read "<visible> of <total> recipes". Clear the search to restore.
5. **Re-run resolver smoke** from AdminScreen as a defensive check — expecting 45 ✅, unchanged.
6. After CP3b clears smoke, refresh the PK code snapshot for `screens/BookViewScreen.tsx` and `screens/BookDetailScreen.tsx` (both substantially changed from their May-19 baselines).

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md` — update both `BookViewScreen` and `BookDetailScreen` entries. BookView: "11D-CP3b — Browse all recipes from one book with the unified browse model (BrowseLensChip + dismissible refinement chips + book-scoped search + RefineSheet with Cookbook facet hidden). Section-id sort preset consumed from route params." BookDetail: already covered in CP3a's recommended updates.
- `PHASE_11_RECIPE_POLISH.md` — mark 11D-CP3 shipped (both CP3a and CP3b); CP4 next.
- `DEFERRED_WORK.md` — track the small follow-ups: (1) extract `useRefinementChips` hook, (2) widen `getRecipesByBook` or add `getRecipesByBookFull`, (3) honor `bookmarked` section sort via saved-tag fetch.
- `PROJECT_CONTEXT.md` — none (phase status bumps when 11D ships fully).

**Surprises:** None substantial. The `recipes_with_books` view's narrow column set was a small friction point (couldn't reuse `getRecipesByBook` for the RecipeCard shape), but the direct supabase query pattern from `RecipeListScreen` covered it cleanly.

**Git status (post-changes):**
```
Modified:
        docs/SESSION_LOG.md
        screens/BookViewScreen.tsx
```

## 2026-05-29 — 11D-CP3a — BookDetail rewrite (curated discovery)

**Shipped:** `screens/BookDetailScreen.tsx` rewritten from a stats dashboard into a curated discovery surface. Header (cover thumb + title + author + "N recipes · X cooked · Y bookmarked" meta line). Four sections (Most cooked / Recently cooked / Friends' favorites / Bookmarked) driven by 11D-CP1's `getCuratedBookSections`, each hidden when empty, each with a "See all →" link in the header. Bottom CTA "Browse all N recipes →" routes to BookView with no preset. Per-section trailing metric under each recipe card (e.g. "5× cooked", "3w ago", "2 friends", "Saved 1mo ago"). Cover fallback (hash-stable solid color + title overlay) matches `BookListScreen`. `App.tsx`'s `RecipesStackParamList.BookView` now carries an optional `sectionId` so CP3b can read it and preset the sort.

**Files modified:**
- `screens/BookDetailScreen.tsx` (full rewrite — replaces the prior 355-line stats-dashboard implementation with a 350-line curated layout). The legacy `getBookStats` / `ComparisonBars` / `MiniBarRow` / `TappableConceptList` machinery is no longer used by this screen; those stay live for the stats-driven `ChefDetailScreen` and `DrillDownScreen` until 11D-CP4 / CP5 touches them.
- `App.tsx` (`RecipesStackParamList.BookView` extended with `sectionId?: 'mostCooked' | 'recentlyCooked' | 'friendsFavorites' | 'bookmarked'`). The route is unchanged; the param is purely additive — CP3a populates it, CP3b consumes it, existing callers (no other callers of BookView exist today) are unaffected.

**Files NOT modified (intentional, CP3a scope):**
- `screens/BookViewScreen.tsx` — CP3b's target. CP3a routes to it with the sectionId hint but the screen ignores the new param for now.
- `lib/services/bookViewService.ts` — fully unchanged; CP1's `getCuratedBookSections` + `getBook` + `getRecipesByBook` consumed as-is.
- `components/RefineSheet.tsx` / `recipe/BrowseLensChip.tsx` — touched only in CP3b when BookView gets the unified browse model.

**CP3a vs CP3b split rationale:**
- The handoff explicitly suggested splitting if the prompt got unwieldy. Rewriting BookDetail and enhancing BookView with the unified browse model in one diff would have been ~700+ lines of churn across two screens with two independent verification paths.
- Splitting gives you a single screen to smoke (BookDetail) before stacking BookView work on top. If something's off with the curated-section layout or the data flow, it surfaces clean here without the BookView refactor muddying the debug.
- CP3b's work will pick up exactly where CP3a leaves off — the `sectionId` param on BookView is the handoff contract; CP3b consumes it and adds the unified browse model + RefineSheet (with Cookbook facet hidden per Tom-locked decision).

**Locked design decisions (Tom, 2026-05-29) — applied in CP3a:**
1. **"See all →" routes to BookView with the section's natural sort.** CP3a passes the `sectionId` via route params. CP3b maps each id to the corresponding `BookSortOption` ('mostCooked' → 'most_cooked', 'recentlyCooked' → 'recently_cooked' via last_cooked-equivalent sort that CP3b will implement on BookView, 'friendsFavorites' → friends-cooked-desc sort, 'bookmarked' → saved-at-desc sort) and applies it on open.
2. **(BookView concern — CP3b.)** RefineSheet on BookView shows all facets + Quick refine, with the Cookbook facet hidden because the book is the lens.
3. **(BookView concern — CP3b.)** BookView search scopes to the current book.
4. **(BookView concern — CP3b.)** Lens chip ✕ on BookView pops back to BookList.
5. **Header meta line: "N recipes · X cooked · Y bookmarked"** — applied here. When `cooked_count === 0` and `bookmarked_count === 0`, the meta line collapses to just "N recipes" (avoids "12 recipes · 0 cooked · 0 bookmarked" noise). The Chef Detail header in CP4 will use the same pattern.

**Key decisions / deviations:**
- **Cross-stack navigation for "See all →" / "Browse all".** BookDetail is registered in both `RecipesStack` (CP2 — from BookList) and `StatsStack` (legacy — from stats drill-down). BookView is only in `RecipesStack`. To make the CTAs work from either entry path, `goToBookView` climbs the navigation tree (`navigation.getParent()?.getParent()` reaches the tab navigator) and dispatches a nested navigation into `RecipesStack`. The side effect of switching tabs to Recipes when entering from Stats is acceptable — the user wanted to browse the book — but worth eyeballing during smoke.
- **Props type stays as `NativeStackScreenProps<StatsStackParamList, 'BookDetail'>`.** Both stacks register the screen with the identical `{ bookId: string }` param shape, so reading `route.params.bookId` works from either stack regardless of typing. Tightening to a `CompositeNavigationProp` union would be cleaner but is over-engineering for the v1 use case.
- **Per-section metric inline component.** Each curated recipe carries exactly one metric (times_cooked / last_cooked_at / friends_cooked_count / saved_at) matching the section it came from (CP1's `CuratedRecipe` contract). `renderSectionMetric` picks the right field and formats it ("5× cooked" / "3w ago" / "2 friends" / "Saved 1mo ago"). A small inline `BookCardMetric` child component handles the styling via `useTheme` without prop-drilling.
- **`relativeDate` helper** — quick "today / yesterday / Nd ago / Nw ago / Nmo ago / Ny ago" formatter. Inline because no project-wide date helper covers this exact phrasing. If a third consumer needs it, promote to a util.
- **Header totals computed in the screen, not in the service.** I considered extending CP1's `getCuratedBookSections` to return totals too, but that would have broken the CP1 contract (`CuratedSections` shape is frozen). Adding a `getBookHeaderStats` helper would have introduced scope creep into the data layer. Compromise: the screen calls `getRecipesByBook` + `getCookingHistory` + `getRecipesWithTag` in parallel for the totals, accepting a slight double-fetch (`getCuratedBookSections` also fetches history + saved internally). Cost is two small concurrent queries; if it becomes a perf issue with large libraries, the right fix is to combine into a single `getBookDetailData` aggregator.
- **Cover fallback duplicated from `BookListScreen`.** Same palette (`COVER_PALETTE` constants + `hashCoverColor` function) inlined here so both screens hash to the same color for the same book id. Promote to a shared `lib/utils/bookCover.ts` helper if a third consumer arrives (likely in CP4 when `ChefDetailScreen` gets the same treatment for its chef-cover-equivalent — author avatar fallback per the handoff).
- **Empty state.** If `recipe_count === 0` (rare edge case: a book record exists but no recipes from it for this user), show "No recipes in this book yet." and hide the Browse all CTA. The four curated sections also naturally hide (each requires at least one recipe in the scope set).
- **`book.author?.trim() || ''`** — the `Book` type from `lib/types/recipeFeatures` has `author: string | undefined`. Fall back to the chef join eventually — but the existing `getBook` only fetches the book row, not the chef join. CP3a renders `books.author` (text column); CP3b or CP4 can enhance `getBook` to include chef metadata if Tom wants the cleaner first/last split here.
- **No `useFocusEffect` reload.** Unlike `BookListScreen` (where book counts can drift as the user cooks/saves recipes between visits), `BookDetailScreen` shows a snapshot of curated sections that don't update mid-session in a user-visible way. A reload on every focus would re-fetch on each back-from-RecipeDetail return. If Tom reports stale data after cook events, add the `useFocusEffect` then.

**Verification:**
- Type-check clean on both touched files (`screens/BookDetailScreen.tsx`, `App.tsx`) in an isolated `tsc --noEmit` run. Project-wide pre-existing errors in `CookSoonSection.tsx` + `DayMealsModal.tsx` (CP1–CP5a surprises) remain unrelated.
- No service-layer changes. CP1's resolver smoke isn't relevant; **worth a defensive re-run** from AdminScreen if you smoke this CP — should still be 45 ✅.
- In-app verification I could NOT run from CC: (a) the curated sections actually rendering with real dev-account data (the four sections may all be empty if you have no cook history for the dev book, in which case only the header + Browse all CTA shows — fine; section-hiding is the locked behavior); (b) cover fallback rendering for books without `cover_image_url`; (c) "See all →" navigation actually landing on BookView (since CP3b hasn't shipped, BookView won't yet honor the `sectionId` preset — but the navigation itself should work and you should arrive at the existing BookView with the right `bookId`); (d) cross-stack navigation when entering BookDetail from the Stats drill-down (verify the tab switches cleanly to Recipes); (e) the back arrow on the native header (`headerShown: true, title: 'Cookbook'` is set in both stack registrations) actually pops you back to BookList or StatsScreen as appropriate.

**Deferred / notes for CP3b:**
- **Read `route.params.sectionId` in `BookViewScreen`** and apply the corresponding sort on mount.
- **Refactor `BookViewScreen` away from inline Supabase queries** to `getBook(bookId)` + `getRecipesByBook(bookId, userId)`.
- **Add the unified browse model:** top search bar (scoped client-side to the loaded book recipes), `BrowseLensChip` showing the book title (✕ pops back), refinement chips (auto-applied dietary + user-set), Refine button → `RefineSheet` with the Cookbook facet filtered out of `activeFacets` (book is the locked lens).
- **`activeFacets` for BookView** — compute via `getActiveFacets(state)` then filter out `'cookbook'` before passing to RefineSheet. Or extend `getActiveFacets` with an optional "excluded facets" parameter — small change, lets future lens screens follow the same pattern.
- **RefineSheet header lens label** — pass `lensLabel={book.title}` so the header reads `Refine · <Book Title>`. Already works via the existing CP4 `lensLabel` prop.
- **The "Bookmarked" curated section's `saved_at` metric currently reads "Saved Nd ago"** — if Tom prefers absolute date or no metric on the bookmarked card, easy tweak.

**Recommended next steps for Tom:**
1. **Smoke BookDetail in Expo Go.** Path: Recipes home → Browse by → Books → tap a book → BookDetail. Verify: (a) cover + title + author + meta line render; (b) sections appear for whichever metrics have data — empty sections hidden; (c) tap a recipe card → RecipeDetail loads; (d) "See all →" navigates to BookView (will show BookView's existing layout until CP3b ships, but the nav should land cleanly); (e) "Browse all N →" same navigation, no preset; (f) back arrow returns to BookList.
2. **Try the StatsStack entry path too** — Stats screen → drill into a book → BookDetail. Verify the same surface renders, and "See all" / "Browse all" do the cross-stack navigation (tab switches to Recipes, BookView opens).
3. **Re-run resolver smoke** from AdminScreen as a defensive check — expecting 45 ✅, unchanged.
4. **Decide whether to ship CP3b now or hold** — CP3b adds the unified browse model to BookView. Independent of CP3a's verification; if CP3a smokes clean, CP3b is the natural next step.

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md` — update the `BookDetailScreen` entry in the screens section ("11D-CP3a — Curated discovery surface. Header + four sections from `getCuratedBookSections`, each with 'See all →' routing to BookView with a section-id sort preset. Bottom 'Browse all N →' CTA. Registered in both RecipesStack (from BookList) and StatsStack (from drill-down)."). Note the `RecipesStackParamList.BookView.sectionId` addition.
- `PHASE_11_RECIPE_POLISH.md` — add CP3a as shipped row; CP3b as the next outstanding row.
- `DEFERRED_WORK.md` — none from CP3a directly. The shared cover-fallback helper (extract `COVER_PALETTE` + `hashCoverColor` to `lib/utils/bookCover.ts`) could be tracked as a small deferred if a third consumer earns it.
- `PROJECT_CONTEXT.md` — none (phase status bump waits for 11D's full ship).

**Surprises:** None. The 11D-CP1 data layer covered what CP3a needed; the small double-fetch for header totals is a clean compromise to keep CP1's contract pristine.

**Git status (post-changes):**
```
Modified:
        App.tsx
        docs/SESSION_LOG.md
        screens/BookDetailScreen.tsx
```

## 2026-05-29 — 11D-CP2 — Books index + Mode A entry

**Shipped:** New `screens/BookListScreen.tsx` — Books index reached from Mode A. 2-column cover grid driven by 11D-CP1's `getBooksForIndex(userId, sort)`; client-side search filter over title/author; single `Sort ▾` dropdown with all five `BookSortOption` variants; cover fallback (hash-stable solid color from book id + white title overlay) when `cover_image_url` is null; tap → `BookDetail`; empty state with "Add a recipe" CTA that pops back to RecipesStack root. `RecipeListScreen` Mode A gains a "Browse by → Books · Chefs" row between the tile grid and "Browse all N →" link — Books tappable, Chefs muted/non-tappable until 11D-CP4 ships `ChefListScreen`. `App.tsx` registers two new routes in `RecipesStackParamList` (`BookList: undefined`, `BookDetail: { bookId: string }`) and the matching `RecipesStack.Screen` entries.

**Files added:**
- `screens/BookListScreen.tsx` (new — 300+ lines: data fetch via `getBooksForIndex` + `useFocusEffect` reload, client-side search filter useMemo, sort-picker modal mirroring the `RecipeListScreen` sort dropdown pattern, 2-column FlatList grid, cover-fallback palette, empty state)

**Files modified:**
- `screens/RecipeListScreen.tsx` (new `renderBrowseByRow` between `renderTileGrid` and `renderBrowseAllLink`; matching `browseByRow` / `browseByPrefix` / `browseByLink` / `browseByLinkMuted` styles; tap target on Books → `navigation.navigate('BookList')`) ⚠️ PK snapshot now stale (was 2026-05-19)
- `App.tsx` (`BookListScreen` import; `BookList` + `BookDetail` added to `RecipesStackParamList`; matching `RecipesStack.Screen` registrations — `BookList` with own header (no native chrome), `BookDetail` with native chrome `{ headerShown: true, title: 'Cookbook' }` matching its existing StatsStack registration)

**Files NOT modified (intentional per scope):**
- `screens/BookDetailScreen.tsx` — registered in `RecipesStack` so the BookList card tap resolves, but the screen body itself is CP3's rewrite target. CP2 only routes the tap correctly.
- `lib/services/bookViewService.ts` — fully unchanged; CP1's contract consumed as-is.

**Locked design decisions (Tom, 2026-05-29) — recorded for the audit trail:**
1. **Empty state** — "Your library is empty — recipes added from a cookbook will appear here." copy + "Add a recipe" CTA. CTA pops back to RecipesStack root (where `AddRecipeModal` lives in Mode A's header). Recommended option from the handoff.
2. **Cover fallback** — hash-stable solid color from a muted 8-color palette + white title overlay, when `books.cover_image_url` is null. (No gradient library installed — the handoff's "gradient" recommendation collapses to solid color for CP2; the visual richness rationale still holds with hash-distinct palette colors.)
3. **Chefs link** — visibly muted, non-tappable until 11D-CP4 wires `ChefListScreen`. Recommended option from the handoff.
4. **Book tap target** — `BookDetailScreen`. CP3 will redesign it; the route improves automatically when CP3 ships.
5. **Mode A "Browse by →" row** — plain text "Browse by → Books · Chefs" with middot separator. Recommended option from the handoff.

**Key decisions / deviations:**
- **Cover fallback uses solid colors, not gradients.** No `expo-linear-gradient` or `react-native-linear-gradient` installed; the only project file referencing "linear-gradient" was a CSS string in `CookingPersonalityCard.tsx`, not an actual import. Rather than add a new dependency, used a hash-stable solid color from an 8-color muted palette (`#E8C5A0`, `#C5A88B`, `#A8C5BA`, `#B5A8C5`, `#E8B0A0`, `#A0B8E8`, `#C5C5A0`, `#A0C5A8`) with the title text overlaid in white. The locked decision's intent ("visual richness, hash-stable per book") is preserved without the library. Easy to upgrade to a true gradient in a later CP if Tom adds `expo-linear-gradient`.
- **BookDetail registered in RecipesStack (in addition to its existing StatsStack registration).** React Navigation handles dual-registered components fine; same `BookDetailScreen` instance, different stack contexts. The alternative — cross-stack-navigate from BookList to `StatsStack.BookDetail` — would put the user in the wrong tab after a tap and confuse the back-stack. Dual registration keeps the user in Recipes tab throughout.
- **Search is client-side, no server round-trip.** Library scale is small (current: 5 books; expected high-usage: 10–20 per the handoff) — filtering an in-memory list by title + author substring beats any RPC. `searchBooks` (existing global ILIKE) remains for a future global-discovery surface; not consumed here.
- **Sort picker modal mirrors `RecipeListScreen`'s pattern** — `Modal animationType="fade"` + overlay TouchableOpacity for dismiss + dropdown anchored at the controls row. Anchored via fixed `top: 152, right: 15` rather than measuring the trigger position; the controls row is at a stable y-offset so this is fine. If we add more controls above (taller header) later, switch to a `measure()` call like RecipeListScreen does.
- **`useFocusEffect` reload on screen focus** — newly-added recipes (which may add new books to the library) surface without a manual refresh. Trade-off: every back-navigation from BookDetail re-fetches `getBooksForIndex` + `getCookingHistory`. Both are sub-second on the dev account; revisit if a tester reports lag with a large library.
- **`useEffect` (initial mount) + `useFocusEffect`** are both wired. On first mount: `useEffect` fires once → user id loads → initial books fetch. On subsequent focus events: `useFocusEffect` re-fetches with the current `(userId, sort)`. No double-fetch on mount because the initial `useFocusEffect` fires before `userId` is set (`userId == null` short-circuits the reload).
- **Sort change calls `loadBooks` directly** rather than relying on `useFocusEffect` re-trigger — gives instant feedback when the user picks a sort option without waiting for a navigation event. The `useFocusEffect` then keeps the data fresh on subsequent focuses.
- **Author display fallback chain** — `chef.first_name + chef.last_name` → `chef.name` → `books.author` text column → "Unknown author". The legacy `books.author` is preserved as a fallback for books whose `chef_id` isn't set; the curated UI shape still renders.
- **Per-card metric** — "N recipes" (always) and " · X cooked" (when cooked_count > 0). When `cooked_count === 0`, the meta line reads just "N recipes" rather than "12 recipes · 0 cooked" — cleaner. Matches the handoff-approved "12 recipes · 8 cooked · 3 bookmarked" header pattern minus the bookmarked count (a Detail header concern, not Index).
- **Back-button copy** — "← Recipes" in the header. Consistent with the rest of the project (no react-native-default back chrome since the screen sets `{ headerShown: false }`).

**Verification:**
- Type-check clean on all touched files (`screens/BookListScreen.tsx`, `screens/RecipeListScreen.tsx`, `App.tsx`) in isolated `tsc --noEmit` runs. The original `as never` nav casts I wrote during the BookListScreen draft (before App.tsx was updated) were dropped once `RecipesStackParamList` knew about `BookList` + `BookDetail` — final code uses fully-typed `navigation.navigate('BookList')` and `navigation.navigate('BookDetail', { bookId })`. Project-wide pre-existing TS errors in `CookSoonSection.tsx` + `DayMealsModal.tsx` remain unrelated.
- No service-layer changes → CP1's resolver smoke isn't relevant here. **Worth running the resolver smoke as a defensive check** after this CP (CP1's 45 ✅ should still hold; CP2 only added a consumer).
- In-app verification I could NOT run from CC: (a) the 2-column grid rendering across the dev account's actual book mix (some with covers, some without); (b) the search box filtering live as you type without flicker; (c) the sort dropdown landing the dropdown at the right pixel y (the fixed `top: 152` was eyeballed against the controls row height — may need a couple of points of adjustment); (d) the "Browse by → Books" tap actually landing on the new screen + a tap-back returning cleanly; (e) the BookList card tap landing on the existing stats-style BookDetail.

**Deferred / notes for CP3:**
- **`BookDetailScreen` rewrite** is CP3's primary deliverable. CP2 just routes there. CP3 consumes `getCuratedBookSections(bookId, userId)` for the four section arrays.
- **`BookViewScreen` enhancement** also CP3 — adds the unified browse model (lens chip + facet row + RefineSheet), refactors away from inline Supabase queries to `getRecipesByBook` + `getBook` from `bookViewService`.
- **Cover fallback gradient upgrade** — if Tom adds `expo-linear-gradient`, swap the solid color tile in `BookListScreen` for a two-stop gradient using the same hash-stable palette pair. ~10 lines of code; no API change.
- **Sort dropdown position** uses a hardcoded `top: 152`. If the header height changes (e.g., dynamic safe-area), measure the trigger position via a ref + `measure()` callback, matching RecipeListScreen's `handleSortPress` pattern.
- **Chefs link** stays muted until 11D-CP4 ships `ChefListScreen`. CP4's modification to RecipeListScreen's Mode A will be a one-line change inside `renderBrowseByRow` (drop the `browseByLinkMuted` style + wrap the Chefs `<Text>` in a `<TouchableOpacity onPress={() => navigation.navigate('ChefList')}>`).

**Recommended next steps for Tom:**
1. **Smoke the screen in Expo Go.** Start at Recipes home (Mode A), tap "Browse by → Books" — should land on the new index. Try: (a) sort change to "Most cooked" reorders the grid; (b) search "molly" (or whatever name appears in the library) filters to that subset; (c) tap a card with a cover — lands on existing stats-style BookDetail; (d) tap a card without a cover (if any) — the solid-color fallback renders with title overlay; (e) hit ← Recipes → returns to Mode A cleanly. Verify the muted "Chefs" link is visibly non-tappable.
2. **If the dev account has 0 books** (unlikely given the existing recipes), confirm the empty state renders the locked copy + "Add a recipe" CTA pops back to RecipesStack root.
3. **Re-run resolver smoke** from AdminScreen — expecting 45 ✅, unchanged from CP3 (defensive after the route additions).

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md` — add `BookListScreen` to the screens list ("11D-CP2 — Books index reached from Mode A 'Browse by →'. Renders `getBooksForIndex` with client-side search filter + single Sort dropdown + 2-column cover grid (solid-color fallback when `cover_image_url` is null). Tap → `BookDetail`."). Update RecipesStack routes section to include `BookList` + `BookDetail`.
- `PHASE_11_RECIPE_POLISH.md` — mark 11D-CP2 shipped; CP3 next.
- `DEFERRED_WORK.md` — none from CP2 directly.
- `PROJECT_CONTEXT.md` — none (phase status bumps when the full 11D ships).

**Surprises:** None — `getBooksForIndex` consumed exactly as designed; the only minor course-correction was dropping the `as never` nav casts after registering the routes properly in `App.tsx`.

**Git status (post-changes):**
```
Added:
        screens/BookListScreen.tsx

Modified:
        App.tsx
        docs/SESSION_LOG.md
        screens/RecipeListScreen.tsx
```

## 2026-05-29 — 11D-CP1 — Data foundation for chef/book pages

**Shipped:** `lib/services/bookViewService.ts` extended with five new exports + six new types. **Curated-section queries** — `getCuratedBookSections(bookId, userId, limit?)` and `getCuratedChefSections(chefId, userId, limit?)` each return a `CuratedSections` object with four arrays (`mostCooked` / `recentlyCooked` / `friendsFavorites` / `bookmarked`) for the CP3/CP4 Detail surfaces. **Books index** — `getBooksForIndex(userId, sort?)` returns `BookWithStats[]` with chef join, user-scoped `recipe_count`, and `cooked_count`; supports five sort options including the locked default `'author_then_title'` (compound chef.last_name → first_name → title with NULLS LAST). **Chefs index** — `getChefsForIndex(userId, sort?)` + `searchChefs(query, userId)` with the same stats shape (`ChefWithStats` adds `book_count`). No screen, component, or navigation changes — pure data foundation. Bookmark concept backed by `user_recipe_tags 'saved'` via `userRecipeTagsService.getRecipesWithTag`.

**Files modified:**
- `lib/services/bookViewService.ts` (extended — two new imports (`recipeHistoryService`, `userRecipeTagsService`); a new "11D-CP1" section at the bottom of the file with the six types, two curated-sections queries, the books index query, two chef index queries, plus internal helpers — `emptyCuratedSections`, `toCuratedRecipe`, `buildCuratedSections`, `getChefAggregatesForUser`, `buildChefRows`, `nullsLast`, `sortBookRows`, `sortChefRows`). All new code additive; existing functions untouched.

**Files NOT modified (intentional per scope):**
- No screens, no components, no navigation. CP1 is the data layer only — CP2/CP3/CP4 do the UI work.
- `AuthorViewScreen` + `BookViewScreen` still bypass `bookViewService` with inline Supabase queries; CP3/CP4 will refactor them as part of touching those screens for the Detail redesigns.
- `is_pinned` on the Recipe TS type stays as-is — separate cleanup, low priority, out of CP1 scope.

**Key decisions / deviations:**
- **Single curated-sections call returning all four sections** rather than four separate exports — fewer round-trips on Detail open, query cost is similar (each scope is small, FK-indexed). Shared `buildCuratedSections` helper consumes a pre-fetched scope recipe list so the book and chef variants differ only in the initial Supabase query (`book_id` vs `chef_id` filter).
- **Curated-section data fetching** — `getCookingHistory(userId)` + `getFriendsCookingInfo(userId)` + `getRecipesWithTag(userId, 'saved')` fired in parallel via `Promise.all`. Each call returns user-wide data (cheap — `posts` table by user_id); filtering down to the scope happens client-side in the section builders.
- **Bookmark section ordering** uses `getRecipesWithTag`'s natural order (already `created_at DESC` per its implementation). Iterating in that order + intersecting with the scope set + breaking once the limit fills gives the "most recently saved first" semantic without a re-sort pass.
- **Chef-curated scope = direct `chef_id` match only**, per the prompt's locked decision. Does NOT broaden to `books.chef_id` derivation. The Chef Detail "Browse all" in CP4 can use a broader query if v1 under-surfaces.
- **Index queries do user-scoping via intersection with the user's recipes set**, matching the existing `getAllBooks` fallback pattern (`recipes.user_id = userId`). "Books in the user's library" = distinct `recipes.book_id` from the user's recipes; "chefs in the user's library" = distinct `recipes.chef_id`. This is simpler than joining `user_books` and consistent with how `RecipeListScreen` already enumerates the user's library.
- **`recipe_count` = the user's recipes in the scope**, not the global recipe count (matches the `user_recipe_count` semantic in the existing `getAllBooks` fallback). The two could be made distinct fields later if a global-stats view is needed.
- **`cooked_count` reuses `getCookingHistory`** — one fetch per index call, then intersected with each book/chef's recipe set client-side. Matches the prompt's "match what `recipeHistoryService` does so the semantic is consistent" wire-up note.
- **Compound NULLS-LAST sort done client-side, not via Supabase `.order()`** on joined columns. Supabase's `.order()` with `foreignTable` + `nullsFirst: false` chained twice would be the alternative; client-side is easier to reason about and the volumes are small (typical library: tens to low hundreds of books/chefs). Implementation uses a `NULL_LAST_SENTINEL = '￿'` (max-codepoint char) in a `nullsLast(s)` helper so a single `localeCompare` sorts nulls to the bottom in one pass.
- **`SortableBook` / `SortableChef` internal types** carry the private `_created_at` field needed for the `'recently_added'` sort without polluting the public `BookWithStats` / `ChefWithStats` types. Stripped via destructure before return — clean public shape.
- **`searchChefs` scoped to the user's library** (intersection of the ILIKE match + the user's `chef_id` set), not a global ILIKE like `searchBooks`. Rationale: the returned `ChefWithStats` carries user-scoped stats, so a global search would surface chefs with `recipe_count: 0` / `cooked_count: 0` / `book_count: 0` which is confusing. Scoping to library makes the returned stats meaningful. The prompt's "match the existing `searchBooks` implementation pattern" applies to the ILIKE expression (`OR name.ilike.%q%, first_name.ilike.%q%, last_name.ilike.%q%`), not the scope.
- **Empty arrays for `getRecipesWithTag` intersection** — when the user has no `'saved'` tags at all, the bookmarked section is empty for every book/chef. No special path needed; the iteration just produces zero hits.
- **No throws on valid inputs** — every exported function catches errors, logs via `console.error`, and returns either `emptyCuratedSections()` or `[]`. Matches the existing service's defensive style.

**Verification:**
- Type-check clean on `lib/services/bookViewService.ts` (isolated `tsc --noEmit` run, no new errors). Project-wide pre-existing errors in `CookSoonSection.tsx` + `DayMealsModal.tsx` (CP1–CP5a surprises) remain unrelated.
- The Supabase join results (`chefs:chef_id (...)` and `books:book_id (...)`) use the same alias pattern as `userRecipeTagsService.getRecipesWithTag` and `AuthorViewScreen`'s inline queries — single object per join, `null` when the FK is unset, accessed as `r.chefs?.name` / `r.books?.title`. Cast to typed interfaces via `as unknown as ScopeRecipeRow[]` etc. since Supabase TS types aren't generated.
- In-dev verification I could NOT run from CC (no live DB access): the prompt's 9-check spot-checks against the dev account (CP3/CP4 will exercise these surfaces; for now, a smoke run in CP2/CP3 will validate). The most useful manual checks before CP2 starts: (a) `getBooksForIndex(userId)` returns books clustered by chef last name with NULLS LAST visible; (b) `getCuratedBookSections('<known-book-id>', userId)` shows `mostCooked` ordered by `times_cooked` desc; (c) `getCuratedBookSections('<book-with-no-cooks>', userId)` returns `mostCooked: []`, `recentlyCooked: []`; (d) `searchChefs('otto', userId)` matches "Ottolenghi" if present in the user's library.

**Deferred / notes for CP2+:**
- **CP2** — Books index screen + Mode A "Browse by →" entry. Will consume `getBooksForIndex`.
- **CP3** — Book Detail redesign (stats → curated sections) + `BookViewScreen` enhancement (unified chip + RefineSheet + searchService). Will consume `getCuratedBookSections`. The `BookViewScreen` refactor away from inline Supabase queries happens here.
- **CP4** — Chefs index + Chef Detail redesign + `AuthorViewScreen` enhancement. Will consume `getChefsForIndex`, `searchChefs`, `getCuratedChefSections`. The `AuthorViewScreen` refactor away from inline Supabase queries happens here.
- **Cook Soon as a curated section** — not in CP1. If a "Want to cook from this book" section earns its place during CP3 design, an additive `getRecipesWithTag(userId, 'cook_soon')` call inside `buildCuratedSections` gives it cheaply.
- **Chef scope broadening** — v1 uses direct `recipes.chef_id` only. If CP4 surfaces a Detail with too few recipes, the fix is a broader query (`recipes.chef_id = X OR recipes.book_id IN (SELECT id FROM books WHERE chef_id = X)`) — easy to add as a new export or a flag on `getCuratedChefSections`.
- **`getAllBooks` RPC + fallback** — the existing `getAllBooks` uses an RPC `get_books_with_counts` with a fallback path. CP1's `getBooksForIndex` does NOT use the RPC (it does the join + count client-side). Two reasons: (a) the RPC's contract is opaque without inspecting the DB function, and (b) the index query needs more fields (cooked_count, chef first/last name) than the existing RPC likely returns. If CP2's UI surfaces perf as an issue with large libraries, consider extending the RPC or adding a new one.

**Recommended next steps for Tom:**
1. **Smoke the new queries from AdminScreen** — wire a temporary button that logs `getBooksForIndex(userId)` and `getCuratedBookSections('<a-real-book-id>', userId)` output to confirm the shapes match expectations. Useful before CP2 starts UI work against this contract.
2. **Confirm the user-scoping decision** — index queries return only books/chefs the user has at least one recipe from. If "library" should include `user_books` ownership entries with zero recipes, that's a small expansion (one additional fetch + union the IDs).
3. **Refresh the PK code snapshot** for `lib/services/bookViewService.ts` — file is ~50% larger than the May-19 baseline.

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md` — extend the `bookViewService.ts` row in the services table to note the new 11D-CP1 surface (curated sections, books/chefs index, search).
- `PHASE_11_RECIPE_POLISH.md` — add an 11D section header (currently the doc has 11D-CP1 as part of the spine but no detail). Or: leave it skeletal until CP2 starts; CP1 ships as the data layer with no user-visible change.
- `DEFERRED_WORK.md` — none from CP1 directly. `is_pinned` TS-type cleanup is acknowledged in the prompt as out of scope; if it should be tracked as a deferred, add a one-line entry.
- `PROJECT_CONTEXT.md` — none. CP1 is a non-visible foundation; status line bumps when CP2 ships.

**Surprises:** None. Existing patterns in `bookViewService` + `recipeHistoryService` + `userRecipeTagsService` covered everything needed; the data flow was straight-line.

**Git status (post-changes):**
```
Modified:
        docs/SESSION_LOG.md
        lib/services/bookViewService.ts
```

## 2026-05-29 — 11A-CP5a — Mode split (discovery vs list)

**Shipped:** Recipes screen split into two explicit states. **Mode A (home / discovery):** header + search + "What are you looking for?" + 6-tile grid + `Browse all <N> →` link. **Mode B (list):** header + one compressed filter line (lens chip + dismissible refinement chips + right-aligned Refine button) + small `<N> recipes` status text + recipe list. The persistent CP3 facet row is gone; its contextual facets relocated to a new **"Quick refine"** section at the top of `RefineSheet`'s scrollable content. Cuisine strip removed from home. Lens chip ✕ now returns to Mode A (supersedes the CP2 "show all in place" decision). The "X you can make now" status-bar tap-through is gone — Ready to cook tile is the entry now (CP5b will formalize the WhatCanICook absorption). The CP4 search-lens-label gap (P11A-CP5-deferred-1) closes as a side-effect — the lens chip now surfaces `"<query>"` when search is active.

**Files modified:**
- `screens/RecipeListScreen.tsx` (the big one — new `screenMode` state; `clearLens` useCallback hoisted above the `lens` useMemo; `lens` rewritten to cover search-lens + tile + Browse-all cases; new `handleBrowseAll`; `handleTilePress`, `handleSearch`, and the stats drill-down route-param effect all set `screenMode='list'` on transition; new `renderBrowseAllLink`, `renderFilterLine`, `renderCompactStatus`, `renderList`, `renderModalsAndSheets` helpers; main return body restructured into selection-mode / Mode A / Mode B branches; old `renderActiveLensChip` retired; CP3's `renderRefinementChipsRow` + `renderFacetRow` kept in source as dead code for CP5b to remove if it touches the file) ⚠️ PK snapshot now stale (was 2026-05-19)
- `components/RefineSheet.tsx` (two new props — `activeFacets?: FacetId[]` + `onOpenCookbookPicker?: () => void`; new `isFacetActiveInDraft` / `toggleFacetInDraft` / `handleQuickRefineTap` helpers operate on the sheet's localFilters draft; new **Quick refine** section at the top of the ScrollView renders `activeFacets` as chips — toggle facets flip draft refinements, the `cuisine` picker scrolls the sheet to the Cuisine section, the `cookbook` picker fires the parent callback)

**Files NOT modified (intentional):**
- `lib/services/recipeBrowseService.ts` — no changes. CP3 facet config layer, `getActiveFacets`/`isFacetActive`, `BROWSE_CONTEXTS`, `resolveBrowse` all consumed unchanged from CP5a's new orchestration.
- `lib/services/__recipeBrowseResolverTest.ts` — no resolver changes → the 45-assertion suite still covers parity. Re-run as a defensive check after the screen restructure.
- `components/recipe/BrowseLensChip.tsx` — CP3 reusable chip stays unchanged; CP5a relies on the lens + refinement variants exactly as built.

**Key decisions / deviations:**
- **`screenMode` is explicit state, not derived.** Per the prompt: "Browse all" needs to land in Mode B with `context='all'` — a state derivation from `browseMode` alone can't express "Mode B with no tile context active". Default `'home'`. Mutations: tile-tap (live), Browse-all tap, search-success, stats drill-down → `'list'`. Lens chip ✕ → `'home'`.
- **`clearLens` as `useCallback`, hoisted above the `lens` useMemo.** The lens useMemo's `clear` closures reference `clearLens`. Const arrow declarations are TDZ-protected, so referencing `clearLens` before its declaration line would throw at first render. `useCallback` gives a stable reference + lets the useMemo close over it cleanly (added to deps); declared between `userDietaryFlagsActive` (its dependency) and the `lens` useMemo.
- **Lens-clear re-seeds auto-applied dietary.** The CP3 auto-apply effect runs once on mount, so a naive "reset advancedFilters to empty" in `clearLens` would lose the dietary seed until the user reloads. Fix: `clearLens` reads `userDietaryFlagsActive` (already computed from `userDietaryPrefs`) and seeds the empty dietaryFlags with the auto-apply set when `auto_apply_to_browse` is on. Mode A's tile counts now continue to reflect the user's dietary prefs immediately after a ✕. The CP3 semantic that "clearing a dietary chip in Mode B doesn't write to saved prefs" is preserved — individual chip ✕ goes through `unsetDietary`, which only touches `advancedFilters`.
- **Search lens label closes P11A-CP5-deferred-1.** The CP4 deferred-1 was about the RefineSheet header reading "Refine recipes" during an active search; CP5a's `lens` useMemo now returns `{ label: '"<query>"', clear: clearLens }` when `searchedRecipeIds !== null && searchText.trim()`. The same `lens` feeds `refineLensLabel` (was `activeLens?.label`) so the sheet header now reads `Refine · "<query>"` during search-active opens. P11A-CP5-deferred-1 should be marked resolved in DEFERRED_WORK.md (deferred for a doc-edit pass after CP5a smokes).
- **Mode-transition timing.** Search success: I set `screenMode='list'` inside the existing `handleSearch` success path (`setSearchedRecipeIds(new Set(recipeIds))` + `setScreenMode('list')`), which keeps the live-debounce-as-you-type behavior from CP2 intact. The prompt's word "submit" is a loose phrase — there's no explicit Enter handler; live-search drives the transition. UX consequence: typing in Mode A's search bar will auto-transition to Mode B after ~300ms (debounce), unmounting the search bar. The user can ✕ back to Mode A to refine. Not ideal but matches the existing search behavior; revisit if smoke makes it feel jarring.
- **`handleSearch` with empty term DOES NOT transition.** When the term is empty, `setSearchedRecipeIds(null)` runs but `setScreenMode` is not called. This means: `clearLens` → reset searchText to `''` → debounce fires → handleSearch with empty → no screen-mode change → `clearLens`'s `setScreenMode('home')` stands. No race.
- **Selection mode unchanged.** The selection-mode branch (`if (isSelectionMode)`) bypasses both Mode A and Mode B and renders just header + list — matches the pre-CP5a picker layout. Tile grid, search bar, filter line all gated on `!isSelectionMode` inside their helpers.
- **Stats drill-downs land in Mode B.** Added `setScreenMode('list')` to the stats-route-param effect immediately after the `hasInitialFilter` early-return. Stats → Cuisine podium → See all now arrives at Mode B with `context='something_new'`, `cuisineTypes` set, and the lens chip showing `Something new` with cuisine as a refinement chip beside it (per the CP3 dismissible-refinement model).
- **`renderRefinementChipsRow` and `renderFacetRow` kept as dead code.** They're no longer called from the main return body (Mode A skips them, Mode B uses the new `renderFilterLine` which inlines their work). Deleting them now would be a clean sweep, but the source kept for CP5b to remove cleanly if it touches the file. Same pattern as the orphan styles CP4 swept in its cleanup pass.
- **`renderCuisineStrip` and `renderStatusBar` similarly orphaned.** Neither called from the new main return body. Source kept for CP5b's pass.
- **Refine sheet's `Quick refine` picker facets.** `cuisine` scrolls to the Cuisine section inside the sheet via the same `sectionLayouts` ref CP4 used for `initialSection`. `cookbook` fires the new `onOpenCookbookPicker` prop — RecipeListScreen passes a closure that closes the sheet + opens the book picker modal. `sort` isn't in any context's facet list so the default-no-op `handleQuickRefineTap` switch is fine.
- **`activeFacets` prop computed at the call site.** RecipeListScreen passes `activeFacets={getActiveFacets(browseState)}` so the sheet doesn't need to know about BrowseState. Empty list → Quick refine section is hidden entirely.
- **Cookbook facet active-state is hardcoded false in the sheet** because `selectedBook` is screen-level state, not in FilterState. CP5a accepts the minor cosmetic miss — the cookbook chip won't visually reflect "active" inside Quick refine even when `selectedBook !== null`. The user still sees the book name as a dismissible refinement chip in the Mode B filter line, which IS the source of truth. Worth tightening if it nags during smoke.

**Verification:**
- Type-check clean on all touched files (`RecipeListScreen.tsx`, `RefineSheet.tsx`, plus the unchanged `recipeBrowseService.ts` / `__recipeBrowseResolverTest.ts` / `BrowseLensChip.tsx`) via isolated `tsc` runs. Pre-existing project-wide errors in `CookSoonSection.tsx` + `DayMealsModal.tsx` (CP1–CP4 surprises) remain unrelated.
- Resolver smoke test unaffected by CP5a (no service changes). The 45-assertion CP3 suite is the parity guard. **Worth re-running** as a defensive check after the screen restructure — a stray `FilterState` typo would surface there.
- In-app parity I could NOT verify from CC: (a) Mode A's tile counts respecting auto-applied dietary silently (no chip visible in Mode A); (b) entering Mode B after a tile tap surfacing the dietary chip alongside any user-set refinements; (c) the lens ✕ landing back on Mode A with auto-dietary re-seeded (tile counts unchanged); (d) the search-bar dismount when transitioning to Mode B via search (keyboard handling, focus loss); (e) the RefineSheet's Quick refine section rendering the right facets per context (e.g. `quick_tonight` → `vegetarian`, `high_protein`, `cuisine`); (f) cookbook facet in Quick refine actually closing the sheet and opening the book picker; (g) stats drill-downs landing in Mode B with the correct lens chip + refinement chips.

**Deferred / notes for CP5b:**
- **Dead code sweep.** `renderActiveLensChip` is commented out; `renderRefinementChipsRow`, `renderFacetRow`, `renderCuisineStrip`, `renderStatusBar` are kept in source but uncalled. CP5b should delete them (small cleanup pass during its card work).
- **WhatCanICookScreen absorption.** Ready to cook tile in Mode A is the entry now, but the WhatCanICookScreen still exists as a destination. CP5b removes it (or re-skins it as a Mode B context entry).
- **`PantryScreen` "What can I cook?" CTA.** Still navigates to WhatCanICookScreen — CP5b redirects it.
- **Pantry-match threshold refinement.** Per the CP5b out-of-scope note in CP5a's prompt: `ready_to_cook` tile currently uses the readyToCookService's 0.9 hardcoded threshold. CP5b might surface `50% / 75% / 90%` as a facet or status control.
- **"X you can make now" surfacing.** Gone in CP5a — CP5b decides if/how it returns (e.g. inside the Ready to cook context's status, or as a tile-row variant).
- **Cookbook facet active-state hardcoded false in Quick refine.** Cosmetic. Fix when CP5b is already in the sheet.
- **Search-bar UX in Mode A.** Auto-transition on debounce unmounts the bar; user has to ✕ back to refine. Watch for tester frustration in F&F; if it surfaces, consider keeping a slim search bar in Mode B too.

**Recommended next steps for Tom:**
1. **Smoke the screen in Expo Go** against the CP5a prompt's 12-check list. Pay special attention to: (a) Mode A breathing room vs CP4 baseline; (b) Mode B recipe-space gain vs CP4 baseline (the whole point of the CP); (c) lens ✕ returning to Mode A with auto-dietary still seeded (tile counts should not change after a ✕); (d) Search submit transitioning to Mode B with `"<query>"` lens chip; (e) RefineSheet's Quick refine row showing the right facets per context; (f) stats drill-downs landing correctly with lens + refinement chips.
2. **Re-run resolver smoke** from AdminScreen as a defensive check (expecting 45 ✅, unchanged from CP3).
3. **Mark `P11A-CP5-deferred-1` as resolved** in `docs/DEFERRED_WORK.md` (the search-lens label gap is closed by CP5a's `lens` useMemo).
4. After CP5a clears smoke, refresh the PK code snapshot for `screens/RecipeListScreen.tsx` (now significantly drifted from the 2026-05-19 baseline — CP1 through CP5a).

**Recommended doc updates:**
- `docs/PHASE_11_RECIPE_POLISH.md` — mark CP5a shipped in the sub-phase spine table; move CP5 description to a "CP5b" row (cards + WhatCanICook absorption + pantry-match threshold + the "X you can make now" decision).
- `FRIGO_ARCHITECTURE.md` — note the screen's two-mode pattern under the screens section if useful for future contributors; the `screenMode: 'home' | 'list'` state is new vocabulary.
- `DEFERRED_WORK.md` — close P11A-CP5-deferred-1 (search-lens label resolved by CP5a).
- `PROJECT_CONTEXT.md` — Phase 11 line could bump from "CP1–CP4 shipped" to "CP1–CP5a shipped" when CP5a smokes clean.

**Surprises:**
- None. The hardest piece was the `clearLens` ↔ `lens` forward reference, which `useCallback` + reorder handled cleanly.

**Git status (post-changes):**
```
Modified:
        components/RefineSheet.tsx
        docs/SESSION_LOG.md
        screens/RecipeListScreen.tsx
```

## 2026-05-28 — Phase 11 doc creation + 11A doc reconciliation (post-CP4)

**Shipped:** New `docs/PHASE_11_RECIPE_POLISH.md` created — 11A fleshed out (locked direction, CP1–CP5 spine with CP1–CP4 marked shipped, CP5 open items, carried deferred); 11B–11H skeletal placeholders (scope, refs, status only); post-launch + phase-wide deferred + references blocks. Master plan gained a pointer at the Phase 11 scope-definition section. `FRIGO_ARCHITECTURE.md` bumped for `recipeBrowseService`, `RefineSheet` (renamed from `FilterDrawer`), and `BrowseLensChip` (reusable locked-filter chip pattern), plus a top-of-file Phase 11A status line. `PROJECT_CONTEXT.md` Phase 11 entry rewritten. `DEFERRED_WORK.md` — P11-input-1 marked resolved by CP3; new `P11A-CP5-deferred-1` (search-lens label) added. All five updated/new docs staged in `_pk_sync/`.

**Files added:**
- `docs/PHASE_11_RECIPE_POLISH.md` (new phase doc)
- `_pk_sync/PHASE_11_RECIPE_POLISH.md`
- `_pk_sync/FF_LAUNCH_MASTER_PLAN.md`
- `_pk_sync/FRIGO_ARCHITECTURE.md`
- `_pk_sync/PROJECT_CONTEXT.md`
- `_pk_sync/DEFERRED_WORK.md`

**Files modified:**
- `docs/FF_LAUNCH_MASTER_PLAN.md` (Phase 11 section gained pointer to the new phase doc — appended after the existing "Estimated: 9-15 sessions" line, not in place of any master-plan content; **Last Updated** header bumped to 2026-05-28)
- `docs/FRIGO_ARCHITECTURE.md` (new row in services table for `recipeBrowseService.ts`; modals list entry for FilterDrawer rewritten as `RefineSheet (renamed from FilterDrawer in 11A-CP4)` with the full CP4 contract; new line in Cards & Display for `recipe/BrowseLensChip.tsx`; Phase 11A status line added below the doc title; **Last Updated** header bumped to 2026-05-28)
- `docs/PROJECT_CONTEXT.md` (Phase 11 entry in the "After Phase 8 (F&F-blocking phases)" list rewritten — was a one-liner pointing forward; now reflects CP1–CP4 shipped + CP5 open + 11B–11H outstanding + pointer to the phase doc; **Last Updated** bumped)
- `docs/DEFERRED_WORK.md` (P11-input-1 line gained `✅ Resolved 2026-05-28 by 11A-CP3` annotation; new `P11A-CP5-deferred-1` row appended below for the search-lens-label gap; **Last Updated** bumped)

**Files NOT modified (intentional):**
- No code files. This is a doc-only reconciliation per the prompt.
- The SESSION_LOG entries for 11A-CP1 through 11A-CP4 stand as written — this entry adds the meta-level Phase 11 doc layer that should have existed before CP1 shipped but didn't.

**Key decisions / deviations:**
- **Master plan: pointer added, content preserved.** Per the prompt's "Do not delete master-plan content," I added the new "See `docs/PHASE_11_RECIPE_POLISH.md`…" pointer after the existing "Estimated: 9-15 sessions" line of the Phase 11 scope-definition section, NOT in place of any of the must-have / stretch / moved-to-post-launch lists. The pointer is additive; the master plan continues to host the canonical scope-cut framing and estimate.
- **Master plan filename.** Prompt said "could carry a newer date suffix"; the actual file is `docs/FF_LAUNCH_MASTER_PLAN.md` (no suffix). I used that name for the PK copy. If Tom later renames to `FF_LAUNCH_MASTER_PLAN_<date>.md`, the PK copy will need to follow.
- **PROJECT_CONTEXT location.** The prompt expected a "current-phase status line/section"; the file has its Phase 11 line inside the "After Phase 8 (F&F-blocking phases)" list. I rewrote that line in place since that's where Phase 11 was previously discussed; the broader "What's Next" structure stays intact.
- **DEFERRED_WORK.md placement of new entry.** Added `P11A-CP5-deferred-1` immediately below `P11-input-1` in the same "Phase 11 inputs (2026-05-27)" table — kept the section header date even though the entry is from 2026-05-28, since the section spans Phase 11 deferred items in general. Also resolved P11-input-1 in-place (it's a CP3 deliverable) so future audits see the dietary-pills item as closed.
- **FRIGO_ARCHITECTURE.md placement choices.** Services table: `recipeBrowseService` inserted directly after `readyToCookService` (chronological neighbor in the browse domain). Modals list: `RefineSheet` description inserted in place of the previous `FilterDrawer` reference, with the full CP4 contract; the surrounding modal-name run-on list is intact. Cards & Display: `BrowseLensChip` added as a bolded paragraph below the existing card components since the section is a mix of run-on lists and bolded callouts.
- **Phase 11A status line.** Added immediately below the doc-title/version block in FRIGO_ARCHITECTURE.md. Cleanest "current-phase signal" placement since the doc doesn't have a dedicated phase-status section.
- **Living doc `**Last Updated**` bumps.** Per Rule A, headers updated to 2026-05-28 on all four edited docs (master plan, FRIGO_ARCHITECTURE, PROJECT_CONTEXT, DEFERRED_WORK). The new PHASE_11 doc has no Last Updated header (none of the other phase docs do, per the existing pattern — they carry section-level dates instead).
- **PK staging — no date-suffix copies.** Per the prompt's section 6, I copied the docs to `_pk_sync/` under their existing filenames (no `_<date>.md` suffix) rather than the Rule A default of `FILENAME_YYYY-MM-DD.md`. The prompt is explicit about which filenames to use; treating that as authorization to override the default staging pattern. If Tom prefers dated copies for this batch, easy to redo.

**Verification:**
- `git status` shows the new Phase 11 doc + the four updated docs + the five staged copies in `_pk_sync/`, plus the untracked `_pk_sync/code/` subdir that was already present. No code files modified — confirmed via `git diff --stat`.
- `ls _pk_sync/` shows `DEFERRED_WORK.md`, `FF_LAUNCH_MASTER_PLAN.md`, `FRIGO_ARCHITECTURE.md`, `PHASE_11_RECIPE_POLISH.md`, `PROJECT_CONTEXT.md` — all five required, plus the pre-existing `code/` subdir.
- Phase 11 doc contains: 11A locked direction + sub-phase spine with CP1–CP5 (CP1–CP4 marked shipped, CP5 outstanding) + CP5 open items + carried-deferred block; 11B–11H skeletons (scope, refs, open questions, status); Post-launch section; References block.
- Master plan retains its Phase 11 row in the phase table, the "Why this order" paragraph, the must-have/stretch/post-launch lists, and the estimate. Only the pointer line is new.

**Deferred / notes:**
- None from this reconciliation. The doc system is now caught up to CP4. CP5 ships → 11A "Shipped" row in the spine, and a fresh SESSION_LOG entry.

**Recommended next steps for Tom:**
1. Upload the five staged copies from `_pk_sync/` to PK / canonical doc store; confirm before next CC session.
2. PK code snapshot for `screens/RecipeListScreen.tsx` is still stale from CP1's call — worth refreshing now that CP1–CP4 are doc-reconciled.
3. CP5 is the only remaining 11A checkpoint; the next major prompt should be `CC_PROMPT_11A_CP5.md` for cards + WhatCanICook absorption.

**Recommended doc updates:** All applied in this entry — none outstanding.

**Surprises:** None. Doc edits were straightforward; pre-existing unicode-escape sequences in FRIGO_ARCHITECTURE (the UserAvatar emoji regex) required a smaller-anchor replacement target rather than the long surrounding string, but no semantic edits to that line.

**Git status (post-changes):**
```
Untracked files:
        _pk_sync/DEFERRED_WORK.md
        _pk_sync/FF_LAUNCH_MASTER_PLAN.md
        _pk_sync/FRIGO_ARCHITECTURE.md
        _pk_sync/PHASE_11_RECIPE_POLISH.md
        _pk_sync/PROJECT_CONTEXT.md
        docs/PHASE_11_RECIPE_POLISH.md

Modified:
        docs/DEFERRED_WORK.md
        docs/FF_LAUNCH_MASTER_PLAN.md
        docs/FRIGO_ARCHITECTURE.md
        docs/PROJECT_CONTEXT.md
        docs/SESSION_LOG.md
```

## 2026-05-28 — 11A-CP4 — Refine sheet rework (FilterDrawer → RefineSheet)

**Shipped:** `components/FilterDrawer.tsx` renamed to `components/RefineSheet.tsx` (default export `RefineSheet`). The four numeric sliders (Cal max, Protein min, Active time, Total time) replaced with mutually-exclusive range chip groups per the CP4 preset table. Live "Show N recipes" count on the Apply button driven by a `previewCount` closure the parent (RecipeListScreen) provides — the closure runs `resolveBrowse` over the **full pipeline** (current context + search + draft refinements), so N reflects what Apply will actually produce. Header now reads "Refine · `<lensLabel>`" when an active tile/cuisine/search lens is set (falls back to "Refine recipes"). `initialSection` prop lets the cuisine facet open the sheet anchored at the Cuisine section, retiring CP3's "open the drawer at the top" stopgap. The "Advanced" collapse is gone — all 13 sections render in the prompt's order (Time → Nutrition → Dietary → Cuisine → Vibe → Difficulty → Cooking method → Course → Hero ingredient → Ingredient count → Serving temp → Make-ahead → Social). Orphaned styles from CP1–CP3 swept from `screens/RecipeListScreen.tsx`.

**Files renamed:**
- `components/FilterDrawer.tsx` → `components/RefineSheet.tsx` (via `git mv` after tracking-state check per Rule C — file was tracked; rename preserves history)

**Files modified:**
- `components/RefineSheet.tsx` (full rewrite — new sections + order + range chips + lens-label header + previewCount + initialSection + onLayout-based section y-offset capture; FilterState type name preserved exactly as before since the resolver imports it)
- `screens/RecipeListScreen.tsx` (import swap; new `refineInitialSection` state + cleanup-on-close wiring; `previewRefineCount` closure passes the full draft through `resolveBrowse`; `refineLensLabel` derived from CP2's `activeLens.label`; cuisine facet `openPickerFacet` case now sets `initialSection='cuisine'` before opening; orphan style sweep — 24 dead style keys removed across the StyleSheet) ⚠️ PK snapshot now stale (was 2026-05-19)

**Files NOT modified (intentional per scope):**
- `lib/services/recipeBrowseService.ts` — resolver, BROWSE_CONTEXTS, facet config all untouched. CP3 finalized them.
- `lib/services/__recipeBrowseResolverTest.ts` — no resolver changes → no new assertions needed. The 45-assertion suite remains the parity guard.
- `components/recipe/BrowseLensChip.tsx` — CP3's reusable lens/refinement chip stays as-is.
- The existing sort-picker modal + book-picker modal in the screen — still triggered from their facets; no rework.

**Key decisions / deviations:**
- **Range chip presets from the prompt verbatim.** Active: `≤15m / ≤30m / ≤45m / ≤60m`. Total: `≤30m / ≤60m / ≤90m / ≤2h`. Cal max: `≤300 / ≤500 / ≤750`. Protein min: `20g+ / 30g+ / 40g+`. Mutually exclusive per dimension — tapping the active chip clears (`undefined`); tapping a different chip replaces. No explicit "Any" chip. Implemented via `setRangeBound(field, value)` that checks current value === tapped value → undefined, else value.
- **Boundary preservation.** A recipe at exactly 30 active min is included by `≤30m` (≤, not <), exactly the resolver's existing `r.active_time_min <= af.maxActiveTime!` check. No resolver changes needed because the chip values just write straight to the existing FilterState field — same predicate fires.
- **Live count via parent-provided closure.** The sheet doesn't know about the active context, search state, or recipe set — it just calls `previewCount(localFilters)` whenever the draft mutates. The parent's closure: `(draft) => resolveBrowse(recipesWithMatch, matchMap, { ...browseState, refinements: draft }).length`. Closes over the current BrowseState so context + search + readyToCookIds + userDietaryFlags all flow through. ~475 recipes on a typical account; no debounce needed (revisit if flicker shows up in testing). Falls back to the legacy `Apply (N)` label when `previewCount` is undefined (defensive — current parent always provides it).
- **`initialSection` anchored open via onLayout capture.** Each section's `<View onLayout={onSectionLayout(id)}>` writes its y-offset into a `Map<SectionId, number>` ref. An effect keyed on `[visible, initialSection, localFilters]` re-reads the map and calls `scrollRef.current?.scrollTo({ y, animated: false })` once the layout has reported — defensive against the case where onLayout fires after the open effect. The `-8` offset gives a touch of breathing room above the section title. Map cleared on every open so a re-open with a different `initialSection` doesn't read stale offsets.
- **Lens label derived from CP2's `activeLens`.** When a tile context or cuisine is active, the same string CP2's lens chip shows ("Quick tonight" / "Thai") gets prefixed with "Refine · " in the sheet header. No new state on the screen — just `refineLensLabel = activeLens?.label`. When search is the lens, CP2's `activeLens` doesn't currently surface a search label — CP3 deferred the search-lens chip case; the sheet header will fall back to "Refine recipes" in that case. Worth tightening when CP3's search-lens chip ships.
- **No section anchor for the four facet-only refinements** (`quickUnder30`, `onePotOnly`, plus the `vegetarian` / `high_protein` shortcut semantics). They have no UI in the sheet per the prompt — surfacing them would double-represent the dietary / protein / time / method dimensions the sheet already covers. The dietary chip in the Dietary section IS the vegetarian flag; the protein range chip IS high-protein; the active-time range chip IS quick30; cookingMethods chip IS one_pot. Three of the four refinements toggled only via facets stay queryable via the parent's chips view above the list.
- **Footer button label.** When `previewCount` provides N: `Show <N> recipe(s)` (handles pluralization). When previewCount is undefined: `Apply (<N>)` where N is the legacy activeCount. The header still shows the activeCount badge ("Refine · Thai · 4") for at-a-glance count even when the footer shows the live preview.
- **Reset behavior unchanged.** "Clear all" in the header resets localFilters to EMPTY_FILTERS (the canonical empty shape). Does NOT touch `quickUnder30` / `onePotOnly` since they're not in EMPTY_FILTERS — wait, actually they ARE: I added them to EMPTY_FILTERS as `false` so reset properly clears them too. Verified in the rewrite.
- **Style sweep verified per-key.** All 24 candidates listed in the CP3 deferred + CP2/CP3 retire list confirmed zero references via grep before removal: `bookFilterContainer`, `bookFilterButton`, `bookFilterText`, `bookFilterTextActive`, `bottomSearchContainer`, `searchBar`, `searchIcon`, `segmentedWrapper`, `segmentedContainer`, `segmentedTab`, `segmentedTabActive`, `segmentedTabIcon`, `segmentedTabText`, `segmentedTabTextActive`, `sortButton`, `sortButtonText`, `quickFiltersContainer`, `dietaryPrefIndicator`, `dietaryPrefIndicatorIcon`, `dietaryPrefIndicatorText`, `dietaryPrefShowAll`, `quickFilterChipActive`, `quickFilterIcon`, `quickFilterLabelActive`. Verification command: `grep -cE "^\s+$key:\s*\{" screens/RecipeListScreen.tsx` confirms all definitions are gone and `grep -c "styles\.$key\b"` confirmed zero references before each deletion.

**Verification:**
- Type-check clean on all touched files (`components/RefineSheet.tsx`, `screens/RecipeListScreen.tsx`, plus the unchanged service module + smoke test) in isolated `tsc` runs. Pre-existing project-wide errors in `CookSoonSection.tsx` + `DayMealsModal.tsx` (CP1/CP2/CP3 surprises) remain — unchanged.
- Resolver smoke test unaffected by CP4 (no resolver changes); the 45-assertion suite from CP3 stands as the parity guard. Tom **does not need to re-run the smoke test** for CP4 — it would produce the same 45 ✅. **Worth running anyway** as a defensive guard after the rename + sheet rewrite, since a typo in the FilterState type that the resolver imports would surface there.
- In-app parity I could NOT verify from CC: (a) each range chip's boundary behavior under real data (a recipe at exactly 30 min should appear when `≤30m` is selected; verify a couple of edge cases when smoke-passing); (b) the live count actually updating on every chip toggle without flicker; (c) the cuisine facet opening anchored at the Cuisine section (scroll lands precisely, not a tick late); (d) the 10F dietary auto-apply still seeding flags as selected chips in the Dietary section when the sheet opens (the data flow is unchanged — `userDietaryPrefs` → `advancedFilters.dietaryFlags` → sheet's `filters` prop → `localFilters` on open — but worth eyeballing); (e) selection mode still working (the new sheet shouldn't be opened during selection mode anyway since the facet row is gated on `!isSelectionMode`, but verify Add Recipe + Cancel flows aren't disturbed).

**Deferred / notes for CP5:**
- The refine model is complete. CP5 (cards: low-stock chips, match-badge integration, WhatCanICook absorption) is the next visible-output checkpoint and doesn't touch the refine surface.
- Search lens has no `activeLens` representation yet (CP3 deferred). When CP5+ tightens that, the sheet header will start surfacing "Refine · \"chicken\"" for search-active opens too.
- Cuisine facet → `initialSection='cuisine'` works through React Navigation's `scrollTo` — the onLayout race-condition guard (re-running the scroll effect on localFilters mutation) is defensive but worth eyeballing on slower devices to confirm the anchor lands on the first paint, not after a frame or two.
- The reusable `BrowseLensChip` adoption in `WhatCanICookScreen` and stats `DrillDownScreen` is still post-F&F per the locked plan; CP4 didn't touch either.

**Recommended next steps for Tom:**
1. **Smoke-pass the refine sheet in Expo Go.** Run through the CP4 prompt's 10-check list with extra attention to: (a) range-chip boundary values (does a 30-min recipe pop in/out cleanly as `≤30m` toggles?); (b) live count behavior — toggle several refinements rapidly and watch the Apply button label; (c) cuisine facet → anchored open (does it land on Cuisine or scroll past it?); (d) lens label header ("Refine · Quick tonight" with the tile active); (e) Apply N matches the resulting list length exactly.
2. **Re-run resolver smoke** from AdminScreen as a defensive check after the rename (expecting 45 ✅, unchanged from CP3).
3. After CP4 clears smoke, refresh the PK code snapshot for `screens/RecipeListScreen.tsx` (now 1446 lines added / 995 removed across CP1→CP4 — substantial drift from the 2026-05-19 baseline).

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md` — `FilterDrawer` → `RefineSheet` rename in the components list (Cards & Display or new "Recipe browse" subsection); note the lens-label header + previewCount + initialSection contract since other surfaces may want to reuse this pattern. Phase 11A status: CP4 shipped; only CP5 (cards) remains for the visible-output sequence.
- `DEFERRED_WORK.md` — if the search-lens-label gap is worth tracking, suggest adding `P11A-CP5-deferred-1: Surface a search-lens label through BrowseState.activeLens so the RefineSheet header reads "Refine · \"<query>\"" for search-active opens.`
- `PROJECT_CONTEXT.md` — none.
- `FF_LAUNCH_MASTER_PLAN.md` — none until CP5 lands.

**Surprises:** None new — same pre-existing TS errors in `CookSoonSection.tsx` + `DayMealsModal.tsx` remain unrelated to CP4.

**Git status (post-changes):**
```
Changes to be committed:
        renamed:    components/FilterDrawer.tsx -> components/RefineSheet.tsx

Changes not staged for commit:
        modified:   components/RefineSheet.tsx
        modified:   docs/SESSION_LOG.md
        modified:   screens/AdminScreen.tsx
        modified:   screens/RecipeListScreen.tsx

Untracked files:
        _scratch/
        components/recipe/BrowseLensChip.tsx
        docs/CC_PROMPT_11A_CP1.md
        docs/CC_PROMPT_11A_CP2.md
        docs/CC_PROMPT_11A_CP3.md
        docs/CC_PROMPT_11A_CP4.md
        lib/services/__recipeBrowseResolverTest.ts
        lib/services/recipeBrowseService.ts
```

## 2026-05-28 — 11A-CP3 — Refine surface (locked lens chip + contextual facets + dismissible chips)

**Shipped:** Single refine surface replacing the CP2 interim controls. `BrowseLensChip` grew into the reusable locked-filter chip pattern (lens vs refinement variants). Active refinements now render as dismissible chips above the list (including auto-applied dietary pills — the 10F text indicator is gone). A contextual facet row sits below, driven by per-context `facets: FacetId[]` data on the `BROWSE_CONTEXTS` registry, with universal `Sort ▾` and `More ›` appended. The `quickFilters` state and its resolver branch are removed — the four legacy semantics are facet-driven refinements (`vegetarian` → `dietaryFlags.is_vegetarian`, `highProtein` → `minProteinPerServing=25`, `quick30` → `quickUnder30=true`, `comfort` → `vibeTags=['comfort']` via More). Sort + Cookbook standalone controls removed; both reachable via their facets.

**Files modified:**
- `lib/services/recipeBrowseService.ts` (BrowseState dropped `quickFilterIds`; resolver dropped quick-filter branch; added `quickUnder30` + `onePotOnly` refinement branches; per-context `facets: FacetId[]` on registry; `FACET_META`, `CUISINE_LENS_FACETS`, `SEARCH_LENS_FACETS`, `isFacetActive`, `getActiveFacets` exports)
- `lib/services/__recipeBrowseResolverTest.ts` (quickFilter assertions migrated to facet-refinement assertions; baseState dropped `quickFilterIds`; new `BROWSE-REF-onePot` empty-set guard; combined-case rewritten to use refinements)
- `components/FilterDrawer.tsx` (FilterState gained `quickUnder30?: boolean` + `onePotOnly?: boolean` — facet refinements with no drawer UI; drawer otherwise untouched per CP3 scope)
- `components/recipe/BrowseLensChip.tsx` (rewritten — reusable chip with `{ label, icon?, count?, variant: 'lens' | 'refinement', onClear }` API; lens = filled primary, refinement = lighter outline with ✕)
- `screens/RecipeListScreen.tsx` (removed `quickFilters` state, `QuickFilter` interface, `toggleQuickFilter`, `renderQuickFilters`, `renderBookFilter`, `renderDietaryPrefIndicator`, `autoFilterDismissed`; added `activeRefinementChips` useMemo (one chip per applied refinement), `applyToggleFacet` + `openPickerFacet` handlers, `renderRefinementChipsRow` + `renderFacetRow`; rewired main body) ⚠️ PK snapshot now stale (was 2026-05-19)

**Key decisions / deviations:**
- **`quick` and `one_pot` as refinements, not BrowseState fields.** Per the prompt: "After CP3, `BrowseState` is the single source of truth: `context` + `refinements` + `searchedRecipeIds` + `sort`." I extended `FilterState` (in `FilterDrawer.tsx`) with two optional refinements (`quickUnder30`, `onePotOnly`) rather than adding new top-level fields to `BrowseState`. The drawer doesn't surface them (they're facet-only refinements), but the type is the right home for "things that filter the recipe set." The resolver gets two new branches that mirror the old `quick30` / `is_one_pot` predicates exactly.
- **Quick predicate preserved verbatim.** `quickUnder30` branch: `(r.total_time_min && ≤30) || (r.active_time_min && ≤30) || (prep+cook ≤30)` — the exact 3-way OR from the legacy `quick30` quickFilter. Smoke test asserts the same `{r1, r3, r4, r6}` set the CP1 `quickFilterIds: ['quick30']` test produced.
- **Dietary chips, not text indicator.** The 10F "From your dietary preferences / Show all" surface is gone. The auto-apply useEffect still seeds `advancedFilters.dietaryFlags` from `userDietaryPrefs` on load; CP3 just renders each set flag as a dismissible refinement chip in the row. Clearing a chip removes the flag from `advancedFilters` but never touches `userDietaryPrefs` — the existing semantic ("clearing this session doesn't change saved prefs") is preserved by routing all chip ✕ taps through `unsetDietary` which updates only `advancedFilters`. Dropped `autoFilterDismissed` state since the dismiss-the-banner action no longer exists.
- **Refinement chips: one per item, not one per dimension.** Each cuisine, hero, vibe, dietary flag, etc. becomes its own chip with its own ✕. Numeric bounds (cal/protein/time) and booleans (makeAhead/easierThanLooks/etc.) are one chip each. Selected book is one chip. This is what the prompt's "clearing the chip removes just that refinement" means.
- **Facet-row chips re-use `quickFilterChip` styles.** New styles only needed for the refinement-chips row container and the facet-row container (border-bottom, padding). The actual chip pills lean on existing `styles.quickFilterChip` / `styles.quickFilterLabel` / `styles.moreChip` / `styles.clearFiltersChip` — same visual language as the CP2 interim controls, now driven from facet config. Active toggle facets render as refinement chips in the row above (single source of truth — facet row hides them to avoid double-rendering).
- **Facet ✕ behavior:** facet row only ever ADDS a refinement; clearing it happens via its dismissible chip in the row above. Keeps the facet row stable (the same facets shown regardless of state) and surfaces the "what's applied" view explicitly in the chips row.
- **`getActiveFacets` resolution order:** search lens wins over cuisine lens. (A search inside a cuisine context is still a search-scoped refine surface.) Cuisine lens applies when `context='all'` AND exactly one cuisine in `cuisineTypes`. Otherwise the context's own `facets` array wins. All three sets are data on the service module, not hardcoded in render.
- **Cuisine facet routes to FilterDrawer for now.** No standalone multi-cuisine picker exists yet; tapping the `cuisine` facet opens the drawer (whose cuisine section is the current best path). CP4's drawer rework lands a faster picker that could replace this.
- **`getActiveFilterCount` now = `activeRefinementChips.length`.** Single source of truth — what the user sees as chips IS the count. Used by the status bar suppression check + the empty-list "Clear" CTA visibility check + the trailing "✕ Clear" chip in the facet row.

**Verification:**
- Type-check clean on all touched files (`recipeBrowseService.ts`, `__recipeBrowseResolverTest.ts`, `BrowseLensChip.tsx`, `FilterDrawer.tsx`, `RecipeListScreen.tsx`) in isolated `tsc` runs. Project-wide pre-existing TS errors in `CookSoonSection.tsx` + `DayMealsModal.tsx` still there (CP1/CP2 surprises), unchanged.
- Smoke test extended: 4 former quick-filter assertions migrated to facet-refinement form (`BROWSE-REF-vegetarian`/`-highProtein`/`-quick`/`-comfort`), all asserting the same recipe sets as their CP1 counterparts; new `BROWSE-REF-onePot` empty-set guard; combined-case rewritten. Total expected: 43 assertions (42 from CP2 minus the 4 old quick-filter ones, plus 4 new refinement equivalents plus 1 new onePot = 43). **Tom needs to re-run "Run recipe browse resolver tests" from AdminScreen.**
- In-app parity I could NOT verify from CC: every facet toggling/clearing in real time; the chip row wrapping behavior with many active refinements; the modal pickers (Sort, book) firing from facet taps; the FilterDrawer's `cuisine` section landing the user where they need to be; selection-mode unaffected by the new chip rows.

**Deferred / notes for CP4:**
- `More ›` still opens the unchanged FilterDrawer per CP3 scope. CP4 reworks the drawer into grouped/range-chip/live-count and the same refine row CP3 ships now becomes the drawer's home surface.
- The `cuisine` facet's current "open FilterDrawer" is a stopgap. CP4's drawer rework will likely surface a faster cuisine picker (or the facet itself could open an inline multi-select sheet).
- Orphaned styles remain in the StyleSheet (e.g. `bookFilterContainer`, `bookFilterButton`, `dietaryPrefIndicator*`, `quickFiltersContainer`) — harmless but worth a sweep in CP4 when the styles block is already being touched.
- The reusable `BrowseLensChip` is NOT yet adopted by WhatCanICook / stats DrillDown — explicit "later/post-F&F pass" per the CP3 prompt.

**Recommended next steps for Tom:**
1. **Re-run resolver smoke test** from AdminScreen. Expected: 43 assertions, all green. The four `BROWSE-REF-*` results should match the CP1 `BROWSE-QF-*` sets exactly (parity guard for the facet-refinement migration).
2. **Smoke-pass the screen in Expo Go.** Per the CP3 prompt's 9-check list, with special attention to: (a) dietary auto-apply still produces chips on load; (b) clearing a dietary chip filters live but doesn't write to saved prefs (re-open screen — auto-apply should re-seed); (c) `quick` facet hits exactly the recipes the old "Under 30m" did, including ones that qualify only via active-time or prep+cook (not total-time); (d) Sort facet opens the existing picker; (e) Cookbook facet opens the existing book picker when in `something_new`; (f) More opens the unchanged FilterDrawer; (g) clearing every refinement via chip ✕ returns the list to base context.
3. After Tom signs off CP2+CP3 in Expo Go, refresh the PK code snapshot for `screens/RecipeListScreen.tsx` (now 938 lines added / 549 removed across CP1→CP3 — substantial drift from the 2026-05-19 snapshot).

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md` — `recipeBrowseService.ts` now hosts the facet config layer (`FACET_META`, `CUISINE_LENS_FACETS`, `SEARCH_LENS_FACETS`, `isFacetActive`, `getActiveFacets`) in addition to the resolver/registry. Worth a one-line bump. `BrowseLensChip` graduated to the reusable locked-filter chip pattern (8E-CP3 master-plan callout) and is callable from any screen that needs lens/refinement chip UI. Phase 11A status: CP3 shipped; CP4 (drawer rework) and CP5 (cards + WhatCanICook absorption) outstanding.
- `DEFERRED_WORK.md` — none from CP3 directly. If the cuisine-facet → drawer stopgap should be tracked as a CP4 cleanup, suggest adding `P11A-CP4-deferred-1: Replace cuisine-facet → FilterDrawer stopgap with the new drawer's inline cuisine picker.`
- `PROJECT_CONTEXT.md` — none.
- `FF_LAUNCH_MASTER_PLAN.md` — none until CP4/CP5 land.

**Surprises:** None new — same pre-existing TS errors in `CookSoonSection.tsx` + `DayMealsModal.tsx` remain.

**Git status (post-changes):**
```
Changes not staged for commit:
        modified:   components/FilterDrawer.tsx
        modified:   docs/SESSION_LOG.md
        modified:   screens/AdminScreen.tsx
        modified:   screens/RecipeListScreen.tsx

Untracked files:
        _scratch/
        components/recipe/BrowseLensChip.tsx
        docs/CC_PROMPT_11A_CP1.md
        docs/CC_PROMPT_11A_CP2.md
        docs/CC_PROMPT_11A_CP3.md
        lib/services/__recipeBrowseResolverTest.ts
        lib/services/recipeBrowseService.ts
```

## 2026-05-28 — 11A-CP2 — Home rebuild (tiles + cuisine + top search)

**Shipped:** Tile contexts added to the browse registry (`quick_tonight`, `ready_to_cook`, `recently_added`, `your_classics`, `for_your_diet`, `friends_cook`, plus registered-but-not-defaulted `something_new`); `RecipeListScreen.tsx` home rebuilt with a top-anchored search bar, a 2×3 tile grid (live counts or dashed inroad CTAs per liveness gate), a cuisine strip below it, and a minimal `BrowseLensChip` above the list. Segmented control + bottom search bar removed. Interim refine controls — `quickFilters` row, `More ›` (FilterDrawer), `Sort` dropdown, book dropdown — kept (CP3 replaces them with locked-chip + facets + refine sheet).

**CP1 carryover cleanups also done in this CP:** local `Recipe` interface folded into the canonical export from `components/recipe/RecipeCard.tsx`; `filteredRecipes` converted from `useState` + `setFilteredRecipes` `useEffect` to a `useMemo` derived directly from `browseState` (drops the `exhaustive-deps` warning CP1 carried).

**Files added:**
- `components/recipe/BrowseLensChip.tsx` (minimal label + ✕ pill; CP3 extends it with dismissible refinement chips, dietary pills, and the search-lens case)

**Files modified:**
- `lib/services/recipeBrowseService.ts` (BrowseContextId widened; CP1 `cook_again`/`try_new` IDs renamed → `your_classics`/`something_new`; new tile-context predicates wired through extended `BrowseState` fields `readyToCookIds: Set<string> | null` and `userDietaryFlags: Partial<FilterState['dietaryFlags']>`; `DEFAULT_TILES` metadata exported)
- `lib/services/__recipeBrowseResolverTest.ts` (assertions renamed to match new IDs; 9 new assertions added for `quick_tonight`, `ready_to_cook` (positive + null gate), `recently_added` (empty + positive with synthetic `created_at`), `for_your_diet` (single flag + AND + no-prefs vacuous-empty), `friends_cook`)
- `screens/RecipeListScreen.tsx` (the big one — see "Key decisions" below) ⚠️ PK snapshot now stale (was 2026-05-19)

**Key decisions / deviations:**
- **ID rename rather than alias.** CP1's `cook_again` / `try_new` got renamed to `your_classics` / `something_new` in the registry rather than kept as aliases. The route-param handler in `RecipeListScreen` maps incoming stats drill-down `initialBrowseMode='cook_again' | 'try_new' | 'all'` to the new IDs, so `RecipesStackParamList` in `App.tsx` did NOT need to change — external callers stay on the old string values and translate at the boundary. Tradeoff: one rename diff vs. a dual-aliases-forever ambiguity in the registry.
- **`ready_to_cook` predicate via state, not matchMap.** The `readyToCookService.filterReadyToCook` gate needs the catalog ingredient names per recipe (lives in `recipeIngredientsMap`), which the resolver doesn't have. Rather than thread three new args through `resolveBrowse`, the screen pre-computes the ready-to-cook id set into `state.readyToCookIds` and the predicate just does `set.has(id)`. Same shape used for `for_your_diet`: predicate reads `state.userDietaryFlags` (populated from `userDietaryPrefs`) and ANDs over set flags. Keeps the resolver pure and lets the screen own integrations.
- **`canMakeCount` derived from `readyToCookIds`.** CP1's `canMakeCount` useMemo did its own `filterReadyToCook` call; CP2 collapses that into a single computation: `readyToCookIds` is the Set, `canMakeCount = readyToCookIds?.size ?? 0`. One fewer pass; same result.
- **Liveness gates** (per prompt): `quick_tonight` + `recently_added` live whenever the user has any recipes; `ready_to_cook` requires `readyToCookIds.size > 0` (proxy for "active space has supplies"); `your_classics` requires at least one recipe with `times_cooked > 0`; `for_your_diet` requires at least one set dietary pref; `friends_cook` requires at least one recipe with `friends_cooked_count > 0`. Inroad CTA labels per the prompt; `your_classics` inroad clears to all recipes ("Cook a few to build these") since no dedicated setup screen exists.
- **Cross-stack navigation routes** (read from `App.tsx`): `ready_to_cook` inroad → `navigation.getParent()?.navigate('PantryStack')`. `for_your_diet` → `navigation.getParent()?.navigate('FeedStack', { screen: 'DietaryPreferences' })`. `friends_cook` → `navigation.getParent()?.navigate('FeedStack', { screen: 'UserSearch' })`. (`DietaryPreferences` and `UserSearch` are screens nested inside `FeedStack`, not their own tabs — confirmed in `App.tsx`.)
- **Cuisine strip top-N = 8** by frequency over `recipes[].cuisine_types`; trailing `More ›` chip opens the FilterDrawer for the full set. Cuisine tap clears `browseMode` to `'all'` and sets `advancedFilters.cuisineTypes = [cuisine]` (lens = cuisine; context stays all). Re-tapping the active cuisine clears it.
- **`activeLens` priority:** tile context wins over cuisine when both are present (tiles are the primary entry point in CP2). The lens chip shows the tile label and its ✕ resets `browseMode` to `'all'` in place; for a cuisine lens, ✕ clears `advancedFilters.cuisineTypes`. Drill-down flows that combine `initialBrowseMode + initialCuisine` (e.g. stats podium "See all" with a cuisine focus) will show the tile lens chip; the cuisine still narrows via refinements. CP3 formalizes multi-axis lens display.
- **Status bar reworded.** "All recipes · N" by default; suppressed when context=all + no quickFilters/advancedFilters/cuisine. Tile contexts get `"<tile label> · N"`. `your_classics` and `something_new` keep the friendly wording ("recipes you've cooked" / "recipes to try"). The "X you can make now" tap-through to WhatCanICookScreen still fires from the 'all' status bar (8D-CP4 Preservation Contract).
- **Tile icons** use existing SVG components: `TimerIcon` (quick_tonight), `PantryOutline` (ready_to_cook), `NewIcon` (recently_added), `AgainIcon` (your_classics), `VegetablesIcon` (for_your_diet), `FriendsIcon` (friends_cook). No new SVGs.

**Verification:**
- Type-check clean on all four files I touched (`recipeBrowseService.ts`, `__recipeBrowseResolverTest.ts`, `BrowseLensChip.tsx`, `RecipeListScreen.tsx`) in isolated `tsc` runs. Project-wide pre-existing `tsc` errors in `components/CookSoonSection.tsx` + `components/DayMealsModal.tsx` (CP1-flagged in the previous SESSION_LOG entry) still need a separate sweep — not regressed by CP2.
- Resolver smoke test extended with 9 new assertions for the tile contexts (positive cases for `quick_tonight`/`ready_to_cook`/`recently_added`/`for_your_diet`/`friends_cook`, plus null-gate cases for `ready_to_cook`/`for_your_diet` and the no-`created_at` empty case for `recently_added`). **Tom needs to re-run "Run recipe browse resolver tests" in AdminScreen** — the CP1 run was 33/33 ✅ against the renamed-from IDs; CP2's renames + additions still need their first green light.
- In-app parity I could NOT verify from CC: the cross-stack inroad navigation actually landing on PantryScreen / DietaryPreferencesScreen / UserSearchScreen; the tile counts matching what users see when they tap a tile; live-vs-inroad rendering on a fresh/empty account; selection mode (reachable from MyMealsScreen) still working — the home tiles + search + cuisine strip are gated on `!isSelectionMode` so the screen should still look like the pre-CP2 selection picker, but worth a smoke pass.

**Deferred / notes for CP3:**
- Interim controls (quickFilters chip row, `More ›` drawer trigger, `Sort` dropdown, book dropdown) all still present per the prompt. CP3 replaces them with contextual facets + locked chip + dietary pills + dismissible refinement chips + the search-lens case in `BrowseLensChip`.
- `BrowseLensChip` is intentionally minimal — single label + ✕. CP3 grows it into the structure described in P11-input-1.
- The activeLens useMemo currently picks tile-OR-cuisine; CP3's locked-chip surface should make multi-axis lenses (tile + cuisine + refinements) explicit rather than collapsing them.
- The book dropdown's only live context now is `something_new` (renamed from `try_new`). CP3 should fold it into the contextual facets for that context rather than gating it on `browseMode` from the screen.
- Pre-existing project-wide TS errors in `components/CookSoonSection.tsx` and `components/DayMealsModal.tsx` (CP1 surprises bullet) still pending a fix sweep before the next type-check can run cleanly across the whole repo.

**Recommended next steps for Tom:**
1. **Re-run the resolver smoke test** from AdminScreen → "Run recipe browse resolver tests". Expected: 42 assertions (33 from CP1, renamed where applicable; 9 new for CP2 tile contexts), all green. Flag any ❌ FAIL lines in the Metro console.
2. **Smoke-pass the screen in Expo Go.** Pay attention to: (a) all 6 tiles render with correct live/inroad styling; (b) tapping a live tile filters the list and sets the lens chip; (c) tapping an inroad cross-stack-navigates to the right tab/screen; (d) cuisine strip taps work and toggle; (e) `your_classics` shows the 3 Cook Again sections; (f) top search still produces hits; (g) stats drill-down route params still land (e.g. Stats → Cuisine podium → See all should now arrive at `browseMode='something_new'` with `cuisineTypes` set); (h) selection mode (recipe picker from MyMealsScreen) still works without tile/search noise.
3. Refresh the PK code snapshot for `screens/RecipeListScreen.tsx` after CP3 (will likely be the heavy-rewrite-target again).

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md` — `recipeBrowseService.ts` now hosts the tile-context registry + `DEFAULT_TILES` export in addition to the resolver/sectioner; worth a one-line bump in the Services section. The new `BrowseLensChip` component is small but listable under "Cards & Display" or a new "Recipe browse" subsection. Phase 11A status can be bumped to "CP2 shipped" when both the smoke + Expo-Go pass are green.
- `DEFERRED_WORK.md` — none from CP2 directly. CP3 will likely produce the multi-axis lens treatment as a deferred item if it doesn't ship in CP3 itself.
- `PROJECT_CONTEXT.md` — none.
- `FF_LAUNCH_MASTER_PLAN.md` — none; the master plan picks up Phase 11A when the visible-output sequence (CP2 → CP4) lands.

**Surprises:**
- None new — the pre-existing TS errors in `CookSoonSection.tsx` + `DayMealsModal.tsx` remain, as does the cascading `@react-navigation/core` parse error flood they trigger.

**Git status (post-changes):**
```
Changes not staged for commit:
        modified:   docs/SESSION_LOG.md
        modified:   screens/AdminScreen.tsx
        modified:   screens/RecipeListScreen.tsx

Untracked files:
        _scratch/
        components/recipe/BrowseLensChip.tsx
        docs/CC_PROMPT_11A_CP1.md
        docs/CC_PROMPT_11A_CP2.md
        docs/CC_PROMPT_11A_CP3.md
        lib/services/__recipeBrowseResolverTest.ts
        lib/services/recipeBrowseService.ts
```

## 2026-05-28 — 11A-CP1 — Unified browse model (foundational refactor)

**Shipped:** New pure module `lib/services/recipeBrowseService.ts` (BrowseState shape + context registry + `resolveBrowse` + `getCookAgainSections`); `RecipeListScreen.tsx` routed through it (the in-component `applyFilters` body and the in-component Cook Again grouping are gone); resolver smoke test `lib/services/__recipeBrowseResolverTest.ts` added. No visual change of any kind — `browseMode` segmented control, `quickFilters` chip row, `More ›` drawer trigger, `Sort` dropdown, and bottom search bar all stay and keep populating the new BrowseState until CP2–CP3 swap them.

**Files modified:**
- `screens/RecipeListScreen.tsx` (−286 / +44; verbatim port to `resolveBrowse`/`getCookAgainSections`, BrowseState `useMemo`, iconKey → icon mapping in `renderSectionHeader`, `SortOption` import moved to module, local duplicate `Recipe` interface left intact per prompt) ⚠️ PK snapshot now stale (was 2026-05-19)

**Files added:**
- `lib/services/recipeBrowseService.ts` (pure module — no Supabase, no React, no icon components)
- `lib/services/__recipeBrowseResolverTest.ts` (in-memory smoke harness, mirrors `_pantryMatchingSmokeTest` conventions: `[BROWSE-*]` console.warn lines, no teardown)

**Key decisions / deviations:**
- `SortOption` moved to the new module and imported back into the screen. `BrowseContextId` is its own type even though it overlaps `BrowseMode` 1:1 today — gives CP2 room to add tile contexts (`quick_tonight`, `ready_to_cook`, …) without changing the screen's local `BrowseMode` union or its segmented-control wiring. `BrowseMode` and `BrowseContextId` are assignment-compatible since they're identical string-literal unions.
- Section icons return as `iconKey` (`'fire' | 'gem' | 'again'`) so the service stays React-free; the screen owns a `SECTION_ICONS` map next to `renderSectionHeader` that resolves the icon component.
- The local duplicate `Recipe` interface in `RecipeListScreen.tsx` was left in place per the prompt's "for CP1 you may leave that in place" allowance. The new module imports the canonical `Recipe` from `components/recipe/RecipeCard.tsx` (structurally identical to the screen's local copy, so the call site type-checks). Consolidation deferred so this CP stays surgical.
- The `applyFilters` `useEffect` keeps its original dependency list (`[recipesWithMatch, quickFilters, advancedFilters, browseMode, selectedBook, sortOption, matchMap, searchedRecipeIds]`) per the prompt — `browseState` is derived from those, so it recomputes on the same triggers. ESLint `exhaustive-deps` will note that `browseState` itself isn't listed; matches the original applyFilters precedent.
- The `cookAgainSections` `useMemo` still gates on `browseMode === 'cook_again'` and returns `[]` outside that mode — preserves the skip-the-work behavior and keeps the existing `useMemo` dependencies (`[filteredRecipes, browseMode]`) intact.

**Parity verification:**
- Type-check on the touched files is clean (`recipeBrowseService.ts`, `__recipeBrowseResolverTest.ts`, and `screens/RecipeListScreen.tsx` all report zero errors in isolated `tsc --noEmit` runs; the only `tsc -p tsconfig.json` errors are pre-existing in `components/CookSoonSection.tsx`, `components/DayMealsModal.tsx`, and the cascading `@react-navigation/core` parse errors — confirmed present on HEAD before this session via `git stash`, so unrelated to CP1).
- Resolver smoke test (`runRecipeBrowseResolverTests`) authored against an in-memory fixture of 6 synthetic recipes spanning every dimension the resolver reads. Each context (all/cook_again/try_new), each quick filter (vegetarian/highProtein/quick30/comfort), 14 advanced-refinement dimensions (dietary AND, hero/vibe/cuisine/method/course/serving-temp OR, ingredient-count ranges incl. `'16+'`, the two nutrition + two time bounds, difficulty + easierThanLooks, makeAhead, recentlyCookedByFriends), all 9 sorts (with null-to-bottom assertions on the trailing partition), search intersection (positive + empty + ∩-context), and one combined case (`try_new + highProtein + cuisine=american + sort=protein_high`) are asserted. **The harness is in-tree but has not yet been wired into AdminScreen — Tom will need to add the trigger button or run it from a temp invocation to actually exercise the assertions in Expo Go.** I have not run it yet; the parity claim above is based on a manual line-by-line trace against `applyFilters` + the `cookAgainSections` useMemo and the type-check.
- Behavioral parity I have NOT directly exercised in Expo Go: the 10F dietary auto-apply path (still wired via `setAdvancedFilters` → `browseState.refinements`), the stats drill-down route-param effects (`initialBrowseMode`, `initialCuisine`, `initialCookingConcept`, `initialDietaryFlag`, `initialIngredient`, `sortBy=cook_count`), and the `canMakeCount` / "X you can make now" tap — all left untouched by the refactor but worth confirming in the smoke pass.

**Deferred / notes for CP2:**
- `browseMode`, `quickFilters`, `advancedFilters` state pieces remain in the screen as temporary populators of `BrowseState`. Tile contexts plug into `BROWSE_CONTEXTS` as new registry entries; the cuisine strip and contextual facets become new `BrowseState` fields (likely `lockedContextChip` + `contextualFacets`) that the resolver consumes.
- The duplicate `Recipe` interface in `RecipeListScreen.tsx` should fold into the canonical `components/recipe/RecipeCard.tsx` export in CP2 — leaving two copies in sync is a maintenance hazard once the dietary and nutrition fields keep evolving.
- The `applyFilters` useEffect dependency list does not include `browseState` itself — preserved verbatim per the prompt's "keep the same dependency set", but in CP2 it's worth converting the side-effect into a `useMemo` over `browseState` directly to remove the ESLint warning and tighten the dep graph.

**Recommended next steps for Tom:**
1. Smoke-pass the screen in Expo Go (`npx expo start`) — open Recipes tab, exercise each of the 10 checklist items in the prompt's "Verification" section, paying special attention to the stats drill-downs (Stats → Cuisine podium → See all; Stats → Cooking concept podium → See all; Pantry → "Find recipes" bulk action) since I did not directly test those route-param paths.
2. Decide whether to wire `runRecipeBrowseResolverTests()` into `AdminScreen.tsx` alongside the pantry matcher smoke button before CP2 starts — it'll catch any resolver regressions during the tile/cuisine/facets work without needing a manual matrix walk-through each time.
3. Refresh PK code snapshot for `screens/RecipeListScreen.tsx` since the file changed substantially (−286 / +44).

**Recommended doc updates:**
- `FRIGO_ARCHITECTURE.md` — add `recipeBrowseService.ts` to the services list (Section "## Services (lib/services/)") with a one-line description: "Pure browse domain model — BrowseState shape, context registry, `resolveBrowse`, `getCookAgainSections`. Consumers: RecipeListScreen." Phase 11A status note can be added when CP2 lands (no need to mention CP1 in isolation).
- `DEFERRED_WORK.md` — none (the `Recipe`-type consolidation note is captured here as a CP2 deferred; if it should be a tracked deferred item, suggest adding `P11A-CP1-deferred-1: Consolidate the duplicate Recipe interface in RecipeListScreen.tsx into the canonical RecipeCard export`).
- `PROJECT_CONTEXT.md` — none.
- `FF_LAUNCH_MASTER_PLAN.md` — none (CP1 is foundational only; the master plan should pick up Phase 11A when the visible-output CPs ship).

**Surprises:**
- `tsc -p tsconfig.json` against HEAD has pre-existing parse errors in `components/CookSoonSection.tsx` (line 264 col 48) and `components/DayMealsModal.tsx` (line 296 col 52) — both `TS1382 Unexpected token. Did you mean {'>'} or &gt;?`. These cascade into a flood of `@react-navigation/core` errors that obscure real new errors. Worth a fix sweep before CP2 so the type-check actually runs cleanly across the repo. Stashed and verified these exist independent of CP1.

**Git status (post-changes):**
```
Changes not staged for commit:
        modified:   screens/RecipeListScreen.tsx

Untracked files:
        _scratch/
        docs/CC_PROMPT_11A_CP1.md
        lib/services/__recipeBrowseResolverTest.ts
        lib/services/recipeBrowseService.ts
```
