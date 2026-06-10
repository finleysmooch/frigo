# Cookbook Ownership Verification — Ops & Architecture

**Created:** 2026-06-10
**Last Updated:** 2026-06-10
**Owner topic:** O1 verify-first cookbook delivery — the verification half (CP6a-1 + CP6a-2). Delivery is CP6b.

Verify-first: a user must prove they own a physical cookbook before its transcribed recipes are
delivered into their account. Proof = a photo of the **book together with a handwritten note showing
that day's date**. This doc covers the two shipped halves and how to operate them; **CP6b (delivery)
is not built yet** — the seam is defined at the bottom.

---

## The two halves

| Half | What | Tier | Migration |
|------|------|------|-----------|
| **CP6a-1** | `book_ownership_verifications` table + private `verification-images` bucket + `submitVerification`/`getMy*` + capture component | checkpoint (shipped + pushed) | `20260610165737_cp6a1_book_ownership_verifications` |
| **CP6a-2** | admin gate (`app_admins`), trusted allowlist, `is_admin()`, review RPCs, server-side auto-grant, gated review portal, admin bucket-read-all, CP6b seam | gated (Tom pushes) | `20260610173954_cp6a2_verification_admin_review` |

`book_ownership_verifications` is the **sole source of verification status**. The legacy
`user_books.ownership_*` columns are retained but NOT read as truth (consolidation deferred —
see `DEFERRED_WORK.md`).

---

## Security model (CP6a-2)

- **Allowlist tables are fully locked.** `app_admins` and `trusted_verification_users` have RLS on,
  **zero policies**, and client `GRANT`s revoked — no client (not even an admin) can `SELECT` or
  write them. They are populated only by the manual service-role SQL below and read only inside
  SECURITY DEFINER functions (which run as owner and bypass RLS).
- **One admin predicate.** `public.is_admin()` (SECURITY DEFINER, `auth.uid() IN app_admins`) is used
  by every admin check — the review RPCs and the admin storage policy — so the roster never has to be
  client-readable.
- **Privileged writes only via definer RPCs**, each anon-EXECUTE-locked (REVOKE PUBLIC + anon, GRANT
  authenticated) per `MIGRATIONS.md`:
  - `submit_verification(p_book_id, p_proof_path)` — evaluates trusted-allowlist membership
    **server-side**; trusted → auto `verified` (`auto_granted=true`, audit kept), else `pending`. The
    client cannot claim trust (and CP6a-1's RLS still blocks any direct client write of `verified`).
  - `list_pending_verifications()` — `is_admin()`-gated; returns rows + proof **paths**.
  - `review_verification(p_id, p_decision, p_note)` — `is_admin()`-gated; approve/reject.
- **Proof images: signed URLs only.** A Postgres function cannot mint a Storage-signed URL, so the
  service (`listPendingVerifications`) mints short-TTL (300s) signed URLs in JS, authorized by the
  admin bucket-read-all policy. Proof images are **never** public.
- **Two-layer portal gate.** `VerificationReviewScreen` checks `is_admin()` to render (UI only); the
  real boundary is the RPC self-checks — a non-admin who reaches the screen still gets a raise.

---

## Operating it (manual SQL — Supabase SQL editor, service-role)

There is no in-app admin management primitive yet (deliberate at F&F scale). Manage both allowlists
with SQL.

**Grant a reviewer (who can approve/deny in the portal):**
```sql
INSERT INTO public.app_admins (user_id)
SELECT id FROM auth.users WHERE email = 'tom@example.com'   -- ← Tom's login email
ON CONFLICT (user_id) DO NOTHING;
```

**Add a trusted user (their submissions auto-approve, skipping the queue):**
```sql
INSERT INTO public.trusted_verification_users (user_id)
SELECT id FROM auth.users WHERE email = 'tester@example.com'
ON CONFLICT (user_id) DO NOTHING;
```

**Revoke either:**
```sql
DELETE FROM public.app_admins WHERE user_id = (SELECT id FROM auth.users WHERE email = 'someone@example.com');
DELETE FROM public.trusted_verification_users WHERE user_id = (SELECT id FROM auth.users WHERE email = 'someone@example.com');
```

Reviewers reach the portal at **Settings → Developer → Verification Review** (the row is hidden for
non-reviewers). Deny optionally records a note — this is the F&F "flag the user"; user-level
moderation is deferred.

---

## Approve → CP6b delivery seam (DEFINED here; BUILT in CP6b)

Approval is **inert** until CP6b: `review_verification(..., 'verified')` sets `status='verified'` and
leaves `delivered_at` **NULL**. No recipes move.

**CP6b's work queue:** `book_ownership_verifications` rows where
```sql
status = 'verified' AND delivered_at IS NULL
```
For each such row, CP6b will:
1. Create the library link via the **existing** `createUserBookOwnership(userId, bookId, …)`.
2. Deep-copy the catalog book's recipes into the user's account as independent, editable rows,
   keeping `book_id` = the **catalog** book id (`books.is_catalog` stays `true`), with provenance
   stamped on each copy.
3. Stamp `delivered_at` so the row leaves the queue (idempotent / re-run safe).

`review_verification` refuses to re-review a row once `delivered_at` is set, so an admin can't strand
already-delivered copies.

---

## CP6b delivery engine — `recipeDeliveryService` (AUTHORED 2026-06-10; gated on Tom's push)

`lib/services/recipeDelivery/recipeDeliveryService.ts` — an **isolated, config-driven** row-level
deep-copier (imports nothing from the extraction path). `deliverVerifiedBook(client, userId, catalogBookId)`:

1. **Seam gate** — only a `status='verified'` + `delivered_at IS NULL` record proceeds.
2. **Link first** — a shape-faithful `user_books` insert (idempotent check-then-insert; inlined rather
   than importing `createUserBookOwnership`, to keep the delivery service isolated from the extraction
   path — see anchor v0.3.7 / DEFERRED OB-7).
3. **Copies** — for each canonical recipe (`book_id`=catalog, `parent_recipe_id IS NULL`), deep-copy the
   recipe row + the **§4.3 ratified copy-set** children (`lib/services/recipeDelivery/copySet.ts`):
   `recipe_ingredients`, `recipe_media`, `recipe_photos` (copy-if-present), `recipe_source_notes`,
   `instruction_sections` + `instruction_steps` (two-level, re-parented). EXCLUDED children are never
   copied (user content, `recipe_references`, user-activity, QA artifacts — see copySet). Per-recipe
   idempotent (a copy already keyed by `parent_recipe_id` is skipped → resume-safe).
   - **Images are (a) references** (§3): `recipes.image_url`, `recipe_media.url`, `recipe_photos.image_url`
     are copied **verbatim** — the copy points at the SAME stored object; **no bytes are rehosted**.
   - **Provenance inherited** (§4.5): `extraction_method`/`extraction_model` come from the canonical row
     (columns → `raw_extraction_data` → `'unknown_legacy'`), **never** the current models.ts value;
     `is_author_authenticated=false`; the `gold_standard_*` family is reset on copies.
4. **`delivered_at` stamped LAST** — only after the full set completes (a crash mid-copy is repaired by a
   re-run; an already-delivered book copies nothing).

**Invocation:** the `deliver-book` edge function (`supabase/functions/deliver-book/`), **async** (not
synchronous in `review_verification` — 100+-recipe books). **Internal-only:** a service-role bearer gate
rejects any non-service-role caller (403); wire it via a DB webhook on `status→verified` or an
admin-portal enqueue after `reviewVerification()`.

### Purge identifiability (row-scoped, delivery-record-keyed)

Every delivered set is identifiable and removable. The predicate keys on the **delivery records**
(`user_id`, catalog `book_id`, lineage ∈ the book's canonical recipes) — **never** `parent_recipe_id IS
NOT NULL` alone. Row-scoped per §3: a purge deletes the delivered **rows**; it **must NOT** delete the
shared stored image objects (they are (a) references). The purge ACTION is a documented **future**
operation — built identifiable, not run now (`recipeDeliveryService.identifyDeliveredSet` returns the set).

```sql
-- Full delivered tree for one delivered (user :U, catalog book :B). Delete children before recipes.
WITH canon AS (SELECT id FROM recipes WHERE book_id = :B AND parent_recipe_id IS NULL),
     delivered AS (SELECT id FROM recipes WHERE user_id = :U AND book_id = :B
                   AND parent_recipe_id IN (SELECT id FROM canon)),
     sections AS (SELECT id FROM instruction_sections WHERE recipe_id IN (SELECT id FROM delivered))
SELECT 'recipes' AS tbl, id FROM delivered
UNION ALL SELECT 'recipe_ingredients', id FROM recipe_ingredients WHERE recipe_id IN (SELECT id FROM delivered)
UNION ALL SELECT 'recipe_media', id FROM recipe_media WHERE recipe_id IN (SELECT id FROM delivered)
UNION ALL SELECT 'recipe_photos', id FROM recipe_photos WHERE recipe_id IN (SELECT id FROM delivered)
UNION ALL SELECT 'recipe_source_notes', id FROM recipe_source_notes WHERE recipe_id IN (SELECT id FROM delivered)
UNION ALL SELECT 'instruction_sections', id FROM sections
UNION ALL SELECT 'instruction_steps', id FROM instruction_steps WHERE section_id IN (SELECT id FROM sections);
```

> **Binding post-push gate:** a fixture smoke through the **real** `recipeDeliveryService` (deliver →
> verify per §4.3 → clean up; real-corpus counts before==after) must PASS **after** `supabase db push`
> of `20260610192408`, **before** CP4b promotes any catalog book or any real-user delivery. The pre-push
> de-risk was a SQL mirror (logic proxy), not the shipped path.

---

## Caveats / deferred

- **Partial OB-2 only.** This is a verification reviewer gate, **not** a general admin/roles system.
  The existing `AdminScreen` dev panel remains unguarded (out of scope here); a real admin-auth
  primitive is still deferred (see `DEFERRED_WORK.md`).
- **AI review is out.** The portal has an empty "AI recommendation" placeholder with no logic; AI
  *recommendation* (never AI approval) is a later phase.
- **Web review portal** is deferred (in-app only for F&F).
- **User-level moderation** (beyond per-submission deny+note) is deferred.
