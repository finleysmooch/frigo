# EXECUTION HANDOFF — Onboarding Front-Half (CP3 + CP9)

**Date:** 2026-06-11 · **For:** the execution-planning instance driving the onboarding-flow workstream
**Anchor at handoff:** `ONBOARDING_AND_COLDSTART_SCOPING.md` **v0.3.7** (repo canonical; confirm the version line before relying on it)
**Parallel workstream (not yours):** Tom is running the **book DB / catalog** workstream (CP4-seed, CP4b promotion) with a separate instance. Coordinate at the one seam noted in §5 below; otherwise independent.

> This doc orients and scopes. It does **not** replace `ONBOARDING_BUILD_SPEC.md §4` — that is the authoritative screen-by-screen build order, and it is **repo-only (NOT in PK)**. Reading it from the repo is your first job (see §6). Where this handoff and the build spec disagree, the build spec wins on *what/how to build*; the anchor wins on *scope/decisions of record*.

---

## 1. Where the build is now

The cookbook-delivery backend chain is **shipped and prod-verified** this session:

| CP | What | State |
|----|------|-------|
| CP1 | migrations tracking | ✅ shipped |
| CP2 | invite codes (`inviteCodeService`) | ✅ shipped + closed out |
| CP4 | `is_catalog` column + `searchBookCatalog` | ✅ shipped |
| CP5 | auth trigger (no-username, metadata-ready) | ✅ shipped + live-verified |
| CP6a-1 | verification table + private bucket + capture/submit | ✅ shipped + verified |
| CP6a-2 | admin gate + review RPCs + allowlist + in-app portal + CP6b seam | ✅ shipped |
| CP6b | copy-on-verify delivery engine (`recipeDeliveryService`) + provenance | ✅ **shipped + prod-verified** (post-push smoke 17/17 on the real service) |
| — | stale extraction child-saver fix (Ruling 5) | ✅ shipped (`ad71296`, pushed) |

**Anchor §7 status drift — in flight as v0.3.8 (oversight-owned, no action needed from you).** The §7 table in v0.3.7 still shows **CP6a-2 as "in oversight pre-review"** and **CP6b as "provenance migration authored / engine cleared to author"** — both stale, since CP6a-2 and CP6b are shipped, pushed, and prod-verified (the closeouts landed in SESSION_LOG but the §7 cells were never bumped). Oversight has dispatched the reconciliation to CC as **anchor v0.3.8** (CP6a-2 → ✅; CP6b → ✅ shipped + smoke-PASS). Read §7 against v0.3.8 once it lands; if you're somehow on v0.3.7, treat both as shipped.

**What this unblocked:** CP4b (catalog promotion) is now off the bench *from the CP6b side* — it still also waits on the assembly-owner's per-book list (the parallel workstream). Real cookbook delivery to a verified user now works end-to-end; there is simply nothing in the catalog to deliver until CP4b promotes books.

---

## 2. Your scope — the onboarding flow itself (CP3 + CP9)

The delivery *mechanism* is built; the user-facing onboarding *flow* is not. That is this workstream.

**Model (anchor §1):** a routed value-exchange flow — a short critical-path **spine**, then a **cook-style router** forking into a Recipe path or a (shelved) Freehand path, with find-friends elevated early. Every step either routes or returns visible value.

**F&F definition of done (anchor §1 — the bar):** a brand-new tester, unaided, reaches: invite code + account → a real name (no email-as-handle) → ≥1 piece of their own data → ≥1 friend (seeded or found) → lands on **populated-or-nudging** surfaces, **never a blank dead-end.** Ongoing in-app guidance (W4) is explicitly **out** of this bar.

**The 15 wireframe screens (v4)** — your build surface, grouped by CP:

| # | Screen | CP | Exists? |
|---|--------|----|---------|
| 1 | Welcome | CP9 (spine) | build |
| 2 | Invite code | CP9 (spine) | backend exists (`inviteCodeService`, CP2); screen build |
| 3 | Account | CP9 (spine) | `SignupScreen` exists — adapt (invite-gate, S1 name fields) |
| 4 | Profile (avatar only, no username) | CP9 (spine) | new onboarding screen; `EditProfileScreen` is the later-edit target |
| 5 | Find friends (share/QR/contacts; name-search demoted) | CP9 | `UserSearchScreen` is the search piece; hero + suggested/seeded + skip is new. **⚠️ "Suggested/seeded" presumes a seeded graph (CP7) nobody has built — see §8** |
| 6 | Router (Q0) | CP9 | build |
| 7 | Recipe · sources (single-column checklist, S4) | CP9 | build |
| 8 | Recipe · cookbooks (search catalog + select + verify image) | CP9 | **cross-workstream — see §5**; reuses `searchBookCatalog` (CP4) + CP6a-1 capture/submit |
| 9 | Recipe · value steps (paste / signature / chefs sub-steps, S5) | CP9 | build |
| 10 | Freehand | — | **shelved** (S6) — placeholder only |
| 11 | Pantry staples (default in-stock) | **CP3** | build; **§3 space-ensure constraint** |
| 12 | Social hand-off | CP9 | build |
| 13–15 | Empty states (feed ×2 / recipes / pantry; "start a grocery list" exit, S7) | CP9 | build |

**Screen 2 invite-flow contract (CP2 / `INVITE_CODES.md`):** `validate_invite_code` is **anon-callable** and gates **pre-signup**; `redeem_invite_code` is **authenticated**, runs **post-signup**, best-effort + idempotent per user. So T2 is validate-before-account, redeem-after-account — never redeem-before-account.

**CP3** = the pantry-staples checklist (screen 11, decision D-ON-2). Self-contained, checkpoint tier.
**CP9** = everything else above (spine + router + recipe value steps + find-friends + social hand-off + empty states). Checkpoint tier.

**Recommendation: CP9 is too big for one CP — decompose it into sub-CPs.** The wireframes give natural seams: (9a) spine T1–T4, (9b) find-friends T5, (9c) router T6, (9d) recipe path T7–T9, (9e) social hand-off T12, (9f) empty states T13–T15. Confirm the decomposition against `ONBOARDING_BUILD_SPEC.md §4` before drafting — the build spec may already slice it, and its slicing wins. Given the size, **a focused subproject for the onboarding flow is worth proposing to Tom.** **If the subproject is spun up, `ONBOARDING_BUILD_SPEC.md` MUST be added to its PK** — it's repo-only today, and without it the new instance is forced to bootstrap its own authoritative build order through CC paste-relays (the trap §9 step 1 warns about). Recommended subproject PK working set: anchor (v0.3.8 once landed), `ONBOARDING_BUILD_SPEC.md`, wireframes v4, this handoff, SESSION_LOG, INVITE_CODES.md, DEFERRED_WORK.md, and refreshed code snapshots for `spaceService`, `SpaceContext`, `SignupScreen`, `suppliesService`, `inviteCodeService`.

---

## 3. The load-bearing constraint — space-ensure (anchor §6)

`handle_new_user` does **NOT** create a Space at signup (CP5 finding). Spaces are lazy-created by app/RPC. **Any step that writes space-scoped data — CP3 staples → `supplies`, the pantry seed, and any space-scoped write in the CP9 spine — must first ensure the user's space exists.**

**The existing path to call (do not invent a second one):**
- **`ensureDefaultSpace(userId): Promise<string>`** in `lib/services/spaceService.ts`. Idempotent: checks `space_members` for an accepted `is_default` space and returns its id; otherwise calls the `create_default_space_for_user(p_user_id)` RPC and returns the new id.
- `SpaceContext` already calls `ensureDefaultSpace` — follow that wiring pattern rather than calling the service raw from a screen, if the context is mounted by the time onboarding writes.
- **Ordering: space-ensure BEFORE the first space-scoped write.** Missed, the write silently no-ops or errors.

This is the single highest-risk detail in the workstream. Put it in every CP3/CP9 prompt that touches `supplies` or any space-scoped table, and verify it in the test plan (a brand-new user with no space, run the step, confirm the space got created and the write landed).

---

## 4. Reuse inventory (confirm live before drafting)

**Reuse:** `SignupScreen` (account), `EditProfileScreen` (later name/avatar edit), `UserSearchScreen` (name search), `inviteCodeService` (CP2), `searchBookCatalog` (CP4), CP6a-1 capture/submit component (built, **not yet wired into a screen** per CP6a-1's SESSION_LOG — onboarding T8 is where it gets wired), `spaceService.ensureDefaultSpace`, `suppliesService` (CP3 staples → supplies), `SpaceContext`.

**Build new:** Welcome, invite-code entry screen, onboarding profile/avatar screen, find-friends onboarding screen (share/QR/contacts hero + suggested + skip), router, recipe-sources checklist, recipe value-step sub-screens, social hand-off, the 3 empty-state screens, and the staples checklist (CP3).

Confirm all of the above against the **live** code (not the PK code mirror, which is a 2026-06-01 snapshot) — the confirm-from-code discipline below applies.

---

## 5. Cross-workstream seam (the one place you touch CP4b)

Onboarding **screen 8 (Recipe · cookbooks)** lets a user search the catalog (`searchBookCatalog`), select titles they own, and verify with a photo (CP6a capture/submit → CP6b delivery). That screen depends on a **populated catalog**, which is the *other* workstream (CP4-seed CSV + CP4b promotion).

For F&F, this means: **the onboarding cookbook step must degrade gracefully when the catalog is empty or sparse** — empty-catalog search returns nothing today (zero `is_catalog=true` books). Treat it under the same empty-state discipline as S7: no blank dead-end; a "we're adding cookbooks" nudge or a skip. Do **not** block the spine on the catalog being populated. Coordinate timing with Tom: the cookbook step is only fully exercisable once CP4b has promoted books.

---

## 6. Inputs to read (in order)

1. **Anchor `ONBOARDING_AND_COLDSTART_SCOPING.md` v0.3.7** — §1 (model + F&F bar), §2 (decision register: D-ON-*, S1–S8, O1), §5 (CP5 auth state), **§6 (space-ensure — load-bearing)**, §7 (build sequence/status). *(In PK.)*
2. **`ONBOARDING_BUILD_SPEC.md` §4** — the authoritative screen-by-screen build order + which existing pieces to reuse. **Repo-only — read it from the repo (via CC or have Tom paste it).** This is the doc that turns the wireframes into a build plan.
3. **`docs/wireframes/frigo_onboarding_coldstart_wireframes_v4.html`** — the 15 screens. *(In PK.)*
4. **`COOKBOOK_DELIVERY_SCOPE.md`** — only relevant to the screen-8 seam (§5 above).
5. **Live code, confirm-from-code:** `spaceService.ts` (`ensureDefaultSpace` + the `create_default_space_for_user` RPC), `SpaceContext.tsx`, `SignupScreen` / `LoginScreen`, `EditProfileScreen`, `UserSearchScreen`, `suppliesService`, `inviteCodeService`, `searchBookCatalog`, the CP6a-1 capture/submit component, and `App.tsx` navigation (how the onboarding stack mounts and how the app decides new-user vs returning).

---

## 7. Operating model (carry forward — unchanged from the delivery workstream)

**Three tiers.** *Oversight/spec* owns the anchor (decisions of record); merges your proposals; pre- and post-reviews gated CPs. *You (execution-planning)* turn locked scope into CC prompts, draft SQL/migrations conceptually, ground every decision in live code, flag spec-vs-reality conflicts, and **propose** — oversight merges. *CC* executes (authors code/migrations, dry-runs, reports via SESSION_LOG); never authors strategic content. *Tom* relays between tiers and performs the gated pushes, `supabase db push`, and manual PK uploads.

**CP tiers.** *Mechanical* — CC authors + commits + pushes. *Checkpoint* (CP3 and CP9 are here) — CC authors + reports; Tom commits/pushes; lighter than gated but still grounded + reported. *Gated* — CC authors + dry-run only, oversight pre- and post-reviews, Tom pushes; clean tree, per-CP commits. CP3/CP9 are checkpoint, but they write to the DB (supplies, spaces), so confirm-from-code and a real test plan still matter.

**Hard rules.**
- **Confirm-from-code before drafting** — never assume schema/columns/function shapes. The PK code mirror is a 2026-06-01 snapshot; the PK schema CSVs are stale; **introspect live** (this exact discipline caught real bugs every CP this session — an open edge-function auth surface, a generated-column write failure, broken child-saver column mappings).
- **Never remove existing functionality** unless explicitly instructed.
- **Services handle all DB calls** — components never call Supabase directly.
- **Don't assert repo/commit state — confirm it** with Tom/CC at the start of a session.
- **Log-before-close** (CLAUDE.md rule): a CP isn't complete until its SESSION_LOG entry is written same-session; no CP closes on transcript-only evidence.
- **Repo-as-canonical doc workflow:** living docs edited by Claude.ai (directly or via mechanical CC prompts); the updated file stages in `_pk_sync/` (gitignored); **Tom owes a manual PK upload whenever `_pk_sync` refreshes** — a stale PK is what caused a phantom-missing-log audit and a missed-table FK scan this session, so don't let it drift.
- **Working with Tom:** concise, evidence over assumptions, ask clarifying questions in plain numbered text (never the input-widget), push back when you disagree, acknowledge uncertainty. Simple working solutions over complex ones.

---

## 8. Open items / carry-forwards

- **Anchor §7 status drift** (CP6a-2, CP6b stale → shipped) — **in flight as anchor v0.3.8** (oversight-owned, dispatched to CC); no action from you. Confirm it landed, then this item drops.
- **⚠️ Seeded graph (CP7) — unaccounted-for dependency, likely an oversight ruling.** The F&F bar requires "≥1 friend (**seeded** or found)" and screen 5 presumes a seeded/suggested graph — but the seeded-graph work (CP7; `invite_code_redemptions` was retained in CP2 specifically for its attribution) appears **nowhere in this handoff or anchor §7**. Without it, find-friends ships against a graph nobody built and the F&F bar is **unmeetable** for testers with no organic friends. **Early task:** once the build spec is read, confirm where seeded-graph work lives, whether T5 depends on it, and who owns it — then **flag for an oversight ruling.**
- **PK freshness** — Tom refreshed PK this session (anchor v0.3.7 + SESSION_LOG + DEFERRED_WORK + re-exported schema CSVs). Even so: **introspect live, don't trust the CSVs** as a standing rule (now baked into anchor §4.3 as the migration-time deny-list rule).
- **Bare-"@" cleanup** (DEFERRED §8) — ~6 surfaces render a bare "@" for NULL-username users; show `display_name` or drop the affordance. **Anchor §8 ruled this its own small CP, before F&F** — sequence it adjacent to the onboarding work; **do not fold it into a CP9 sweep.**
- **MIGRATIONS.md invocation-auth debt (oversight's)** — the v0.3.7 changelog references an invocation-auth checklist item that `MIGRATIONS.md` doesn't yet contain (material now exists: the CP6b service-role gate + the generated-column/`SELECT *` lesson). **In flight as anchor v0.3.8** (oversight dispatched it to CC); no action from you. Confirm it landed, then this item drops.
- **CP4-seed** waits on Tom's `docs/seed/cookbook_titles.csv`; **CP4b** waits on the assembly-owner per-book list — both the parallel workstream, both upstream of a fully-exercisable screen-8.
- **CP8 (claim-by-email)** — gated, high-risk, isolated, its own verified CP; **not** part of the front half.
- **OAuth (S2)** — decided, not built; out of the F&F onboarding minimum (email + password is the path). Apple-4.8 obligation applies only if/when Google sign-in ships.

---

## 9. Suggested first moves

1. **Read `ONBOARDING_BUILD_SPEC.md §4` from the repo** and reconcile its slicing against the CP9 sub-CP seams proposed in §2. Its build order wins. (If a subproject is spun up, this doc must be in its PK — §2.)
2. **[HIGH] New-user detection / onboarding-completion persistence — decide BEFORE CP9a drafts.** §6's "how the app decides new-user vs returning" almost certainly resolves to *no mechanism exists today*. How completion is persisted (e.g. a `profiles.onboarding_completed_at` column vs local-only) is a **decision of record, likely carrying a small migration** — it must go to **oversight as an explicit early relay**, not be improvised by CC mid-screen.
3. **[HIGH] Seeded graph (CP7) — confirm + flag.** Once the build spec is read: confirm where seeded-graph work lives, whether T5 (find-friends) depends on it, and who owns it; **relay for an oversight ruling** (§8). The F&F bar is unmeetable without it.
4. **Confirm `ensureDefaultSpace` live** (signature + the `create_default_space_for_user` RPC + how `SpaceContext` invokes it) — it gates CP3 and every space-scoped CP9 write.
5. **Propose the CP sequence to Tom/oversight** — likely CP3 (smallest, self-contained, exercises the space-ensure path once) as the warm-up, then CP9 spine (9a), then the rest. Consider a focused subproject given the screen count.
6. Draft the first checkpoint CP prompt (context, inputs-to-read, confirm-from-code, task, constraints, verification incl. the space-ensure test, SESSION_LOG format) and hand it to CC.
