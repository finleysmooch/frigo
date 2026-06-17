// lib/services/bookmarkService.ts
// Custom recipe bookmarks — composes userRecipeTagsService.
//
// Per-recipe ASSIGNMENTS live in user_recipe_tags (tag = a bookmark KEY).
// CUSTOM definitions (name + color) live in user_bookmarks. The two built-in
// defaults — Favorite (key 'favorite') and Make Soon (key 'cook_soon') — are
// LOCKED code constants here, not rows: no rename/recolor/delete, so no storage
// or seeding. "Make Soon" is the existing cook_soon tag relabeled, so
// CookSoonScreen / getRecipesWithTag('cook_soon') keep working unchanged.

import { supabase } from '../supabase';
import { fetchAllRows } from '../utils/fetchAllRows';
import {
  getRecipeTags,
  toggleRecipeTag,
  getRecipesWithTag,
  TaggedRecipe,
} from './userRecipeTagsService';

export type BookmarkKind = 'favorite' | 'cook_soon' | 'custom';

export interface Bookmark {
  id: string | null; // null for the locked default constants
  key: string; // stable tag key (lowercase)
  name: string;
  color: string;
  kind: BookmarkKind;
  sort_order: number;
  editable: boolean; // false for the two locked defaults
}

export interface BookmarkWithState extends Bookmark {
  isAssigned: boolean;
}

// Fixed palette for custom bookmarks. Deeper, cohesive jewel tones (the 600–800
// range) chosen to harmonize with Frigo's teal-forward brand rather than the
// generic bright Tailwind set — reads more professional. Must match the DB
// CHECK (^#[0-9A-Fa-f]{6}$).
export const BOOKMARK_PALETTE = [
  '#0d9488', // teal (brand primary)
  '#0e7490', // deep cyan
  '#65a30d', // olive / lime (brand accent, deepened)
  '#ca8a04', // gold
  '#c2410c', // terracotta
  '#9f1239', // wine
  '#6d28d9', // plum
  '#475569', // slate
];

const FAVORITE_COLOR = '#ca8a04'; // gold (matches the palette's deepened gold)
const MAKE_SOON_COLOR = '#0d9488'; // teal (brand primary)

export const DEFAULT_BOOKMARKS: Bookmark[] = [
  { id: null, key: 'favorite', name: 'Favorite', color: FAVORITE_COLOR, kind: 'favorite', sort_order: -2, editable: false },
  { id: null, key: 'cook_soon', name: 'Make Soon', color: MAKE_SOON_COLOR, kind: 'cook_soon', sort_order: -1, editable: false },
];
const DEFAULT_KEYS = new Set(DEFAULT_BOOKMARKS.map((b) => b.key));
const DEFAULT_NAMES = new Set(DEFAULT_BOOKMARKS.map((b) => b.name.toLowerCase()));

interface CustomRow {
  id: string;
  key: string;
  name: string;
  color: string;
  sort_order: number;
}

function rowToBookmark(r: CustomRow): Bookmark {
  return { id: r.id, key: r.key, name: r.name, color: r.color, kind: 'custom', sort_order: r.sort_order, editable: true };
}

/**
 * All of the user's bookmarks: the two locked defaults + their custom ones.
 * The defaults are always returned — if the custom-rows query fails (e.g. the
 * user_bookmarks migration hasn't been applied yet), we still surface Favorite
 * and Make Soon (those ride on user_recipe_tags, which always exists).
 */
export async function listBookmarks(userId: string): Promise<Bookmark[]> {
  let custom: Bookmark[] = [];
  try {
    const rows = await fetchAllRows<CustomRow>((from, to) =>
      supabase
        .from('user_bookmarks')
        .select('id, key, name, color, sort_order')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .range(from, to)
    );
    custom = rows.map(rowToBookmark);
  } catch (error) {
    console.warn('listBookmarks: could not load custom bookmarks (defaults still shown):', error);
  }
  return [...DEFAULT_BOOKMARKS, ...custom];
}

/** Create a custom bookmark. Key = lowercase slug + short suffix (stable). */
export async function createBookmark(
  userId: string,
  name: string,
  color: string
): Promise<{ success: boolean; bookmark?: Bookmark; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: 'Please enter a name.' };
  if (DEFAULT_NAMES.has(trimmed.toLowerCase())) {
    return { success: false, error: `"${trimmed}" is a built-in bookmark.` };
  }
  if (!BOOKMARK_PALETTE.includes(color)) {
    return { success: false, error: 'Pick a color.' };
  }

  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'bookmark';
  const suffix = Math.random().toString(36).slice(2, 7);
  const key = `${slug}-${suffix}`;

  try {
    const { data, error } = await supabase
      .from('user_bookmarks')
      .insert({ user_id: userId, key, name: trimmed, color, sort_order: 0 })
      .select('id, key, name, color, sort_order')
      .single();
    if (error) {
      if (error.code === '23505') return { success: false, error: 'You already have a bookmark with that name.' };
      throw error;
    }
    return { success: true, bookmark: rowToBookmark(data as CustomRow) };
  } catch (error) {
    console.error('Error creating bookmark:', error);
    return { success: false, error: 'Could not create the bookmark.' };
  }
}

/** Rename a custom bookmark (name only — the key/assignments are untouched). */
export async function renameBookmark(
  userId: string,
  bookmarkId: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: 'Please enter a name.' };
  if (DEFAULT_NAMES.has(trimmed.toLowerCase())) {
    return { success: false, error: `"${trimmed}" is a built-in bookmark.` };
  }
  try {
    const { error } = await supabase
      .from('user_bookmarks')
      .update({ name: trimmed })
      .eq('id', bookmarkId)
      .eq('user_id', userId);
    if (error) {
      if (error.code === '23505') return { success: false, error: 'You already have a bookmark with that name.' };
      throw error;
    }
    return { success: true };
  } catch (error) {
    console.error('Error renaming bookmark:', error);
    return { success: false, error: 'Could not rename the bookmark.' };
  }
}

/** Recolor a custom bookmark. */
export async function recolorBookmark(
  userId: string,
  bookmarkId: string,
  color: string
): Promise<{ success: boolean; error?: string }> {
  if (!BOOKMARK_PALETTE.includes(color)) return { success: false, error: 'Pick a color.' };
  try {
    const { error } = await supabase
      .from('user_bookmarks')
      .update({ color })
      .eq('id', bookmarkId)
      .eq('user_id', userId);
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error recoloring bookmark:', error);
    return { success: false, error: 'Could not update the color.' };
  }
}

/**
 * Delete a custom bookmark: first remove its assignment rows
 * (user_recipe_tags where tag = key), then the definition row. RLS scopes both
 * to the user. No DB FK between the tables (tag is free-text), so this is two
 * explicit statements.
 */
export async function deleteBookmark(
  userId: string,
  bookmarkId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: row, error: readErr } = await supabase
      .from('user_bookmarks')
      .select('key')
      .eq('id', bookmarkId)
      .eq('user_id', userId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!row) return { success: false, error: 'Bookmark not found.' };
    if (DEFAULT_KEYS.has(row.key)) return { success: false, error: 'Built-in bookmarks cannot be deleted.' };

    await supabase.from('user_recipe_tags').delete().eq('user_id', userId).eq('tag', row.key);
    const { error: delErr } = await supabase.from('user_bookmarks').delete().eq('id', bookmarkId).eq('user_id', userId);
    if (delErr) throw delErr;
    return { success: true };
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    return { success: false, error: 'Could not delete the bookmark.' };
  }
}

/** All bookmarks with whether each is assigned to this recipe (for the sheet). */
export async function getRecipeBookmarks(
  userId: string,
  recipeId: string
): Promise<BookmarkWithState[]> {
  const [bookmarks, tags] = await Promise.all([listBookmarks(userId), getRecipeTags(userId, recipeId)]);
  const tagSet = new Set(tags);
  return bookmarks.map((b) => ({ ...b, isAssigned: tagSet.has(b.key) }));
}

/** Just the bookmarks assigned to this recipe (for the header chips). */
export async function getAssignedBookmarks(userId: string, recipeId: string): Promise<Bookmark[]> {
  const all = await getRecipeBookmarks(userId, recipeId);
  return all.filter((b) => b.isAssigned);
}

/** Toggle this recipe on/off a bookmark (by key). */
export async function toggleRecipeBookmark(
  userId: string,
  recipeId: string,
  bookmarkKey: string
): Promise<{ success: boolean; isAssigned: boolean; error?: string }> {
  const { success, isTagged, error } = await toggleRecipeTag(userId, recipeId, bookmarkKey);
  return { success, isAssigned: isTagged, error };
}

/** Recipes filed under a bookmark (delegates to the paginated tag query). */
export async function getRecipesForBookmark(userId: string, bookmarkKey: string): Promise<TaggedRecipe[]> {
  return getRecipesWithTag(userId, bookmarkKey);
}

/**
 * Map of recipeId → the bookmarks assigned to it, for the whole user, in a
 * single tag scan (so recipe-list cards can show their bookmark glyphs without
 * one query per card). Tags that aren't registered bookmark keys (e.g. the
 * book-view 'saved' tag) are skipped. Each recipe's list is sorted by
 * sort_order so the defaults lead.
 */
export async function getBookmarksByRecipe(userId: string): Promise<Map<string, Bookmark[]>> {
  const [defs, tagRows] = await Promise.all([
    listBookmarks(userId),
    fetchAllRows<{ recipe_id: string; tag: string }>((from, to) =>
      supabase.from('user_recipe_tags').select('recipe_id, tag').eq('user_id', userId).range(from, to)
    ),
  ]);
  const byKey = new Map(defs.map((d) => [d.key, d]));
  const map = new Map<string, Bookmark[]>();
  for (const row of tagRows) {
    const def = byKey.get(row.tag);
    if (!def) continue; // not a registered bookmark (e.g. 'saved')
    const arr = map.get(row.recipe_id);
    if (arr) arr.push(def);
    else map.set(row.recipe_id, [def]);
  }
  for (const arr of map.values()) arr.sort((a, b) => a.sort_order - b.sort_order);
  return map;
}
