// constants/cookingMethods.ts
// Canonical list of cooking methods matching the DB CHECK constraint on
// posts.cooking_method. Display labels are human-readable; values are the
// exact strings stored in the DB.

export const COOKING_METHODS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'cook', label: 'Cook' },
  { value: 'bake', label: 'Bake' },
  { value: 'bbq', label: 'BBQ' },
  { value: 'roast', label: 'Roast' },
  { value: 'grill', label: 'Grill' },
  { value: 'sauté', label: 'Sauté' },
  { value: 'braise', label: 'Braise' },
  { value: 'fry', label: 'Fry' },
  { value: 'steam', label: 'Steam' },
  { value: 'slow_cook', label: 'Slow Cook' },
  { value: 'soup', label: 'Soup' },
  { value: 'preserve', label: 'Preserve' },
  { value: 'meal_prep', label: 'Meal Prep' },
  { value: 'snack', label: 'Snack' },
  { value: 'eating_out', label: 'Eating Out' },
  { value: 'breakfast', label: 'Breakfast' },
];
