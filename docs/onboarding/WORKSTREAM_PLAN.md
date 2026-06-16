# Onboarding Front-Half (CP3 + CP9) — Workstream Plan

**Created:** 2026-06-11 · **Updated:** 2026-06-11 (D-ON-9..15 decision batch folded in) · **Owner of this doc:** the onboarding workstream (CC updates the status table at every CP closeout, in the same commit as that CP's SESSION_LOG entry)
**Status of this doc:** ✅ **BUILD SPEC OF RECORD** — ratified by oversight 2026-06-11 (anchor v0.3.9, D-ON-9); the CP3 + CP9a–CP9f slicing is **final**. Scope/decisions of record live in the anchor (`ONBOARDING_AND_COLDSTART_SCOPING.md` v0.3.9). The recovered `docs/ONBOARDING_BUILD_SPEC.md` (v1.0, 2026-06-08, pre-dates anchor v0.3.2) is a **reference input only** — superseded on OAuth (T3), T8b, tier-badge sourcing, and claim-by-email placement; its reconcilable content is harvested into §2 below.
**Inputs:** execution handoff (`docs/onboarding/EXECUTION_HANDOFF_2026-06-11.md`) · anchor v0.3.9 · wireframes v4 · recovered build spec (reference) · live code (§6 confirm-from-code record, 2026-06-11).

---

## 1. CP decomposition (FINAL — D-ON-9) + adjacent ruled CPs

**Naming note:** wireframe screens are `T1…T15` (sub-screens `T8a/c`, `T9a/b/c`); workstream sub-CPs are `CP9a…CP9f`. This doc always writes the `CP`/`T` prefix.

| CP | Screens / surface | One-line scope |
|----|-------------------|----------------|
| **CP3** | T11 | Pantry-staples checklist (D-ON-2); list content = the D-ON-13 21-item **config constant** |
| **CP-persist** | — (migration + App.tsx gate) | `user_profiles.onboarding_completed_at` (D-ON-10) |
| **CP4-ext** | — (service) | `searchBookCatalog` + `has_recipes` boolean (D-ON-12) |
| **CP7-minimal** | T5 share surface + RPC | Per-user pass-on invite codes (D-ON-11 amendment): authed generation RPC (`owner_user_id`, default cap, deactivatable) + "your invite code" in T5 |
| **CP-O2** | contacts-sync flow | GATED, decoupled from T5's ship (D-ON-14); slots in additively |
| **CP9a** | T1–T4 | Spine: Welcome → Invite → Account (**email+password only**, D-ON-15) → Profile + onboarding stack + the D-ON-10 gate wiring |
| **CP9b** | T5 | Find friends: share/QR hero + same-code **cohort suggestions** (D-ON-11) + demoted name search + skip; ships **without** contacts |
| **CP9c** | T6 | Router Q0 |
| **CP9d** | T7–T9 | Recipe path; **T8b snap-shelf OUT of F&F** (D-ON-9 → DEFERRED OB-8); T10 freehand placeholder only |
| **CP9e** | T12 | Social hand-off + the **completion stamp** (D-ON-10) |
| **CP9f** | T13–T15 | Empty states |

**Recommended sequence:**

```
CP-persist + CP4-ext + CP3   (independent; all 🟢 runnable/draftable now)
   → CP9a → CP9c → CP9d → CP9e → CP9f
   → CP7-minimal → CP9b
CP-O2: gated, additive — schedules independently after oversight pre-review
```

- CP-persist precedes CP9a (the gate reads the column). CP4-ext precedes CP9d's T8a badges.
- CP7-minimal precedes CP9b (T5's share surface shows the user's own code; cohort suggestions read redemption attribution).
- CP9f floats — independent of the onboarding stack apart from reusing CP3's component.

---

## 2. Per-CP detail

### CP3 — Pantry staples checklist (T11) · tier: checkpoint · 🟢 draftable now

- **Scope:** standalone staples-checklist component + T11 screen. **Content ruled (D-ON-13, provisional content):** 21 items, 3 categories — Pantry: salt, black pepper, olive oil, neutral oil, AP flour, sugar, rice, pasta, canned tomatoes, chicken/veg stock; Fridge: butter, eggs, milk, garlic, onions, lemons; Condiments: soy sauce, vinegar, mustard, mayo, hot sauce. Default in-stock, tap to deselect, no second tier. **Lives as a CONFIG CONSTANT** — content iterates post-look without rebuild.
- **Reuse:** `suppliesService.createSupply` (`spaceId`, `ingredientId`|`customName`, dedup built in — `lib/services/suppliesService.ts:405`); `searchCatalogIngredients` to resolve list names → ingredient ids; `SpaceContext`.
- **Build:** the component + screen + the config constant. Component is reused by T15 (CP9f) and likely Settings later.
- **Dependencies:** none — first up.
- **⚠️ SPACE-ENSURE (anchor §6):** THE space-scoped write. Design rule: **the component awaits space readiness** (consume `SpaceContext.isInitialized`/`activeSpace`; await the ensure if not initialized) so every mount point is safe by construction. `ensureDefaultSpace` (`spaceService.ts:1004`) is the one path; never invent a second.
- **Verification sketch:** brand-new user (0 `space_members`) → complete T11 → exactly one default space + membership created; 21-item render matches the constant; supplies rows land with right `space_id`/`status='in_stock'`/`added_by`; re-run dedups; skip writes nothing; watch the Metro/Expo terminal during the smoke.

### CP-persist — `onboarding_completed_at` · tier: mechanical · 🟢 runnable now (D-ON-10)

- **Scope:** migration adding `user_profiles.onboarding_completed_at timestamptz` (nullable) **backfilling `now()` on existing profiles** (existing users never see onboarding); App.tsx gate rework: `session ∧ completed → tabs; session ∧ ¬completed → onboarding stack`. **Binary — no mid-spine resume for F&F.**
- **Note:** the gate wiring can land with CP9a if the stack doesn't exist yet at migration time — the migration itself is independently runnable. Deny-list rule: `user_profiles` is not a §4.3 copied table; classify-or-state in the CP anyway.
- **Verification sketch:** post-migration, all existing profiles non-NULL; a fresh signup is NULL until T12; the gate routes each state correctly (new → onboarding; completed → tabs; sign-out/in preserves).

### CP4-ext — `searchBookCatalog.has_recipes` · tier: mechanical · 🟢 runnable now (D-ON-12)

- **Scope:** extend `searchBookCatalog` (`bookService.ts:490`) to return `has_recipes boolean` via an EXISTS subquery (`EXISTS recipes WHERE book_id=X`). T8a tier badges key off `has_recipes` per anchor §4.1 — **never `toc_extracted_at`** (the recovered spec's `toc_extracted_at` derivation is superseded on exactly this point).
- **Verification sketch:** catalog book with recipes → `has_recipes=true`; transcribed-TOC-but-no-recipes book → `false`; non-catalog books still never returned.

### CP7-minimal — per-user pass-on codes · tier: checkpoint (RPC follows the MIGRATIONS.md invocation-auth rule) · scoped (D-ON-11)

- **Scope:** F&F seeding model (D-ON-11): **cluster invite codes** minted per friend group (note names the cluster) are the oversight-side mechanism; this CP builds the promoted per-user piece — authed generation RPC (`owner_user_id` on `invite_codes`, default redemption cap, deactivatable) + a "your invite code" share surface in T5. Attribution tree = owner → code → redemptions (`invite_code_redemptions` already retained for this). **Tree visualization/stats UI → DEFERRED (OB-9).**
- **Reuse:** `inviteCodeService` + the CP2 tables/RPC patterns; INVITE_CODES.md conventions.
- **Dependencies:** none hard; lands before CP9b so T5 ships with the share surface live.
- **Space-ensure note:** no space-scoped writes.
- **Verification sketch:** authed user generates a code (owner stamped, cap applied); anon validate works on it; redemption attributes to the owner; deactivation kills validation; **invocation-auth check pasted per MIGRATIONS.md** (anon cannot generate; RPC surface restricted as ruled).

### CP-O2 — contacts sync · tier: **GATED** · scoped (D-ON-14), decoupled

- **Scope:** O2 resolved — IN F&F scope as its own gated CP, **decoupled from T5's ship** (T5 ships without it; it slots in additively). Build requirements (D-ON-14, all binding): salted-hash ephemeral matching (no raw address-book upload or persistence); **email-only** match (no phone collection — modest match rates accepted); enumeration guard (authed-only, rate-limited, matched-profiles-only response); privacy-policy update + Apple purpose-string/privacy-label drafts ride the CP; zero-match UX folds back to cohort suggestions + share link.
- **Oversight:** pre- and post-review (gated tier); schedules independently of the spine.

### CP9a — Spine T1–T4 · tier: checkpoint · 🟢 unblocked (D-ON-10 + D-ON-15)

- **Scope:** Welcome (T1), invite-code entry (T2), account (T3), profile/avatar (T4), the onboarding stack, and the D-ON-10 gate wiring (if not already landed with CP-persist). **T3 is email+password only (D-ON-15)** — the wireframe's Google/Apple buttons do not ship in F&F; the trigger stays metadata-ready for when S2 builds.
- **Reuse:** `Logo`/theme (T1); `inviteCodeService` (T2 — validate anon/pre-signup, redeem authed/post-signup/idempotent; never redeem-before-account); `SignupScreen` adapted (T3 — carry the invite gate + S1 name fields; proposing `display_name` via `signUp options.data` to retire the 500 ms post-update race); `EditProfileScreen` avatar patterns (T4).
- **Dependencies:** CP-persist (the gate's column).
- **Space-ensure note:** no space-scoped writes in T1–T4.
- **Verification sketch:** invalid/expired/redeemed codes block with correct copy; valid gates through; profile lands `username NULL` + `display_name "First Last"`; redemption attributed post-signup; completed user bypasses onboarding; **binary gate confirmed** — kill mid-spine → restart at T1 (no resume, per D-ON-10); back-nav through the spine.

### CP9b — Find friends (T5) · tier: checkpoint · scoped (D-ON-11 + D-ON-14)

- **Scope:** share-link/QR hero + **"your invite code" share surface** (CP7-minimal) + **cohort suggestions** — same-code cohort, **suggest-and-confirm, never auto-follow** (D-ON-11) — + demoted name search + skip. **Ships without contacts** (D-ON-14 decouples CP-O2; when CP-O2 lands, the Contacts pill slots in additively). The old claim-by-email dependency for seeded rows is superseded: suggestions come from live same-code redemptions, not pre-seeded phantom profiles.
- **Reuse:** `UserSearchScreen` (name search), follow services, CP7-minimal RPC + attribution.
- **Dependencies:** CP9a (stack), CP7-minimal (share surface + cohort data).
- **Space-ensure note:** no space-scoped writes (`follows` is user-scoped).
- **Verification sketch:** two users on the same cluster code see each other suggested; confirm creates a `follows` row, declining doesn't; **no auto-follow anywhere**; own-code share sheet carries the user's code URL; QR renders/scans; zero-cohort state degrades to hero + search without a blank section; skip proceeds.

### CP9c — Router Q0 (T6) · tier: checkpoint

- **Scope:** "How do you cook?" — three cards, pure route-only (D-ON-5). Routes: recipes/both → T7; by-feel → T10 placeholder → T11.
- **Dependencies:** CP9a. Whether the Q0 answer persists as a personalization signal is settled in the CP prompt (user-scoped either way).
- **Space-ensure note:** no space-scoped writes.
- **Verification sketch:** each card routes correctly; by-feel reaches T11 without dead-ending; back preserves selection.

### CP9d — Recipe path T7–T9 · tier: checkpoint · T8b OUT (D-ON-9)

- **Scope:** L1 sources (T7, S4 list), cookbooks **T8a search + T8c verify** (T8b snap-shelf is **out of F&F** → DEFERRED OB-8), value steps T9a/T9b/T9c. Social/video sources route + personalize only.
- **T7 branch map (harvested from recovered spec §4, now confirmed):** **Cookbooks → T8 · web/social (NYT, links, IG/TikTok, YouTube, Reddit, Substack) → T9a paste · "In my head"/Other → no import, personalization signal only.** T9c chefs offered to ALL recipe-path users (S5, not source-gated); T9b signature always-offered (S5). "In my head" alone does NOT bounce to freehand (shelved) — it proceeds to T11/T12.
- **Reuse:** `searchBookCatalog` **with `has_recipes` (CP4-ext)** for T8a badges ("recipes ready"/"title only" keyed per §4.1); `OwnershipVerificationCapture` wired per selected book at T8c (delivery fires downstream via CP6a-2/CP6b — no delivery code here); `AddRecipeFromUrl` + extraction (T9a); `chefs` pick-list (T9c).
- **⚠️ T9b backdating dependency (anchor §7 flag, from recovered spec §5.5):** T9b's "backdated + estimated" profile/Favorites entry depends on post-backdating flags (composer "when" date field + backdated + estimated) **that do not exist**. Per the ruling: **CP9d ships T9b degraded (favorites + times-made, no backdated post) OR picks up a small flags migration — CC reports which at draft time.**
- **Cross-workstream seam:** T8a must degrade gracefully on an empty/sparse catalog (nudge or skip, never a dead-end; never block the spine on CP4-seed/CP4b).
- **Dependencies:** CP9c (routing), CP4-ext (badges).
- **Space-ensure note:** no space-scoped writes identified; standing rule stays in the prompt.
- **Verification sketch:** gating matrix per the branch map (cookbooks-only / web-only / in-my-head-only / mixed); empty-catalog nudge; badges flip on `has_recipes` (a TOC-extracted-no-recipes book must show "title only"); T8c writes one pending verification per book; allowlisted tester auto-approves → CP6b delivers; T9a imports an NYT URL; T9b behaves per the degraded-vs-flags call reported at draft.

### CP9e — Social hand-off (T12) · tier: checkpoint

- **Scope:** convergence screen ("You're all set, {firstName}"; cook-and-post + find-more-friends nudges; "Go to Frigo") + **the D-ON-10 completion stamp: `onboarding_completed_at = now()` written at T12 completion.**
- **Dependencies:** CP9a (+CP-persist).
- **Space-ensure note:** no space-scoped writes (the stamp is user-scoped).
- **Verification sketch:** name interpolates; both cards navigate; "Go to Frigo" lands on tabs; the stamp is written exactly once at completion; restart post-stamp bypasses onboarding (closes the binary-gate loop).

### CP9f — Empty states T13–T15 · tier: checkpoint · floatable

- **Scope (T13 detail harvested from recovered spec §4):** **T13a no-follows** — lead CTA "Find your friends", secondary "Post a cook". **T13b following-but-quiet** (the common first-wave state) — lead "Post a cook", then "Find more friends", then a soft "Browse recipes" escape. `FeedScreen` must distinguish zero-follows from follows-but-no-recent-posts **and not flash the nudge during the ~1–2 s refresh window.** **T14** — add-first, not browse: the three `AddRecipeModal` rails promoted inline. **T15** — sous-chef framing; "Add staples" (→ CP3 component) + "Add one item" + What-Can-I-Cook teaser + **"Start a grocery list" exit → `ViewsScreen`/create-view (8R lists/views model)** — the second productive exit for someone not ready to seed the pantry; iterate later: live WCIC count once staples exist.
- **Dependencies:** CP3 (T15 reuses the component).
- **⚠️ SPACE-ENSURE:** T15 "Add staples" → covered by construction via CP3's component owning the ensure; re-verify here with a no-space user.
- **Verification sketch:** zero-data account shows each state (the anchor's #1 drop-off risk — test at real zero data); T13a vs T13b copy switches on follow count; no nudge-flash during refresh; T14 rails open the right flows; T15 staples on a no-space user creates space + supplies; grocery exit reaches create-view.

---

## 3. The load-bearing constraint — space-ensure (anchor §6) — confirmed from live code

- `handle_new_user` creates **no Space** (CP5 finding; `20260610003320` comments it).
- **The one path:** `ensureDefaultSpace(userId): Promise<string>` — `lib/services/spaceService.ts:1004`; idempotent membership check, then the lazy-create RPC. **⚠️ FOUND BROKEN 2026-06-12 (CP3 gate test):** the service calls `create_default_space_for_user`, which **does not exist on prod** (PGRST202); the live function is **`create_default_home_space(p_user_id)`** (baseline-confirmed: Home space + owner membership + settings + active space). Worse, the service ignores the rpc `error` and silently returns null — so new users get NO space and space-scoped writes fail. Corrective (rename + error-throw) proposed, awaiting green-light; until it lands, every space-scoped CP is blocked at its gate test.
- **Wiring:** `SpaceContext.loadSpaces()` calls it post-SIGNED_IN (`contexts/SpaceContext.tsx:128`) — async, so a fast post-signup flow can race it. Resolution: CP3's component awaits space readiness (§2). **Ordering: space-ensure BEFORE the first space-scoped write — in every CP prompt and test plan that touches `supplies` or any space-scoped table.**

---

## 4. Status table — the workstream's state of record

Every CP closeout updates this table **in the same commit as its SESSION_LOG entry** (log-before-close).

| CP | Screens/surface | Tier | Status | Blocked on |
|----|-----------------|------|--------|------------|
| CP3 | T11 | checkpoint | ✅ **CLOSED 2026-06-12** — committed + pushed (`fc7e240`); gate test PASS 9/9 (incl. the v0.3.10 §6 spaceService corrective); Tom's live look done ("staples playground functions"; Metro session clean, zero CP3 errors). D-ON-13 content stays open for config-only iteration. Component ready for T11 (CP9 wiring) + T15 (CP9f) reuse — D-ON-16 branch lands in those hosts | — |
| CP-persist | migration + gate | mechanical | ✅ **shipped + prod-verified 2026-06-12** (migration `20260611235055` pushed; backfill 37/37, fresh-profile NULL check PASS; App.tsx gate ships with CP9a as ruled) | — |
| CP4-ext | service | mechanical | ✅ **shipped + prod-verified 2026-06-12** (migration `20260611235555` pushed; fixture smoke PASS incl. anon-denial; SECURITY DEFINER grounding flagged in SESSION_LOG) | — |
| CP7-minimal | RPC + share surface (interim on T12) | checkpoint (invocation-auth rule) | ✅ **SHIPPED + prod-verified 2026-06-12** (migration `20260612180000`; harness 10/10 incl. the D-ON-17 hook end-to-end; cap=5 flagged for content review; share surface relocates to T5 with CP9b) | — |
| CP-O2 | contacts sync | **GATED** | scoped (D-ON-14); decoupled from T5/spine | oversight pre-review |
| CP9a | T1–T4 | checkpoint | ⏳ **authored + backend-verified 2026-06-12** (harness PASS 10/10: validate→metadata-signup→redeem→gate→stamp, all real services). Flags: INTERIM stamp at T4 until CP9e moves it to T12; T4 photo capture deferred (no avatars bucket + emoji-glyph avatar system — oversight ruling needed); gate fails OPEN on read error. Awaiting Tom: in-app walk (needs a minted code) + commit | Tom look + commit |
| CP9b | T5 | checkpoint | ✅ **SHIPPED 2026-06-16** (committed + pushed; harness 6/6). Find Friends: share hero (relocated invite-code surface), name search + follow, Continue/Skip; inserted Profile→FindFriends→Router. **Cohort "Suggested" section deferred** — needs `get_invite_cohort` RPC (OB-22, small migration; section hidden until then). QR/Contacts deferred. | — |
| CP9c | T6 (+T10 placeholder, +T11 hosting w/ D-ON-16 branch) | checkpoint | ⏳ **authored 2026-06-12** — spine walkable T1→T12; D-ON-16 join branch UI in, data path **blocked on CP-spaces** | Tom look + commit |
| CP-spaces | — (corrective migration) | **GATED** | ✅ **SHIPPED + prod-verified 2026-06-12** (migration `20260612170500` pushed post-review with the D-ON-18 self-or-service guard; gate PASS: spouse harness 9/9 — checks 2–4 flipped — + denial probes 5/5). Shared Pantries invite flow live for the first time; **D-ON-16 join branch LIVE** | — |
| CP9d | T7–T9 | checkpoint | ✅ **shipped + UX-iterated 2026-06-16** (committed; spine walkable end-to-end, Tom-walked). Backend harness 5/5. Notes: **T9b Signature HIDDEN** (OB-16; recipe-path routes past it to Staples); **T9c held** (no chef-follow mechanism — needs ruling); T8a empty-catalog nudge live (real books pending CP4-seed); T9a paste = background import queue. UX polish: cookbook search/verify continuity, batch-submit verify, CameraIcon, dev fast-path. O1 signature amendment flagged | — |
| CP9e | T12 | checkpoint | ⏳ **authored 2026-06-12** — stamp moved T4→T12 (D-ON-10 satisfied; harness checks 7/8 PASS); card deep-targeting deferred to CP9b/CP9f | Tom look + commit |
| CP9f | T13–T15 | checkpoint | 🟡 floatable | CP3 |

Legend: 🟢 unblocked/runnable · 🟡 sequenced behind a predecessor · ⏳ in build · ✅ shipped per its tier's bar.

---

## 5. Decision register — RULED 2026-06-11 (anchor v0.3.9; full text in anchor §2)

The planning session's D1–D7 oversight items are all ruled. Anchor §2 is canonical; this maps them:

| Plan item | Ruling | Effect here |
|-----------|--------|-------------|
| D1 missing build spec | **D-ON-9** — this plan ratified spec-of-record; 9a–9f final; recovered spec = reference input; **T8b OUT of F&F → DEFERRED (OB-8)** | Banner removed; T8b dropped from CP9d |
| D2 new-user detection / completion | **D-ON-10** — `user_profiles.onboarding_completed_at` (Option A), backfill `now()`; stamp at T12; binary App.tsx gate, no mid-spine resume | New CP-persist; CP9a/CP9e unblocked |
| D3 seeded graph / CP7 | **D-ON-11** — cluster codes + cohort suggestions (suggest-and-confirm, never auto-follow); AMENDED: per-user pass-on codes promoted into F&F as **CP7-minimal**; tree viz/stats UI → DEFERRED (OB-9) | New CP7-minimal; CP9b rescoped to the cohort model; claim-by-email dependency superseded |
| D4 T8a tier signal | **D-ON-12** — `has_recipes` EXISTS boolean on `searchBookCatalog`; badges never key off `toc_extracted_at` | New CP4-ext; CP9d badge gap closed |
| D5 staples content | **D-ON-13** (provisional content) — the 21-item / 3-category list as a config constant | CP3 draftable |
| D6 contacts sync | **D-ON-14** (O2 resolved) — in F&F scope, own GATED CP, decoupled from T5's ship; salted-hash ephemeral email-only matching + enumeration guard + privacy artifacts ride the CP | New CP-O2; CP9b ships without it |
| D7 OAuth on T3 | **D-ON-15** — email+password only in F&F; wireframe OAuth buttons do not ship | CP9a scope confirmed |

**Open items for oversight: none new.** The one in-flight report-back: CP9d's T9b **degraded-vs-flags-migration** call, owed from CC at CP9d draft time (anchor §7 flag).

---

## 6. Confirm-from-code record (live repo, 2026-06-11 — unchanged from the planning session)

| Surface | Confirmed |
|---------|-----------|
| `spaceService.ensureDefaultSpace` | `lib/services/spaceService.ts:1004` — `(userId) => Promise<string>`; idempotent; → **`create_default_home_space(p_user_id)`** RPC (name corrected 2026-06-12, anchor v0.3.10 §6 — the originally-recorded `create_default_space_for_user` never existed on prod) |
| `SpaceContext` | `contexts/SpaceContext.tsx:90-149` — SIGNED_IN listener → `loadSpaces()` → `ensureDefaultSpace`; exposes `isInitialized`, `activeSpace`; mounts only in the session branch |
| `App.tsx` | `App.tsx:919-993` — binary `session ?` gate; **no new-user/onboarding mechanism** (now addressed by D-ON-10/CP-persist); `AuthStackNavigator` local Login/Signup toggle (`App.tsx:312-340`) |
| `SignupScreen` | `screens/SignupScreen.tsx` — first/last/email/password; no invite gate; `signUp()` without metadata + 500 ms sleep + `display_name` post-update (`:104-123`) |
| `inviteCodeService` | `lib/services/inviteCodeService.ts` — `validateCode` anon/status-only; `redeemCode` authed/idempotent/best-effort; no in-app generation (CP7-minimal adds the authed RPC) |
| `searchBookCatalog` | `lib/services/recipeExtraction/bookService.ts:490` — `is_catalog=true` only; no recipes-exist signal yet (CP4-ext adds `has_recipes`) |
| CP6a-1 capture/submit | `components/OwnershipVerificationCapture.tsx` — built, standalone, unwired by design; per-book props; T8c is the wiring point |
| `suppliesService` | `lib/services/suppliesService.ts:405` — `createSupply({spaceId, …})`; status guard; dedup; `searchCatalogIngredients` available |

**Recovered-spec divergences (recorded; anchor wins on all):** spec T3 ships OAuth (superseded — D-ON-15); spec S3/§5.4 derives recipes-available from `toc_extracted_at` (superseded — anchor §4.1 + D-ON-12); spec T8b snap-shelf in scope (superseded — D-ON-9 → OB-8); spec T5 seeded rows depend on claim-by-email (superseded — D-ON-11 cohort model); spec §6 build order rows 1–5 already shipped as CP1/CP2/CP4/CP5 (anchor §7 is the live status).
