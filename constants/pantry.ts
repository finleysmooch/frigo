import { ComponentType } from 'react';
import {
  VegetablesIcon, MeatIcon, DairyProductsIcon, CannedFoodIcon,
  LeafyGreensIcon, CarrotIcon, GarlicIcon, LemonIcon, FruitIcon,
  SquashIcon, HerbIcon, MushroomIcon, SteakIcon, PoultryIcon,
  SeafoodIcon, TofuIcon, MilkIcon, YogurtIcon, CheeseIcon,
  ButterIcon, EggsIcon, GrainIcon, BakingIcon, OliveOilIcon,
  OilIcon, CondimentIcon, SpicesIcon, NutsIcon, RaisinsIcon, BeansIcon,
  FridgeIcon, ColdIcon, PantryFilled,
} from '../components/icons';

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

// Map lowercase DB values (from ingredient suggestion service) to canonical type keys
const INGREDIENT_TYPE_ALIASES: Record<string, string> = {
  'vegetable': 'Vegetables',
  'fruit': 'Fruits',
  'herb': 'Fresh Herbs',
  'meat': 'Red Meat',
  'dairy': 'Fresh Dairy',
  'seafood': 'Seafood',
  'mushroom': 'Mushrooms',
  'produce': 'Vegetables',
  'spice': 'Spices & Dried Herbs',
  'pantry staple': 'Canned/Jarred Goods',
  'legume': 'Legumes',
  'grain': 'Grains',
  'nut': 'Nuts & Seeds',
};

/**
 * Get emoji icon for an ingredient type
 */
export function getTypeIcon(type: string | null): string {
  if (!type) return '📦';
  const canonical = INGREDIENT_TYPE_ALIASES[type.toLowerCase()] || type;
  return INGREDIENT_TYPE_ICONS[canonical as keyof typeof INGREDIENT_TYPE_ICONS]
    || INGREDIENT_TYPE_ICONS[type as keyof typeof INGREDIENT_TYPE_ICONS]
    || '📦';
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

// ============================================
// COMPONENT-BASED ICON MAPPINGS
// ============================================

type IconComponent = ComponentType<{ size?: number; color?: string }>;

export const FAMILY_ICON_COMPONENTS: Record<string, IconComponent> = {
  'Produce': VegetablesIcon,
  'Proteins': MeatIcon,
  'Dairy': DairyProductsIcon,
  'Pantry': PantryFilled,
};

export const INGREDIENT_TYPE_ICON_COMPONENTS: Record<string, IconComponent> = {
  'Vegetables': VegetablesIcon,
  'Leafy Greens': LeafyGreensIcon,
  'Root Vegetables': CarrotIcon,
  'Alliums': GarlicIcon,
  'Citrus': LemonIcon,
  'Fruits': FruitIcon,
  'Gourds': SquashIcon,
  'Fresh Herbs': HerbIcon,
  'Mushrooms': MushroomIcon,
  'Red Meat': SteakIcon,
  'Poultry': PoultryIcon,
  'Seafood': SeafoodIcon,
  'Plant-Based Proteins': TofuIcon,
  'Fresh Dairy': MilkIcon,
  'Cultured Dairy': YogurtIcon,
  'Cheese': CheeseIcon,
  'Butter': ButterIcon,
  'Eggs': EggsIcon,
  'Grains': GrainIcon,
  'Baking': BakingIcon,
  'Oils & Fats': OliveOilIcon,
  'Vinegars': OilIcon,
  'Condiments & Sauces': CondimentIcon,
  'Spices & Dried Herbs': SpicesIcon,
  'Nuts & Seeds': NutsIcon,
  'Dried Fruit': RaisinsIcon,
  'Canned/Jarred Goods': CannedFoodIcon,
  'Legumes': BeansIcon,
};

export const STORAGE_ICON_COMPONENTS: Record<string, IconComponent> = {
  'fridge': FridgeIcon,
  'freezer': ColdIcon,
  'pantry': PantryFilled,
  // 'counter' — no SVG yet, falls back to emoji
};

export function getFamilyIconComponent(family: string): IconComponent | null {
  return FAMILY_ICON_COMPONENTS[family] || null;
}

export function getTypeIconComponent(type: string | null): IconComponent | null {
  if (!type) return null;
  const canonical = INGREDIENT_TYPE_ALIASES[type.toLowerCase()] || type;
  return INGREDIENT_TYPE_ICON_COMPONENTS[canonical] || INGREDIENT_TYPE_ICON_COMPONENTS[type] || null;
}

export function getStorageIconComponent(storage: string): IconComponent | null {
  return STORAGE_ICON_COMPONENTS[storage.toLowerCase()] || null;
}