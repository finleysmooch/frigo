// lib/services/unitConverter.ts
// Unit conversion service for recipe ingredients
// Uses measurement_units table from database

import { supabase } from '../supabase';

export type UnitSystem = 'original' | 'metric' | 'imperial';

export interface ConversionResult {
  amount: number;
  unit: string;
  displayText: string;
}

interface MeasurementUnit {
  id: string;
  unit: string;
  display_singular: string;
  display_plural: string;
  unit_type: 'volume' | 'weight' | 'count' | 'other';
  metric_g: number | null;
  metric_ml: number | null;
  aliases: string[] | null;
}

// Cache for measurement units to avoid repeated DB calls
let unitsCache: MeasurementUnit[] | null = null;

/**
 * Load all measurement units from database
 */
async function loadUnits(): Promise<MeasurementUnit[]> {
  if (unitsCache) {
    return unitsCache;
  }

  const { data, error } = await supabase
    .from('measurement_units')
    .select('*');

  if (error) {
    console.error('Error loading measurement units:', error);
    return [];
  }

  unitsCache = data || [];
  return unitsCache;
}

/**
 * Find a unit in the database by name or alias
 */
async function findUnit(unitName: string): Promise<MeasurementUnit | null> {
  const units = await loadUnits();
  const lowerName = unitName.toLowerCase().trim();

  return units.find(u => 
    u.unit.toLowerCase() === lowerName ||
    u.display_singular.toLowerCase() === lowerName ||
    u.display_plural.toLowerCase() === lowerName ||
    (u.aliases && u.aliases.some((a: string) => a.toLowerCase() === lowerName))
  ) || null;
}

/**
 * Convert ingredient quantity and unit to target system
 */
export async function convertUnit(
  amount: number | null,
  unit: string | null,
  targetSystem: UnitSystem,
  ingredientName?: string
): Promise<ConversionResult | null> {
  // If no amount or already in original, return as-is
  if (!amount || !unit || targetSystem === 'original') {
    return {
      amount: amount || 0,
      unit: unit || '',
      displayText: formatDisplayText(amount || 0, unit || '')
    };
  }

  const sourceUnit = await findUnit(unit);
  if (!sourceUnit) {
    // Unknown unit, return original
    return {
      amount,
      unit,
      displayText: formatDisplayText(amount, unit)
    };
  }

  // Convert based on target system
  if (targetSystem === 'metric') {
    return convertToMetric(amount, sourceUnit, ingredientName);
  } else {
    return convertToImperial(amount, sourceUnit, ingredientName);
  }
}

/**
 * Convert to metric system
 */
function convertToMetric(
  amount: number,
  sourceUnit: MeasurementUnit,
  ingredientName?: string
): ConversionResult {
  // Already metric
  if (['g', 'kg', 'ml', 'l', 'gram', 'grams', 'kilogram', 'kilograms', 'milliliter', 'milliliters', 'liter', 'liters'].includes(sourceUnit.unit.toLowerCase())) {
    return {
      amount,
      unit: sourceUnit.unit,
      displayText: formatDisplayText(amount, sourceUnit.unit)
    };
  }

  // Weight conversions
  if (sourceUnit.metric_g) {
    const grams = amount * sourceUnit.metric_g;
    if (grams >= 1000) {
      return {
        amount: roundTo(grams / 1000, 2),
        unit: 'kg',
        displayText: formatDisplayText(roundTo(grams / 1000, 2), 'kg')
      };
    }
    return {
      amount: roundTo(grams, 0),
      unit: 'g',
      displayText: formatDisplayText(roundTo(grams, 0), 'g')
    };
  }

  // Volume conversions
  if (sourceUnit.metric_ml) {
    const ml = amount * sourceUnit.metric_ml;
    if (ml >= 1000) {
      return {
        amount: roundTo(ml / 1000, 2),
        unit: 'L',
        displayText: formatDisplayText(roundTo(ml / 1000, 2), 'L')
      };
    }
    return {
      amount: roundTo(ml, 0),
      unit: 'ml',
      displayText: formatDisplayText(roundTo(ml, 0), 'ml')
    };
  }

  // No conversion available, return original
  return {
    amount,
    unit: sourceUnit.unit,
    displayText: formatDisplayText(amount, sourceUnit.unit)
  };
}

/**
 * Convert to imperial system
 */
function convertToImperial(
  amount: number,
  sourceUnit: MeasurementUnit,
  ingredientName?: string
): ConversionResult {
  // Already imperial
  if (['cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'tablespoon', 'tablespoons', 'teaspoon', 'teaspoons', 'ounce', 'ounces', 'pound', 'pounds'].includes(sourceUnit.unit.toLowerCase())) {
    return {
      amount,
      unit: sourceUnit.unit,
      displayText: formatDisplayText(amount, sourceUnit.unit)
    };
  }

  // Convert from metric weight to imperial
  if (sourceUnit.metric_g) {
    const grams = amount * sourceUnit.metric_g;
    const ounces = grams / 28.35;
    
    if (ounces >= 16) {
      return {
        amount: roundTo(ounces / 16, 2),
        unit: 'lb',
        displayText: formatDisplayText(roundTo(ounces / 16, 2), 'lb')
      };
    }
    return {
      amount: roundTo(ounces, 1),
      unit: 'oz',
      displayText: formatDisplayText(roundTo(ounces, 1), 'oz')
    };
  }

  // Convert from metric volume to imperial
  if (sourceUnit.metric_ml) {
    const ml = amount * sourceUnit.metric_ml;
    
    // Convert to cups, tbsp, or tsp
    const cups = ml / 236.588;
    if (cups >= 1) {
      return {
        amount: roundTo(cups, 2),
        unit: 'cup',
        displayText: formatDisplayText(roundTo(cups, 2), cups > 1 ? 'cups' : 'cup')
      };
    }
    
    const tbsp = ml / 14.787;
    if (tbsp >= 1) {
      return {
        amount: roundTo(tbsp, 1),
        unit: 'tbsp',
        displayText: formatDisplayText(roundTo(tbsp, 1), 'tbsp')
      };
    }
    
    const tsp = ml / 4.929;
    return {
      amount: roundTo(tsp, 1),
      unit: 'tsp',
      displayText: formatDisplayText(roundTo(tsp, 1), 'tsp')
    };
  }

  // No conversion available, return original
  return {
    amount,
    unit: sourceUnit.unit,
    displayText: formatDisplayText(amount, sourceUnit.unit)
  };
}

/**
 * Round number to specified decimal places
 */
function roundTo(num: number, decimals: number): number {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Format amount and unit for display
 */
function formatDisplayText(amount: number, unit: string): string {
  // Handle fractions for common amounts
  const fraction = decimalToFraction(amount);
  if (fraction) {
    return `${fraction} ${unit}`;
  }
  
  // Round to reasonable precision
  const rounded = amount % 1 === 0 ? amount : roundTo(amount, 2);
  return `${rounded} ${unit}`;
}

/**
 * Convert decimal to fraction for common cooking amounts
 */
function decimalToFraction(decimal: number): string | null {
  const commonFractions: { [key: number]: string } = {
    0.25: '¼',
    0.33: '⅓',
    0.5: '½',
    0.67: '⅔',
    0.75: '¾',
    1.25: '1¼',
    1.33: '1⅓',
    1.5: '1½',
    1.67: '1⅔',
    1.75: '1¾',
    2.5: '2½',
    2.25: '2¼',
    2.75: '2¾'
  };

  // Check for exact matches (with small tolerance)
  for (const [dec, frac] of Object.entries(commonFractions)) {
    if (Math.abs(decimal - parseFloat(dec)) < 0.01) {
      return frac;
    }
  }

  return null;
}

/**
 * Convert all ingredients in a recipe to target system
 */
export async function convertRecipeIngredients(
  ingredients: Array<{
    displayText: string;
    quantity_amount?: number;
    quantity_unit?: string;
    name: string;
    preparation?: string;
  }>,
  targetSystem: UnitSystem,
  scale: number = 1
): Promise<Array<{
  displayText: string;
  converted: ConversionResult | null;
}>> {
  const results = await Promise.all(
    ingredients.map(async (ingredient) => {
      const scaledAmount = (ingredient.quantity_amount || 0) * scale;
      const converted = await convertUnit(
        scaledAmount,
        ingredient.quantity_unit || null,
        targetSystem,
        ingredient.name
      );

      // Build full display text with ingredient name
      let fullDisplayText = ingredient.displayText;
      
      if (converted && targetSystem !== 'original') {
        // Extract everything after the unit in original text
        const originalText = ingredient.displayText;
        
        // Try to find where the ingredient name starts
        // Pattern: "2 cups rice" -> we want "rice"
        const parts = originalText.split(/\s+/);
        let ingredientNameIndex = -1;
        
        // Skip quantity and unit to find ingredient name
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i].toLowerCase();
          // Check if this looks like an ingredient name (not a number or common unit)
          if (!/^[\d\/\.]+$/.test(part) && 
              !['cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'g', 'kg', 'ml', 'l'].includes(part)) {
            ingredientNameIndex = i;
            break;
          }
        }
        
        if (ingredientNameIndex > 0) {
          const ingredientName = parts.slice(ingredientNameIndex).join(' ');
          fullDisplayText = `${converted.displayText} ${ingredientName}`;
        } else {
          // Fallback: use the converted amount/unit + original ingredient name
          fullDisplayText = `${converted.displayText} ${ingredient.name}${ingredient.preparation ? ', ' + ingredient.preparation : ''}`;
        }
      }

      return {
        displayText: ingredient.displayText,
        converted: converted ? {
          ...converted,
          displayText: fullDisplayText
        } : null
      };
    })
  );

  return results;
}