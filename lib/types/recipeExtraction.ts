// lib/types/recipeExtraction.ts
// COMPLETE TYPE DEFINITIONS for recipe extraction features
// Updated: November 11, 2025 - Added sections and annotations

// ============================================================================
// BOOKS
// ============================================================================

export interface Book {
  id: string;
  title: string;
  author?: string;
  isbn?: string;
  isbn13?: string;
  publisher?: string;
  publication_year?: number;
  cover_image_url?: string;
  total_pages?: number;
  is_verified: boolean;
  verification_source?: 'isbn_api' | 'manual_review' | 'user_submitted';
  style_metadata?: BookStyleMetadata;
  created_at: string;
  updated_at: string;
}

export interface BookStyleMetadata {
  color_scheme?: {
    primary_color?: string;
    accent_color?: string;
    background_color?: string;
  };
  typography?: {
    header_style?: 'serif' | 'sans-serif' | 'handwritten';
    body_style?: 'serif' | 'sans-serif';
    font_weight?: 'light' | 'regular' | 'bold';
  };
  layout?: {
    style?: 'minimal' | 'maximalist' | 'traditional' | 'modern';
    has_illustrations?: boolean;
    has_photos?: boolean;
    column_layout?: 'single' | 'double';
  };
  design_elements?: string[];
  overall_tone?: 'elegant' | 'casual' | 'rustic' | 'playful';
}

export interface UserBook {
  id: string;
  user_id: string;
  book_id: string;
  ownership_claimed: boolean;
  ownership_proof_image_url?: string;
  added_date: string;
  recipe_count: number;
}

// ============================================================================
// INSTRUCTION SECTIONS (NEW!)
// ============================================================================

export interface InstructionSection {
  id: string;
  recipe_id: string;
  section_title: string; // "Prepare Beans", "Cook Beans"
  section_description?: string; // Optional explanation
  section_order: number; // 1, 2, 3
  estimated_time_min?: number; // Time for this section only
  steps: InstructionStep[]; // Steps within this section
  created_at: string;
  updated_at: string;
}

export interface InstructionStep {
  id: string;
  section_id: string;
  step_number: number; // 1, 2, 3 within section
  instruction: string;
  is_optional: boolean;
  is_time_sensitive: boolean; // "Watch closely, can burn easily"
  created_at: string;
  updated_at: string;
}

// For creating new sections during extraction
export interface CreateInstructionSection {
  recipe_id: string;
  section_title: string;
  section_description?: string;
  section_order: number;
  estimated_time_min?: number;
  steps: CreateInstructionStep[];
}

export interface CreateInstructionStep {
  step_number: number;
  instruction: string;
  is_optional?: boolean;
  is_time_sensitive?: boolean;
}

// ============================================================================
// USER ANNOTATIONS (NEW!)
// ============================================================================

export interface RecipeAnnotation {
  id: string;
  user_id: string;
  recipe_id: string;
  field_type: AnnotationFieldType;
  field_id?: string; // ID of ingredient, step, etc.
  field_index?: number; // For backward compat with JSONB arrays
  original_value: string;
  annotated_value: string;
  annotation_type: AnnotationType;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export type AnnotationFieldType = 
  | 'ingredient' 
  | 'instruction' 
  | 'time' 
  | 'servings' 
  | 'note';

export type AnnotationType = 
  | 'edit'      // Changed value
  | 'note'      // Added note
  | 'highlight' // Marked as important
  | 'warning';  // User warning/tip

export interface UserRecipePreferences {
  id: string;
  user_id: string;
  recipe_id: string;
  preferred_view_mode: ViewMode;
  show_section_times: boolean;
  auto_collapse_sections: boolean;
  highlight_annotations: boolean;
  preferred_scale: number;
  hide_optional_steps: boolean;
  created_at: string;
  updated_at: string;
}

export type ViewMode = 
  | 'markup'    // Show original strikethrough + new value
  | 'clean'     // Show only new value
  | 'original'; // Show only original

// For creating annotations
export interface CreateAnnotation {
  user_id: string;
  recipe_id: string;
  field_type: AnnotationFieldType;
  field_id?: string;
  field_index?: number;
  original_value: string;
  annotated_value: string;
  annotation_type?: AnnotationType;
  notes?: string;
}

// ============================================================================
// EXTRACTED DATA (From Claude API)
// ============================================================================

export interface ExtractedRecipeData {
  recipe: {
    title: string;
    description?: string;
    image_url?: string; // NEW: Recipe image URL
    source_author?: string; // NEW: Author name for chef creation
    servings?: number;
    prep_time_min?: number;
    cook_time_min?: number;
    inactive_time_min?: number;
    total_time_min?: number;
    chef_difficulty_label?: string;
    chef_difficulty_level?: 'easy' | 'medium' | 'hard';
    cuisine_types?: string[];
    meal_type?: string[];
    dietary_tags?: string[];
    cooking_methods?: string[];
  };
  book_metadata?: {
    book_title?: string;
    author?: string;
    page_number?: number;
    isbn?: string;
    isbn13?: string;
  };
  style_metadata?: BookStyleMetadata;
  ai_difficulty_assessment?: {
    difficulty_level: 'easy' | 'medium' | 'hard';
    difficulty_score: number; // 0-100
    factors: {
      ingredient_count: number;
      step_count: number;
      advanced_techniques: string[];
      total_time_min: number;
      special_equipment: string[];
    };
    reasoning: string;
  };
  ingredients: ExtractedIngredient[];
  
  // Instruction sections (for structured instructions)
  instruction_sections: ExtractedInstructionSection[];
  
  cross_references?: CrossReference[];
  media_references?: MediaReference[];
  
  // NEW: Store raw extraction data for future parsing
  // This includes recipe notes, ingredient swaps, and other text not yet fully parsed
  raw_extraction_data?: {
    source_url?: string;
    source_site?: string;
    scraped_at?: string;
    raw_text?: any; // All the raw text from scraping
  };
}


// NEW: Extracted sections from Claude
export interface ExtractedInstructionSection {
  section_title: string;
  section_description?: string;
  section_order: number;
  estimated_time_min?: number;
  steps: ExtractedInstructionStep[];
}

export interface ExtractedInstructionStep {
  step_number: number;
  instruction: string;
  is_optional?: boolean;
  is_time_sensitive?: boolean;
}

export interface ExtractedIngredient {
  original_text: string;
  quantity_amount?: number;
  quantity_unit?: string;
  ingredient_name: string;
  preparation?: string;
  sequence_order: number;
  is_optional?: boolean;
  alternatives?: IngredientAlternative[];
}

export interface IngredientAlternative {
  ingredient_name: string;
  is_equivalent: boolean; // true = "peaches OR nectarines", false = "can substitute"
  notes?: string;
}

export interface CrossReference {
  reference_text: string;
  page_number?: number;
  recipe_name?: string;
  reference_type: 'ingredient' | 'technique' | 'variation' | 'note';
}

export interface MediaReference {
  type: 'qr_code' | 'url' | 'youtube' | 'instagram' | 'video' | 'podcast';
  location?: string;
  visible_url?: string;
  description?: string;
}

// ============================================================================
// PROCESSED DATA (After ingredient matching)
// ============================================================================

export interface ProcessedRecipe extends ExtractedRecipeData {
  ingredients_with_matches: ProcessedIngredient[];
  book?: Book | null;
  needsOwnershipVerification?: boolean;
}

export interface ProcessedIngredient extends ExtractedIngredient {
  ingredient_id: string | null;
  match_confidence: number;
  match_method: string;
  match_notes: string | null;
  needs_review: boolean;
}

// ============================================================================
// UI DISPLAY TYPES
// ============================================================================

// Recipe with annotations applied
export interface RecipeWithAnnotations {
  recipe: any; // Base recipe data
  sections: InstructionSectionWithAnnotations[];
  ingredients: IngredientWithAnnotations[];
  preferences: UserRecipePreferences | null;
}

export interface InstructionSectionWithAnnotations extends InstructionSection {
  steps: InstructionStepWithAnnotations[];
}

export interface InstructionStepWithAnnotations extends InstructionStep {
  annotation?: RecipeAnnotation;
  displayText: string; // Rendered based on view mode
}

export interface IngredientWithAnnotations {
  id: string;
  name: string;
  original_text: string;
  annotation?: RecipeAnnotation;
  displayText: string; // Rendered based on view mode
}

// ============================================================================
// DATABASE MODELS
// ============================================================================

export interface RecipeReference {
  id: string;
  source_recipe_id: string;
  reference_text: string;
  referenced_page_number?: number;
  referenced_recipe_name?: string;
  referenced_recipe_id?: string;
  reference_type: 'ingredient' | 'technique' | 'variation' | 'note';
  is_fulfilled: boolean;
  created_at: string;
}

export interface RecipeMedia {
  id: string;
  recipe_id: string;
  media_type: 'qr_code' | 'url' | 'youtube' | 'instagram' | 'video' | 'podcast';
  url?: string;
  description?: string;
  location_on_page?: string;
  created_at: string;
}

export interface ExtractionLog {
  id: string;
  user_id: string;
  recipe_id?: string;
  image_url?: string;
  image_hash?: string;
  extracted_data: ExtractedRecipeData;
  user_corrections?: any;
  extraction_quality_rating?: number; // 1-5
  provider_used: string;
  provider_model: string;
  processing_time_ms?: number;
  cost_usd?: number;
  created_at: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

// For recipe list views
export interface RecipeWithBook {
  id: string;
  title: string;
  description?: string;
  image_url?: string;
  prep_time_min?: number;
  cook_time_min?: number;
  book_id?: string;
  book_title?: string;
  book_author?: string;
  chef_name?: string;
  cuisine_types?: string[];
}

// For book views
export interface BookWithRecipes extends Book {
  recipes: RecipeWithBook[];
  recipe_count: number;
}

// For chef/author views
export interface ChefWithRecipes {
  id: string;
  name: string;
  bio?: string;
  image_url?: string;
  books: Book[];
  recipes: RecipeWithBook[];
  total_recipes: number;
}