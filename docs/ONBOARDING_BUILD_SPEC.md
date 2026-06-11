> ⚠️ SUPERSEDED REFERENCE (recovered 2026-06-11). The build spec of record is
> docs/onboarding/WORKSTREAM_PLAN.md; scope/decisions of record live in the anchor.

# Onboarding & Cold Start — Build Spec

**Status:** 🟢 Ready for build · v1.0 · 2026-06-08
**Repo home:** `docs/ONBOARDING_BUILD_SPEC.md` → stage in `_pk_sync/` for PK upload
**Anchor (scope source of truth):** `ONBOARDING_AND_COLDSTART_SCOPING.md` → **v0.3.2** (this session's locks fold in there)
**Visual reference:** `docs/wireframes/frigo_onboarding_coldstart_wireframes_v4.html` (15 screens)
**Read first (executing instance):** this doc → anchor v0.3.2 → `PROJECT_CONTEXT.md` → `FRIGO_ARCHITECTURE.md` → the schema CSVs.

This is a **build-ready handoff**, not a rescope. The anchor owns *why*; this doc owns *what to build, in what order, with which existing pieces, and where the risk is.*

---

## 1. Operating model (3-tier)

| Tier | Instance | Owns |
|------|----------|------|
| Spec / oversight | **This Claude.ai instance** (carries the design context from the wireframe sessions) | The **anchor doc + this spec** (canonical). Reviews high-risk CPs before/after; checkpoints mechanical CPs. |
| Execution planning | **A new Claude.ai instance** | **CC prompts, SQL/migration drafts, SESSION_LOG reconciliation.** Proposes doc updates back via SESSION_LOG / `_pk_sync` — does **not** edit the anchor/spec directly. |
| Execution | **Claude Code (CC)** | Applies migrations, writes code in-repo, reports via `SESSION_LOG.md`. Never authors design. |

**Rules of the model:**
1. **Single canonical owner per doc.** Spec/oversight holds anchor + spec; execution proposes-and-oversight-merges. No two instances editing the same living doc.
2. **Execution may push back on the spec.** If a decision doesn't survive contact with the schema/code, flag it in SESSION_LOG; oversight reconciles. Reviewer-of-own-spec is blind to spec flaws otherwise — this closes that gap.
3. **Tiered oversight.** Gate the two high-risk CPs hard (auth trigger; claim-by-email): oversight reviews the prompt *before* run and the result *after*. Mechanical CPs (migrations tracking, invite codes, staples, title-catalog seed) get light checkpoint review (read SESSION_LOG, spot-check).
4. **Shared-DB caveat.** A git branch does **not** isolate Supabase — schema/trigger edits hit the shared DB regardless of code branch. Sequence migrations deliberately; claim-by-email stays its own verified CP.

---

## 2. Locked decisions

### From the anchor (D-ON-x)
| ID | Decision |
|----|----------|
| D-ON-1 | Minimum onboarding = **full-surface, critical path** (routed value-exchange model). |
| D-ON-2 | Pantry seed v1 = **staples checklist, default in-stock**. Ongoing add-points are separate, already-built surfaces. |
| D-ON-3 | Vehicle = focused Claude.ai context + CC (now the 3-tier model above). Master-plan **placement/numbering still open**, non-blocking. |
| D-ON-4 | **Invite codes (#69) owned by this project** (~1 session, admin code gen). |
| D-ON-5 | First value = **cook-style router → Recipe / Freehand paths**. |
| D-ON-6 | Ongoing in-app guidance (W4) = **out of the F&F minimum** (defer/ship TBD). |

### Locked this session (fold into anchor v0.3.2)
| ID | Decision | Build implication |
|----|----------|-------------------|
| S1 | **No username.** Display name = first + last (Strava-style). | Drop the username step. `handle_new_user` no longer needs a username default. Audit that nothing reads the username column. Name editable later in Settings (see O3). |
| S2 | **Google + Apple sign-in + native strong password** on Account. | OAuth via Supabase Auth; both providers (Apple guideline 4.8 — offering Google requires offering Apple). Trigger must populate profile from OAuth payload (name/email), not just the email form. |
| S3 | **Cookbooks: search the title DB (primary) + snap shelf (secondary, restored) → ownership-verify image → library.** Title catalog **decoupled from transcription**. | `books` already supports this (`title` required; `toc_data`/`toc_extracted_at` nullable). Search returns **title-only** books (tagged); recipes-available derived from `toc_extracted_at`. Needs a wide title-catalog seed + verify-image storage + per-`user_book` verified flag. |
| S4 | **L1 sources = single-column checklist, gated-by-selection.** Sources: Cookbooks · NYT Cooking · Saved web links · Instagram/TikTok · YouTube · Reddit · Substack · In my head · **Other (free text)**. | Social/video sources (Reels/TikTok/YouTube/Reddit) are **not** clean recipe URLs — for v1 they **route + personalize**, not promise extraction. "Other" stored as a profile signal. |
| S5 | **Tab-9 value steps split** into lean, L1-gated sub-steps (paste / signature / chefs). | Chefs (9c) offered to **all** recipe-path users (no longer gated by a source row, which was removed). Signature (9b) drawn always-offered (see O-walk). |
| S6 | **Freehand path shelved** → placeholder. Router "I go by feel" points there; revisit later. | The staples seed (D-ON-2) is a **standalone component**, not freehand-bound — it survives shelving and is reused by empty-pantry + the recipe soft card. |
| S7 | **Dedicated empty-state screens** for feed (2 variants), recipes, pantry. Skipper/partial framing; nudge-next-action, never dead-end. | Empty feed must distinguish zero-follows vs follows-but-no-recent-posts. Empty pantry gains a **"start a grocery list"** exit. |
| S8 | **Verbiage source = `cookfrigo.com` landing page.** Domain `cookfrigo.com`; **request-access fallback** confirmed (retires the prior hard-wall question). | "A home for your home cooking" / pillars / sous-chef framing as the copy bank. |

---

## 3. Open decisions (owner: Tom)

| ID | Question | Blocks |
|----|----------|--------|
| **O1** | **Verification image (tab 8c):** cover photo (fast, weak proof) / a *named page* (stronger, feeds page-scan pipeline) / both? | **The cookbook CP.** Define before building tab 8. |
| **O2** | **Contact sync in v1 (tab 5):** build `expo-contacts` email-match now (+~1 session, strongest spread lever + best disambiguator given no username) or fast-follow? | Find-friends CP scope. |
| **O3** | **Name editable in Settings later** (assumed yes) vs permanently locked. | Minor; assume yes unless told. |
| **O4** | **Cook-type chips:** keep app emojis (🍳🥖🔥) or move to text/icons. | Deferred — moot while freehand is shelved. |
| O-walk | Is **9b signature** always-offered (drawn) or also gated? Does "In my head" alone bounce to (shelved) freehand? | Recipe-path sequencing; non-blocking, resolve in build. |

Smaller per-screen iterate items are noted inline in §4; none block kickoff.

---

## 4. Screen-by-screen spec (keyed to v4 wireframe tabs)

### Spine

**T1 Welcome** — Brand mark (`Fridge` icon via `LogoConfigContext`) + "A home for your home cooking" / "Your recipes, your cooking, and the friends you cook with." Primary "Get started"; secondary "I already have an account" → existing `LoginScreen`. *Reuse:* `Logo`, theme. *Iterate:* single screen vs 3-pillar swipe (leaning single).

**T2 Invite code** — Code entry **before** account creation. Valid/invalid/expired/redeemed states. "No code? Request access →" links to the site flow. *Build:* #69 codes table + validation + admin generation (reuse admin panel). *Reuse:* `AdminScreen`.

**T3 Account** — **Continue with Google** + **Continue with Apple** + email/first/last/password with native strong-password. *Reuse:* `SignupScreen` + Supabase Auth. *Build:* OAuth providers; profile populated through `handle_new_user` from OAuth payload (see §5).

**T4 Profile** — Optional avatar only (photo / library; initials fallback). **No username, no display-name field** — derived from signup. Auto-advance if avatar skipped. *Reuse:* `EditProfileScreen` avatar/name patterns. *Dependency:* with no username, the email-as-handle leak dissolves; audit no other reader of the column.

### Shared

**T5 Find friends** — Viral-first: hero row **Share link · QR · Sync contacts** (link/QR work new-to-new and new-to-existing); seeded "Suggested" follow rows (pre-following, editable); **name** search at the bottom (demoted — collisions, no handle). Skippable. *Reuse:* `UserSearchScreen` (now name-based), `InviteMemberModal`, follow services, `are_mutual_followers`. *Open:* O2 (contact sync). *Dependency:* seeded rows need claim-by-email so a seeded profile becomes the real account, not a duplicate.

**T6 Router (Q0)** — "How do you cook?" → recipes / both → Recipe path; **by feel → shelved placeholder (T10)**. Pure router (only routes, returns no data). One tap; copy reassures it's not a lock-in.

### Recipe path

**T7 L1 sources** — Single-column checklist (S4 list). Gates which next steps surface. *Branch map (proposed, confirm):* Cookbooks → T8 · web/social → T9a paste · "In my head"/Other → no import (personalization only). Chefs step (T9c) offered to all, not gated.

**T8 Cookbooks** — three methods on a subtoggle: **8a search** the title DB (returns title-only books, tagged) · **8b snap shelf** (restored; detects spines → same select list) · **8c verify** ownership via image per book → library. Status tiers: owned+transcribed → recipes ready · owned+title-only → on shelf, queued · not-in-catalog → request it. *Reuse:* `books` + `user_books` + `bookService` + page-scan/assembly pipeline; `BookSelectionModal` / `BookOwnershipModal` likely re-skin. *Blocks on O1.* *Build:* title-catalog seed + verify-image storage + verified flag (§5).

**T9 Value steps (split)** — lean L1-gated sub-steps: **9a paste** (URL incl. NYT → library now; `AddRecipeFromUrl` + extraction) · **9b signature** ("a recipe you make on repeat" + source + ~times → Favorites + backdated/estimated profile entry) · **9c chefs** (optional pick-list, `chefs` table). Each appears only if relevant; nobody hits a wall. Soft pantry-seed card appears once (hand-off / empty-pantry, not stacked here).

### Freehand (shelved)

**T10 Freehand — placeholder** — Parked. By-feel first-value beat needs redesign. *Revisit:* what's the by-feel value moment (capture recent cook = old F1, or pantry-first?); does "In my head" funnel here. *Held with:* the post-schema "when"/backdated/estimated work.

**T11 Pantry staples (D-ON-2)** — Standalone seed component (decoupled from freehand). Curated ~20-item checklist by category, default in-stock (tap to deselect) → unlocks What Can I Cook. *Reuse:* catalog + `createSupply`/`suppliesService`, `StockUpCard` concept, `WhatCanICookScreen`/`readyToCookService`. *Iterate:* item set / category count / default-on vs off.

**T12 Social hand-off (T2 tail)** — Both paths converge: "Cook & post tonight" + "Find more friends" → into the app. Definition-of-done checkpoint (§7).

### Empty states (W2 — #1 drop-off risk, untested at zero data)

**T13 Empty feed** — two variants: **13a no follows** (lead "Find your friends") · **13b following-but-quiet** (lead "Post a cook," then friends, then soft "Browse" escape — the common first-wave state). *Build:* `FeedScreen` must distinguish the two cases and not flash the nudge during the ~1–2s refresh window.

**T14 Empty recipes** — Nudge = **add first recipe** (the three `AddRecipeModal` rails promoted inline: camera / library / paste), **not browse** (no cold content). Verbiage from the recipes pillar.

**T15 Empty pantry** — Sous-chef framing ("teach Frigo what's in your kitchen"); **Add staples** (→ T11 checklist) + **Add one item** + a What-Can-I-Cook teaser + **"Start a grocery list"** exit (→ `ViewsScreen`/create-view, 8R lists/views model). *Iterate:* live WCIC count once any staples exist.

---

## 5. Backend / schema work (consolidated)

1. **`supabase/migrations/` tracking (P7-23)** — prerequisite for all trigger/seed work. Must be in before the auth-trigger CP.
2. **Invite codes (#69)** — codes table (single/multi-use, expirable), validation, admin generation UI.
3. **`handle_new_user` rework** — populate profile from **both** the email form and Google/Apple OAuth payloads (name/email). Remove/neutralize the username default. Smoke-test the trigger + the signup "wait for trigger" race. **No-username audit:** verify nothing reads the username column (search RPC, follow, RLS, invite). *High-risk CP — oversight gates.*
4. **Books title catalog** — wide title-catalog seed; search returns title-only entries; "recipes available" signal derived from `toc_extracted_at`. Verify-image storage + per-`user_book` verified flag (definition pending O1).
5. **Post backdating** — "when"/date field on the composer (currently posts as now) + **backdated** (sort by cook date, no notification, no top-of-feed jump) + **estimated** flags. Shared by 9b signature and the (shelved) freehand F1. *Held with freehand for the post-screen piece; the schema/flags can land earlier if 9b needs them.*
6. **Admin seeding** — seed follow edges (editable suggestions) + **claim-by-email** (seeded profile adopted by the real signup, not duplicated). *Claim-by-email = highest-risk CP, isolated and verified on its own — a botched reconciliation could orphan/duplicate real accounts.* Backdated/estimated guards apply; hard line: never fabricate posts attributed to a person.

---

## 6. Build order & CP plan

| # | CP | Risk | Depends on | Oversight |
|---|-----|------|-----------|-----------|
| 0 | **Build spec** (this doc) + spin up executing instance | — | — | — |
| 1 | `supabase/migrations/` tracking | low | — | checkpoint |
| 2 | Invite codes (#69) | low | 1 | checkpoint |
| 3 | Staples checklist (D-ON-2) | low | — | checkpoint |
| 4 | Books title-catalog seed + search (title-only) | low–med | 1 | checkpoint |
| 5 | **Auth trigger** — OAuth profile population + no-username audit + smoke test | **high** | 1 | **gate (before+after)** |
| 6 | Cookbook screens (search/shelf/verify) | med | 4, **O1** | checkpoint (gate the verify-image schema) |
| 7 | Find-friends + seeded graph | med | 5, O2 | checkpoint |
| 8 | **Claim-by-email** | **high** | 1, 5 | **gate (before+after), isolated** |
| 9 | Spine + router + recipe value steps + empty states | med | 5 | checkpoint |

Parallelizable: 2, 3, 4 are independent of each other and of 5. The screens (6, 9) can draw in parallel with backend once their dependencies land. **O1 must resolve before 6.**

---

## 7. Definition of done (F&F)

A brand-new tester, no hand-holding, reaches: in (code + account) · a real name (no email-as-handle — moot, no handle) · ≥1 piece of their own data (recipe imported or cook posted) · ≥1 friend (seeded or found) · lands on populated-or-nudging surfaces, never a blank dead-end. W4 ongoing guidance is explicitly out of this bar.

---

## 8. Risks / watchpoints

- **Empty states untested at zero data** — the single biggest unknown; the W2 screens are the mitigation but need real zero-data testing.
- **Social-video extraction unproven** — Reels/TikTok/YouTube/Reddit aren't clean recipe URLs; v1 routes + personalizes only.
- **Name collisions** in find-friends (no handle) — lean on contacts/invite-link/QR/seeded; name search is the weak fallback.
- **Apple guideline 4.8** — Google sign-in obligates Apple sign-in; both are in S2.
- **Shared DB** — schema/trigger edits aren't branch-isolated; sequence deliberately, isolate claim-by-email.
- **Cohort maturity** — first wave matches few friends; admin seeding + backdated content + invite-link carry the early feed.

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-06-08 | 1.0 | Initial build spec. 3-tier operating model + doc ownership. Locked decisions S1–S8 (no username, Google+Apple+strong-pw, cookbook search+shelf+verify+title-catalog, social/Other sources, tab-9 split, freehand shelved, empty states, verbiage). Open items O1–O4. Screen-by-screen spec keyed to wireframes v4. Backend work + gated build order + risks. |
