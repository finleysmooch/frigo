// ============================================
// FRIGO — VIEW TAG RESOLUTION (Phase 8R-UX6 Item 4a)
// ============================================
// Shared helper extracted from four prior duplicates (InlineAddNeedRow,
// ExpandedRegularsSheet, ListPickerModal, SupplyControls). Resolves a
// view's filter values to concrete tag IDs, getOrCreating any missing
// (space-scoped) tags along the way.
//
// Drift caught during extraction: `SupplyControls` previously unioned the
// supply's own tags into the result so spawned needs inherited store /
// etc. tags. That behavior is supply-specific and stays in SupplyControls
// — this helper covers only the view→tag-id translation.
// ============================================

import { getOrCreateTag } from '../services/tagsService';
import { Tag, TagDimension } from '../types/tags';
import { ViewWithFilters } from '../types/views';

// Urgency values sorted most-specific → least-specific. When a view has
// multiple urgency values, the helper collapses to the most specific
// (today > this-week > this-month) — single-tag resolution semantics.
export const URGENCY_SPECIFICITY = ['today', 'this-week', 'this-month'];

/**
 * Resolve a view's filter values to concrete tag IDs.
 *
 * @param view View whose filters to traverse. `status` dimension is
 *             skipped (row-level concept, not a tag). If multiple
 *             `urgency` values are present, collapses to the most
 *             specific.
 * @param tagsBySpace Cached tags for the active space. If the helper
 *             can find an existing tag here (case-insensitive value
 *             match on the right dimension), it uses that ID directly.
 *             Missing tags get created via `getOrCreateTag`.
 * @param spaceId Active space id (for `getOrCreateTag`).
 * @param userId  Acting user id (for `getOrCreateTag`).
 * @returns Tag IDs to attach to a new need / supply. Never throws —
 *          per-tag failures are logged and skipped so the rest of the
 *          resolution proceeds.
 */
export async function resolveViewTagIds(
  view: ViewWithFilters | null,
  tagsBySpace: Tag[],
  spaceId: string,
  userId: string
): Promise<string[]> {
  if (!view) return [];
  const tagIds: string[] = [];
  for (const f of view.filters) {
    if (f.dimension === 'status') continue;
    let values = f.values;
    if (f.dimension === 'urgency' && values.length > 1) {
      const ranked = values
        .slice()
        .sort(
          (a, b) =>
            URGENCY_SPECIFICITY.indexOf(a) - URGENCY_SPECIFICITY.indexOf(b)
        );
      const winner = ranked.find((v) => URGENCY_SPECIFICITY.includes(v));
      values = winner ? [winner] : [values[0]];
    }
    for (const value of values) {
      const existing = tagsBySpace.find(
        (t) =>
          t.dimension === f.dimension &&
          t.value.toLowerCase() === value.toLowerCase()
      );
      if (existing) {
        tagIds.push(existing.id);
        continue;
      }
      try {
        const created = await getOrCreateTag(
          spaceId,
          f.dimension as TagDimension,
          value,
          userId
        );
        tagIds.push(created.id);
      } catch (error) {
        console.error('❌ resolveViewTagIds: getOrCreateTag failed:', error);
      }
    }
  }
  return tagIds;
}
