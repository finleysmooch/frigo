// lib/utils/ingredientMatcher.ts
// Matches ingredient names in instruction text for clickable highlights

interface Ingredient {
  id: string;
  name: string;
  displayText: string;
  family: string;
  quantity_amount?: number;
  quantity_unit?: string;
  preparation?: string;
}

interface IngredientMatch {
  startIndex: number;
  endIndex: number;
  matchedText: string;
  ingredient: Ingredient;
}

/**
 * Find all ingredient mentions in an instruction string
 * Returns array of matches with positions
 */
export function findIngredientsInText(
  instruction: string,
  ingredients: Ingredient[]
): IngredientMatch[] {
  const matches: IngredientMatch[] = [];
  const lowerInstruction = instruction.toLowerCase();

  ingredients.forEach(ingredient => {
    // Get variations of the ingredient name to match
    const namesToMatch = getIngredientNameVariations(ingredient.name);

    namesToMatch.forEach(name => {
      const lowerName = name.toLowerCase();
      let searchIndex = 0;

      // Find all occurrences of this ingredient name
      while (searchIndex < lowerInstruction.length) {
        const index = lowerInstruction.indexOf(lowerName, searchIndex);
        if (index === -1) break;

        // Check if it's a word boundary match (not part of another word)
        const beforeChar = index > 0 ? lowerInstruction[index - 1] : ' ';
        const afterChar = index + lowerName.length < lowerInstruction.length 
          ? lowerInstruction[index + lowerName.length] 
          : ' ';

        const isWordBoundary = /[\s,;.!?()]/.test(beforeChar) && /[\s,;.!?()]/.test(afterChar);

        if (isWordBoundary) {
          // Check if this position overlaps with an existing match
          const overlaps = matches.some(m => 
            (index >= m.startIndex && index < m.endIndex) ||
            (index + lowerName.length > m.startIndex && index + lowerName.length <= m.endIndex)
          );

          if (!overlaps) {
            matches.push({
              startIndex: index,
              endIndex: index + lowerName.length,
              matchedText: instruction.substring(index, index + lowerName.length),
              ingredient
            });
          }
        }

        searchIndex = index + 1;
      }
    });
  });

  // Sort matches by position
  return matches.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Get variations of ingredient name to match
 * e.g., "red bell pepper" → ["red bell pepper", "bell pepper", "pepper"]
 */
function getIngredientNameVariations(name: string): string[] {
  const variations: string[] = [name];

  // Remove common descriptors
  const descriptors = [
    'fresh', 'dried', 'frozen', 'canned', 'whole', 'ground', 'chopped',
    'diced', 'sliced', 'minced', 'large', 'small', 'medium',
    'red', 'green', 'yellow', 'white', 'black', 'purple', 'orange'
  ];

  let simplifiedName = name.toLowerCase();
  descriptors.forEach(desc => {
    simplifiedName = simplifiedName.replace(new RegExp(`\\b${desc}\\b`, 'g'), '').trim();
  });

  if (simplifiedName !== name.toLowerCase() && simplifiedName.length > 2) {
    variations.push(simplifiedName);
  }

  // Also try without the first word (e.g., "bell pepper" from "red bell pepper")
  const words = name.split(' ');
  if (words.length > 2) {
    variations.push(words.slice(1).join(' '));
  }

  // Remove duplicates and empty strings
  return [...new Set(variations.filter(v => v.length > 2))];
}

/**
 * Format ingredient for display in popup
 */
export function formatIngredientForPopup(
  ingredient: Ingredient,
  scale: number = 1
): {
  name: string;
  quantity: string;
  preparation?: string;
} {
  const scaledAmount = (ingredient.quantity_amount || 0) * scale;
  
  let quantityText = '';
  if (scaledAmount && ingredient.quantity_unit) {
    // Format with fractions if appropriate
    const formatted = formatQuantity(scaledAmount);
    quantityText = `${formatted} ${ingredient.quantity_unit}`;
  } else if (ingredient.displayText) {
    // Use the original display text if no structured quantity
    quantityText = ingredient.displayText;
  }

  return {
    name: ingredient.name,
    quantity: quantityText,
    preparation: ingredient.preparation
  };
}

/**
 * Format quantity with fractions for common cooking amounts
 */
function formatQuantity(amount: number): string {
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
    2.75: '2¾',
    3.5: '3½',
    4.5: '4½'
  };

  // Check for exact matches (with small tolerance)
  for (const [dec, frac] of Object.entries(commonFractions)) {
    if (Math.abs(amount - parseFloat(dec)) < 0.01) {
      return frac;
    }
  }

  // Return as decimal
  return amount % 1 === 0 ? amount.toString() : amount.toFixed(2);
}

/**
 * Split instruction text into parts (plain text and clickable ingredients)
 */
export interface TextPart {
  type: 'text' | 'ingredient';
  text: string;
  ingredient?: Ingredient;
}

export function splitInstructionIntoParts(
  instruction: string,
  ingredients: Ingredient[]
): TextPart[] {
  const matches = findIngredientsInText(instruction, ingredients);
  
  if (matches.length === 0) {
    return [{ type: 'text', text: instruction }];
  }

  const parts: TextPart[] = [];
  let currentIndex = 0;

  matches.forEach(match => {
    // Add text before the match
    if (currentIndex < match.startIndex) {
      parts.push({
        type: 'text',
        text: instruction.substring(currentIndex, match.startIndex)
      });
    }

    // Add the matched ingredient
    parts.push({
      type: 'ingredient',
      text: match.matchedText,
      ingredient: match.ingredient
    });

    currentIndex = match.endIndex;
  });

  // Add remaining text after last match
  if (currentIndex < instruction.length) {
    parts.push({
      type: 'text',
      text: instruction.substring(currentIndex)
    });
  }

  return parts;
}