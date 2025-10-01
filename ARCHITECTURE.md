# Frigo Architecture

## Data Model
- Ingredients stored in master table
- recipe_ingredients junction connects recipes to ingredients
- User preferences (staples, brands) in user_ingredient_preferences
- Nutrition facts in ingredients table (future: user overrides)

## Key Design Decisions
- Ingredients as separate table (not JSON) for nutrition/shopping
- Chef attribution via chefs table
- Recipe versioning via parent_recipe_id
