// lib/services/recipeDelivery/copySet.ts
// CP6b — the PARAMETERIZED copy-set config (anchor §4.3, v0.3.6). SINGLE SOURCE OF TRUTH for what
// copy-on-verify delivers. A future narrowing (e.g. → the metadata model) is an edit to THIS file,
// not an engine rewrite — that reversibility is non-negotiable per §4.3.
//
// This file deliberately mirrors anchor §4.3's ratified copy-set EXACTLY. The completeness guard
// (verifyCopySetAgainstLiveSchema, see recipeDeliveryService) checks the live FK closure against
// COPIED_CHILD_TABLES ∪ EXCLUDED_CHILD_TABLES and STOPS if any table is unclassified.

// ── recipes columns the delivery engine OWNS (never copied verbatim from the canonical row) ───────
// These are set by the engine, not inherited:
export const RECIPE_ENGINE_SET_COLUMNS = [
  'id', // new uuid (DB default)
  'user_id', // = the delivered-to user
  'book_id', // = the catalog book id (is_catalog stays true; orthogonal to ownership)
  'parent_recipe_id', // = the canonical recipe id (read-only lineage pointer)
  'created_at',
  'updated_at',
  'is_public', // copies are private (false)
  // provenance (§4.5 / Amendment B — inherited from canonical, never re-stamped with "now"):
  'extraction_method',
  'extraction_model',
  'is_author_authenticated', // always false for machine-extracted copies
] as const;

// ── recipes columns EXCLUDED from the copy (left at DB default/null) ───────────────────────────────
// §4.3 explicitly excludes gold_standard_notes. The other gold_standard_* columns are the CANONICAL's
// QA-verification state and must NOT transfer to a user copy (a copy is not a verified gold standard).
// ⚠️ FLAG: only `gold_standard_notes` is named verbatim in §4.3; resetting is_gold_standard +
// gold_standard_verified_* is a field-level decision beyond §4.3's literal text — config-reversible,
// surfaced for oversight in SESSION_LOG.
export const RECIPE_EXCLUDED_COLUMNS = [
  'gold_standard_notes', // §4.3 explicit (QA artifact)
  'is_gold_standard', // reset (copy is not the gold standard)
  'gold_standard_verified_by',
  'gold_standard_verified_at',
] as const;

// ── COPIED child tables (anchor §4.3), in dependency order, with re-parent spec ───────────────────
export type ParentMap = 'recipe' | 'instruction_section';
export interface ChildCopySpec {
  table: string;
  /** FK column re-pointed at the new parent id. */
  parentKey: string;
  /** Which old→new id map re-parents this table. `recipe` = top-level child; `instruction_section`
   *  = two-level (re-parented to the NEW instruction_sections ids). */
  parentMap: ParentMap;
}
export const COPIED_CHILDREN: ChildCopySpec[] = [
  { table: 'recipe_ingredients', parentKey: 'recipe_id', parentMap: 'recipe' },
  { table: 'recipe_media', parentKey: 'recipe_id', parentMap: 'recipe' }, // url is a reference (§3 (a)) — copied verbatim
  { table: 'recipe_photos', parentKey: 'recipe_id', parentMap: 'recipe' }, // image_url reference; expected empty (zero writers)
  { table: 'recipe_source_notes', parentKey: 'recipe_id', parentMap: 'recipe' },
  { table: 'instruction_sections', parentKey: 'recipe_id', parentMap: 'recipe' },
  // two-level: instruction_steps re-parented to the NEW section ids (must run after instruction_sections)
  { table: 'instruction_steps', parentKey: 'section_id', parentMap: 'instruction_section' },
];

/** Per-child columns the engine sets (everything else on the row is copied verbatim). */
export const CHILD_ENGINE_SET_COLUMNS = ['id', 'created_at', 'updated_at']; // + the spec's parentKey

// ── EXCLUDED child/grandchild tables (anchor §4.3) — documented for the completeness guard ────────
export const EXCLUDED_CHILD_TABLES = [
  // user content
  'recipe_annotations',
  'user_recipe_tags',
  'user_recipe_preferences',
  'recipe_step_notes',
  'user_ingredient_choices', // v0.3.6 — user content (grandchild of recipe_ingredients; the FK-scan-halted table)
  // leak/dangle
  'recipe_references',
  // user-activity
  'cooking_sessions',
  'posts',
  'meal_dish_plans',
  'needs_recipes',
  // QA / operational
  'extraction_corrections',
  'extraction_logs',
  'recipe_extraction_comparison',
  'recipe_extraction_queue',
  'recipe_image_mapping', // §4.3 typo'd as recipe_image_mappings (v0.3.6 fixed)
  'or_pattern_decisions',
];

/** The recipes self-FK is lineage, never a copy target. */
export const LINEAGE_SELF_REF_TABLE = 'recipes';

/** Every table the live FK closure may surface, classified. The completeness guard asserts the live
 *  closure ⊆ this set; anything else HALTS (per §4.3). */
export const CLASSIFIED_TABLES = new Set<string>([
  ...COPIED_CHILDREN.map((c) => c.table),
  ...EXCLUDED_CHILD_TABLES,
  LINEAGE_SELF_REF_TABLE,
]);
