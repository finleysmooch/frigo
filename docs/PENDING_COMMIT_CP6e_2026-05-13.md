# Pending commit notes — CP6e-Services + smoke fixes

**Status:** Not committed. Stage + commit when ready.

---

## Commit message (use as-is)

```
CP6e-Services -a/-b/-c + 4 schema fixes (smoke-test caught)

Service-layer build for lot tracking model (Phase 8R / CP6e):

lotsService.ts (NEW): CRUD + deductFromOldest/Specific + getLotAggregate
+ Q44/Q45 auto-flip helpers
cookDepletionService.ts: rewrite preserves API; lot-aware deduction;
Q53 reverses prior demote-on-cook for non-lots supplies;
posts.lot_depletions JSONB persistence; rollbackFromPersistedRecord
for cross-session revert
needsService.ts: acquire-side-effects helper; lot creation on Branch B;
preserves bareness of setNeedStatus signature
suppliesService.ts: tracks_lots toggle + includeLots option on read funcs
4 CP6e-Schema fixes from smoke: RLS vocabulary, RPC CTE ambiguity,
multi-token AND, tsvector INSERT trigger

Smoke test 7/8 scenarios PASSED; Scenario 6 deferred to CP6e-FlowsUI.
Two follow-ups filed (helper ordering trace, recipe unit normalization).
```

---

## Open thread before commit

**P8R-D27 collision.** The stray-duplicate-"Home"-space deferred entry asked for ID `P8R-D27`, which is already taken (UnitPicker no-ingredient mode, DEFERRED_WORK.md:98). Next unused 8R-namespace ID is **P8R-D34**. Pending Tom's call (D34 vs another resolution). Entry text to add:

```
| P8R-D?? | **Stray duplicate "Home" space row.** Space `d627bd4b-e0fa-4224-884a-886e04146de5` exists with same `created_at` as Tom's real space (`7aa945ab-fb32-4197-ae11-e6dbd3392587`) but has 0 supplies and 1 member row. Likely retry artifact from sign-up flow. Investigate whether this pattern affects other users; if so, write a cleanup migration that identifies + archives stray empty spaces sharing created_at with active spaces under the same user. | 🔧 | 🟢 | Post-F&F. Single-row issue; not user-facing. |
```

---

## Scope reminder when staging

`git status` shows ~40+ touched paths, most pre-dating this CP. Stage selectively to keep this commit focused on CP6e-Services + the 4 schema fixes. The CP6e-Services-c session log entry at `docs/SESSION_LOG.md` and the PK_CODE_SNAPSHOTS staleness updates belong here. The 4 schema fixes are Tom's work — paths to be confirmed at commit time.
