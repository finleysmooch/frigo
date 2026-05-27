// ============================================
// FRIGO — SUPPLY ↔ VIEW MATCHING (Phase 8R-UX6 Item 4c)
// ============================================
// Predicate: does a supply qualify for a view's filter set?
//
// Extracted from two duplicates (ViewDetailScreen, ExpandedRegularsSheet)
// that had already drifted once. Post-drift-fix version: skips both
// `status` AND `urgency` dimensions when matching supplies.
//
// Rationale: urgency is a need-level concept ("Tonight" = "need this
// today"), not a supply-level property. Supplies don't carry urgency tags
// by default. Pre-fix, the Regulars strip on the Tonight / This Week
// default views showed 0/0/0/0 because no supply had an urgency=today
// tag. Now urgency is skipped entirely from the supply predicate.
//
// Status is also skipped (also a need-level field, not a supply tag).
//
// Other dimensions (store, storage, recipe) still apply — they're
// meaningful at the supply level.
// ============================================

import { SupplyWithTags } from '../types/supplies';
import { ViewWithFilters } from '../types/views';

export function supplyMatchesView(
  supply: SupplyWithTags,
  view: ViewWithFilters
): boolean {
  const tagFilters = view.filters.filter(
    (f) => f.dimension !== 'status' && f.dimension !== 'urgency'
  );
  if (tagFilters.length === 0) return true;
  for (const f of tagFilters) {
    const allowed = expandUrgencyValues(f.dimension, f.values);
    const matches = supply.tags.some(
      (t) => t.dimension === f.dimension && allowed.includes(t.value)
    );
    if (!matches) return false;
  }
  return true;
}

/**
 * Urgency widening — when a need is filtered by 'this-week', it also
 * includes 'today' items (the inclusive cascade). Same for 'this-month'
 * widening to include 'today' and 'this-week'. Other dimensions
 * pass-through unchanged. Exported for callers that need the same
 * widening for non-supply paths (e.g., needsService).
 */
export function expandUrgencyValues(
  dimension: string,
  values: string[]
): string[] {
  if (dimension !== 'urgency') return values;
  const expanded = new Set<string>(values);
  if (values.includes('this-week')) expanded.add('today');
  if (values.includes('this-month')) {
    expanded.add('today');
    expanded.add('this-week');
  }
  return Array.from(expanded);
}
