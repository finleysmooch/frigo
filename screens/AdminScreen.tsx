import { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';
import { supabase } from '../lib/supabase';
import { parseIngredientString, matchToDatabase, processRecipeIngredients } from '../lib/ingredientsParser';
import {
  searchRecipesByIngredient,
  searchRecipesByTitle,
  searchRecipesByChef,
  searchRecipesByCuisine,
  searchRecipes,
  searchRecipesByMultipleIngredients,
  searchRecipesByMixedTerms
} from '../lib/searchService';

export default function AdminScreen() {
  const { colors, functionalColors } = useTheme();

  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // NEW: for search testing

  // Dynamic styles based on theme
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.card,
      padding: 20,
    },
    header: {
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 20,
      marginTop: 40,
      color: colors.text.primary,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 15,
      marginTop: 10,
      color: colors.primary,
    },
    buttonSection: {
      gap: 10,
      marginBottom: 20,
    },
    button: {
      backgroundColor: colors.primary,
      padding: 15,
      borderRadius: 8,
      alignItems: 'center',
    },
    buttonSecondary: {
      backgroundColor: functionalColors.success,
    },
    buttonTertiary: {
      backgroundColor: functionalColors.warning,
    },
    buttonSearch: {
      backgroundColor: colors.accent,
    },
    buttonClear: {
      backgroundColor: functionalColors.error,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: colors.background.card,
      fontSize: 16,
      fontWeight: '600',
    },
    searchInput: {
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      marginBottom: 10,
      color: colors.text.primary,
    },
    loading: {
      textAlign: 'center',
      fontSize: 16,
      color: colors.text.secondary,
      marginVertical: 10,
    },
    resultsContainer: {
      marginTop: 20,
    },
    resultsHeader: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 10,
      color: colors.text.primary,
    },
    resultsBox: {
      backgroundColor: colors.background.secondary,
      padding: 15,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    resultLine: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.text.secondary,
      fontFamily: 'monospace',
    },
    resultHeader: {
      fontWeight: 'bold',
      color: colors.primary,
      marginTop: 10,
    },
    resultError: {
      color: functionalColors.error,
    },
    resultDivider: {
      color: colors.text.tertiary,
      marginVertical: 5,
    },
  }), [colors, functionalColors]);

  // Test OR Pattern Detection
  const testOrPatterns = async () => {
    setIsLoading(true);
    const results: string[] = [];
    
    const testCases = [
      "1 head purple or green cabbage",
      "2 jalapeños or fresno chiles", 
      "1 cup butter or oil",
      "3 tablespoons sugar",
      "1 cup whole wheat flour",
      "red or yellow bell pepper",
      "1/2 cup olive or vegetable oil"
    ];
    
    results.push("=== OR PATTERN TESTS ===\n");
    
    for (const test of testCases) {
      // Parse the ingredient
      const parsed = parseIngredientString(test);
      results.push(`Input: "${test}"`);
      results.push(`Parsed: ${parsed.ingredient_name}`);
      
      // Try to match to database
      try {
        const match = await matchToDatabase(
          parsed,
          undefined,
          { recipe_id: 'test-123', recipe_title: 'Test Recipe' }
        );
        
        results.push(`Match: ${match.match_method}`);
        results.push(`Confidence: ${match.match_confidence}`);
        results.push(`Notes: ${match.match_notes || 'None'}`);
        results.push(`Needs Review: ${match.needs_review}`);
      } catch (error) {
        results.push(`Error matching: ${error}`);
      }
      
      results.push("---");
    }
    
    setTestResults(results);
    setIsLoading(false);
    Alert.alert("Test Complete", "Check the results below");
  };

  // Check Tracking Records
  const checkTrackingRecords = async () => {
    setIsLoading(true);
    const results: string[] = [];
    
    try {
      // Check or_pattern_decisions
      const { data: patterns, error: patternsError } = await supabase
        .from('or_pattern_decisions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (patternsError) throw patternsError;
      
      results.push("=== TRACKED OR PATTERNS ===\n");
      
      if (patterns && patterns.length > 0) {
        patterns.forEach((p: any) => {
          results.push(`"${p.option1_name}" OR "${p.option2_name}"`);
          results.push(`Equivalent: ${p.detected_as_equivalent}`);
          results.push(`Reason: ${p.decision_reason}`);
          results.push(`---`);
        });
      } else {
        results.push("No OR patterns tracked yet");
      }
      
      // Check migration readiness
      const { data: readiness, error: readinessError } = await supabase
        .from('migration_readiness')
        .select('*')
        .single();
      
      if (!readinessError && readiness) {
        results.push("\n=== MIGRATION STATUS ===");
        results.push(`Status: ${readiness.status}`);
        results.push(`Total patterns: ${readiness.total_or_patterns_logged}`);
        results.push(`Unique patterns: ${readiness.unique_patterns}`);
      }
      
    } catch (error) {
      results.push(`Error: ${error}`);
    }
    
    setTestResults(results);
    setIsLoading(false);
  };

  // Check Recipe Ingredients
  const checkRecipeIngredients = async () => {
    setIsLoading(true);
    const results: string[] = [];
    
    try {
      // Get ingredients with OR patterns
      const { data: ingredients, error } = await supabase
        .from('recipe_ingredients')
        .select('original_text, match_notes, match_confidence, needs_review')
        .like('original_text', '%or%')
        .limit(20);
      
      if (error) throw error;
      
      results.push("=== RECIPE INGREDIENTS WITH 'OR' ===\n");
      
      if (ingredients && ingredients.length > 0) {
        ingredients.forEach((ing: any) => {
          results.push(`Original: "${ing.original_text}"`);
          results.push(`Confidence: ${ing.match_confidence}`);
          results.push(`Needs Review: ${ing.needs_review}`);
          if (ing.match_notes) {
            results.push(`Notes: ${ing.match_notes}`);
          }
          results.push("---");
        });
      } else {
        results.push("No ingredients with 'or' found");
      }
      
      // Get review stats
      const { count: reviewCount } = await supabase
        .from('recipe_ingredients')
        .select('*', { count: 'exact', head: true })
        .eq('needs_review', true);
      
      results.push(`\nTotal needing review: ${reviewCount}`);
      
    } catch (error) {
      results.push(`Error: ${error}`);
    }
    
    setTestResults(results);
    setIsLoading(false);
  };

  // Test one real recipe
  const testRealRecipe = async () => {
    setIsLoading(true);
    const results: string[] = [];
    
    try {
      // Get a recipe with OR ingredients
      const { data: recipe, error } = await supabase
        .from('recipes')
        .select('id, title, ingredients')
        .limit(1)
        .single();
      
      if (error) throw error;
      
      results.push(`=== TESTING RECIPE: ${recipe.title} ===\n`);
      
      // Process the ingredients
      const { ingredients: processed, alternatives } = await processRecipeIngredients(
        recipe.id,
        recipe.ingredients,
        recipe.title
      );
      
      results.push(`Processed ${processed.length} ingredients`);
      results.push(`Found ${alternatives.length} alternatives`);
      
      // Show OR patterns found
      processed.forEach((ing, idx) => {
        if (ing.original_text.includes(' or ')) {
          results.push(`\nOR Pattern: "${ing.original_text}"`);
          results.push(`Matched to: ${ing.ingredient_id ? 'Found' : 'Not found'}`);
          results.push(`Confidence: ${ing.match_confidence}`);
          if (ing.match_notes) {
            results.push(`Notes: ${ing.match_notes}`);
          }
        }
      });
      
    } catch (error) {
      results.push(`Error: ${error}`);
    }
    
    setTestResults(results);
    setIsLoading(false);
  };

  // ============================================
  // SEARCH TESTING FUNCTIONS
  // ============================================

  // Test search by ingredient
  const testSearchByIngredient = async () => {
    if (!searchTerm.trim()) {
      Alert.alert('Enter Search Term', 'Please enter an ingredient to search for');
      return;
    }

    setIsLoading(true);
    const results: string[] = [];
    
    try {
      results.push(`=== SEARCHING BY INGREDIENT: "${searchTerm}" ===\n`);
      
      const recipeIds = await searchRecipesByIngredient(searchTerm);
      
      results.push(`Found ${recipeIds.length} recipes\n`);
      
      if (recipeIds.length > 0) {
        // Get recipe details
        const { data: recipes } = await supabase
          .from('recipes')
          .select('id, title')
          .in('id', recipeIds);
        
        recipes?.forEach(r => {
          results.push(`- ${r.title}`);
        });
      } else {
        results.push('No recipes found with this ingredient');
      }
      
    } catch (error) {
      results.push(`Error: ${error}`);
    }
    
    setTestResults(results);
    setIsLoading(false);
  };

  // Test search by title
  const testSearchByTitle = async () => {
    if (!searchTerm.trim()) {
      Alert.alert('Enter Search Term', 'Please enter a title to search for');
      return;
    }

    setIsLoading(true);
    const results: string[] = [];
    
    try {
      results.push(`=== SEARCHING BY TITLE: "${searchTerm}" ===\n`);
      
      const recipeIds = await searchRecipesByTitle(searchTerm);
      
      results.push(`Found ${recipeIds.length} recipes\n`);
      
      if (recipeIds.length > 0) {
        const { data: recipes } = await supabase
          .from('recipes')
          .select('id, title')
          .in('id', recipeIds);
        
        recipes?.forEach(r => {
          results.push(`- ${r.title}`);
        });
      } else {
        results.push('No recipes found with this title');
      }
      
    } catch (error) {
      results.push(`Error: ${error}`);
    }
    
    setTestResults(results);
    setIsLoading(false);
  };

  // Test search by chef
  const testSearchByChef = async () => {
    if (!searchTerm.trim()) {
      Alert.alert('Enter Search Term', 'Please enter a chef name to search for');
      return;
    }

    setIsLoading(true);
    const results: string[] = [];
    
    try {
      results.push(`=== SEARCHING BY CHEF: "${searchTerm}" ===\n`);
      
      const recipeIds = await searchRecipesByChef(searchTerm);
      
      results.push(`Found ${recipeIds.length} recipes\n`);
      
      if (recipeIds.length > 0) {
        const { data: recipes } = await supabase
          .from('recipes')
          .select(`
            id,
            title,
            chefs (
              name
            )
          `)
          .in('id', recipeIds);
        
        recipes?.forEach((r: any) => {
          results.push(`- ${r.title} (by ${r.chefs?.name})`);
        });
      } else {
        results.push('No recipes found by this chef');
      }
      
    } catch (error) {
      results.push(`Error: ${error}`);
    }
    
    setTestResults(results);
    setIsLoading(false);
  };

  // Test combined search
  const testCombinedSearch = async () => {
    if (!searchTerm.trim()) {
      Alert.alert('Enter Search Term', 'Please enter a term to search for');
      return;
    }

    setIsLoading(true);
    const results: string[] = [];
    
    try {
      results.push(`=== COMBINED SEARCH: "${searchTerm}" ===\n`);
      
      const searchResult = await searchRecipes(searchTerm);
      
      results.push(`Found ${searchResult.matchCount} recipes`);
      results.push(`Matched in: ${searchResult.searchType}\n`);
      
      if (searchResult.recipeIds.length > 0) {
        const { data: recipes } = await supabase
          .from('recipes')
          .select(`
            id,
            title,
            chefs (
              name
            )
          `)
          .in('id', searchResult.recipeIds);
        
        recipes?.forEach((r: any) => {
          results.push(`- ${r.title} (by ${r.chefs?.name})`);
        });
      } else {
        results.push('No recipes found');
      }
      
    } catch (error) {
      results.push(`Error: ${error}`);
    }
    
    setTestResults(results);
    setIsLoading(false);
  };

  // Test multi-ingredient search (AND logic)
  const testMultiIngredientSearch = async () => {
    if (!searchTerm.trim()) {
      Alert.alert('Enter Search Terms', 'Please enter ingredients separated by commas (e.g., "basil, tomato")');
      return;
    }

    setIsLoading(true);
    const results: string[] = [];
    
    try {
      const ingredients = searchTerm.split(',').map(i => i.trim()).filter(i => i);
      results.push(`=== SEARCHING FOR RECIPES WITH ALL: ${ingredients.join(', ')} ===\n`);
      
      const recipeIds = await searchRecipesByMultipleIngredients(ingredients);
      
      results.push(`Found ${recipeIds.length} recipes with ALL ingredients\n`);
      
      if (recipeIds.length > 0) {
        const { data: recipes } = await supabase
          .from('recipes')
          .select('id, title')
          .in('id', recipeIds);
        
        recipes?.forEach(r => {
          results.push(`- ${r.title}`);
        });
      } else {
        results.push('No recipes found with all these ingredients');
      }
      
    } catch (error) {
      results.push(`Error: ${error}`);
    }
    
    setTestResults(results);
    setIsLoading(false);
  };

  // Test smart mixed search (AND logic across all fields)
  const testMixedSearch = async () => {
    if (!searchTerm.trim()) {
      Alert.alert('Enter Search Terms', 'Please enter terms separated by commas (e.g., "lemon, molly" or "basil, italian")');
      return;
    }

    setIsLoading(true);
    const results: string[] = [];
    
    try {
      const terms = searchTerm.split(',').map(t => t.trim()).filter(t => t);
      results.push(`=== SMART MIXED SEARCH FOR ALL: ${terms.join(', ')} ===\n`);
      results.push(`Each term searches: ingredients, titles, chefs, cuisines\n`);
      
      const recipeIds = await searchRecipesByMixedTerms(terms);
      
      results.push(`Found ${recipeIds.length} recipes matching ALL terms\n`);
      
      if (recipeIds.length > 0) {
        const { data: recipes } = await supabase
          .from('recipes')
          .select(`
            id,
            title,
            cuisine_types,
            chefs (
              name
            )
          `)
          .in('id', recipeIds);
        
        recipes?.forEach((r: any) => {
          results.push(`- ${r.title}`);
          results.push(`  By: ${r.chefs?.name}`);
          if (r.cuisine_types?.length > 0) {
            results.push(`  Cuisine: ${r.cuisine_types.join(', ')}`);
          }
          results.push('');
        });
      } else {
        results.push('No recipes found matching all terms');
      }
      
    } catch (error) {
      results.push(`Error: ${error}`);
    }
    
    setTestResults(results);
    setIsLoading(false);
  };

  // Clear results
  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Admin Testing Panel</Text>
      
      {/* Test Buttons */}
      <View style={styles.buttonSection}>
        <Text style={styles.sectionTitle}>Ingredient Parser Tests</Text>
        
        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={testOrPatterns}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Test OR Pattern Parser</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.buttonSecondary, isLoading && styles.buttonDisabled]}
          onPress={checkTrackingRecords}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Check Tracking Records</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.buttonSecondary, isLoading && styles.buttonDisabled]}
          onPress={checkRecipeIngredients}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Check Recipe Ingredients</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.buttonTertiary, isLoading && styles.buttonDisabled]}
          onPress={testRealRecipe}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Test Real Recipe</Text>
        </TouchableOpacity>
      </View>

      {/* Search Testing Section */}
      <View style={styles.buttonSection}>
        <Text style={styles.sectionTitle}>Search Tests</Text>
        
        {/* Search input */}
        <TextInput
          style={styles.searchInput}
          placeholder="Enter search term (e.g., basil, pasta, molly)"
          value={searchTerm}
          onChangeText={setSearchTerm}
          editable={!isLoading}
        />

        <TouchableOpacity 
          style={[styles.button, styles.buttonSearch, isLoading && styles.buttonDisabled]}
          onPress={testSearchByIngredient}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>🥬 Search by Ingredient</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.buttonSearch, isLoading && styles.buttonDisabled]}
          onPress={testSearchByTitle}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>📖 Search by Title</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.buttonSearch, isLoading && styles.buttonDisabled]}
          onPress={testSearchByChef}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>👨‍🍳 Search by Chef</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.buttonSearch, isLoading && styles.buttonDisabled]}
          onPress={testCombinedSearch}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>🔍 Combined Search</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.buttonSearch, isLoading && styles.buttonDisabled]}
          onPress={testMultiIngredientSearch}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>🔗 Multi-Ingredient (use commas)</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.buttonSearch, isLoading && styles.buttonDisabled]}
          onPress={testMixedSearch}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>✨ Smart Mixed Search (use commas)</Text>
        </TouchableOpacity>

        {testResults.length > 0 && (
          <TouchableOpacity 
            style={[styles.button, styles.buttonClear]}
            onPress={clearResults}
          >
            <Text style={styles.buttonText}>Clear Results</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Loading Indicator */}
      {isLoading && (
        <Text style={styles.loading}>Loading...</Text>
      )}

      {/* Results Display */}
      {testResults.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsHeader}>Test Results:</Text>
          <View style={styles.resultsBox}>
            {testResults.map((line, index) => (
              <Text 
                key={index} 
                style={[
                  styles.resultLine,
                  line.startsWith('===') && styles.resultHeader,
                  line.startsWith('Error') && styles.resultError,
                  line === '---' && styles.resultDivider
                ]}
              >
                {line}
              </Text>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

