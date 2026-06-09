# Frigo — Invite Codes
**Created:** 2026-06-09
**Last Updated:** 2026-06-09
**Status:** Backend live (CP2 / #69). T2 onboarding screen that consumes it = CP9.

Onboarding T2 gates entry on an invite code entered **before** account creation. This doc
covers the backend: the tables, the two RPCs, how to **mint** codes for F&F, and the known
security trade-offs.

---

## Architecture (why it looks the way it does)

- **`invite_codes`** — the codes. Code is stored normalized (a `BEFORE INSERT/UPDATE` trigger
  applies `upper(btrim(code))`), so matching is case/whitespace-insensitive.
- **`invite_code_redemptions`** — lean attribution: one row per `(code_id, user_id)`. Lets CP7's
  seeded graph know which code a tester entered on.
- **Both tables are locked down.** RLS is enabled with **no policies**, and table privileges are
  revoked from `anon`/`authenticated`. They are reachable **only** through two `SECURITY DEFINER`
  RPCs:
  - **`validate_invite_code(p_code text) → text`** — anon-callable (pre-account). Returns a status
    string only (`valid` | `invalid` | `expired` | `redeemed`), never the row. No mutation.
  - **`redeem_invite_code(p_code text) → boolean`** — authenticated only. Atomic, race-safe,
    idempotent per user (re-calling returns `true` without burning a second use).
- App code calls these via `lib/services/inviteCodeService.ts` (`validateCode` / `redeemCode`) —
  never Supabase directly.

Migrations: `supabase/migrations/20260609183710_invite_codes.sql` (+
`20260609184359_invite_codes_restrict_redeem_to_authenticated.sql`).

---

## ⚠️ Minting is SQL-editor only (no in-app generation)

There is **no admin-auth primitive** in the app yet (AdminScreen is an unguarded dev screen;
`user_profiles` has no `is_admin`/role column — see DEFERRED_WORK). So invite codes are minted by
running SQL in the **Supabase SQL editor** (which runs as a privileged role that bypasses RLS).
In-app generation is deferred until a real admin gate exists.

### Mint a batch for F&F

Paste into the Supabase SQL editor. Adjust the count, `max_uses`, `expires_at`, and `note`:

```sql
INSERT INTO public.invite_codes (code, max_uses, expires_at, note)
SELECT
  'FRIGO-' || upper(substr(md5(random()::text), 1, 8)),  -- random 8-hex code
  1,                                                      -- max_uses per code (NULL = unlimited)
  now() + interval '90 days',                             -- expires_at (NULL = never)
  'F&F batch ' || to_char(now(), 'YYYY-MM-DD')            -- note (for grouping/cleanup)
FROM generate_series(1, 25)                               -- how many codes to mint
RETURNING code, max_uses, expires_at;
```

(The `RETURNING` prints the minted codes so you can hand them out. If a rare random collision
aborts the batch on the `UNIQUE(code)` constraint, just re-run it.)

### Mint a single, memorable code

```sql
INSERT INTO public.invite_codes (code, max_uses, expires_at, note)
VALUES ('FAMILY2026', 10, now() + interval '180 days', 'shared family code')
RETURNING code;
```

### List / inspect codes

```sql
SELECT code, max_uses, uses_count, is_active, expires_at, note, created_at
FROM public.invite_codes
ORDER BY created_at DESC;
```

### Deactivate a code (without deleting attribution)

```sql
UPDATE public.invite_codes SET is_active = false WHERE code = 'FRIGO-XXXXXXXX';
```

---

## Security trade-off (tracked in DEFERRED_WORK)

`validate_invite_code` is an **anon-callable `SECURITY DEFINER`** function on production — a
deliberate widening of the anon surface, because a pre-auth code gate is unavoidable. Boundary:
it returns a **status string only** (no table exposure, no mutation). If abuse appears
(enumeration, brute force), revisit with rate-limiting / captcha. See DEFERRED_WORK.

---

## Notes for CP9 (the T2 screen)

- Call `validateCode(code)` before account creation; only `'valid'` proceeds.
- Call `redeemCode(code)` **after** the account is created/authenticated. It is best-effort: if it
  returns `false` due to a race, surface a message — do **not** delete/orphan the already-created
  account over a code race.
