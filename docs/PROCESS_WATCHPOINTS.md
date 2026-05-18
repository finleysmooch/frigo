# Process Watchpoints
**Last Updated:** May 18, 2026
**Version:** 1.5

**Purpose:** Track open concerns about the Frigo documentation and planning process — things we've invented on paper that haven't been pressure-tested yet, or disciplines we're trying to enforce that rely on habit. This is a retrospective working doc, not a rulebook. `DOC_MAINTENANCE_PROCESS.md` is where the actual rules live; this is where we track whether the rules are doing what we hoped.

---

## How to use this doc

- Read at phase-boundary oversight sessions, or any time you're stepping back to review how the process is going.
- For each open watchpoint, note observations from recent sessions as they accumulate.
- When a watchpoint resolves (positively or negatively), move it to **Closed watchpoints** with a one-line note on what changed and whether it affected the process doc.
- Add new watchpoints whenever new process infrastructure is introduced and you're uncertain it will stick.
- Keep each entry short — a few lines. If a watchpoint needs more than a short paragraph, it's probably ready to become a proposed change to `DOC_MAINTENANCE_PROCESS.md` instead.

**Status values:**
- **Open** — newly raised, no observations yet
- **Observing** — active, signal accumulating
- **Resolving** — trending positive or negative, not yet decided
- **Closed** (moves to the section below) — outcome is clear, one-line summary recorded

---

## Active watchpoints

### W1. Oversight sessions as useful ritual vs. skipped ceremony

**Concern:** Phase-boundary oversight was invented during the 2026-04-21 DOC_MAINTENANCE_PROCESS rewrite. It's coherent on paper but has only run once (the CLAUDE.md audit). If reports don't catch things, it becomes ceremony.

**What to watch for:**
- At each phase boundary, does the oversight pass actually surface drift, missed concerns, or recommendations worth acting on?
- If the first 2–3 phase-boundary oversights produce only minor findings, consider narrowing scope or dropping to "on-demand only."

**Observations:**
- *2026-04-21:* CLAUDE.md audit (oversight-style, not phase-boundary) produced substantive findings and a clean set of proposed edits. Good initial signal.

**Status:** Observing

---

### W2. Instance-proposes-type clarification accuracy

**Concern:** When Tom doesn't declare a session type, the instance proposes one based on the opening message. If the instance proposes wrong often, the friction of correcting outweighs the value over a simpler open-ended "what kind?" question.

**What to watch for:**
- How often does the instance propose correctly vs. Tom overrides?
- If override rate >30% across ~10 sessions, revert to open-ended clarification.

**Observations:** None yet.

**Status:** Open

---

### W3. Session-type-in-chat-title convention adoption

**Concern:** The `[cross-cutting] …` title prefix convention is aspirational. Requires deliberate Tom behavior at chat creation or rename.

**What to watch for:**
- Scan the chat list periodically. If fewer than ~70% of structured-work chats carry a prefix after 2–3 weeks, either the convention isn't worth the friction, or a different enforcement mechanism is needed (e.g., instance reminds at session start).

**Observations:**
- *2026-04-21:* First application — this chat suggested `[cross-cutting] DOC_MAINTENANCE_PROCESS v5.0 rewrite`.

**Status:** Open

---

### W4. Downstream doc-update flagging (Section 2, step 1)

**Concern:** The rule asks Claude.ai to scan "does this decision imply updates to `DEFERRED_WORK` / `FRIGO_ARCHITECTURE` / `PROJECT_CONTEXT` / `FF_LAUNCH_MASTER_PLAN`?" after every non-trivial decision. Easy to codify, hard to remember — relies on active metacognition each time.

**What to watch for:**
- At phase-boundary oversights, check whether SESSION_LOG reconciliation actually caught downstream updates, or whether updates were missed and discovered later.
- If miss rate is high, consider making the flag structural (e.g., every decision entry in a phase doc has an explicit "downstream docs affected" field).

**Observations:** None yet.

**Status:** Open

---

### W5. Standing Rules triggering CC's automatic behavior

**Concern:** This is the biggest unobserved bet of the v5.0 rewrite. We've asserted that putting rules in `CLAUDE.md` means CC will follow them without being reminded in prompts. Untested.

**What to watch for:**
- On the next 3–5 CC sessions that touch living docs: does CC automatically update the `Last Updated` header + stage a dated copy to `_pk_sync/` without the prompt explicitly saying so?
- If CC consistently needs prompt-level reminders, the Standing Rules aren't working as default behavior and we need a different mechanism (e.g., every CC prompt that touches a living doc includes a one-line reminder).

**Observations:**

- *2026-04-22 (discovery-pass patch v2 landing):* CC correctly applied the patch's content as spec'd despite a Verification #5 inconsistency in the spec itself — Edit 2's content used markdown bold (`**Tier 3 discovery:** SKIPPED`) while Verification #5's grep looked for plain text (`Tier 3 discovery: SKIPPED`). Per Rule D, CC flagged the mismatch in SESSION_LOG rather than modifying Edit 2 to satisfy the broken grep or modifying the grep to match the content. First concrete evidence that Rule D ("No strategic content authorship — STOP and report rather than improvising") triggers reliably on real prompts beyond the obvious-judgment-call cases. Positive signal for the standing-rule mechanism that W5 is tracking.

**Status:** Open

---

### W6. DOC_MAINTENANCE_PROCESS length vs. actual consultation

**Concern:** The doc is 406 lines with 13 sections. Comprehensive, but length might make it an impressive-but-unconsulted artifact. The real test isn't design quality — it's whether Claude.ai or CC actually looks up rules in it, vs. operating from memory.

**What to watch for:**
- Note any situations where a rule was misapplied because someone worked from memory rather than consulting the doc.
- If misapplications cluster around specific sections, those sections might need to be shorter or moved to a more consulted location (e.g., promoted to CLAUDE.md Standing Rules).

**Observations:**

- *2026-04-22 (v5.1 first tier populate + refinement):* v4's categorical tier rules ("all `lib/services/**/*.ts`", "all non-Tier-2 `components/*.tsx`") produced 42/46/72 files across Tiers 1–3 on first populate. A full inventory + Claude.ai review surfaced three classes of rule failure:
  - **Under-inclusion:** rules missed entire directories — `lib/types/` (9 files), `components/stats/` (29 files including 15 Tier 2 candidates), `components/cooking/` (12 files including 4 Tier 2 candidates). 41+ files that should have been candidates were invisible to the rules.
  - **Over-inclusion:** "all non-Tier-2 `components/*.tsx`" captured ~71 files where the actual Tier 3 value-weighted set is ~24.
  - **Structural drift:** 5 service files at `lib/` root vs. FRIGO_ARCHITECTURE v4.0's documented `lib/services/` home — drift the categorical rule couldn't surface because it only looked at `lib/services/**/*.ts`.

  Evidence that broad categorical rules written pre-inventory consistently miss real structure in both directions. Patched in `PK_CODE_SNAPSHOTS.md` v1.1 (2026-04-22) by replacing rules with explicit named file lists. Not a new watchpoint — confirmation that W6's "written rules vs. actual consultation" concern is real, and that tier-rule calibration against a fresh inventory (not memory or partial directory listings) is a valuable check at first populate.

**Status:** Open

---

### W7. Process accretion risk

**Concern:** The 2026-04-21 rewrite session alone added session types, chat title conventions, dated `_pk_sync/` filenames, CC-facing audience framing, Standing Rules section in CLAUDE.md, and this watchpoints doc. Each addition is individually reasonable. The aggregate risk is that process becomes the work rather than supporting the work.

**What to watch for:**
- Time spent on doc maintenance vs. shipping features. Hard to measure from inside; worth an explicit look at each phase boundary.
- At each phase-boundary oversight, ask: "What process additions from the previous phase actually got used, and which were dead weight?"
- Be willing to **remove** process, not just add. A future version that drops an unused convention would be a healthy signal.

**Observations:**
- *2026-04-21:* Acknowledged as the accretion point to watch from.

**Status:** Observing

---

### W8. New-file PK staging gap

**Concern:** When CC creates a new doc file in `docs/` (scaffold, phase doc, CC prompt) rather than editing an existing PK-resident doc, the `_pk_sync/` propagation doesn't fire — the pattern only triggers on edits to already-PK-resident files. New files live in the repo but never stage to PK, so PK drifts silently. A later Claude.ai session reading the old PK copy drafts work against a stale shape.

**What to watch for:**
- How often does this recur? Phase docs, scaffolds, and new workflow docs are the main risk classes.
- Does STOP-on-mismatch catch it downstream (as it did on 2026-04-22 Part A)? If yes, cost is drafting-time waste but no silent data loss.
- If it happens more than ~2-3 times in the next month, promote to a rule change in `DOC_MAINTENANCE_PROCESS.md` — likely: "when CC creates a new file of a PK-resident class, auto-stage a no-date-suffix copy at `_pk_sync/FILENAME.md` and surface it in SESSION_LOG as a PK upload task." The no-date-suffix would distinguish "initial PK version" from dated edit stages.

**Observations:**
- *2026-04-22:* PHASE_8 v0.1 scaffold created in commit c6c2438 during the Phase 7 archival session. PK still had the Mar-17-era content. Bit during the Part A batch cleanup — CC's STOP-on-mismatch caught it; corrective stage-and-replace follow-up prompt fixed it. Cost: ~1 round trip of wasted drafting effort plus the remediation work.

**Status:** Open

---

## W9 — Scope overruns on multi-session phases

**Status:** Observing
**Opened:** 2026-04-22 (post-Phase-7P retrospective)

**Observation:**

Two consecutive phases have overrun their original session estimates by approximately 2×:

- **Phase 7 (Social & Feed Polish):** estimated 12-18 sessions, actual ~30 sessions (~2× over).
- **Phase 7P (Feed Polish):** estimated 1-2 sessions, actual 4 sessions + 2 device-test rounds (~2× over).

The FF_LAUNCH_MASTER_PLAN v6.0 risk register acknowledges the pattern via a 2× growth buffer on session estimates. That buffer makes the calendar realistic; it does not address the planning discipline underneath.

**Pattern identified:**

When a phase's first session reveals that the original scope estimate was wrong — because diagnostic work is larger than anticipated, or because scope dependencies only become visible after execution starts — the default move has been to absorb the extra work into the current phase rather than stopping to re-estimate. This preserves continuity but surrenders estimate accuracy, which compounds across phases because each phase's estimate is partially informed by prior phases' actuals.

**Contributing factors (hypotheses, not confirmed):**

- Mid-flight re-estimation feels like a planning failure, not a correction, so there's implicit pressure to absorb rather than re-scope.
- Sub-phase structure (7A, 7B, etc.) gives an illusion of bounded work where the sub-phases themselves can each absorb overrun.
- No retrospective practice forces us to look at the overrun gap after the fact.

**Proposed mitigations (experimental, track whether these reduce future overruns):**

1. **Re-scope trigger at first session.** If a phase's first working session reveals the original estimate is materially off (say, ±30% or more on the scope surface area), stop planning work, communicate the revised estimate, and write a brief re-scope note into the active phase doc's Decisions Log before continuing. Not a formal rule yet — trial practice.

2. **Overrun retro artifact.** For any phase that actually ships >1.5× its original estimate, a short retrospective doc captures: (a) what the original estimate missed (scope growth, diagnostic surprise, planning imprecision, execution friction), (b) whether a re-scope trigger would have caught it, (c) one calibration note for future phase-estimate work. Stored in `docs/archive/retros/` or similar (CC use judgment on location consistent with existing archive structure; flag in Surprises if no precedent exists). Skipped for phases that ship within 1.5× of estimate — retro is a debugging tool, not a ceremony.

3. **Phase-estimate calibration note in the master plan.** Future FF_LAUNCH_MASTER_PLAN reconciliations should reference observed-vs-estimated ratios from shipped phases when estimating upcoming ones. Phase 8 is currently estimated at 7-12 sessions; if W9's pattern holds, real outcome may be 14-24. The buffer needs to be visible in planning, not only in the risk register.

**Review trigger:** re-evaluate W9 after Phase 8 ships. Specifically: did either proposed mitigation (re-scope trigger, overrun retro) get tried, and did it help? If yes on both, candidate for graduation to DOC_MAINTENANCE_PROCESS §10. If W9's pattern recurs without mitigation, the hypothesis that "absorption is the default" strengthens and may need a stronger intervention.

---

## W10 — Diagnostic sub-phases should isolate measurement from fix

**Status:** Observing
**Opened:** 2026-04-22 (post-Phase-7P retrospective)

**Observation:**

Phase 7P-1 was originally scoped as "P7-45 verification + fix (if needed)" in a single sub-phase — 0.5-1 session. Actual path:

- 7P-1 session #1: instrumentation authored, shipped.
- Follow-up session: `console.time` routing discovered not to surface in Metro; timer pattern swapped to `console.log`. Re-shipped.
- Follow-up session: device test produced the first actual timing data. Four runs captured. Interpretation against D7P-2 decision tree drafted.

The "+ fix (if needed)" language created implicit slack that absorbed the diagnostic time. When the first measurement attempt produced no output (the `console.time` surfacing issue), the problem was treated as part of 7P-1 rather than as its own unit of work, because 7P-1's scope was elastic enough to contain it.

**Pattern identified:**

When a phase combines "take a measurement" with "decide fix scope based on measurement," the measurement work tends to expand to fill available time, because a measurement attempt that produces unexpected output (instrumentation doesn't work, first measurement is inconclusive, data reveals a new question) has nowhere to land except "still part of the same sub-phase."

**Proposed mitigation:**

Any sub-phase whose purpose includes measurement or diagnosis should separate the measurement work from the fix-scope-decision as two distinct sub-phases:

- **Sub-phase N-a:** Instrument. Take one complete measurement. Report.
- **Sub-phase N-b:** Interpret measurement. Decide fix scope. Author fix prompt.

Fix scope is determined AFTER the measurement completes, in a planning pass separate from the measurement session. This is consistent with the Rule D pattern already in effect (CC executes, Claude.ai interprets) — W10 just asserts the separation at the sub-phase level, not only the agent level.

**Counter-consideration:**

For genuinely small diagnostic tasks (single known-working metric, single query, expected-shape-of-result), the overhead of splitting is real. Mitigation should apply when diagnostic outcome is uncertain, not when measurement is routine.

**Review trigger:** re-evaluate W10 after the next diagnostic sub-phase in any future phase. Specifically: was the measurement-vs-fix separation applied? Did it help or feel ceremonial?

---

## W11 — Prompts making schema/API claims should cite the source or mark needs-verification

**Status:** Observing
**Opened:** 2026-04-23 (surfaced during Phase 8B-CP4 pre-flight)

**Observation:**

Phase 8B-CP4's execution prompt asserted two specific schema facts as part of its Part 1 design:

- `posts.space_id` exists (used in `posts.select('id, space_id, recipe_id')` for the depletion's space scope).
- `recipes.ingredients` is a JSONB column parsed for ingredient list.

Both were incorrect against the actual codebase:

- `posts` has no `space_id` column; posts are user-scoped, not space-scoped. `postService.createDishPost` inserts `user_id`, `recipe_id`, `meal_type`, etc. — no `space_id`.
- Recipe ingredients live in a separate `recipe_ingredients` table (`recipe_id`, `ingredient_id`, `quantity_amount`, `quantity_unit`, ...), not a JSONB on `recipes`.

CC caught both during pre-flight (Open Q #1 + #2 STOP conditions fired before any code was written), reported them, and Tom authorized adaptations. Net impact was ~10 min of back-and-forth plus substantive re-design of Part 1 — caught early enough to avoid wasted code, but the same class of error in a less-guarded prompt could produce deeply wrong output before anyone notices.

**Pattern identified:**

Prompts sometimes carry schema/API claims stated as givens — e.g., "posts.space_id", "recipes.ingredients JSONB". When those claims are wrong (stale, inherited from an earlier doc version, or confused with a different table), the prompt's design rests on unstable ground. Absent a citation or verification mark, there's no forcing function to check the claim before CC starts executing. The Open Q STOP pattern works reactively — it relies on CC spotting the mismatch during input reading — but a structural prompt discipline would catch it proactively in Claude.ai's authoring pass.

**Proposed mitigation:**

When a prompt makes a specific schema/API claim (table has column X, function returns Y, file exports Z), the prompt should either:

- **Cite the source** inline: `posts.space_id (verify at lib/services/postService.ts:N)` or `recipes.ingredients JSONB (verify at lib/services/recipeService.ts:N)`. The citation forces Claude.ai to look at the file while authoring; if the claim doesn't hold, the mismatch surfaces in the planning session rather than mid-execution.
- **Mark the claim as needs-verification**: `posts.space_id (needs-verification)` — explicitly flagging that the claim is an assumption to confirm. CC's reading pass then treats it as a STOP gate rather than a given.

Applies most strongly to Part 1 / "compute" / "fetch" steps where the schema shape determines the downstream design. Less critical for UI-wiring prompts that just consume already-designed types.

**Counter-consideration:**

Trivially-known schema facts (e.g., "the `recipes` table exists" — self-evident if the app runs) shouldn't require cites. The mitigation targets non-trivial claims: specific column presence, specific function signatures, specific nested shapes. A rule of thumb: if the claim would cost CC ≥5 min to verify from scratch, cite it; otherwise leave untouched.

Also: adding cites to every prompt adds authoring overhead for Claude.ai. The ROI is highest for "deep" prompts where wrong schema produces long-path downstream errors (like Phase 8B-CP4's Part 1); lowest for mechanical rename/move prompts.

**Review trigger:** re-evaluate W11 after the next non-trivial CC prompt that makes specific schema/API claims. Did Claude.ai remember to cite? If not, did CC catch the issue pre-execution via the Open Q pattern (retroactive), or did wrong-schema code ship (process gap)? Traceback: W11 was opened based on Phase 8B-CP4's SESSION_LOG entry (2026-04-23), specifically the pre-flight STOP on Open Q #1 and #2.

---

## W12 — Pre-written destructive SQL should cite actual CHECK constraint definitions, not assume semantics

**Status:** Observing
**Opened:** 2026-05-18 (surfaced during 8D-CP1 Part 0 execution)

**Observation:**

The 8D-CP1 cheese cleanup migration's Phase 3b was pre-written by Claude.ai assuming `supply_has_identity` was an OR-semantics constraint (either `ingredient_id` OR `custom_name` non-null). The actual constraint is XOR (exactly one non-null). The migration failed twice in production execution — first when Phase 5's FK `ON DELETE SET NULL` cascade fired (because Phase 3b left `ingredient_id` non-null, then Phase 5 nulled it without backfilling `custom_name`, violating XOR via the absence-of-identity path), then again when an interim fix set both `ingredient_id` AND `custom_name` (violating XOR via the both-set path). The successful v2 atomically nulled `ingredient_id`, set `custom_name`, and set `archived_at` in one UPDATE.

The constraint definition lives in `phase_8r_cp1_schema_migration.sql` (committed during 8R-CP1). A targeted grep during prompt authoring would have surfaced it. The schema CSVs that would have helped exist in Claude.ai's project knowledge but not in the repo (filed as DEFERRED_WORK T9).

**Pattern identified:**

Destructive SQL prompts authored by Claude.ai sometimes carry constraint or schema assumptions that aren't verified against the actual constraint text. When the assumption is wrong, the migration fails at execution time — best case, the BEGIN/COMMIT rolls back cleanly (this case); worst case, partial state leaks if a check is missing.

**Proposed mitigation:**

Prompts that include destructive SQL (UPDATE/DELETE/DROP on shared tables) should include a "verify constraints" pre-flight step in the prompt's "Inputs to read" — either citing the constraint by name and source file, or running a `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'X'` query before the destructive phase. The fix is process-only: Claude.ai's prompt-authoring discipline, not a tooling change.

Tighter mitigation depends on closing T9 (repo schema snapshots) — once CSVs are in `docs/schema/`, CC can grep them as part of input reading.

**Counter-consideration:**

For trivially-safe SQL (single-table SELECT, well-known columns), constraint pre-flight adds overhead with no payoff. The mitigation applies to destructive SQL on tables with multiple constraints, FK cascades, or both — i.e., non-trivial migration scenarios.

**Review trigger:** re-evaluate W12 after the next prompt that includes destructive SQL on a table with non-trivial constraints. Did the prompt cite or verify? Did execution succeed first try?

---

## W13 — "Wire to screen X (if it exists)" prompts should verify the screen is currently reachable, not just that the file exists

**Status:** Observing
**Opened:** 2026-05-18 (surfaced during 8D-CP1 Part 3 trigger wiring)

**Observation:**

The 8D-CP1 prompt instructed CC to "wire a hidden invocation from `screens/AdminScreen.tsx` (if it exists)" for the smoke-test runner. CC found `AdminScreen.tsx` in the repo, added the button — but `AdminScreen` was unreachable from the running app (defined in `RootTabParamList` but not registered as a `<Tab.Screen>`; no other screen pushed to it). Tom hit the button-doesn't-do-anything dead end during verification.

A follow-up prompt added an `Admin Tools` row in `SettingsScreen` and registered AdminScreen in `ProfileStackNavigator` — but `ProfileStackNavigator` is also dead code (defined, never mounted). The second runtime error ("action 'navigate' with payload {name:'Admin'} was not handled by any navigator") was the bridge that finally surfaced the dead navigator. A third fix registered Admin in the two live stacks (`FeedStack`, `StatsStack`) where SettingsScreen actually lives.

Total: three prompts to land a one-button feature. Root cause was the false equivalence between "the file exists" and "the screen is reachable from the running app."

**Pattern identified:**

Prompts that wire features to existing screens use "if it exists" as the reachability test. File existence is a weaker test than reachability — a screen can exist in the repo but be defined inside a dead navigator, registered to a param list that's never mounted, or pushed-to via a route that no caller uses. The smoke-test wiring is a clear instance; the dead `ProfileStackNavigator` + unreachable `LogoPlayground` is the latent precedent.

**Proposed mitigation:**

When a prompt wires to or navigates from an existing screen, the prompt should instruct CC to verify reachability by tracing the navigator chain:
1. Find the navigator that registers the target screen.
2. Confirm that navigator is mounted by `Tab.Navigator` or another mounted navigator (transitively).
3. If unreachable, STOP and report rather than wiring blind.

Lightweight version: a single grep step in "Inputs to read" — `grep -n "<Tab.Screen.*{NavigatorName}" App.tsx` — surfaces the gap.

**Counter-consideration:**

For obviously-reachable target screens (the screen Tom is looking at right now, a screen referenced by a route the user just tapped), reachability is implicit. The mitigation applies when the target screen has no recent user-visible interaction — dev tools, admin screens, deeply-nested settings panels.

**Review trigger:** re-evaluate W13 after the next prompt that wires to or navigates from a screen Tom hasn't been actively touching. Did the prompt include a reachability check? Did CC trace the navigator chain?

---

## Closed watchpoints

*(Nothing closed yet — 2026-04-21 is day one.)*

When closing a watchpoint, add an entry here:
```
### W#. [Title] — CLOSED [date]
**Outcome:** [one-line summary of what happened]
**Process-doc impact:** [changes to DOC_MAINTENANCE_PROCESS or CLAUDE.md, or "none"]
```

---

## Review cadence

- **Phase-boundary oversight sessions** naturally review this doc — process health is part of the oversight scope.
- **Ad-hoc review** when introducing new process mechanics, to decide whether a new watchpoint is warranted.
- **Review-trigger outcome discipline.** When a watchpoint's review trigger fires (e.g., "re-evaluate after Phase 8 ships"), the default outcomes are **graduate** (promote the proposed mitigation to a DOC_MAINTENANCE_PROCESS rule if it's proven valuable) or **close** (retire the watchpoint if the concern didn't materialize or the mitigation was tried and didn't help). Continued Observing without progress is the failure mode to avoid — observations accumulate cheaply, but the doc's value depends on watchpoints actually resolving. If a review fires and the signal is genuinely still inconclusive, extend the observation window explicitly by writing a new review trigger rather than defaulting to continued Observing by inaction.
- **No standalone cadence** — this doc integrates into existing rhythms rather than scheduling its own.

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-05-18 | 1.6 | Added W12 (pre-written destructive SQL should cite actual CHECK constraint definitions — surfaced when the 8D-CP1 cheese migration assumed OR-semantics on the XOR `supply_has_identity` constraint) and W13 ("wire to screen X (if it exists)" prompts should verify reachability, not just file existence — surfaced when AdminScreen took three prompts to become reachable). Both Observing. Traceback: SESSION_LOG 2026-05-18 [8D-CP1 cleanup]. |
| 2026-04-23 | 1.5 | Added W11 — prompts making schema/API claims should cite the source or mark needs-verification. Surfaced during Phase 8B-CP4 pre-flight when two STOP conditions fired on stale schema assumptions (posts.space_id, recipes.ingredients JSONB). Traceback: SESSION_LOG 2026-04-23 [Phase 8B-CP4]. |
| 2026-04-22 | 1.4 | Added review-trigger outcome discipline to the Review cadence section: when a watchpoint's review trigger fires, the default outcomes are graduate (to a DOC_MAINTENANCE_PROCESS rule) or close — continued Observing is the failure mode. Motivation: post-Phase-7P retrospective surfaced that watchpoints can accumulate in Observing indefinitely without a forcing function to resolve them. |
| 2026-04-22 | 1.3 | Added W9 (scope overruns on multi-session phases) and W10 (diagnostic sub-phases should isolate measurement from fix) following Phase 7P retrospective. Both observing; review triggers are Phase 8 completion (W9) and next diagnostic sub-phase (W10). |
| 2026-04-22 | 1.2 | Added W8 (New-file PK staging gap). Captures the 4/22 Part A miss where PHASE_8 v0.1 scaffold created during archival session (commit c6c2438) never staged to PK, causing Claude.ai to draft the Part A deltas against stale PK content. Status Open — observing recurrence before considering a DOC_MAINTENANCE_PROCESS rule change. |
| 2026-04-22 | 1.1 | W6 observation: v5.1 first tier populate surfaced three classes of categorical-rule failure (under-inclusion, over-inclusion, structural drift). Patched in PK_CODE_SNAPSHOTS.md v1.1. W5 observation (added later same day): discovery-pass-v2 patch landing surfaced first concrete evidence that Rule D triggers reliably — CC flagged a spec-internal inconsistency rather than silently fixing it. |
| 2026-04-21 | 1.0 | Initial watchpoints doc. Seeded with 7 concerns surfaced during the DOC_MAINTENANCE_PROCESS v5.0 rewrite + CLAUDE.md Standing Rules session. |
