// Phase 8R-CP2a — supply types.
// Per Q5/Q14/Q15/Q27/Q35/Q37 — see PHASE_8R_UNIFIED_NEEDS.md.
// Phase 8R-CP6d-Schema additions: tracking_mode, storage_location,
// archived_at, is_priority, usage_level (gap-audit Decisions Locked).
// Phase 8R-CP6e-Schema additions: tracks_lots flag + supply_lots row + aggregate
// (D8R-Q43-Q60 — see CP6e-Services-a build).

import { Tag } from './tags';

// CP6d-SmokeFix-4 Task 3: 'unknown' added as a real status. Reachable only
// via long-press modal or SupplyDetail's status strip — NOT via cycle-tap
// (per Tom's call, accidental cycling-into-unknown would degrade pantry UX).
// Unknown supplies are hidden from Attention/Regulars/On Hand sections;
// surface only during search in the "Not tracked yet" group. Schema CHECK
// constraint update lives at _pk_sync/cp6d_smokefix4_unknown_status_migration.sql.
export type SupplyStatus = 'in_stock' | 'low' | 'critical' | 'out' | 'unknown';

// Q35: critical only reachable via state-cycling, not at creation.
export type SupplyInitialStatus = 'in_stock' | 'low' | 'out';

// CP6d-Schema: how a supply behaves on out-transitions.
//  - 'restock' → spawn need on out (existing CP3-era behavior).
//  - 'track_only' → auto-archive on out (no spawn).
export type TrackingMode = 'restock' | 'track_only';

// CP6d-Schema: canonical export of the storage-location enum.
// Until CP6d, this lived inlined in ingredientSuggestionService.ts.
// 8R-UX1: 'garden' added for items growing at home. Requires the DB CHECK
// constraint update in docs/8R_UX1_add_garden_storage_migration.sql before
// supplies with this value will save.
export type StorageLocation = 'fridge' | 'freezer' | 'pantry' | 'counter' | 'garden';

export interface Supply {
  id: string;
  space_id: string;
  ingredient_id: string | null;
  custom_name: string | null;
  status: SupplyStatus;
  for_user_ids: string[];
  brands: string[];
  added_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // 8R-UX4: behavioral-engagement timestamp — drives "Sitting Idle" in the
  // Pantry Use Soon outer tab. Bumped by status changes, swipe-mark-used,
  // lot creates/updates/archives, cook depletion, lot storage moves. See
  // lib/services/suppliesService.ts CONFIRMING_FUNCTIONS_REFERENCE for the
  // canonical bumper list.
  last_confirmed_at: string;
  // CP6d-Schema fields
  tracking_mode: TrackingMode;
  storage_location: StorageLocation | null;
  archived_at: string | null;
  is_priority: boolean;
  usage_level: number; // 0–5 inclusive
  // CP6e-Schema field (D8R-Q43)
  tracks_lots: boolean;
}

export interface SupplyIngredient {
  id: string;
  name: string;
  plural_name: string | null;
  family: string;
  ingredient_type: string | null;
  typical_store_section: string | null;
  // 8R-UX1: per-storage shelf life in days. Used by lotsService.isLotExpiringSoon
  // to derive a per-ingredient "expiring soon" threshold (clamped 1-7d at 25%
  // of shelf life). null → fall back to the flat 7d rule.
  shelf_life_days_fridge: number | null;
  shelf_life_days_freezer: number | null;
  shelf_life_days_pantry: number | null;
  shelf_life_days_counter: number | null;
}

export interface SupplyWithTags extends Supply {
  tags: Tag[];
  ingredient: SupplyIngredient | null;
  // CP6e-Services-a: populated when getSuppliesForSpace/getSupplyById is called
  // with `{ includeLots: true }`. Default consumers never see these.
  lots?: SupplyLot[];
  lot_aggregate?: SupplyLotAggregate;
}

export interface CreateSupplyParams {
  spaceId: string;
  ingredientId?: string;
  customName?: string;
  status: SupplyInitialStatus;
  forUserIds?: string[];
  brands?: string[];
  addedBy: string;
  notes?: string;
  tagIds?: string[];
  // CP6d-Schema: optional overrides; createSupply infers when omitted.
  trackingMode?: TrackingMode;
  storageLocation?: StorageLocation;
  isPriority?: boolean;
}

export interface UpdateSupplyParams {
  customName?: string;
  forUserIds?: string[];
  brands?: string[];
  notes?: string;
}

// Return type for status-change operations (includes optional spawned need per Q10β).
// CP6d-Schema: adds `autoArchived` for the track_only-at-out auto-archive path.
export interface SupplyStatusResult {
  supply: SupplyWithTags;
  spawnedNeed?: {
    id: string;
    ingredient_id: string | null;
    custom_name: string | null;
    status: string;
    supply_id: string;
  };
  autoArchived?: boolean;
}

// ============================================
// CP6e-Schema — Lots (D8R-Q43-Q60)
// ============================================

// D8R-Q46. One physical inventory instance of a supply.
export interface SupplyLot {
  id: string;
  supply_id: string;

  quantity: number;
  quantity_unit: string;

  storage_location: StorageLocation;
  acquired_at: string;            // ISO
  expires_at: string | null;      // ISO; computed default at create time, user-overridable
  expires_at_overridden: boolean; // D8R-Q47. true → future storage moves preserve expires_at

  variant_label: string | null;
  brand: string | null;
  notes: string | null;

  consumed_at: string | null;     // D8R-Q48 soft-delete on full consumption

  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Aggregate metadata for a supply's lots — useful for display + decision logic.
// `total_quantity` is summed in `canonical_unit`; if lots have multiple
// non-convertible units, `canonical_unit` is null and `total_quantity` is 0
// (caller's signal that aggregation isn't meaningful).
export interface SupplyLotAggregate {
  total_quantity: number;
  canonical_unit: string | null;
  lot_count: number;                // active lots only
  storage_locations: string[];      // distinct active storage locations
  variant_labels: string[];         // distinct active variant_labels (excluding null)
  oldest_expiration: string | null; // ISO; nearest future expiration across active lots
  // 8R-UX1: was a flat 7-day window. Now derived per-lot via
  // lotsService.isLotExpiringSoon when an ingredient is passed to
  // getLotAggregate (threshold = clamp(ceil(shelf_life * 0.25), 1, 7)).
  // Falls back to flat 7d when ingredient is absent.
  has_expiring_soon: boolean;
  // 8R-UX1: true when any active lot is already past expiration. Date-only,
  // computed unconditionally.
  has_expired: boolean;
}

export interface CreateLotParams {
  supply_id: string;
  quantity: number;
  quantity_unit: string;
  storage_location: StorageLocation;
  acquired_at?: string;            // defaults to NOW
  expires_at?: string;             // if omitted, computed from acquired_at + ingredient.shelf_life_days_<storage>
  variant_label?: string;
  brand?: string;
  notes?: string;
  created_by?: string;
}

export interface UpdateLotParams {
  quantity?: number;
  quantity_unit?: string;
  storage_location?: StorageLocation;
  acquired_at?: string;
  expires_at?: string;             // setting this also sets expires_at_overridden = true
  variant_label?: string | null;
  brand?: string | null;
  notes?: string | null;
}

// Result of deductFromOldest — used by cookDepletion + manual deplete.
export interface LotDeductionResult {
  lots_affected: Array<{
    lot_id: string;
    quantity_before: number;
    quantity_deducted: number;
    quantity_after: number;
    quantity_unit: string;         // lot's native unit at deduction time
    archived: boolean;             // true if this deduction set consumed_at
  }>;
  status_changed_to: SupplyStatus | null; // null if status didn't change
  shortfall: number;               // > 0 if couldn't satisfy requested qty
  shortfall_reason: 'no_compatible_unit' | 'insufficient_stock' | null;
}

// CP6e-Services-b: manual override plan for deductFromSpecificLots. Caller
// (e.g., cookDepletionService.applyDepletion's `options.overrides`) names the
// lots and quantities explicitly, bypassing the oldest-first default.
export interface LotDeductionPlanItem {
  lot_id: string;
  quantity: number;
  quantity_unit: string;
}

// ============================================
// CP6e-FlowsUI-b2 — Supply search match shapes
// ============================================
// Dimensions that can contribute to a `search_supplies` RPC match. Drives
// MatchPillRow display + lot-level highlighting. Mirrors the dimensions
// folded into the server-side tsvector (`supplies.search_vector` +
// per-lot search_vector) so the client post-hoc matcher
// (`lib/utils/lotSearch.computeSupplySearchMatch`) can recompute which
// dimensions matched without an RPC roundtrip.
export type SearchMatchDimension =
  | 'name'      // custom_name | ingredient.name | ingredient.plural_name
  | 'family'    // ingredient.family
  | 'type'      // ingredient.ingredient_type
  | 'tag'       // any supply_tag value
  | 'variant'   // any lot's variant_label
  | 'brand'     // any lot's brand
  | 'notes'     // any lot's notes
  | 'storage';  // any lot's storage_location (with synonym expansion)

export interface SupplySearchMatch {
  supplyId: string;
  /** ts_rank from the server RPC; populated by the caller (SuppliesSection). */
  rank: number;
  /** Dimensions where every query token has a synonym-substring hit. */
  matchedDimensions: Set<SearchMatchDimension>;
  /**
   * Lots that contributed via any lot-level dimension (variant/brand/notes/
   * storage). Per-lot OR-of-tokens-having-any-dim-hit — NOT AND across tokens.
   * Drives the soft background tint on LotRow when SupplyRow is expanded.
   */
  matchedLotIds: Set<string>;
}
