// ============================================
// FRIGO - SEARCH TYPES
// ============================================
// TypeScript types for search functionality
// Last updated: October 27, 2025

/**
 * Options for configuring search behavior
 */
export interface SearchOptions {
  // What to search in
  searchIngredients?: boolean;  // Search ingredient names
  searchTitles?: boolean;        // Search recipe titles
  searchChefs?: boolean;         // Search chef names
  searchCuisines?: boolean;      // Search cuisine types
  
  // Future options
  caseSensitive?: boolean;       // Case-sensitive search (default: false)
  exactMatch?: boolean;          // Exact match only (default: false)
  limit?: number;                // Max results to return
}

/**
 * Result from a search operation
 */
export interface SearchResult {
  recipeIds: string[];           // Array of matching recipe IDs
  matchCount: number;            // Number of matches found
  searchTerm: string;            // What was searched
  searchType: string;            // Where we searched (ingredients/title/chef/cuisine)
}

/**
 * Detailed search result with match information
 */
export interface DetailedSearchResult extends SearchResult {
  matches: SearchMatch[];        // Detailed info about each match
}

/**
 * Information about a single search match
 */
export interface SearchMatch {
  recipeId: string;              // Recipe that matched
  matchField: string;            // Which field matched (ingredient/title/chef)
  matchValue: string;            // The value that matched
  matchType: 'exact' | 'partial' | 'fuzzy';  // How it matched
}

/**
 * Error types for search operations
 */
export class SearchError extends Error {
  constructor(
    message: string,
    public searchTerm: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'SearchError';
  }
}