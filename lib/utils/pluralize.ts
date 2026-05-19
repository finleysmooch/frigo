// Phase 8R-CP6d-Pantry — display pluralization helper.
// Catalog-driven: ingredient rows store `plural_name` and we pick singular vs
// plural by quantity. Used by SupplyRow (qty always 1 → always singular) and
// by NeedRow (CP6d-ViewDetail) where qty can vary.

export function pluralize(
  singular: string,
  plural: string | null | undefined,
  qty: number
): string {
  if (qty > 1 && plural) return plural;
  return singular;
}
