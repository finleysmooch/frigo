// ============================================
// FRIGO - PANTRY CONSTANTS
// ============================================
// Icons, storage options, and taxonomy mappings for pantry UI
// Location: constants/pantry.ts

// ============================================
// FAMILY ICONS
// ============================================

export const FAMILY_ICONS = {
  'Produce': '🥬',
  'Proteins': '🥩',
  'Dairy': '🧀',
  'Pantry': '🥫',
} as const;

// ============================================
// INGREDIENT TYPE ICONS
// ============================================

export const INGREDIENT_TYPE_ICONS = {
  // Produce
  'Vegetables': '🥗',
  'Leafy Greens': '🥗',
  'Root Vegetables': '🥕',
  'Alliums': '🧅',
  'Citrus': '🍋',
  'Fruits': '🍎',
  'Gourds': '🎃',
  'Fresh Herbs': '🌿',
  'Mushrooms': '🍄',
  
  // Proteins
  'Red Meat': '🥩',
  'Poultry': '🍗',
  'Seafood': '🐟',
  'Plant-Based Proteins': '🫘',
  
  // Dairy
  'Fresh Dairy': '🥛',
  'Cultured Dairy': '🧈',
  'Cheese': '🧀',
  'Butter': '🧈',
  'Eggs': '🥚',
  
  // Pantry
  'Grains': '🌾',
  'Baking': '🧁',
  'Oils & Fats': '🫒',
  'Vinegars': '🍶',
  'Condiments & Sauces': '🌶️',
  'Spices & Dried Herbs': '🌶️',
  'Nuts & Seeds': '🥜',
  'Dried Fruit': '🫐',
  'Canned/Jarred Goods': '🥫',
  'Legumes': '🫘',
} as const;

// ============================================
// STORAGE LOCATIONS
// ============================================

export const STORAGE_LOCATIONS = [
  { value: 'fridge' as const, label: 'Fridge', emoji: '❄️' },
  { value: 'freezer' as const, label: 'Freezer', emoji: '🧊' },
  { value: 'pantry' as const, label: 'Pantry', emoji: '🏺' },
  { value: 'counter' as const, label: 'Counter', emoji: '🪴' },
] as const;

// ============================================
// EXPIRATION UNITS
// ============================================

export const EXPIRATION_UNITS = [
  { value: 'days', label: 'days', singular: 'day' },
  { value: 'weeks', label: 'weeks', singular: 'week' },
  { value: 'months', label: 'months', singular: 'month' },
] as const;

// ============================================
// QUANTITY PRESETS
// ============================================

// Common quantity values for scroll picker (0.25 to 20 in sensible increments)
export const QUANTITY_VALUES = [
  0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 4.5, 5,
  6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
];

// ============================================
// EXPIRING THRESHOLD (CONFIGURABLE)
// ============================================

export const EXPIRING_SOON_DAYS = 3; // Items expiring within 3 days (configurable)

// Expiration color coding
export const EXPIRATION_COLORS = {
  CRITICAL: '#E53E3E', // Red: today or 1 day (0-1)
  WARNING: '#F59E0B',  // Orange: 2-3 days
  SAFE: '#10B981',     // Green: 4+ days
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get emoji icon for an ingredient family
 */
export function getFamilyIcon(family: string): string {
  return FAMILY_ICONS[family as keyof typeof FAMILY_ICONS] || '📦';
}

/**
 * Get emoji icon for an ingredient type
 */
export function getTypeIcon(type: string | null): string {
  if (!type) return '📦';
  return INGREDIENT_TYPE_ICONS[type as keyof typeof INGREDIENT_TYPE_ICONS] || '📦';
}

/**
 * Get storage location display info
 */
export function getStorageInfo(location: string) {
  return STORAGE_LOCATIONS.find(s => s.value === location) || STORAGE_LOCATIONS[0];
}

/**
 * Get expiration unit display
 */
export function getExpirationUnitLabel(value: number, unit: string): string {
  const unitInfo = EXPIRATION_UNITS.find(u => u.value === unit);
  if (!unitInfo) return unit;
  return value === 1 ? unitInfo.singular : unitInfo.label;
}

/**
 * Get color for expiration based on days remaining
 * Red (critical): 0-1 days
 * Orange (warning): 2-3 days
 * Green (safe): 4+ days
 */
export function getExpirationColor(daysUntilExpiration: number): string {
  if (daysUntilExpiration <= 1) return EXPIRATION_COLORS.CRITICAL;
  if (daysUntilExpiration <= 3) return EXPIRATION_COLORS.WARNING;
  return EXPIRATION_COLORS.SAFE;
}