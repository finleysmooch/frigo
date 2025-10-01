# Frigo - Strava for Cooking

## Tech Stack
- Frontend: React Native (Expo) with TypeScript
- Backend: Supabase (PostgreSQL)
- Language: TypeScript
- Platform: iOS & Android mobile app

## Current State (Dec 2024)
✅ Basic cooking mode implemented and working
✅ Connected to Supabase backend
✅ Database schema complete with:
  - user_profiles table
  - recipes table (with chef attribution)
  - chefs table
  - ingredients table
  - posts table (cooking activities)
  - follows table
  - post_likes table
✅ 7 test recipes loaded (Molly Baz, Eden Grinshpan)
✅ App displays recipes and allows cooking mode

## Known Issues
- "Ready in NaN minutes" - need to use prep_time_min and cook_time_min fields
- Only shows one recipe - need recipe list screen
- No user authentication yet
- Posts creation needs to be connected properly

## Database Structure
- Recipes have chef_id linking to chefs table
- Users tracked in user_profiles (extends Supabase auth)
- Posts track when users cook recipes
- Social features ready (follows, likes)

## Next Priority Tasks
1. Fix NaN display issue in App.tsx ✅
2. Build recipe list screen to browse all recipes ✅
3. Add navigation between list and cooking mode ✅
4. Add user authentication (signup/login)
5. Create feed showing posts from followed users

## GitHub Repo
github.com/finleysmooch/frigo

## Key Files
- App.tsx - Main app component with cooking mode
- lib/supabase.ts - Supabase connection config
- package.json - Dependencies

## Test User
ID: 6523b955-827e-4179-92c7-0aeb9ae281d4
Email: tommorley33@gmail.com
Password: EASYpassword123

## Database Migration Status
- ✅ Core tables created
- ⚠️ recipe_ingredients junction table needed
- ⚠️ ingredients table needs population (245 items)
- ⚠️ Need to migrate JSON ingredients to relational structure

## Current Work Thread
- Creating proper ingredients relationships
- Building recipe list view in app
- Fixing NaN display bug
