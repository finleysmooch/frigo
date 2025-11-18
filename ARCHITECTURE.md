# Frigo Architecture

## System Overview
Frigo is a social cooking app that tracks recipe preparation like Strava tracks workouts. Built with React Native/Expo frontend and Supabase (PostgreSQL) backend.

## Data Model

### Core Entities

#### Ingredients System (Hierarchical)
```
ingredients (master table)
├── id, name, plural_name, family
├── ingredient_type, ingredient_subtype  
├── base_ingredient_id (self-reference for parent-child)
├── nutrition facts (per 100g)
└── typical_unit, typical_quantity

recipe_ingredients (junction with intelligence)
├── recipe_id → recipes
├── ingredient_id → ingredients (nullable if no match)
├── original_text (preserves exact recipe wording)
├── quantity_amount, quantity_unit, preparation
├── match_confidence (0.0-1.0)
├── match_method (exact|fuzzy|partial|none)
├── match_notes (explanation of matching decision)
├── needs_review (boolean flag)
├── optional_confidence, substitute_confidence
└── timing fields (prep, cook, inactive)

recipe_ingredient_alternatives (OR patterns)
├── recipe_ingredient_id → recipe_ingredients
├── alternative_ingredient_id → ingredients
├── is_equivalent (true for red/green, false for primary/alt)
└── preference_order
```

#### Recipe & Social System
```
recipes → chefs (attribution)
posts → recipes (cooking activities)
user_profiles → follows → posts → post_likes
```

### Ingredient Matching Logic

#### Confidence Scoring System
- **1.0** - Exact match found
- **0.8** - Fuzzy match (removed descriptors like "extra-virgin")
- **0.6-0.7** - Partial match or generic parent
- **0.5** - Fallback to generic ingredient
- **0.0** - No match found

#### OR Pattern Detection (Option A - Current)
Simple rules-based approach:
1. Color variants → Equivalent (red/green cabbage)
2. Common substitutions → Primary/Alternative (butter/oil)
3. All patterns tracked to `or_pattern_decisions` for learning

#### Future: Option B (ML-Based)
After 100+ tracked patterns, migrate to data-driven relationships stored in `ingredient_relationships` table.

## Key Design Decisions

### 1. Preserve Original Text
- Always store and display exact recipe wording
- Never show users our "matched" ingredient names
- Maintains recipe author's intent

### 2. Ingredients as Relational Data
- Moved from JSON arrays to proper junction table
- Enables nutrition calculations
- Supports smart shopping lists
- Allows pantry matching

### 3. Confidence Over Forcing
- Never force matches with low confidence
- Flag uncertain matches for review
- Learn from patterns over time

### 4. Hierarchical Ingredients
```
sugar (parent, base_ingredient_id = NULL)
├── white sugar (base_ingredient_id → sugar)
├── brown sugar (base_ingredient_id → sugar)
└── powdered sugar (base_ingredient_id → sugar)
```
Allows fallback when specific type not specified.

### 5. Track Everything for Learning
Every OR pattern decision logged with:
- What was detected
- How we decided (equivalent vs primary)
- Confidence level
- Reasoning

## Processing Pipeline

### Recipe Import Flow
```
1. Recipe JSON ingredients array
   ["2 tablespoons extra-virgin olive oil", "purple or green cabbage"]
                    ↓
2. Parser extracts structure
   {quantity: 2, unit: "tablespoon", ingredient: "extra-virgin olive oil"}
                    ↓
3. Matching attempts (in order):
   a. Exact match → confidence 1.0
   b. Simplified match → confidence 0.8
   c. Partial match → confidence 0.6
   d. Generic parent → confidence 0.5
   e. No match → confidence 0.0, needs_review = true
                    ↓
4. OR patterns detected & tracked
   Equivalent options OR Primary/Alternative
                    ↓
5. Store in recipe_ingredients + alternatives
```

### Display Flow
```
recipe_ingredients.original_text → UI Component → User sees exact recipe text
         ↓ (hidden from user)
    ingredient_id → nutritional data, shopping list, pantry matching
```

## Analytics & Views

### Analysis Views
- `or_pattern_analysis` - Aggregated OR patterns across recipes
- `migration_readiness` - Progress toward Option B (100+ patterns)
- `remaining_review_items` - Ingredients needing manual review
- `unmatched_ingredients` - Items that couldn't be matched

### Tracking Tables
- `or_pattern_decisions` - Every OR pattern decision logged
- `user_ingredient_choices` - Future: track what users actually cook with

## State Management

### Frontend (React Native)
- Screen-level state with useState
- Supabase client for data fetching
- No global state management yet (will add Context/Redux as needed)

### Backend (Supabase)
- Row Level Security (RLS) policies
- Postgres triggers for updated_at
- Views for complex queries
- Functions for analysis (when stable)

## Performance Optimizations

### Database
- Indexes on foreign keys and frequently queried fields
- Materialized views for analysis (future)
- GENERATED columns for computed values (total_time_min)

### Parser
- Batch loading of ingredients (one query per recipe)
- Cached ingredient list during processing
- Optional chaining for safe property access

## Security

### Current Implementation
- RLS policies on all tables
- Authenticated users can read recipes
- Recipe owners can modify their data
- Public read for recipes/ingredients

### Future Considerations
- User-specific pantry privacy
- Shared shopping lists permissions
- Chef verification system

## Testing Infrastructure

### Admin Panel Features
- OR pattern parser testing
- Tracking record verification
- Recipe ingredient inspection
- Real recipe processing test

### SQL Verification Queries
Built-in analysis queries for monitoring system health and data quality.

## Future Architecture Considerations

### Scaling
- Consider Redis for ingredient cache
- Move parser to edge function for performance
- Implement queue for bulk recipe imports

### Features Pipeline
1. **Authentication** - Supabase Auth with social login
2. **Pantry Tracking** - User inventory management
3. **Smart Shopping** - List generation from recipes
4. **Social Feed** - Follow other cooks, see their posts
5. **Meal Planning** - Weekly/monthly planning tools

### Data Evolution
- Recipe versioning (track changes over time)
- User-submitted ingredients
- Crowdsourced OR pattern validation
- Regional ingredient variations
