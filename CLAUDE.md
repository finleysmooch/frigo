# Frigo - Project Context for Claude Code

## What is Frigo?
Frigo is a "Strava for cooking" mobile app - users track their cooking, manage pantries, discover recipes, and share with friends.

## Tech Stack
- **Frontend:** React Native + Expo + TypeScript
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **AI:** Claude API for recipe extraction from photos/URLs
- **State:** React Context (SpaceContext, etc.)

---

## Documentation System

### What to read every session
1. **This file** (CLAUDE.md) — conventions, instructions, tracker format
2. **docs/FRIGO_ARCHITECTURE.md** — codebase map, services, patterns, domain boundaries

### What to read only when referenced in the prompt
3. **docs/DEFERRED_WORK.md** — master backlog (only if the prompt references specific items)

### What to write
4. **docs/SESSION_LOG.md** — Write a detailed entry after every session (format below)

### What NOT to edit
- Do not edit FRIGO_ARCHITECTURE.md, DEFERRED_WORK.md, or any other living docs
- Flag recommended changes in your SESSION_LOG entry — Claude.ai will make the edits

### SESSION_LOG Entry Format

The session log is the contract between Claude Code and Claude.ai. Entries must be detailed enough for Claude.ai to update all living docs without guessing. Add new entries at the TOP of the file.

```markdown
### YYYY-MM-DD — [Brief Title]
**Phase:** [which phase, or "cross-cutting"]
**Prompt from:** [brief description of what Claude.ai asked for]

**Files created:**
- [file] — [purpose and key design choices]

**Files modified:**
- [file] — [what changed and why]

**DB changes:** [migrations, schema changes, or "none"]

**Decisions made during execution:**
- [Decision]: [Why — especially anything not specified in the prompt]

**Deferred during execution:**
- [Item]: [Why deferred, what would be needed]

**Recommended doc updates:**
- ARCHITECTURE: [what to add/change and why it matters]
- DEFERRED_WORK: [any items that should be tracked]
- PROJECT_CONTEXT: [any changes to "what works" or known issues]

**Status:** [What's working, what needs testing, blockers]

**Surprises / Notes for Claude.ai:**
- [Anything unexpected that affects planning]
```

### Key principles
- **Follow decisions/constraints from Claude.ai prompts** — don't re-decide things that have already been decided
- **Be detailed in SESSION_LOG** — Claude.ai depends on these entries to maintain all project documentation
- **When in doubt, flag it** — use "Recommended doc updates" and "Surprises" to surface anything Claude.ai should know

---

## Project Structure
```
frigo/
├── App.tsx                 # Main entry, navigation setup
├── screens/                # Screen components
├── components/             # Reusable components
│   └── modals/            # Modal components
├── contexts/              # React Context providers
│   └── SpaceContext.tsx   # Shared pantry spaces
├── lib/
│   ├── services/          # Business logic + Supabase calls
│   ├── types/             # TypeScript type definitions
│   └── theme.ts           # Theme constants
└── assets/                # Images, icons, fonts
```

## 8 Domains
All code maps to one of these domains:

| Domain | Scope |
|--------|-------|
| Recipe | Recipe CRUD, cookbooks, extraction, annotations |
| Cooking | Active cooking mode, timers, voice control |
| Planning | Meals, cook soon, calendar |
| Social | Feed, posts, comments, partners |
| Pantry | Inventory, spaces, expiration |
| Grocery | Lists, stores, regular items |
| Discovery | Search, filters, suggestions |
| Platform | Auth, navigation, settings, theme |

## Code Conventions
- Services handle ALL Supabase/database calls
- Components should NOT call Supabase directly
- Use TypeScript strictly - define types for everything
- Prefer simple solutions over clever ones
- Don't remove existing functionality unless asked
- Owner is learning React Native - explain non-obvious code

## Key Features (Built)
- ✅ Recipe management (add via photo, URL, manual)
- ✅ Pantry tracking with inline editing
- ✅ Grocery lists
- ✅ Cooking mode
- ✅ Social feed with posts
- ✅ Meal planning
- ✅ Shared Pantries (Spaces)
- ✅ Nutrition data + dietary badges
- ✅ Smart recipe browse (3 modes, expandable cards, 60 SVG icons)
- ✅ Test data seeded (1,740 posts, 17 users, full year)
- ✅ Stats dashboard with WeeklyChart (5 modes: meals, calories, protein, veg%, new/repeat)
- ✅ Stats Recipes page: Kitchen/Frontier sections, podium, bubble map, family ingredient chips
- ✅ Frontier Cards (worth exploring suggestions) + Gateway Card insights with period comparisons
- ✅ Nutrition page: Frigo color palette, macro summary cards, macro/secondary divider
- ✅ Insights page: Cooking Personality Card, Growth Timeline, diversity growth context, compact complexity

## Commands
```bash
npx expo start          # Start development
npx expo start --ios    # iOS simulator
npx expo start --android # Android emulator
```

---

## Tracker Row Generation

When asked to "generate tracker rows" after a commit, follow the spec in `docs/TRACKER_SPEC.md`.

**Quick reference:** 13 tab-separated columns → `docs/tracker_update.tsv`
```
EntryDate | File | Status | ReplacedBy | Domain | Type | Lines | CodeDate | Imports | Exports | Purpose | Changes | Notes
```

Read `docs/TRACKER_SPEC.md` for column definitions, path rules, examples, and the generation workflow.