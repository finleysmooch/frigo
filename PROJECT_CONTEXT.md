# Frigo - Strava for Cooking

## Tech Stack
- Frontend: React Native (Expo)
- Backend: Supabase
- Language: TypeScript

## Current State
- Basic cooking mode implemented
- Connected to Supabase
- Test recipe working

## Database Schema
- recipes table: id, title, ingredients (JSONB), instructions (JSONB), prep_time, cook_time
- posts table: id, recipe_id, meal_type, notes, cooked_at

## Next Steps
1. Fix app registration error
2. Add recipe list view
3. Add user authentication

## Common Issues & Fixes
- "App entry not found" - Clear cache with `npx expo start -c`
- Supabase connection - Check lib/supabase.ts has correct URL and key in quotes
