# Onboarding Front-Half (CP3 + CP9) — Workstream Plan

**Created:** 2026-06-11 · **Owner of this doc:** the onboarding workstream (CC updates the status table at every CP closeout, in the same commit as that CP's SESSION_LOG entry)
**Status of this doc:** PLANNING — no app code or migrations authored yet. This doc is the workstream's **state of record**.
**Inputs read (this session, 2026-06-11):** `docs/onboarding/EXECUTION_HANDOFF_2026-06-11.md` · anchor `ONBOARDING_AND_COLDSTART_SCOPING.md` **v0.3.8** (version gate passed) · wireframes v4 (`docs/wireframes/frigo_onboarding_coldstart_wireframes_v4.html`) · live code (see §6 confirm-from-code record).

> ## ⚠️ PROVISIONAL — `ONBOARDING_BUILD_SPEC.md` IS MISSING FROM THE REPO
> The handoff and the anchor both name `ONBOARDING_BUILD_SPEC.md` §4 as the **authoritative screen-by-screen build order** ("repo-only — read it from the repo"). It does **not exist**: not on disk anywhere in the working tree (including `_scratch/`, `_pk_sync/`), and **never committed** (`git log --all` over `*BUILD_SPEC*` is empty). The mandated reconciliation of the handoff's CP9 seams against build-spec §4 **could not be performed.** The decomposition below therefore adopts the handoff §2 proposal **provisionally** and is flagged as DECISIONS-FOR-OVERSIGHT **D1**. No CP9 sub-CP should be drafted-for-build until oversight either supplies the spec or ratifies this slicing as the spec.

---

## 1. CP decomposition (provisional — handoff §2 seams; spec slicing wins when it appears)

**Naming note:** wireframe screens are `T1…T15` (with sub-screens `T8a/b/c`, `T9a/b/c`); workstream sub-CPs are `CP9a…CP9f`. The collision between sub-CP `CP9a` and sub-screen `T9a` is unfortunate but inherited — this doc always writes the `CP`/`T` prefix.

| Sub-CP | Screens | One-line scope |
|--------|---------|----------------|
| **CP3** | T11 | Pantry-staples checklist (D-ON-2), standalone component reused by T15 |
| **CP9a** | T1–T4 | Spine: Welcome → Invite code → Account → Profile/avatar + the onboarding stack mount + new-user routing |
| **CP9b** | T5 | Find friends (share/QR/contacts hero, suggested/seeded, demoted name search, skip) |
| **CP9c** | T6 | Router Q0 ("How do you cook?") |
| **CP9d** | T7–T9 | Recipe path: sources checklist (T7), cookbooks T8a/b/c, value steps T9a/b/c; T10 freehand = placeholder only (S6) |
| **CP9e** | T12 | Social hand-off |
| **CP9f** | T13–T15 | Empty states: feed ×2, recipes, pantry |

**CP3 placement: FIRST.** Recommended per the handoff and adopted here: it is the smallest slice, fully self-contained, and exercises the space-ensure path (§3 below) exactly once before any other CP depends on that discipline. It also produces the component T15 (CP9f) reuses.

**Recommended sequence** (rulings permitting — see blocked-on column in §4):

```
CP3 → CP9a → CP9c → CP9d → CP9e → CP9f → CP9b
```

- CP9a precedes everything else in CP9 (the stack the other screens mount into) but is **blocked on D2** (new-user detection) — relay D2 immediately.
- CP9b runs **last** because it carries two open rulings (D3 seeded graph, D6 contact sync); its non-seeded pieces (share link/QR/search/skip) could be pulled earlier if rulings lag.
- CP9f is largely independent of the onboarding stack (it edits main-app surfaces) and can float earlier if a CP9a ruling stalls the spine.
- T10 (freehand) is shelved (S6) — a placeholder ships inside CP9c/CP9d routing, not its own CP.

---

## 2. Per-CP detail

### CP3 — Pantry staples checklist (T11) · tier: checkpoint

- **Scope:** A standalone staples-checklist component + the T11 onboarding screen wrapping it. Curated ~20 ingredient items by category, **default in-stock**, tap to deselect, "Add N staples →" CTA. Component is built for reuse: T11 (onboarding), T15 empty-pantry "Add staples" CTA, and likely Settings later.
- **Reuse:** `suppliesService.createSupply` (confirmed: takes `spaceId`, `ingredientId` **or** `customName`, `status ∈ {in_stock, low, out}`, `addedBy`; has built-in dedup via `findActiveSupplyMatch` + DB partial unique index, and storage/tracking inference from the ingredient row — `lib/services/suppliesService.ts:405`). `searchCatalogIngredients` exists for ingredient-catalog lookups. `SpaceContext` for the space id.
- **Build:** the checklist component + screen; the staples item list itself is **content oversight/Tom must supply (D5)** — the component can be built against the decision, but CP3 does not close until the real list is in.
- **Dependencies:** D5 (staples list content). No other CP.
- **⚠️ SPACE-ENSURE (anchor §6):** `supplies.space_id` is NOT NULL territory — this is THE space-scoped write. `handle_new_user` creates **no** Space; `SpaceContext` lazily ensures one via `ensureDefaultSpace` (`lib/services/spaceService.ts:1004` → `create_default_space_for_user` RPC), but that runs **async after SIGNED_IN** (`contexts/SpaceContext.tsx:128`) and a fast post-signup onboarding flow **can race it**. Design rule proposed: **the staples component itself awaits space readiness** — consume `SpaceContext` (`isInitialized` + `activeSpace.id`) and, if not yet initialized, await the ensure before the first `createSupply`. The component owning this makes every mount point (T11, T15, Settings) safe by construction. Never invent a second create path.
- **Verification sketch:** brand-new user (0 `space_members` rows) → complete T11 → confirm (a) exactly one `is_default` space + accepted owner membership now exists, (b) supplies rows landed with that `space_id`, `status='in_stock'`, correct `added_by`; re-run → dedup returns existing rows (no dupes); deselect-all/skip path writes nothing; watch the Metro/Expo terminal during the smoke.

### CP9a — Spine T1–T4 · tier: checkpoint

- **Scope:** Welcome (T1), invite-code entry (T2), account creation (T3), profile/avatar (T4); the onboarding navigation stack; routing a brand-new user into it and a returning user past it.
- **Reuse:** `Logo`/`LogoConfigContext` + theme (T1); `inviteCodeService` (T2 — confirmed: `validateCode` **anon-callable**, returns `'valid'|'invalid'|'expired'|'redeemed'`; `redeemCode` **authenticated, post-signup, idempotent per user**, best-effort — never orphan an account over a code race); `SignupScreen` adapted (T3); `EditProfileScreen` avatar patterns + image upload service (T4 — `EditProfileScreen` remains the later-edit surface).
- **Build:** T1, T2, T4 screens; T3 = adapt `SignupScreen` (today: first/last/email/password, no invite gate, `signUp()` **without metadata**, then a 500 ms `setTimeout` and a `user_profiles.display_name` post-update — `screens/SignupScreen.tsx:104-123`). Adaptation should carry the invite gate + S1 name fields; passing `display_name` via `signUp` `options.data` would let the CP5 metadata-ready trigger set it atomically and retire the 500 ms race — an implementation improvement to propose in the CP9a prompt, not a scope change.
- **Invite-flow contract (T2, locked):** validate **before** account creation; redeem **after** — never redeem-before-account.
- **Dependencies:** **D2 (new-user detection + completion persistence) — HARD BLOCKER; do not draft until ruled.** Where the onboarding stack mounts is implementation, but it is shaped by D2: today App.tsx is a pure binary `session ? MainTabNavigator : AuthStackNavigator` gate (`App.tsx:969-987`) and T1/T2/T3 are pre-session screens while T4+ require a session.
- **Space-ensure note:** **no space-scoped writes** in T1–T4 (auth signup, `user_profiles` update, invite redemption are all user-scoped). `SpaceContext` will begin its own ensure on SIGNED_IN — harmless and desirable.
- **Verification sketch:** invalid/expired/redeemed codes each render their error and block; valid code gates through; signup creates profile with `username NULL` + `display_name = "First Last"`; `redeem_invite_code` returns true post-signup (redemption row attributed to the new user); returning user (completion flag set per D2) lands in the main app untouched; killed-mid-onboarding user resumes per the D2 mechanism; back-navigation through the spine.

### CP9b — Find friends (T5) · tier: checkpoint

- **Scope:** Share-link/QR/contacts hero, "Suggested — people you may know" (seeded) section, demoted name search, follow buttons, Continue/Skip.
- **Reuse:** `UserSearchScreen` (the name-search piece), follow services, invite-link plumbing (CP2 codes back the share link).
- **Build:** the onboarding screen itself (hero + suggested + skip); QR display; contacts sync **if D6 rules build-now** (`expo-contacts`, est. ~1 session per the wireframes).
- **Dependencies:** **D3 (seeded graph / CP7) — the suggested/seeded section has no data source today**; wireframe notes also tie seeded rows to claim-by-email (CP8 — gated, explicitly NOT in this front half). **D6** (contact sync v1 vs fast-follow). The non-seeded 80% (share/QR/search/skip) is buildable independent of both.
- **Space-ensure note:** no space-scoped writes (`follows` is user-scoped).
- **Verification sketch:** follow from a suggested row creates a `follows` row; share sheet carries the user's invite URL; QR renders and scans to the same URL; name search finds an existing tester by display_name; zero-suggestions state degrades to the hero without a blank section; skip proceeds to T6.

### CP9c — Router Q0 (T6) · tier: checkpoint

- **Scope:** "How do you cook?" — three choice cards; pure route-only step (the one deliberate route-only exception, D-ON-5).
- **Reuse:** choice-card pattern shared with T12; repo SVG icons (book/shuffle/flame).
- **Build:** the screen + route wiring: "I follow recipes" / "A bit of both" → T7; "I go by feel" → T10 placeholder → T11.
- **Dependencies:** CP9a (stack exists). Open implementation question to settle in the prompt: whether the Q0 answer persists anywhere (profile personalization signal) or is flow-local — if persisted it is user-scoped, not a schema decision, but say so explicitly in the CP prompt.
- **Space-ensure note:** no space-scoped writes.
- **Verification sketch:** each card routes correctly; by-feel reaches T11 (staples) via the placeholder without dead-ending; back from T7 returns to T6 with selection preserved.

### CP9d — Recipe path T7–T9 · tier: checkpoint

- **Scope:** L1 sources checklist (T7, S4 list: Cookbooks · NYT · Saved web links · Instagram/TikTok · YouTube · Reddit · Substack · In my head · Other-free-text); cookbooks T8a search / T8b snap-shelf / T8c verify; value steps T9a paste / T9b signature / T9c chefs. Gating: T7 selections decide which subsequent steps appear (Cookbooks → T8; web/social → T9a; in-my-head/Other → personalization signal only). T9b/T9c offered to all recipe-path users (S5). Social/video sources are **route + personalize only — no extraction promise**.
- **Reuse:** `searchBookCatalog` (T8a — confirmed live: `is_catalog=true` only, title/author ilike, ranked, returns `{id, title, author, cover_image_url, toc_extracted_at}` — `lib/services/recipeExtraction/bookService.ts:490`); **`OwnershipVerificationCapture`** (T8c — confirmed built + deliberately unwired, per-book props `{bookId, bookTitle?, bookAuthor?, onSubmitted?}`, writes a `'pending'` verification via `ownershipVerificationService`; T8c is where it finally gets wired); CP6a-2 review/allowlist + CP6b delivery fire downstream of approval — **no delivery code in this CP**; `AddRecipeFromUrl` rail + extraction pipeline (T9a); `chefs` table pick-list (T9c).
- **Build:** T7, T8a/T8b/T8c screens, T9a/T9b/T9c screens, the gating logic. T8b (snap-shelf spine detection) is a vision feature with no existing service — candidate to descope/fast-follow; flagged in D1 for the spec to rule (the wireframe calls it "optional, convenience shortcut — not sole path").
- **Cross-workstream seam (handoff §5):** T8 depends on a **populated catalog** (CP4-seed/CP4b — the parallel workstream). HARD REQUIREMENT: T8a must **degrade gracefully on an empty/sparse catalog** (today: zero `is_catalog=true` rows ⇒ search returns nothing) — "we're adding cookbooks" nudge or skip, never a blank dead-end; never block the spine on the catalog. Coordinate exercise timing with Tom post-CP4b.
- **Catalog tier-badge gap (D4):** T8a's "recipes ready"/"title only" badges require a **recipes-exist** signal (anchor §4.1: tiers key on `EXISTS recipes WHERE book_id=X`, **never** `toc_extracted_at`), and `searchBookCatalog` does not return one. Needs a small service/RPC extension on the CP4 surface — **flagged, not built, until ruled.**
- **Dependencies:** CP9c (routing in); D1 (does the spec slice T7–T9 differently / sub-slice this CP — it is the largest); D4 (tier badge). T9b open wireframe question (always-offered vs L1-gated) is resolved by S5 = **offered to all recipe-path users** — drawn as always-offered; build per S5.
- **Space-ensure note:** no space-scoped writes identified — recipes/favorites (T9a/T9b), verifications (T8c), chef follows (T9c) are all user-scoped. Standing rule stays in the CP prompt anyway: any space-scoped write that appears mid-build must be preceded by space-ensure.
- **Verification sketch:** gating matrix — (cookbooks only → T8 then skip T9a), (web only → T9a, no T8), (in-my-head only → straight to T11/T12), (mixed → full sequence); empty-catalog search shows the nudge, not a dead end; T8c submit writes one pending `book_ownership_verifications` row per selected book; allowlisted tester's submit auto-approves and CP6b delivers (copies land, `parent_recipe_id` set) — piggybacks the already-verified delivery chain; T9a paste of an NYT URL imports a recipe into the new user's library; T9b creates the backdated signature entry.

### CP9e — Social hand-off (T12) · tier: checkpoint

- **Scope:** "You're all set, {firstName}" convergence screen — both paths land here; two forward nudges (cook & post · find more friends) + "Go to Frigo".
- **Reuse:** choice-card pattern (T6); navigation to `PostCreationModal`/Meals and back to the T5 surface; first name from `user_profiles.display_name`.
- **Build:** the screen; the **completion write** — T12 is the natural place the D2 completion flag gets set, so the mechanism choice lands here (and in CP9a's resume logic).
- **Dependencies:** CP9a (stack + D2 mechanism in place).
- **Space-ensure note:** no space-scoped writes (completion flag is user-scoped under every D2 option).
- **Verification sketch:** name interpolates from display_name; both cards navigate; "Go to Frigo" lands on main tabs; completion flag is set such that a re-login or app restart skips onboarding (closes the F&F bar's "never a blank dead-end" loop with CP9f).

### CP9f — Empty states T13–T15 · tier: checkpoint

- **Scope:** Empty feed ×2 (T13a zero-follows / T13b following-but-quiet), empty recipes (T14), empty pantry (T15 incl. "start a grocery list" exit, S7).
- **Reuse:** the three `AddRecipeModal` rails promoted inline (T14); **the CP3 staples component** (T15 "Add staples"); `ViewsScreen`/create-view (T15 grocery link); `WhatCanICookScreen` teaser (T15).
- **Build:** the empty-state UI inside `FeedScreen` / recipes list / `PantryScreen`, including `FeedScreen` logic distinguishing zero-follows from follows-but-no-recent-posts (and not flashing the nudge during the ~1–2 s refresh window).
- **Dependencies:** CP3 (T15 reuses the component). Independent of the onboarding stack — can float earlier in the sequence.
- **⚠️ SPACE-ENSURE:** T15 "Add staples" triggers the CP3 component's supply writes — **covered by construction if CP3's component owns the ensure** (the design rule above). Verify it here anyway with a no-space user.
- **Verification sketch:** zero-data account shows each empty state (the anchor names this the #1 drop-off risk — test at real zero data); T13a vs T13b copy switches on follow count; T14 rails each open the right add-flow; T15 "Add staples" on a user with no space creates the space + supplies (re-proves space-ensure); grocery-list exit reaches create-view.

---

## 3. The load-bearing constraint — space-ensure (anchor §6) — confirmed from live code

- `handle_new_user` creates **no Space** (CP5 finding; migration `20260610003320` comments it explicitly).
- **The one path:** `ensureDefaultSpace(userId): Promise<string>` — `lib/services/spaceService.ts:1004`. Idempotent: queries `space_members` (accepted, `spaces.is_default=true`); else calls the **`create_default_space_for_user(p_user_id)`** RPC and returns the new id. The RPC predates `supabase/migrations/` tracking (no tracked definition) but is **live-confirmed** (client calls it; CP5 smoke positively asserted lazy creation).
- **Wiring:** `SpaceContext` calls it inside `loadSpaces()` (`contexts/SpaceContext.tsx:128`), which fires when `currentUserId` is set by its own SIGNED_IN listener. `SpaceProvider` mounts only inside App.tsx's `session ?` branch (`App.tsx:970`).
- **The race to design around:** the ensure is async post-auth; an onboarding flow that reaches a space-scoped write quickly can beat it. Resolution: the CP3 component awaits space readiness (§2 CP3). **Ordering: space-ensure BEFORE the first space-scoped write — in every CP prompt that touches `supplies` or any space-scoped table, and in every such CP's test plan.**

---

## 4. Status table — the workstream's state of record

Every future CP closeout updates this table **in the same commit as its SESSION_LOG entry** (log-before-close applies).

| CP | Screens | Tier | Status | Blocked on |
|----|---------|------|--------|------------|
| CP3 | T11 | checkpoint | 🟡 planned — component draftable now; closeout needs the staples list | D5 |
| CP9a | T1–T4 | checkpoint | ⛔ planned — DO NOT DRAFT until D2 ruled | D1, D2 |
| CP9b | T5 | checkpoint | ⛔ planned — seeded section has no data source | D1, D3, D6 |
| CP9c | T6 | checkpoint | 🟡 planned | D1, CP9a |
| CP9d | T7–T9 (+T10 placeholder) | checkpoint | 🟡 planned — largest slice; spec may sub-slice; T8a badge gap | D1, D4, CP9c |
| CP9e | T12 | checkpoint | 🟡 planned — carries the D2 completion write | D1, D2, CP9a |
| CP9f | T13–T15 | checkpoint | 🟡 planned — floatable early | D1, CP3 |

Legend: 🟡 planned (provisional, awaiting D1 ratification) · ⛔ hard-blocked on a ruling · ⏳ in build · ✅ shipped per its tier's bar.

---

## 5. DECISIONS-FOR-OVERSIGHT — no building on these until ruled

**D1 — `ONBOARDING_BUILD_SPEC.md` is missing from the repo (spec-vs-reality conflict, blocks ratification of everything above).**
Named by the anchor (header companion-docs line) and the handoff (§2, §6, §9 step 1) as the authoritative build order, "repo-only — NOT in PK." It is not on disk and was never committed (verified: full-tree search + `git log --all`). The handoff's own warning (§9 step 1 / §2) is that without it an instance is forced to bootstrap its own build order — exactly what §1–§2 above provisionally do. **Ask:** supply/commit the spec, or ratify §1's slicing as the spec of record (and then this doc's banner drops). Also for the spec to rule when it lands: T8b snap-shelf in/out of F&F scope; whether CP9d sub-slices further.

**D2 — New-user detection + onboarding-completion persistence (blocks CP9a/CP9e; likely a small migration).**
**What exists in code today: nothing.** App.tsx renders a pure binary gate — `session ? <SpaceProvider><MainTabNavigator/></SpaceProvider> : <AuthStackNavigator/>` (`App.tsx:969-987`); `AuthStackNavigator` is a local Login/Signup toggle (`App.tsx:312-340`); zero hits for onboarding/new-user/first-launch anywhere in App.tsx; no profile column, no local flag. Every authenticated user, brand-new or returning, lands directly in the main tabs. Note detection and persistence collapse into one decision: with any durable flag, "new" = flag-absent-while-authenticated; the signup flow itself can deterministically route into onboarding, and the flag covers kill-mid-onboarding resume + returning users + reinstalls. Options (NOT picking — oversight rules):
- **Option A — `user_profiles.onboarding_completed_at timestamptz NULL` (column + small migration).** Pros: server-truth; survives reinstall/new device (matters for F&F testers); queryable for funnel visibility; reads piggyback the existing profile fetch; the profile row already exists at the moment of signup (trigger-created). Cons: a migration (checkpoint-tier sequencing + the §4.3 deny-list classification rule applies to any new column — though `user_profiles` is not a copied table, classify-or-state in the CP anyway); one more thing RLS-reviewed.
- **Option B — local-only flag (AsyncStorage).** Pros: no migration, trivial. Cons: reinstall/new-device re-runs onboarding for an existing user (testers reinstall a lot during F&F — this will fire); invisible server-side (no funnel measurement); can't distinguish "skipped" from "never started" across devices.
- **Option C — Supabase auth `user_metadata` (`auth.updateUser({ data: { onboarding_completed_at } })`).** Pros: no migration; server-side; rides the session object the app already holds. Cons: user-writable by design (fine for UX gating, weak as a record); not joinable from normal SQL/PostgREST queries for funnel views; precedent-setting — app state starts accumulating in auth metadata.
- A data-presence heuristic (infer "new" from zero recipes/supplies/follows) was considered and is **not** proposed: ambiguous for skippers and pays a multi-table check on every cold start.

**D3 — Seeded graph (CP7): placement, T5 dependency, ownership.**
**Where the build spec places it: unknowable — the spec is missing (D1); the anchor §7 build table has no CP7 row at all**, and the handoff (§8) states the seeded-graph work "appears nowhere in this handoff or anchor §7." **Does T5 depend on it: partially — yes for the bar.** T5's "Suggested — people you may know" section presumes a seeded/suggested graph, and the F&F definition of done requires "≥1 friend (**seeded** or found)" — for a tester with no organic friends on the app, the bar is unmeetable without either seeding or contacts matching (D6). The share/QR/name-search/skip portions of T5 do not depend on it. Supporting facts: `invite_code_redemptions` was retained in CP2 specifically for seeded-graph attribution; the wireframe notes additionally tie seeded "Following" rows to **claim-by-email (CP8)** — gated, high-risk, explicitly **not** in this front half. **Who owns it: unassigned — nobody.** **Ask:** assign CP7 an owner + a place in the build order, and rule whether F&F T5 ships (a) after CP7, (b) degraded (no suggested section; bar met via contacts/share instead), or (c) with a CP8-independent interim seeding mechanism.

**D4 — T8a catalog tier badge needs a recipes-exist signal `searchBookCatalog` doesn't return (touches the anchor's §4.1 catalog model).**
Anchor §4.1 mandates tier display keys on `EXISTS recipes WHERE book_id=X` and **never** "recipes ready" off `toc_extracted_at` — but `searchBookCatalog` returns only `toc_extracted_at` (`bookService.ts:490`). Rendering T8a's "recipes ready"/"title only" badges honestly requires a small extension on the CP4 surface (per-row EXISTS, a view, or an RPC). **Ask:** approve the extension (and whether it rides CP9d or a tiny standalone CP), or rule the badge out of F&F T8a.

**D5 — CP3 staples list content.**
D-ON-2 locks the mechanism (checklist, default in-stock), not the content. Which ~20 items, which categories, default-on-vs-off per item is a content/judgment call (wireframe marks it "open iterate"). CC will not improvise it. **Ask:** supply the list (ingredient-catalog-resolvable names) before CP3 closeout.

**D6 — Contact sync in T5 v1 (O2 — already an anchor open item, surfaced here because CP9b's scope can't finalize without it).**
Anchor §3 holds O2 open (owner: Tom); wireframes draw "Contacts" as a first-class hero pill and note it's unbuilt (`expo-contacts`, ~1 session). Interacts with D3: contacts matching is the strongest D3-independent route to "≥1 friend." **Ask:** build-now vs fast-follow (and if fast-follow, the pill is hidden vs disabled-with-copy).

**D7 — T3 wireframe draws Google/Apple OAuth; S2 says decided-but-not-built, out of the F&F minimum.**
Precedence already resolves this (anchor wins on scope: CP9a builds **email+password only**; the trigger stays metadata-ready) — listed so oversight can confirm T3 ships without the drawn OAuth buttons rather than discovering the divergence at review. Same class of note: the wireframe header still cites anchor v0.3.1; where wireframe annotations conflict with v0.3.8 locks, the anchor was followed throughout this plan.

---

## 6. Confirm-from-code record (live repo, 2026-06-11 — the §2 claims rest on these)

| Surface | Confirmed |
|---------|-----------|
| `spaceService.ensureDefaultSpace` | `lib/services/spaceService.ts:1004` — signature `(userId) => Promise<string>`; idempotent membership check; falls back to `create_default_space_for_user(p_user_id)` RPC (RPC live; definition pre-dates migrations tracking) |
| `SpaceContext` | `contexts/SpaceContext.tsx:90-149` — own SIGNED_IN listener → `loadSpaces()` → `ensureDefaultSpace`; exposes `isInitialized`, `activeSpace`; mounts only inside the session branch |
| `App.tsx` | `App.tsx:919-993` — binary `session ?` gate; **no new-user/onboarding mechanism** (expected: none — confirmed); `AuthStackNavigator` local Login/Signup toggle at `App.tsx:312-340` |
| `SignupScreen` | `screens/SignupScreen.tsx` — first/last/email/password; **no invite gate**; `signUp()` without metadata + 500 ms sleep + `display_name` post-update (`:104-123`) |
| `inviteCodeService` | `lib/services/inviteCodeService.ts` — `validateCode` anon-callable status-only; `redeemCode` authenticated/idempotent/best-effort; no in-app generation (deferred, documented) |
| `searchBookCatalog` | `lib/services/recipeExtraction/bookService.ts:490` — `is_catalog=true` only; title/author ilike, ranked; returns `toc_extracted_at`, **no recipes-exist signal** (→ D4) |
| CP6a-1 capture/submit | `components/OwnershipVerificationCapture.tsx` — built, standalone, **not wired into any screen** (by design; T8c is the wiring point); per-book props; writes `'pending'` rows via `ownershipVerificationService` |
| `suppliesService` | `lib/services/suppliesService.ts:405` — `createSupply({spaceId, ingredientId|customName, status, addedBy, …})`; status guard (no `'critical'` initial); dedup soft-path + DB unique index; storage/tracking inference; `searchCatalogIngredients` available |

**Other spec-vs-reality notes surfaced (no action, recorded):** the wireframe header cites anchor v0.3.1 (superseded locks handled per D7); the handoff arrived at `docs/EXECUTION_HANDOFF_onboarding_fronthalf_2026-06-11.md` and was relocated to the prompt-specified `docs/onboarding/EXECUTION_HANDOFF_2026-06-11.md` in this commit (plain `mv` + `git add`; it was untracked — Rule C check performed).
