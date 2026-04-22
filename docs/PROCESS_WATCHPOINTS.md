# Process Watchpoints
**Last Updated:** April 22, 2026
**Version:** 1.1

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
- **No standalone cadence** — this doc integrates into existing rhythms rather than scheduling its own.

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-04-22 | 1.1 | W6 observation: v5.1 first tier populate surfaced three classes of categorical-rule failure (under-inclusion, over-inclusion, structural drift). Patched in PK_CODE_SNAPSHOTS.md v1.1. W5 observation (added later same day): discovery-pass-v2 patch landing surfaced first concrete evidence that Rule D triggers reliably — CC flagged a spec-internal inconsistency rather than silently fixing it. |
| 2026-04-21 | 1.0 | Initial watchpoints doc. Seeded with 7 concerns surfaced during the DOC_MAINTENANCE_PROCESS v5.0 rewrite + CLAUDE.md Standing Rules session. |
