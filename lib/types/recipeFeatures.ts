// ============================================
// FRIGO - RECIPE FEATURES TYPES (CORRECTED)
// ============================================
// Updated to match actual database structure
// Date: November 11, 2025
// ============================================

export interface Book {
  id: string;
  title: string;
  author: string | null;
  author_normalized: string | null;
  author_bio: string | null;
  author_image_url: string | null;
  author_website: string | null;
  isbn: string | null;
  isbn13: string | null;
  publisher: string | null;
  publication_year: number | null;
  cover_image_url: string | null;
  total_pages: number | null;
  is_verified: boolean;
  verification_source: string | null;
  style_metadata: Record<string, any> | null;
  user_id: string | null;
  chef_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Chef {
  id: string;
  name: string;
  bio: string | null;
  image_url: string | null;
  website: string | null;
  instagram_handle: string | null;
  status: 'verified' | 'pending' | 'user_created';
  created_at: string;
  updated_at: string;
}

// ============================================
// INSTRUCTION SECTIONS
// ============================================

export interface InstructionStep {
  step_number: number;
  text: string;
  timing?: string; // e.g., "5 minutes"
  notes?: string;
  temperature?: string; // e.g., "325°F"
}

export interface InstructionSection {
  id: string;
  recipe_id: string;
  section_number: number;
  section_title: string; // e.g., "Prepare Vegetables", "Make the Sauce"
  section_description?: string;
  steps: InstructionStep[];
  created_at: string;
  updated_at: string;
}

// For creating sections from flat instructions
export interface SectionSuggestion {
  section_title: string;
  section_description?: string;
  step_indices: number[]; // Which original steps belong to this section
}

// ============================================
// RECIPE ANNOTATIONS (User Edits)
// ============================================

export type AnnotationType = 'ingredient_edit' | 'instruction_edit' | 'note' | 'substitution';
export type ViewMode = 'original' | 'clean' | 'markup';

export interface RecipeAnnotation {
  id: string;
  user_id: string;
  recipe_id: string;
  annotation_type: AnnotationType;
  target_field: string; // JSON path like 'ingredients[0].quantity'
  original_value: string;
  new_value: string;
  reason?: string;
  created_at: string;
  updated_at: string;
}

// For display purposes
export interface AnnotatedValue {
  original: string;
  new: string;
  reason?: string;
  show_markup: boolean; // Whether to show crossed-out original
}

// ============================================
// USER RECIPE PREFERENCES
// ============================================

export interface UserRecipePreferences {
  id: string;
  user_id: string;
  recipe_id: string;
  view_mode: ViewMode;
  show_sections: boolean;
  favorite: boolean;
  notes?: string;
  last_cooked?: string;
  times_cooked: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// RECIPE INGREDIENT ALTERNATIVES
// ============================================

export interface RecipeIngredientAlternative {
  id: string;
  recipe_ingredient_id: string;
  alternative_ingredient_id: string;
  is_equivalent: boolean; // true = red/green cabbage, false = primary/substitute
  preference_order: number;
  notes?: string;
  created_at: string;
}

// With ingredient details
export interface AlternativeWithDetails extends RecipeIngredientAlternative {
  ingredient: {
    id: string;
    name: string;
    plural_name: string | null;
    family: string;
  };
}

// ============================================
// ENHANCED RECIPE TYPES
// ============================================

export interface RecipeWithBook {
  id: string;
  title: string;
  description: string | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  servings: number;
  // Book info
  book_id: string | null;
  book_title: string | null;
  book_author: string | null;
  author_normalized: string | null;
  author_bio: string | null;
  author_image_url: string | null;
  author_website: string | null;
  book_cover: string | null;
  book_year: number | null;
  page_number: number | null;
  // Chef info
  chef_id: string | null;
  chef_name: string | null;
  chef_bio: string | null;
  chef_image: string | null;
  // Difficulty
  difficulty_level: string;
  chef_difficulty_label: string | null;
  ai_difficulty_score: number | null;
  // Other metadata
  cuisine_types: string[];
  cooking_methods: string[];
  created_at: string;
}

// ============================================
// BOOK & AUTHOR VIEWS
// ============================================

export interface BookWithRecipeCount extends Book {
  recipe_count: number;
  user_recipe_count: number; // Recipes this user has from this book
  is_owned: boolean;
}

export interface AuthorWithBooks {
  author_normalized: string;
  author: string;
  author_bio: string | null;
  author_image_url: string | null;
  author_website: string | null;
  book_count: number;
  recipe_count: number;
  books: BookWithRecipeCount[];
}

// ============================================
// EXTRACTION METADATA
// ============================================

export interface ExtractionLog {
  id: string;
  user_id: string | null;
  recipe_id: string | null;
  image_url: string | null;
  image_hash: string | null;
  extracted_data: Record<string, any>;
  user_corrections: Record<string, any> | null;
  extraction_quality_rating: number | null; // 1-5 stars
  provider_used: string; // 'anthropic'
  provider_model: string; // 'claude-sonnet-4-20250514'
  processing_time_ms: number | null;
  cost_usd: number | null;
  created_at: string;
}

// ============================================
// RECIPE MEDIA & REFERENCES
// ============================================

export interface RecipeMedia {
  id: string;
  recipe_id: string;
  media_type: 'qr_code' | 'url' | 'video' | 'instagram' | 'youtube' | 'barcode';
  url: string | null;
  description: string | null;
  location_on_page: string | null; // 'top_right', 'bottom', etc.
  created_at: string;
}

export interface RecipeReference {
  id: string;
  source_recipe_id: string;
  reference_text: string; // e.g., "use vinaigrette from page 29"
  referenced_page_number: number | null;
  referenced_recipe_name: string | null;
  referenced_recipe_id: string | null; // null until fulfilled
  reference_type: 'ingredient' | 'technique' | 'variation' | 'note';
  is_fulfilled: boolean;
  created_at: string;
}

// ============================================
// UTILITY TYPES
// ============================================

// For displaying annotations in UI
export interface AnnotationDisplay {
  field: string;
  fieldLabel: string; // "Quantity of Olive Oil"
  original: string;
  new: string;
  reason?: string;
  type: AnnotationType;
}

// For instruction section creation
export interface InstructionAnalysis {
  has_sections: boolean;
  suggested_sections: SectionSuggestion[];
  flat_instructions: string[];
  section_count: number;
}

// For book organization
export interface BookGroup {
  book: Book;
  recipes: RecipeWithBook[];
}

// For author organization
export interface AuthorGroup {
  author_normalized: string;
  author_display_name: string;
  author_bio: string | null;
  author_image_url: string | null;
  books: BookGroup[];
  total_recipes: number;
}

// ============================================
// SERVICE RETURN TYPES
// ============================================

export interface SaveAnnotationResult {
  success: boolean;
  annotation?: RecipeAnnotation;
  error?: string;
}

export interface CreateSectionsResult {
  success: boolean;
  sections?: InstructionSection[];
  error?: string;
}

export interface BookLookupResult {
  found: boolean;
  book?: Book;
  needs_ownership_verification: boolean;
}