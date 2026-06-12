# OVERSIGHT RELAY — shared-pantry onboarding (spouse case): two scoped proposals + one corrective reminder

> ✅ **RULED 2026-06-12 — see anchor v0.3.10:** A → D-ON-16 (S9-lite, as proposed); B → D-ON-17 (role=MEMBER; owner's active space gated on owner/admin role there, else default; rides CP7-minimal); C → corrective ruled into CP3 (§6 correction), applied + gate test PASS 9/9 same day. This doc is now historical record.

**From:** CC (onboarding workstream) · 2026-06-12 · prompted by Tom's design question (spouse/roommate pantry sharing at onboarding)
**Asks:** rule A and B below (both are decisions of record → anchor §2 material). Neither is built. C is already relayed (CP3 SESSION_LOG 2026-06-12) and repeated here only because A and B both sit on top of it.

## Grounding (live model — no schema needed for the core semantics)

The model already separates **default space** (`spaces.is_default` — permanent Home space; can't be deleted or left) from **primary/active space** (`user_active_space` — what the app surfaces). "The shared pantry becomes the spouse's primary pantry" is therefore: accept a `space_members` invitation + `setActiveSpace(shared)` — all live machinery. The spouse keeps a dormant Home space underneath (load-bearing: surfaces assume it; safety net if the share ends). **Recommendation embedded in both items: every new user still gets a default space** — the spouse case changes which space is *active*, never whether Home exists.

The roommate case (partial sharing) is explicitly NOT proposed now; noting for the record it has a data-model home when wanted: `supplies.for_user_ids` (8R per-user item scoping inside a shared space) under the DEFERRED §8 shared-library umbrella.

## A — T11/T15 pending-invitation branch ("S9-lite")

**Problem:** a spouse who signs up hits T11 (staples) minutes after account creation and seeds 21 staples into a fresh Home space they'll never use — a parallel pantry someone then has to merge.

**Proposal:** the staples HOSTS (T11 in the CP9 wiring; T15 empty-pantry in CP9f) check `SpaceContext.pendingInvitations` (already loaded by the provider). If non-empty: lead with **"Join {inviter}'s pantry"** (accept/decline, existing `respondToInvitation`); on accept → `setActiveSpace(shared)` and **skip the staples seed** (a genuinely empty shared space still gets caught by the T15 empty state later). If empty: normal checklist. No schema, no service edits, no component change (StaplesChecklist already writes to `activeSpaceId` when present — post-join, T15 "Add staples" correctly targets the shared pantry).

**Consistency:** honors the S9 ruling (shared-space question stays OUT of the F&F spine; this is reactive — it appears only when an invitation actually exists) and the oversight steer "nudge post-hand-off / on the Pantry-Spaces surface."

**Decision asks:** (A1) approve scope placement — T11 branch rides CP9 spine wiring, T15 branch rides CP9f; (A2) confirm skip-after-join as the default (vs. still offering the checklist against the shared space).

## B — D-ON-11 amendment: "share my pantry" flag on per-user pass-on codes

**Problem A can't solve alone:** invitations require the invitee to already have an account, but the spouse reaches T11 ~2 minutes after signup — the inviter hasn't had a chance. Without B, item A's branch almost never fires for the spouse case.

**Proposal:** CP7-minimal's per-user pass-on codes gain an optional **share-my-pantry intent**: `invite_codes.share_default_space boolean NOT NULL DEFAULT false` (meaningful only when `owner_user_id` is set; cluster codes unaffected). When a flagged code is redeemed, the redemption path additionally creates an **idempotent pending `space_members` invitation** from the code owner to the redeemer (riding the existing per-user-idempotent redemption; SECURITY DEFINER, so no RLS friction). The T5 "your invite code" share surface gets the toggle ("invite them to your pantry too"). Spouse flow end-to-end: redeem flagged code → invitation exists by T11 → item A fires → join → shared pantry is primary → no parallel seed.

**Decision asks:**
- (B1) approve as a CP7-minimal scope extension vs. its own follow-on CP (recommendation: extension — it's one column + one insert inside the same RPC the CP already builds, and splitting it means touching the redemption RPC twice).
- (B2) invited role: recommend **member** (least privilege, promotable in Space settings later) — owner felt wrong as an automatic grant.
- (B3) which space is shared: recommend resolving at REDEMPTION time to the owner's **active space, falling back to default** — matches "my pantry" intuition even when the owner is themselves living in a shared space (their Home may be empty). Alternative: always the owner's default space (simpler, but shares an empty Home in that case).
- (B4) deny-list note (anchor §4.3 standing rule): `invite_codes` is not `recipes` nor a copied child — new column needs no copy-set classification (stated).

## C — reminder: the `ensureDefaultSpace` corrective blocks all of this

Already relayed (CP3 SESSION_LOG, 2026-06-12): `ensureDefaultSpace` calls a **nonexistent RPC** (`create_default_space_for_user`; prod has `create_default_home_space`) and silently returns null on error. Until the one-line corrective is green-lit, NO new user gets a default space at all — A and B are moot without it, and it's a live-app bug regardless of onboarding.
