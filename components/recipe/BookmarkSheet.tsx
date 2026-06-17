// components/recipe/BookmarkSheet.tsx
// Recipe bookmark picker/manager. Opened from the recipe header bookmark
// button. Lists the user's bookmarks (locked defaults Favorite/Make Soon +
// customs), toggles this recipe on/off each, and creates/edits custom ones
// with a color. Favorite renders the bookmark glyph with a star.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { SaveOutlineIcon, SaveFilledIcon } from './SaveIcon';
import StarIcon from '../icons/recipe/StarIcon';
import {
  getRecipeBookmarks,
  toggleRecipeBookmark,
  createBookmark,
  renameBookmark,
  recolorBookmark,
  deleteBookmark,
  BOOKMARK_PALETTE,
  Bookmark,
  BookmarkWithState,
} from '../../lib/services/bookmarkService';

interface Props {
  visible: boolean;
  onClose: () => void;
  recipeId: string;
  userId: string;
  /** Fired whenever assignments change so the header can refresh its chips. */
  onChange?: () => void;
}

type Mode = { type: 'list' } | { type: 'create' } | { type: 'edit'; bookmark: Bookmark };

function BookmarkGlyph({ bookmark, assigned }: { bookmark: Bookmark; assigned: boolean }) {
  const Glyph = assigned ? SaveFilledIcon : SaveOutlineIcon;
  return (
    <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
      <Glyph size={26} color={bookmark.color} />
      {bookmark.kind === 'favorite' && (
        <View style={{ position: 'absolute', top: 5 }}>
          <StarIcon size={11} color={assigned ? '#fff' : bookmark.color} />
        </View>
      )}
    </View>
  );
}

export default function BookmarkSheet({ visible, onClose, recipeId, userId, onChange }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [bookmarks, setBookmarks] = useState<BookmarkWithState[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>({ type: 'list' });
  const [busy, setBusy] = useState(false);

  // Create/edit form state
  const [name, setName] = useState('');
  const [color, setColor] = useState(BOOKMARK_PALETTE[0]);

  const reload = async () => {
    const rows = await getRecipeBookmarks(userId, recipeId);
    setBookmarks(rows);
  };

  useEffect(() => {
    if (!visible) return;
    setMode({ type: 'list' });
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [visible, recipeId, userId]);

  const toggle = async (b: BookmarkWithState) => {
    // optimistic
    setBookmarks((prev) => prev.map((x) => (x.key === b.key ? { ...x, isAssigned: !x.isAssigned } : x)));
    const res = await toggleRecipeBookmark(userId, recipeId, b.key);
    if (!res.success) {
      setBookmarks((prev) => prev.map((x) => (x.key === b.key ? { ...x, isAssigned: b.isAssigned } : x)));
    } else {
      onChange?.();
    }
  };

  const startCreate = () => {
    setName('');
    setColor(BOOKMARK_PALETTE[0]);
    setMode({ type: 'create' });
  };
  const startEdit = (b: Bookmark) => {
    setName(b.name);
    setColor(BOOKMARK_PALETTE.includes(b.color) ? b.color : BOOKMARK_PALETTE[0]);
    setMode({ type: 'edit', bookmark: b });
  };

  const submitCreate = async () => {
    if (busy) return;
    setBusy(true);
    const res = await createBookmark(userId, name, color);
    setBusy(false);
    if (!res.success || !res.bookmark) {
      Alert.alert('Hmm', res.error ?? 'Could not create the bookmark.');
      return;
    }
    // auto-assign the new bookmark to this recipe
    await toggleRecipeBookmark(userId, recipeId, res.bookmark.key);
    await reload();
    onChange?.();
    setMode({ type: 'list' });
  };

  const submitEdit = async () => {
    if (busy || mode.type !== 'edit' || !mode.bookmark.id) return;
    setBusy(true);
    const id = mode.bookmark.id;
    const r1 = await renameBookmark(userId, id, name);
    const r2 = r1.success ? await recolorBookmark(userId, id, color) : r1;
    setBusy(false);
    if (!r1.success) { Alert.alert('Hmm', r1.error ?? 'Could not save.'); return; }
    if (!r2.success) { Alert.alert('Hmm', r2.error ?? 'Could not save the color.'); return; }
    await reload();
    onChange?.();
    setMode({ type: 'list' });
  };

  const confirmDelete = (b: Bookmark) => {
    if (!b.id) return;
    Alert.alert(
      `Delete "${b.name}"?`,
      'This removes the bookmark from every recipe it’s on.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteBookmark(userId, b.id!);
            if (!res.success) { Alert.alert('Hmm', res.error ?? 'Could not delete.'); return; }
            await reload();
            onChange?.();
            setMode({ type: 'list' });
          },
        },
      ]
    );
  };

  const ColorPalette = () => (
    <View style={styles.paletteRow}>
      {BOOKMARK_PALETTE.map((c) => (
        <TouchableOpacity
          key={c}
          style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSelected]}
          onPress={() => setColor(c)}
        />
      ))}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <View style={styles.sheet}>
        <View style={styles.handle} />

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ paddingVertical: 32 }} />
        ) : mode.type === 'list' ? (
          <>
            <Text style={styles.title}>Bookmarks</Text>
            <ScrollView style={styles.list}>
              {bookmarks.map((b) => (
                <View key={b.key} style={styles.row}>
                  <TouchableOpacity style={styles.rowMain} onPress={() => toggle(b)} activeOpacity={0.7}>
                    <BookmarkGlyph bookmark={b} assigned={b.isAssigned} />
                    <Text style={styles.rowLabel}>{b.name}</Text>
                  </TouchableOpacity>
                  {b.editable && (
                    <TouchableOpacity onPress={() => startEdit(b)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.editLink}>Edit</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={[styles.check, b.isAssigned && styles.checkOn]}>{b.isAssigned ? '✓' : ''}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.newBtn} onPress={startCreate}>
              <Text style={styles.newBtnText}>+ New bookmark</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>{mode.type === 'create' ? 'New bookmark' : 'Edit bookmark'}</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Thanksgiving"
              placeholderTextColor={colors.text.tertiary}
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <ColorPalette />
            <TouchableOpacity
              style={[styles.primaryButton, busy && styles.disabled]}
              onPress={mode.type === 'create' ? submitCreate : submitEdit}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.background.card} />
              ) : (
                <Text style={styles.primaryButtonText}>{mode.type === 'create' ? 'Create' : 'Save'}</Text>
              )}
            </TouchableOpacity>
            {mode.type === 'edit' && (
              <TouchableOpacity style={styles.deleteLink} onPress={() => confirmDelete(mode.bookmark)}>
                <Text style={styles.deleteLinkText}>Delete bookmark</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.backLink} onPress={() => setMode({ type: 'list' })}>
              <Text style={styles.backLinkText}>Back</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
    sheet: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      padding: 20,
      paddingBottom: 32,
      maxHeight: '75%',
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border.medium,
      marginBottom: 12,
    },
    title: { fontSize: 18, fontWeight: '700', color: colors.text.primary, marginBottom: 12 },
    list: { maxHeight: 320 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    rowMain: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    rowLabel: { fontSize: 16, color: colors.text.primary },
    editLink: { fontSize: 13, color: colors.primary },
    check: { width: 18, fontSize: 16, color: 'transparent', textAlign: 'center' },
    checkOn: { color: colors.primary, fontWeight: '700' },
    newBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    newBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary },
    input: {
      borderWidth: 1, borderColor: colors.border.medium, borderRadius: 8,
      padding: 14, fontSize: 16, color: colors.text.primary, marginBottom: 16,
    },
    paletteRow: { flexDirection: 'row', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
    swatch: { width: 34, height: 34, borderRadius: 17 },
    swatchSelected: { borderWidth: 3, borderColor: colors.text.primary },
    primaryButton: { backgroundColor: colors.primary, padding: 16, borderRadius: 8, alignItems: 'center' },
    disabled: { opacity: 0.6 },
    primaryButtonText: { color: colors.background.card, fontSize: 16, fontWeight: '600' },
    deleteLink: { alignItems: 'center', marginTop: 14 },
    deleteLinkText: { fontSize: 14, color: '#cc3333' },
    backLink: { alignItems: 'center', marginTop: 14 },
    backLinkText: { fontSize: 14, color: colors.primary },
  });
