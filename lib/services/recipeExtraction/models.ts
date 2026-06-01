// lib/services/recipeExtraction/models.ts
// Centralized Anthropic model IDs for the recipe-extraction pipeline.
//
// WHY THIS FILE EXISTS: model strings were previously hardcoded as literals
// scattered across the extraction services. When Anthropic retires a model,
// every retired ID returns a 404 not_found_error with no fallback — and the
// scattered literals make each retirement a multi-file hunt. Centralizing them
// here makes the next deprecation a one-line change.
//
// Model IDs are PINNED SNAPSHOTS. The 4.6 generation onward uses a dateless
// format (e.g. claude-sonnet-4-6) that is still a pinned snapshot, not an
// evergreen pointer. Pre-4.6 models keep a dated suffix (e.g. -20251001).
// Source: https://platform.claude.com/docs/en/about-claude/models/overview
//
// Deprecation history for this pipeline:
//   - claude-3-haiku-20240307 (Haiku 3)  — RETIRED ~2026-04-20 → migrated to Haiku 4.5
//   - claude-sonnet-4-20250514 (Sonnet 4) — retires 2026-06-15 → migrated to Sonnet 4.6
//
// NOTE: the Supabase edge functions in supabase/functions/* run under Deno and
// cannot import this module. They keep their own model constants and must be
// migrated + redeployed separately. Keep this file as the canonical reference.

/** Cheap text model for parsing already-scraped web recipe data (URL import). */
export const RECIPE_PARSE_MODEL = 'claude-haiku-4-5-20251001';

/** Vision model for extracting recipes from photos/images. */
export const VISION_MODEL = 'claude-sonnet-4-6';
