// ============================================
// FRIGO - PANTRY HELPERS
// ============================================
// Utility functions for pantry item grouping and expiration calculations
// Location: utils/pantryHelpers.ts

import { PantryItemWithIngredient } from '../lib/types/pantry';
import { EXPIRING_SOON_DAYS, INGREDIENT_TYPE_ICONS } from '../constants/pantry';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface GroupedByFamily {
  [family: string]: GroupedByType;
}

export interface GroupedByType {
  [type: string]: PantryItemWithIngredient[];
}

export interface FamilySection {
  family: string;
  totalCount: number;
  expiringCount: number;
  types: TypeSection[];
}

export interface TypeSection {
  type: string;
  items: PantryItemWithIngredient[];
  expiringCount: number;
}

export interface StorageSection {
  storage: string;
  totalCount: number;
  expiringCount: number;
  families: FamilyInStorage[];
}

export interface FamilyInStorage {
  family: string;
  items: PantryItemWithIngredient[];
  expiringCount: number;
}

// ============================================
// EXPIRATION CALCULATIONS
// ============================================

/**
 * Get days until expiration (can be negative if expired)
 */
export function getDaysUntilExpiration(expirationDate: string | null): number {
  if (!expirationDate) return Infinity;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const expiry = new Date(expirationDate);
  expiry.setHours(0, 0, 0, 0);
  
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Check if item is expiring soon (within threshold)
 */
export function isExpiringSoon(expirationDate: string | null): boolean {
  const days = getDaysUntilExpiration(expirationDate);
  return days >= 0 && days <= EXPIRING_SOON_DAYS;
}

/**
 * Check if item is expired
 */
export function isExpired(expirationDate: string | null): boolean {
  const days = getDaysUntilExpiration(expirationDate);
  return days < 0;
}

/**
 * Format expiration display (e.g., "3d", "2w", "expired")
 */
export function formatExpirationShort(expirationDate: string | null): string {
  if (!expirationDate) return '';
  
  const days = getDaysUntilExpiration(expirationDate);
  
  if (days < 0) return 'expired';
  if (days === 0) return 'today';
  if (days === 1) return '1d';
  if (days <= 7) return `${days}d`;
  if (days <= 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks}w`;
  }
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

// ============================================
// GROUPING FUNCTIONS
// ============================================

/**
 * Group items by family and then by type
 */
export function groupItemsByFamilyAndType(
  items: PantryItemWithIngredient[]
): GroupedByFamily {
  const grouped: GroupedByFamily = {};
  
  items.forEach(item => {
    const family = item.ingredient.family || 'Other';
    const type = item.ingredient.ingredient_type || 'Uncategorized';
    
    if (!grouped[family]) {
      grouped[family] = {};
    }
    
    if (!grouped[family][type]) {
      grouped[family][type] = [];
    }
    
    grouped[family][type].push(item);
  });
  
  return grouped;
}

/**
 * Get expiring items (items expiring within threshold days)
 */
export function getExpiringItems(
  items: PantryItemWithIngredient[]
): PantryItemWithIngredient[] {
  return items.filter(item => isExpiringSoon(item.expiration_date));
}

/**
 * Convert grouped data to sections for rendering
 * Sorts types by expiring count, then alphabetically
 */
export function convertToFamilySections(
  groupedByFamily: GroupedByFamily
): FamilySection[] {
  const sections: FamilySection[] = [];
  
  Object.entries(groupedByFamily).forEach(([family, types]) => {
    const typesSections: TypeSection[] = [];
    let familyTotal = 0;
    let familyExpiring = 0;
    
    Object.entries(types).forEach(([type, items]) => {
      const expiringInType = items.filter(item => 
        isExpiringSoon(item.expiration_date)
      ).length;
      
      typesSections.push({
        type,
        items,
        expiringCount: expiringInType,
      });
      
      familyTotal += items.length;
      familyExpiring += expiringInType;
    });
    
    // Sort types: expiring first, then alphabetically
    typesSections.sort((a, b) => {
      if (a.expiringCount !== b.expiringCount) {
        return b.expiringCount - a.expiringCount;
      }
      return a.type.localeCompare(b.type);
    });
    
    sections.push({
      family,
      totalCount: familyTotal,
      expiringCount: familyExpiring,
      types: typesSections,
    });
  });
  
  // Sort families: Produce, Proteins, Dairy, Pantry, then others
  const familyOrder = ['Produce', 'Proteins', 'Dairy', 'Pantry'];
  sections.sort((a, b) => {
    const aIndex = familyOrder.indexOf(a.family);
    const bIndex = familyOrder.indexOf(b.family);
    
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    
    return a.family.localeCompare(b.family);
  });
  
  return sections;
}

/**
 * Get type breakdown summary for category header
 * Example: "🥗 Leafy Greens (2 soon), 🥕 Root Veg (2), 🧅 Alliums (3)"
 */
export function getTypeBreakdownSummary(
  types: TypeSection[],
  getTypeIcon: (type: string) => string
): string {
  return types
    .map(({ type, items, expiringCount }) => {
      const icon = getTypeIcon(type);
      const shortType = type.replace('Vegetables', 'Veg');
      const count = items.length;
      const expiring = expiringCount > 0 ? ` (${expiringCount} soon)` : '';
      return `${icon} ${shortType} (${count}${expiring})`;
    })
    .join(', ');
}

/**
 * Calculate new expiration date when moving items between storage
 */
export function calculateNewExpiration(
  storageLocation: 'fridge' | 'freezer' | 'pantry' | 'counter',
  shelfLifeDays: number
): string {
  const date = new Date();
  date.setDate(date.getDate() + shelfLifeDays);
  return date.toISOString().split('T')[0];
}

/**
 * Format quantity display with unit
 */
export function formatQuantityDisplay(quantity: number, unit: string): string {
  // Format to remove unnecessary decimals
  const formatted = quantity % 1 === 0 ? quantity.toString() : quantity.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted} ${unit}`;
}

// ============================================
// STORAGE LOCATION GROUPING
// ============================================

/**
 * Group items by storage location, then by family, sorted by expiration
 */
export function groupItemsByStorageAndFamily(
  items: PantryItemWithIngredient[]
): StorageSection[] {
  const storageMap: { [storage: string]: { [family: string]: PantryItemWithIngredient[] } } = {};
  
  // Group by storage, then by family
  items.forEach(item => {
    const storage = item.storage_location || 'other';
    const family = item.ingredient.family || 'Other';
    
    if (!storageMap[storage]) {
      storageMap[storage] = {};
    }
    
    if (!storageMap[storage][family]) {
      storageMap[storage][family] = [];
    }
    
    storageMap[storage][family].push(item);
  });
  
  // Convert to sections array
  const sections: StorageSection[] = [];
  
  Object.entries(storageMap).forEach(([storage, families]) => {
    const familySections: FamilyInStorage[] = [];
    let storageTotal = 0;
    let storageExpiring = 0;
    
    Object.entries(families).forEach(([family, familyItems]) => {
      // Sort items by expiration (soonest first)
      const sortedItems = [...familyItems].sort((a, b) => {
        const daysA = getDaysUntilExpiration(a.expiration_date);
        const daysB = getDaysUntilExpiration(b.expiration_date);
        return daysA - daysB;
      });
      
      const expiringCount = sortedItems.filter(item => 
        isExpiringSoon(item.expiration_date)
      ).length;
      
      familySections.push({
        family,
        items: sortedItems,
        expiringCount,
      });
      
      storageTotal += sortedItems.length;
      storageExpiring += expiringCount;
    });
    
    // Sort families within storage
    const familyOrder = ['Proteins', 'Produce', 'Dairy', 'Pantry'];
    familySections.sort((a, b) => {
      const aIndex = familyOrder.indexOf(a.family);
      const bIndex = familyOrder.indexOf(b.family);
      
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      return a.family.localeCompare(b.family);
    });
    
    sections.push({
      storage,
      totalCount: storageTotal,
      expiringCount: storageExpiring,
      families: familySections,
    });
  });
  
  // Sort storage locations: Fridge, Freezer, Pantry, Counter, others
  const storageOrder = ['fridge', 'freezer', 'pantry', 'counter'];
  sections.sort((a, b) => {
    const aIndex = storageOrder.indexOf(a.storage.toLowerCase());
    const bIndex = storageOrder.indexOf(b.storage.toLowerCase());
    
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    
    return a.storage.localeCompare(b.storage);
  });
  
  return sections;
}