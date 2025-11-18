import { parseIngredientString, matchToDatabase } from './ingredientsParser';

async function testOrPatterns() {
  const testCases = [
    "1 head purple or green cabbage",
    "2 jalapeños or fresno chiles",
    "1 cup butter or oil",
    "3 tablespoons sugar",
    "1 cup whole wheat flour"
  ];

  console.log("Testing OR pattern detection:\n");
  
  for (const test of testCases) {
    const parsed = parseIngredientString(test);
    console.log(`Input: "${test}"`);
    console.log(`Parsed:`, parsed);
    
    const match = await matchToDatabase(
      parsed, 
      undefined,
      { recipe_id: 'test-123', recipe_title: 'Test Recipe' }
    );
    console.log(`Match result:`, match.match_notes);
    console.log('---');
  }
}

testOrPatterns();