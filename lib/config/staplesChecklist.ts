// CP3 (D-ON-2 / D-ON-13) — the pantry-staples checklist content.
//
// D-ON-13 (provisional content, anchor §2): 21 items, 3 categories, no second
// tier. This is a CONFIG CONSTANT by ruling — content iterates post-look
// without a component rebuild. Labels are the D-ON-13 wording verbatim.
//
// `catalogName` is the EXACT `ingredients.name` the item resolves to at submit
// (resolved against the live catalog 2026-06-12; full mapping table in the CP3
// SESSION_LOG entry). An item whose catalogName stops resolving falls back to
// a customName supply — it is never dropped.
//
// `storageLocation` is set ONLY where the catalog ingredient's
// default_storage_location is NULL (createSupply infers from the catalog when
// omitted — the house convention; we don't override per-ingredient data with
// category-level guesses). Values follow the catalog's own convention for
// nearest-kin ingredients.

import { StorageLocation } from '../types/supplies';

export interface StapleItem {
  /** D-ON-13 display label (verbatim). */
  label: string;
  /** Exact ingredients.name to resolve at submit time. */
  catalogName: string;
  /** Only set where the catalog row's default_storage_location is NULL. */
  storageLocation?: StorageLocation;
}

export interface StapleCategory {
  key: 'pantry' | 'fridge' | 'condiments';
  title: string;
  items: StapleItem[];
}

export const STAPLES_CHECKLIST: StapleCategory[] = [
  {
    key: 'pantry',
    title: 'Pantry',
    items: [
      { label: 'Salt', catalogName: 'salt', storageLocation: 'pantry' },
      { label: 'Black pepper', catalogName: 'black pepper' },
      { label: 'Olive oil', catalogName: 'olive oil' },
      { label: 'Neutral oil', catalogName: 'neutral oil', storageLocation: 'pantry' },
      { label: 'AP flour', catalogName: 'all-purpose flour' },
      { label: 'Sugar', catalogName: 'sugar' },
      { label: 'Rice', catalogName: 'rice' },
      { label: 'Pasta', catalogName: 'pasta' },
      { label: 'Canned tomatoes', catalogName: 'crushed tomatoes' },
      { label: 'Chicken/veg stock', catalogName: 'chicken stock', storageLocation: 'pantry' },
    ],
  },
  {
    key: 'fridge',
    title: 'Fridge',
    items: [
      { label: 'Butter', catalogName: 'butter' },
      { label: 'Eggs', catalogName: 'eggs' },
      { label: 'Milk', catalogName: 'milk' },
      { label: 'Garlic', catalogName: 'garlic' },
      { label: 'Onions', catalogName: 'onion', storageLocation: 'pantry' },
      { label: 'Lemons', catalogName: 'lemon' },
    ],
  },
  {
    key: 'condiments',
    title: 'Condiments',
    items: [
      { label: 'Soy sauce', catalogName: 'soy sauce' },
      { label: 'Vinegar', catalogName: 'vinegar', storageLocation: 'pantry' },
      { label: 'Mustard', catalogName: 'mustard' },
      { label: 'Mayo', catalogName: 'mayonnaise' },
      { label: 'Hot sauce', catalogName: 'hot sauce' },
    ],
  },
];
