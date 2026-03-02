# Frigo - Project Context for Claude Code

## What is Frigo?
Frigo is a "Strava for cooking" mobile app - users track their cooking, manage pantries, discover recipes, and share with friends.

## Tech Stack
- **Frontend:** React Native + Expo + TypeScript
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **AI:** Claude API for recipe extraction from photos/URLs
- **State:** React Context (SpaceContext, etc.)

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

## Commands
```bash
npx expo start          # Start development
npx expo start --ios    # iOS simulator
npx expo start --android # Android emulator
```

---

## Tracker Row Generation

When asked to "generate tracker rows" after a commit, output tab-separated rows for the Code_Log spreadsheet.

### Columns (tab-separated):
```
EntryDate | File | Status | ReplacedBy | Domain | Type | Lines | CodeDate | Imports | Exports | Purpose | Changes | Notes
```

### How to determine values:
- **EntryDate:** YYYY-MM-DD
- **Status:** `Active` | `Renamed` | `Deleted`
- **Domain:** Use text from 8 Domains above (match by filename keywords)
- **Type:** `Screen` | `Modal` | `Service` | `Component` | `Utility`
- **CodeDate:** DDMMMYY (e.g., `29JAN25`)
- **Purpose:** `[PURPOSE]` for new files, blank for updates (persists via formula)
- **Changes:** Commit message + file-specific details

### Examples:

**New file:**
```
2025-01-29	NewModal.tsx	Active		Recipe	Modal	234	29JAN25	theme; types	NewModal	[PURPOSE]	feat(recipes): Add modal	
```

**Modified file:**
```
2025-01-29	recipeService.ts	Active		Recipe	Service	445	29JAN25	supabase	updateRecipe		feat(recipes): Add scaling	
```

**Renamed (TWO rows):**
```
2025-01-29	OldName.tsx	Renamed	NewName.tsx								refactor: Rename	
2025-01-29	NewName.tsx	Active		Recipe	Modal	234	29JAN25	imports	exports	[PURPOSE]	refactor: Renamed from OldName	
```

**Deleted:**
```
2025-01-29	DeadFile.tsx	Deleted									chore: Remove unused	
```

### Workflow:
1. Get commit message: `git log -1 --pretty=%s`
2. Get changed files: `git diff-tree --no-commit-id --name-status -r HEAD`
3. Generate row for each .ts/.tsx file
4. Output with reminder to fill Purpose for new files