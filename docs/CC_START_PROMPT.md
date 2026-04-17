cat > /tmp/git_prompt.txt << 'PROMPT_END'
Stage and commit all changes, then push to the main branch on github. Before committing, run git status and git diff --stat to understand the scope of changes.

The commit message should follow this format:

Subject line: Phase 7: Social & Feed Polish — complete (13 sub-phases shipped)

Body (use git commit -m with multiple -m flags for paragraphs, or write to a temp file and use git commit -F):

Phase 7 transforms Frigo into a social cooking app (Strava for cooking).
78 items shipped across 13 sub-phases (7A through 7L) from March 24 to April 17, 2026.

Sub-phases shipped today (April 17):
- 7N: Detail screen polish + feed carousel UX (swipe fix, carousel peek, inline engagement bar, multi-photo select, star picker, keyboard fixes)
- 7M: EditPostScreen — Strava Edit Activity pattern (all fields editable, dirty state, save/cancel/delete, CookDetailScreen cleanup -508 lines)
- 7J: Recipe sharing via native Share API (shareRecipe + sharePost on 3 screens)
- 7K: Chef attribution backfill (147 recipes updated via admin function)
- 7L: Settings visibility defaults (default_visibility on user_profiles, SettingsScreen picker, computeDefaultVisibility wired)

Previously shipped (March 24 — April 15):
- 7A: Bug fixes (P6-4, P6-5)
- 7B/7B-Rev: LogCookSheet, overflow menu, half-star rating, keyboard handling
- 7C: Meal Plan wiring fix
- 7D/7E: Multi-cook data layer + cook-to-meal handoff (5 checkpoints + 4 fix passes)
- 7F: Feed rendering rebuild (MealPostCard, PostCard, stat rows, photo model)
- 7I: Cook-post-centric feed rebuild (7 checkpoints + 3 fix passes, D47 architecture)
- 7G: Historical cook logging (cooked_at, date picker, feed sort switch)
- 7H: My Posts navigation fix (CookDetailScreen target, StatsStack route)

New files: EditPostScreen.tsx, StarRating.tsx, cookingMethods.ts, shareService.ts
Key changes: CookDetailScreen (-508 lines), feedGroupingService (cooked_at sort), PhotoCarousel (peek + count pill + onPhotoPress), App.tsx (route registrations)

42 items deferred to post-F&F. See docs/PHASE_7_STATUS_REPORT.md for full audit.
Reference: docs/PHASE_7_SOCIAL_FEED.md (complete phase doc)

Do NOT modify any source files. Only stage, commit, and push.
Write a SESSION_LOG entry confirming the push succeeded with the commit hash.
PROMPT_END

claude -p "$(cat /tmp/git_prompt.txt)"