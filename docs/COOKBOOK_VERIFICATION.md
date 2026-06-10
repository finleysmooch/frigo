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

## Caveats / deferred

- **Partial OB-2 only.** This is a verification reviewer gate, **not** a general admin/roles system.
  The existing `AdminScreen` dev panel remains unguarded (out of scope here); a real admin-auth
  primitive is still deferred (see `DEFERRED_WORK.md`).
- **AI review is out.** The portal has an empty "AI recommendation" placeholder with no logic; AI
  *recommendation* (never AI approval) is a later phase.
- **Web review portal** is deferred (in-app only for F&F).
- **User-level moderation** (beyond per-submission deny+note) is deferred.
