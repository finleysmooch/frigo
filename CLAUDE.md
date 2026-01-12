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
│   ├── PantryScreen.tsx
│   ├── RecipeListScreen.tsx
│   ├── RecipeDetailScreen.tsx
│   ├── CookingScreen.tsx
│   ├── FeedScreen.tsx
│   └── ...
├── components/             # Reusable components
│   ├── modals/            # Modal components
│   └── ...
├── contexts/              # React Context providers
│   └── SpaceContext.tsx   # Shared pantry spaces
├── lib/
│   ├── services/          # Business logic + Supabase calls
│   │   ├── pantryService.ts
│   │   ├── recipeService.ts
│   │   ├── spaceService.ts
│   │   └── ...
│   ├── types/             # TypeScript type definitions
│   │   ├── pantry.ts
│   │   ├── recipe.ts
│   │   ├── space.ts
│   │   └── ...
│   └── theme.ts           # Current theme (being refactored)
└── assets/                # Images, icons, fonts
```

## Code Conventions
- Services handle ALL Supabase/database calls
- Components should NOT call Supabase directly
- Use TypeScript strictly - define types for everything
- Prefer simple solutions over clever ones
- User is learning React Native - explain non-obvious code

## Current Theme (OLD - Being Replaced)
The current theme in `lib/theme.ts` uses green colors (#4A9B4F).
We are refactoring to a new teal-based theme system with swappable color schemes.

## New Theme System (Being Implemented)
Target structure:
```
lib/theme/
├── index.ts           # Exports ThemeProvider, useTheme hook
├── schemes.ts         # Color scheme definitions
├── ThemeContext.tsx   # React Context for theme
└── typography.ts      # Font definitions (Outfit, Poppins)
```

### New Color Schemes
All schemes share primary teal (#0d9488), with different accents:

| Scheme | Primary | Accent | Background |
|--------|---------|--------|------------|
| limeZing | #0d9488 | #84cc16 | #f0fdfa |
| softSage | #0d9488 | #6ee7b7 | #fafaf9 |
| tealMintSlate | #0d9488 | #34d399 | #f8fafc |
| tealMintWarm | #0d9488 | #34d399 | #fafaf9 |

### Theme Usage Pattern
```typescript
// In any component:
import { useTheme } from '../lib/theme';

const MyComponent = () => {
  const { colors, fonts, spacing } = useTheme();
  
  return (
    <View style={{ backgroundColor: colors.background.primary }}>
      <Text style={{ color: colors.text.primary, fontFamily: fonts.heading }}>
        Hello
      </Text>
    </View>
  );
};
```

## Key Features (Already Built)
- ✅ Recipe management (add via photo, URL, manual)
- ✅ Pantry tracking with inline editing
- ✅ Grocery lists
- ✅ Cooking mode
- ✅ Social feed with posts
- ✅ Meal planning (basic)
- ✅ Shared Pantries Phase 1 (Spaces)

## Known Issues
- Some Text component warnings in FeedScreen
- Duplicate key warnings in LinkedPostsGroup

## Commands
```bash
# Start development
npx expo start

# Run on iOS simulator
npx expo start --ios

# Run on Android emulator
npx expo start --android
```

## Important Notes
- Owner is learning to code - explain what you're doing
- Prefer simple, working solutions over complex ones
- Don't remove existing functionality unless asked
- Test changes work before moving to next task