# Frigo - Strava for Cooking

## Tech Stack
- Frontend: React Native (Expo) with TypeScript
- Backend: Supabase (PostgreSQL)
- Language: TypeScript
- Platform: iOS & Android mobile app

## Current State (October 2025)

### ✅ Core Features Working
- Basic cooking mode with keep-awake functionality
- Recipe list view with chef attribution
- Recipe detail screen with ingredients grouped by family
- Admin testing panel for ingredient parsing
- Connected to Supabase backend with RLS policies

### ✅ Database Schema Complete
**User & Social:**
- `user_profiles` - extends Supabase auth
- `follows` - social following relationships
- `post_likes` - engagement tracking

**Recipe System:**
- `recipes` - main recipe data with chef attribution
- `chefs` - chef profiles (Molly Baz, Eden Grinshpan)
- `ingredients` - master ingredient list with hierarchy support
- `recipe_ingredients` - junction table with confidence scoring
- `recipe_ingredient_alternatives` - OR pattern support
- `posts` - cooking activity tracking

**Tracking & Analytics:**
- `or_pattern_decisions` - tracks every OR pattern for learning
- Views: `or_pattern_analysis`, `migration_readiness`, `remaining_review_items`

### ✅ Ingredient Parser v2.2
- Parses quantities, units, and preparations from recipe text
- Confidence-based matching (0.0 to 1.0 scores)
- OR pattern detection ("jalapeños or fresno chiles")
- Color variant recognition (red/green = equivalent)
- Parent-child ingredient hierarchy (generic "sugar" vs specific types)
- Flags new ingredients for database addition
- Preserves original recipe text for display
- Tracks all decisions for future ML migration

### 📊 Data Status
- 7 test recipes loaded
- 300+ ingredients in master table
- OR pattern tracking active (Option A - simple rules)
- Ready for Option B migration at 100+ patterns

## Known Issues & TODOs

### Current Issues
- Some color variants still need proper detection refinement
- Missing ingredients need continuous addition
- Recipe display should use `original_text` not matched names

### Next Priority Tasks
1. ✅ ~~Fix NaN display issue~~
2. ✅ ~~Build recipe list screen~~
3. ✅ ~~Add navigation between screens~~
4. ✅ ~~Create junction table structure~~
5. ✅ ~~Implement ingredient parser~~
6. 🔄 Add user authentication (signup/login)
7. 🔄 Create feed showing posts from followed users
8. 🔄 Implement pantry/inventory tracking
9. 🔄 Build smart shopping list generation

## File Structure
```
Frigo/
├── lib/
│   ├── supabase.ts           # Supabase client config
│   └── ingredientsParser.ts  # v2.2 parser with OR patterns
├── screens/
│   ├── CookingScreen.tsx     # Cooking mode UI
│   ├── RecipeListScreen.tsx  # Browse recipes
│   ├── RecipeDetailScreen.tsx # Recipe with ingredients
│   └── AdminScreen.tsx       # Testing & debugging panel
├── App.tsx                   # Main app with tab navigation
└── package.json             # Dependencies
```

## GitHub Repo
github.com/finleysmooch/frigo

## Test User
- ID: 6523b955-827e-4179-92c7-0aeb9ae281d4
- Email: tommorley33@gmail.com
- Password: EASYpassword123

## Migration Status
**Option A (Current):** Simple hardcoded rules for OR patterns
**Option B (Future):** Database-driven relationships based on tracked patterns
**Tracking:** All OR patterns logged to `or_pattern_decisions` table
**Ready at:** 100+ tracked patterns (check `migration_readiness` view)
