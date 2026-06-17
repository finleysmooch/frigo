// components/recipe/BookmarkFilterRow.tsx
// Horizontal, single-select bookmark filter chips. Shared by the Recipes screen
// and the book view. The two locked defaults (Favorite, Make Soon) always show;
// custom bookmarks appear only when they have at least one recipe (keeps the row
// tight). Tapping a chip filters to that bookmark; tapping the active chip clears
// it (single-select). Star glyph for Favorite, bookmark glyph for the rest.

import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { listBookmarks, Bookmark } from '../../lib/services/bookmarkService';
import { getTagCounts } from '../../lib/services/userRecipeTagsService';
import { SaveOutlineIcon, SaveFilledIcon } from './SaveIcon';
import StarIcon from '../icons/recipe/StarIcon';

interface Props {
  userId: string;
  activeKey: string | null;
  onChange: (key: string | null) => void;
  /** Optional caption rendered above the row (e.g. "Bookmarks"). */
  label?: string;
  style?: StyleProp<ViewStyle>;
  /** Bump to force a reload of the bookmark list (e.g. after edits). */
  reloadKey?: number;
}

export default function BookmarkFilterRow({ userId, activeKey, onChange, label, style, reloadKey }: Props) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([listBookmarks(userId), getTagCounts(userId)])
      .then(([all, counts]) => {
        if (!alive) return;
        // Defaults (editable === false) always render; custom bookmarks only
        // when they actually file at least one recipe.
        setBookmarks(all.filter((b) => !b.editable || (counts[b.key] ?? 0) > 0));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [userId, reloadKey]);

  if (bookmarks.length === 0) return null;

  return (
    <View style={style}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {bookmarks.map((b) => {
          const active = activeKey === b.key;
          const fg = active ? '#fff' : b.color;
          return (
            <TouchableOpacity
              key={b.key}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: b.color, borderColor: b.color }
                  : { backgroundColor: b.color + '14', borderColor: b.color + '66' },
              ]}
              onPress={() => onChange(active ? null : b.key)}
              activeOpacity={0.7}
            >
              {b.kind === 'favorite' ? (
                <StarIcon size={12} color={fg} />
              ) : active ? (
                <SaveFilledIcon size={13} color={fg} />
              ) : (
                <SaveOutlineIcon size={13} color={fg} />
              )}
              <Text style={[styles.chipText, { color: fg }]}>{b.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: '#64748b', marginBottom: 6, marginLeft: 2, fontWeight: '500' },
  row: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
});
