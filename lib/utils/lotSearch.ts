// ============================================
// FRIGO — LOT SEARCH (Phase 8R-CP6e-PantryUI-b)
// ============================================
// Client-side multi-token AND filter across a lot's display dimensions.
// Used by LotsList's "Find within lots…" affordance (D8R-Q51 — shows at 4+
// lots) when expanding a tracks_lots supply in PantryScreen / SupplyDetail.
//
// Match dimensions per D8R-Q56 (subset relevant to the per-supply lots scope):
//   - variant_label
//   - brand
//   - notes
//   - storage_location (with synonym expansion per D8R-Q58)
//
// Storage synonym map mirrors the server-side `expand_storage_synonyms()`
// shipped in `docs/cp6e_schema_migration.sql`. Keep them in sync.
//
// Pure module — no hooks, no side effects.
// ============================================

import type {
  SearchMatchDimension,
  SupplyLot,
  SupplySearchMatch,
  SupplyWithTags,
} from '../types/supplies';

/**
 * Token-to-synonyms map. A query token gets expanded to this array; the token
 * passes for a lot when any synonym substring-matches any dimension. Keys are
 * lower-cased.
 *
 * Source-of-truth: SQL function `expand_storage_synonyms(p_token TEXT)` in
 * `docs/cp6e_schema_migration.sql`.
 */
const STORAGE_SYNONYMS: Record<string, string[]> = {
  frozen: ['frozen', 'freezer'],
  freezer: ['freezer', 'frozen'],
  fridge: ['fridge', 'refrigerated', 'cold'],
  refrigerated: ['refrigerated', 'fridge', 'cold'],
  cold: ['cold', 'fridge', 'refrigerated'],
  shelf: ['shelf', 'pantry', 'cupboard'],
  cupboard: ['cupboard', 'pantry', 'shelf'],
  pantry: ['pantry', 'shelf', 'cupboard'],
  counter: ['counter', 'room', 'temp'],
};

function expandToken(token: string): string[] {
  return STORAGE_SYNONYMS[token] ?? [token];
}

/**
 * Filter `lots` to those matching every token in `query`. Tokens are split on
 * whitespace and lower-cased. A token passes for a lot when any of its
 * synonym expansions substring-matches any of the lot's searchable
 * dimensions.
 *
 * Empty / whitespace-only query → returns `lots` unchanged.
 */
export function filterLotsBySearch(lots: SupplyLot[], query: string): SupplyLot[] {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return lots;

  return lots.filter((lot) => {
    const dimensions: string[] = [
      (lot.variant_label ?? '').toLowerCase(),
      (lot.brand ?? '').toLowerCase(),
      (lot.notes ?? '').toLowerCase(),
      lot.storage_location.toLowerCase(),
    ];

    return tokens.every((token) => {
      const expanded = expandToken(token);
      return expanded.some((syn) =>
        dimensions.some((dim) => dim.length > 0 && dim.includes(syn))
      );
    });
  });
}

// ============================================
// CP6e-FlowsUI-b2 — Supply-level post-hoc match
// ============================================
//
// Mirrors the server's `search_supplies` RPC match logic per-dimension. The
// server returns only supply_id + rank; this matcher recomputes which of
// the 8 dimensions actually contributed so the UI can render pill labels
// and highlight which lots matched (via lot-level dimensions).
//
// Dimension match rule (AND-across-tokens per dimension):
//   A dimension is "matched" iff EVERY query token has at least one
//   synonym-expanded substring hit somewhere in that dimension's text(s).
//   This mirrors `to_tsquery('simple', '<tokens AND>')` semantics — the
//   server's tsquery is AND-joined across tokens against the unioned
//   tsvector, so per-dimension match in our flatter client model means
//   every token has a hit.
//
// matchedLotIds rule (per-lot OR-of-any-token-having-any-dim-hit):
//   A lot lands in matchedLotIds if AT LEAST ONE token has a synonym-
//   substring hit in ANY of that lot's four dimensions (variant / brand /
//   notes / storage). Tuned to highlight more lots rather than fewer; the
//   alternative AND-across-tokens-per-lot was too strict (would hide lots
//   that partially matched).
//
// Keep server-side `expand_storage_synonyms` in sync with STORAGE_SYNONYMS
// above. The simple-dictionary tsquery means we don't need stemming.

function tokenHitsAny(token: string, texts: string[]): boolean {
  const expansions = expandToken(token);
  return expansions.some((syn) =>
    texts.some((t) => t.length > 0 && t.toLowerCase().includes(syn))
  );
}

function everyTokenHitsAny(tokens: string[], texts: string[]): boolean {
  return tokens.every((t) => tokenHitsAny(t, texts));
}

export function computeSupplySearchMatch(
  supply: SupplyWithTags,
  query: string
): SupplySearchMatch {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return {
      supplyId: supply.id,
      rank: 0,
      matchedDimensions: new Set(),
      matchedLotIds: new Set(),
    };
  }

  const matchedDimensions = new Set<SearchMatchDimension>();

  // ----- Supply-level dimensions -----

  // name: custom_name | ingredient.name | ingredient.plural_name
  // (Server SQL: setweight(custom_name, 'A') || setweight(ingredient.name, 'A')
  //              || setweight(ingredient.plural_name, 'A'))
  const nameTexts = [
    supply.custom_name ?? '',
    supply.ingredient?.name ?? '',
    supply.ingredient?.plural_name ?? '',
  ];
  if (everyTokenHitsAny(tokens, nameTexts)) {
    matchedDimensions.add('name');
  }

  // family: ingredient.family (weight B)
  const familyTexts = [supply.ingredient?.family ?? ''];
  if (everyTokenHitsAny(tokens, familyTexts)) {
    matchedDimensions.add('family');
  }

  // type: ingredient.ingredient_type (weight B)
  const typeTexts = [supply.ingredient?.ingredient_type ?? ''];
  if (everyTokenHitsAny(tokens, typeTexts)) {
    matchedDimensions.add('type');
  }

  // tag: joined supply tag values (weight C — server joins via supply_tags →
  // tags + string_agg). Client equivalent: gather tag.value across supply.tags.
  const tagTexts = (supply.tags ?? []).map((t) => t.value);
  if (tagTexts.length > 0 && everyTokenHitsAny(tokens, tagTexts)) {
    matchedDimensions.add('tag');
  }

  // ----- Lot-level dimensions -----
  // Each lot dimension is computed across the union of all active lots'
  // values. Matched if every token has a synonym-substring hit somewhere in
  // that union.

  const lots = supply.lots ?? [];
  const variantTexts = lots
    .map((l) => l.variant_label ?? '')
    .filter((v) => v.length > 0);
  if (variantTexts.length > 0 && everyTokenHitsAny(tokens, variantTexts)) {
    matchedDimensions.add('variant');
  }

  const brandTexts = lots.map((l) => l.brand ?? '').filter((v) => v.length > 0);
  if (brandTexts.length > 0 && everyTokenHitsAny(tokens, brandTexts)) {
    matchedDimensions.add('brand');
  }

  const notesTexts = lots.map((l) => l.notes ?? '').filter((v) => v.length > 0);
  if (notesTexts.length > 0 && everyTokenHitsAny(tokens, notesTexts)) {
    matchedDimensions.add('notes');
  }

  const storageTexts = lots.map((l) => l.storage_location);
  if (storageTexts.length > 0 && everyTokenHitsAny(tokens, storageTexts)) {
    matchedDimensions.add('storage');
  }

  // ----- matchedLotIds (per-lot OR) -----
  const matchedLotIds = new Set<string>();
  for (const lot of lots) {
    const lotDimTexts = [
      lot.variant_label ?? '',
      lot.brand ?? '',
      lot.notes ?? '',
      lot.storage_location,
    ];
    // Per-lot OR: any token having any hit in any of this lot's four dims.
    const anyTokenAnyDim = tokens.some((tok) => tokenHitsAny(tok, lotDimTexts));
    if (anyTokenAnyDim) matchedLotIds.add(lot.id);
  }

  return {
    supplyId: supply.id,
    rank: 0, // overlaid by caller from RPC result
    matchedDimensions,
    matchedLotIds,
  };
}
