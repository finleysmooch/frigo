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

// Fixed palette for custom bookmarks (Tom-confirmed). Defaults use their own
// fixed colors below. Must match the DB CHECK (^#[0-9A-Fa-f]{6}$).
export const BOOKMARK_PALETTE = [
  '#0d9488', // teal
  '#F59E0B', // amber
  '#EF4444', // red
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#10B981', // green
];

const FAVORITE_COLOR = '#EAB308'; // gold
const MAKE_SOON_COLOR = '#F59E0B'; // amber

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

/** All of the user's bookmarks: the two locked defaults + their custom ones. */
export async function listBookmarks(userId: string): Promise<Bookmark[]> {
  const rows = await fetchAllRows<CustomRow>((from, to) =>
    supabase
      .from('user_bookmarks')
      .select('id, key, name, color, sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .range(from, to)
  );
  return [...DEFAULT_BOOKMARKS, ...rows.map(rowToBookmark)];
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
