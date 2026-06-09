// ============================================
// FRIGO — SUPPLY CONTROLS (Phase 8R-CP6d-SmokeFix-1, P12 + P32)
// ============================================
// Shared interactive panel used by both:
//   • SupplyRow's inline-expanded body (P12)
//   • SupplyQuickEditModal long-press surface (P32)
//
// Controls:
//   • 0–4 usage-level slider with PanResponder (StarRating-style gesture)
//   • Regular bookmark toggle (tracking_mode = restock vs track_only)
//   • Priority bookmark toggle (is_priority)
//   • Storage segmented picker
//   • Grocery-list membership (ListMembershipControl) — show / add / move /
//     remove the list(s) this supply is on, plus the Staple auto-list rule
//   • "Search Recipes →" cross-stack to RecipesStack/RecipeList
//
// Each control writes its field individually (direct manipulation pattern,
// mirrors SupplyDetailScreen). Optimistic local updates handled by parent.
// Location: components/pantry/SupplyControls.tsx
// ============================================

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { RootTabParamList } from '../../App';
import {
  setSupplyPriority,
  setSupplyStorage,
  setSupplyTrackingMode,
  setSupplyUsageLevel,
} from '../../lib/services/suppliesService';
import {
  StorageLocation,
  SupplyStatus,
  SupplyWithTags,
  TrackingMode,
} from '../../lib/types/supplies';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../../lib/theme';
import { UsageLevel } from './StatusIcon';
import UsageLevelSlider from './UsageLevelSlider';
import ListMembershipControl from './ListMembershipControl';
import { RegularBookmarkIcon, PriorityBookmarkIcon } from './BookmarkIcons';
import { StorageIcon, storageLabel } from './StorageIcons';
import RecipesOutline from '../icons/RecipesOutline';

const STORAGE_OPTIONS: StorageLocation[] = ['fridge', 'freezer', 'pantry', 'counter'];

function clampLevel(raw: number | null | undefined): UsageLevel {
  if (raw === null || raw === undefined) return 4;
  const n = Math.max(0, Math.min(4, Math.round(raw)));
  return n as UsageLevel;
}

// statusForLevel + statusLabel previously lived here; both are now owned by
// UsageLevelSlider. Removed in CP6d-SmokeFix-4 follow-up.

export interface SupplyControlsProps {
  supply: SupplyWithTags;
  onSupplyChanged: (next: SupplyWithTags) => void;
  /**
   * If false, hides the "Open detail ›" link. Used by SupplyQuickEditModal
   * to avoid the redundant nav (the modal IS the quick-edit; users wanting
   * deeper edit paths use SupplyDetail via PantryRow's separate route).
   */
  showOpenDetail?: boolean;
  onOpenDetail?: () => void;
  /**
   * Called when a supply→need spawn happens via "+ Add to grocery list" so
   * the parent can refresh whatever it cares about (rare for SupplyRow,
   * since the supply itself doesn't change).
   */
  onNeedCreated?: () => void;
  userId: string;
}

export default function SupplyControls({
  supply,
  onSupplyChanged,
  showOpenDetail = false,
  onOpenDetail,
  userId,
}: SupplyControlsProps) {
  const { colors, functionalColors } = useTheme();
  const tabNav = useNavigation<NavigationProp<RootTabParamList>>();

  const level = clampLevel(supply.usage_level);
  const status = supply.status;

  const [busy, setBusy] = useState(false);

  // CP6d-SmokeFix-4 follow-up: anchored modals over the storage + bookmark
  // icon buttons. Each menu measures its button on tap and positions the
  // dropdown directly below.
  const storageBtnRef = useRef<View>(null);
  const bookmarkBtnRef = useRef<View>(null);
  const [storageMenu, setStorageMenu] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [bookmarkMenu, setBookmarkMenu] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const openStorageMenu = useCallback(() => {
    storageBtnRef.current?.measureInWindow((x, y, w, h) => {
      setStorageMenu({ x, y, w, h });
    });
  }, []);
  const openBookmarkMenu = useCallback(() => {
    bookmarkBtnRef.current?.measureInWindow((x, y, w, h) => {
      setBookmarkMenu({ x, y, w, h });
    });
  }, []);

  // ----- Usage-level slider (CP6d-SmokeFix-4 follow-up; battery rework: 0–4) -----
  // Single 4-segment widget; UsageLevelSlider owns the gesture handling.
  const applyLevel = useCallback(
    async (next: UsageLevel) => {
      if (next === level || busy) return;
      try {
        setBusy(true);
        const updated = await setSupplyUsageLevel(supply.id, next);
        onSupplyChanged(updated);
      } catch (error) {
        console.error('❌ SupplyControls applyLevel error:', error);
        Alert.alert('Error', 'Could not update level.');
      } finally {
        setBusy(false);
      }
    },
    [supply.id, level, busy, onSupplyChanged]
  );

  // ----- Toggles -----

  const handleRegularToggle = async () => {
    if (busy) return;
    try {
      setBusy(true);
      const next: TrackingMode =
        supply.tracking_mode === 'restock' ? 'track_only' : 'restock';
      const updated = await setSupplyTrackingMode(supply.id, next);
      onSupplyChanged(updated);
    } catch (error) {
      console.error('❌ SupplyControls regular toggle error:', error);
      Alert.alert('Error', 'Could not toggle regular.');
    } finally {
      setBusy(false);
    }
  };

  const handlePriorityToggle = async () => {
    if (busy) return;
    try {
      setBusy(true);
      const updated = await setSupplyPriority(supply.id, !supply.is_priority);
      onSupplyChanged(updated);
    } catch (error) {
      console.error('❌ SupplyControls priority toggle error:', error);
      Alert.alert('Error', 'Could not toggle priority.');
    } finally {
      setBusy(false);
    }
  };

  const handleStorageChange = async (loc: StorageLocation) => {
    if (busy || supply.storage_location === loc) return;
    try {
      setBusy(true);
      const updated = await setSupplyStorage(supply.id, loc);
      onSupplyChanged(updated);
    } catch (error) {
      console.error('❌ SupplyControls storage change error:', error);
      Alert.alert('Error', 'Could not update storage.');
    } finally {
      setBusy(false);
    }
  };

  // ----- Search recipes -----

  const handleSearchRecipes = () => {
    const name = supply.ingredient?.name ?? supply.custom_name ?? '';
    if (!name) return;
    tabNav.navigate('RecipesStack', {
      screen: 'RecipeList',
      params: { initialIngredient: name, initialBrowseMode: 'all' },
    } as never);
  };

  // ----- Render -----

  const styles = useMemo(
    () => makeStyles(colors, functionalColors),
    [colors, functionalColors]
  );

  // Bookmark kind & helpers (single icon — Priority above Regular).
  const bookmarkKind: 'priority' | 'regular' | 'none' = supply.is_priority
    ? 'priority'
    : supply.tracking_mode === 'restock'
    ? 'regular'
    : 'none';

  const setBookmark = async (next: 'priority' | 'regular' | 'none') => {
    if (busy) return;
    setBookmarkMenu(null);
    try {
      setBusy(true);
      // Two writes when toggling across the priority axis: tracking_mode
      // (restock vs track_only) + is_priority. Keep them sequential so a
      // failed second write surfaces.
      if (next === 'priority') {
        // Priority implies tracking_mode='restock' (priority spawns on low
        // require restock semantics anyway).
        if (supply.tracking_mode !== 'restock') {
          const u1 = await setSupplyTrackingMode(supply.id, 'restock');
          onSupplyChanged(u1);
        }
        if (!supply.is_priority) {
          const u2 = await setSupplyPriority(supply.id, true);
          onSupplyChanged(u2);
        }
      } else if (next === 'regular') {
        if (supply.is_priority) {
          const u1 = await setSupplyPriority(supply.id, false);
          onSupplyChanged(u1);
        }
        if (supply.tracking_mode !== 'restock') {
          const u2 = await setSupplyTrackingMode(supply.id, 'restock');
          onSupplyChanged(u2);
        }
      } else {
        // None → track_only + not priority.
        if (supply.is_priority) {
          const u1 = await setSupplyPriority(supply.id, false);
          onSupplyChanged(u1);
        }
        if (supply.tracking_mode !== 'track_only') {
          const u2 = await setSupplyTrackingMode(supply.id, 'track_only');
          onSupplyChanged(u2);
        }
      }
    } catch (error) {
      console.error('❌ SupplyControls bookmark set error:', error);
      Alert.alert('Error', 'Could not update bookmark.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* CP6d-SmokeFix-4 follow-up — top row layout (per Tom):
          [ slider ............ ] [ storage icon ] [ bookmark icon ] */}
      <View style={styles.topRow}>
        <View style={styles.sliderCol}>
          <UsageLevelSlider
            level={level}
            status={status}
            disabled={busy}
            onLevelChange={(next) => applyLevel(next)}
          />
        </View>

        {/* Bookmark icon — single icon (priority above regular). Sized +30%
            from the prior pass and shifted toward the middle of the row
            (between slider end and row right edge), since storage moved
            down to the third line. */}
        <View ref={bookmarkBtnRef} collapsable={false} style={styles.bookmarkButtonWrap}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={openBookmarkMenu}
            disabled={busy}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={
              bookmarkKind === 'priority'
                ? 'Priority — tap to change'
                : bookmarkKind === 'regular'
                ? 'Staple — tap to change'
                : 'On hand — tap to change'
            }
          >
            {bookmarkKind === 'priority' ? (
              <View style={styles.priorityNudge}>
                <PriorityBookmarkIcon size={23} color={colors.primary} />
              </View>
            ) : bookmarkKind === 'regular' ? (
              <RegularBookmarkIcon size={18} color={colors.primary} />
            ) : (
              <RegularBookmarkIcon size={18} color={colors.text.tertiary} filled={false} />
            )}
            <Text style={styles.iconButtonLabel} numberOfLines={1}>
              {bookmarkKind === 'priority'
                ? 'Priority'
                : bookmarkKind === 'regular'
                ? 'Staple'
                : 'On hand'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2026-06-04: grocery-list membership block (left, flex:1) + Search
          (right, content-sized, pinned top) share ONE row, so Search's Y
          position is independent of how the list chips wrap. Open detail /
          Location is its own row below (direct child of container). */}
      {(() => {
        const rawIngredientName =
          supply.ingredient?.name ?? supply.custom_name ?? '';
        const displayedIngredientName =
          rawIngredientName.length > 16
            ? rawIngredientName.slice(0, 14) + '...'
            : rawIngredientName;
        return (
          <View style={styles.listsSearchRow}>
            <View style={styles.listsCol}>
              <ListMembershipControl
                supply={supply}
                userId={userId}
                onSupplyChanged={onSupplyChanged}
              />
            </View>

            <TouchableOpacity
              style={styles.searchRecipesButton}
              onPress={handleSearchRecipes}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={`Search ${rawIngredientName || 'this ingredient'} within Recipes`}
            >
              {/* Line 1 — "Search {name}" (name in black) */}
              <Text style={styles.searchLine1}>
                <Text style={styles.footerLink}>Search </Text>
                <Text style={styles.searchIngredientName}>
                  {displayedIngredientName}
                </Text>
              </Text>
              {/* Line 2 — "within 🍳 Recipes →" */}
              <View style={styles.searchLine2}>
                <Text style={styles.footerLink}>within </Text>
                <RecipesOutline size={13} color={colors.primary} />
                <Text style={styles.footerLink}> Recipes →</Text>
              </View>
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* Open detail (left edge) + Location (right edge) — own row below the
          lists/Search row; container `gap` provides the separation. */}
      <View style={styles.line2Wrap}>
        {showOpenDetail ? (
          <TouchableOpacity
            onPress={onOpenDetail}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="Open detail screen"
            style={styles.openDetailButton}
          >
            <Text style={styles.openDetailText}>Open detail ›</Text>
          </TouchableOpacity>
        ) : (
          /* Empty spacer so Location stays right-aligned even when Open detail
             is hidden (e.g., inside SupplyQuickEditModal where showOpenDetail=false). */
          <View />
        )}

        <View ref={storageBtnRef} collapsable={false}>
          <TouchableOpacity
            style={styles.storageInlineButton}
            onPress={openStorageMenu}
            disabled={busy}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Location: ${storageLabel(supply.storage_location)}`}
          >
            <Text style={styles.storageInlinePrefix}>Location:</Text>
            <Text style={styles.storageInlineLabel} numberOfLines={1}>
              {storageLabel(supply.storage_location)}
            </Text>
            <StorageIcon
              storage={supply.storage_location}
              size={16}
              color={supply.storage_location ? colors.text.primary : colors.text.tertiary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Storage menu — anchored over the storage icon. */}
      <Modal
        visible={storageMenu !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setStorageMenu(null)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setStorageMenu(null)}>
          {storageMenu && (
            <Pressable
              style={[
                styles.anchoredMenu,
                { top: storageMenu.y + storageMenu.h + 4, left: Math.max(8, storageMenu.x - 60) },
              ]}
              onPress={() => {}}
            >
              {STORAGE_OPTIONS.map((opt) => {
                const active = supply.storage_location === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.menuRow, active && styles.menuRowActive]}
                    onPress={() => {
                      setStorageMenu(null);
                      handleStorageChange(opt);
                    }}
                    activeOpacity={0.7}
                  >
                    <StorageIcon
                      storage={opt}
                      size={20}
                      color={active ? colors.primary : colors.text.secondary}
                    />
                    <Text
                      style={[
                        styles.menuRowLabel,
                        active && styles.menuRowLabelActive,
                      ]}
                    >
                      {storageLabel(opt)}
                    </Text>
                    {active && <Text style={styles.menuCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </Pressable>
          )}
        </Pressable>
      </Modal>

      {/* Bookmark menu — anchored over the bookmark icon. Shifted further
          left (offset ~140) so the wider description text doesn't clip
          off-screen. Each option has a 5–7 word description below the name. */}
      <Modal
        visible={bookmarkMenu !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setBookmarkMenu(null)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setBookmarkMenu(null)}>
          {bookmarkMenu && (
            <Pressable
              style={[
                styles.anchoredMenu,
                styles.anchoredMenuWide,
                { top: bookmarkMenu.y + bookmarkMenu.h + 4, left: Math.max(8, bookmarkMenu.x - 180) },
              ]}
              onPress={() => {}}
            >
              {(['none', 'regular', 'priority'] as const).map((kind) => {
                const active = bookmarkKind === kind;
                const label =
                  kind === 'priority'
                    ? 'Priority'
                    : kind === 'regular'
                    ? 'Staple'
                    : 'On hand';
                const description =
                  kind === 'priority'
                    ? 'Auto-adds to your Short List when it runs low.'
                    : kind === 'regular'
                    ? 'Auto-adds to Long List when low, Short List when out.'
                    : 'Just track in pantry — never auto-listed.';
                return (
                  <TouchableOpacity
                    key={kind}
                    style={[styles.menuRow, active && styles.menuRowActive]}
                    onPress={() => setBookmark(kind)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.bookmarkMenuIconWrap}>
                      {kind === 'priority' ? (
                        <View style={styles.priorityNudge}>
                          <PriorityBookmarkIcon
                            size={22}
                            color={active ? colors.primary : colors.text.secondary}
                          />
                        </View>
                      ) : kind === 'regular' ? (
                        <RegularBookmarkIcon
                          size={18}
                          color={active ? colors.primary : colors.text.secondary}
                        />
                      ) : (
                        <RegularBookmarkIcon
                          size={18}
                          filled={false}
                          color={active ? colors.primary : colors.text.tertiary}
                        />
                      )}
                    </View>
                    <View style={styles.menuRowTextCol}>
                      <Text
                        style={[
                          styles.menuRowLabel,
                          active && styles.menuRowLabelActive,
                        ]}
                      >
                        {label}
                      </Text>
                      <Text style={styles.menuRowDescription} numberOfLines={2}>
                        {description}
                      </Text>
                    </View>
                    {active && <Text style={styles.menuCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </Pressable>
          )}
        </Pressable>
      </Modal>

    </View>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  _fc: ReturnType<typeof useTheme>['functionalColors']
) {
  return StyleSheet.create({
    container: { gap: 8 },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    sliderCol: {
      // Slider takes its natural content width — DOESN'T stretch via flex.
      // Storage + bookmark icons cluster on the right via marginLeft: 'auto'
      // on the storage wrapper. Result: a clear gap between the slider's
      // + button and the storage icon (no visual overlap).
      flexShrink: 0,
    },
    iconButton: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      // Tightened internal padding so the storage + bookmark icons sit
      // closer to each other (the dominant horizontal spacing between them
      // is each iconButton's left+right padding).
      paddingHorizontal: 4,
      paddingVertical: 4,
      minWidth: 48,
    },
    bookmarkButtonWrap: {
      // Slightly further right than the prior pass, plus pushed down
      // vertically so the icon sits below the topRow's center line.
      marginLeft: 'auto',
      marginRight: 0,
      marginTop: 12,
    },
    /* storageInlineWrap removed — Location now sits inside line2Wrap
       which handles its right-edge positioning via justifyContent. */
    storageInlineButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    storageInlinePrefix: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
      fontWeight: typography.weights.medium,
    },
    storageInlineLabel: {
      fontSize: typography.sizes.xs,
      color: colors.text.primary,
      fontWeight: typography.weights.semibold,
    },
    iconButtonLabel: {
      fontSize: 11,
      color: colors.text.tertiary,
      fontWeight: typography.weights.medium,
    },
    // Anchored menus over storage / bookmark icons
    menuOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.2)',
    },
    anchoredMenu: {
      position: 'absolute',
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.md,
      paddingVertical: 4,
      minWidth: 160,
      ...shadows.large,
    },
    anchoredMenuWide: {
      // Slightly tighter per Tom's pass — used to be 240/280.
      minWidth: 200,
      maxWidth: 240,
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: spacing.sm,
      paddingVertical: 8,
    },
    menuRowActive: {
      backgroundColor: colors.primaryLight,
    },
    menuRowLabel: {
      fontSize: typography.sizes.sm,
      color: colors.text.primary,
      fontWeight: typography.weights.medium,
    },
    menuRowLabelActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    menuRowTextCol: {
      flex: 1,
    },
    menuRowDescription: {
      fontSize: 11,
      color: colors.text.tertiary,
      marginTop: 2,
    },
    bookmarkMenuIconWrap: {
      width: 26,
      alignItems: 'center',
    },
    priorityNudge: {
      // CP6d-SmokeFix-4 follow-up: priority bookmark SVG has a heavier
      // left-side stem; nudge ~10% of its rendered width right so it visually
      // aligns with the regular bookmark.
      paddingLeft: 2,
    },
    menuCheck: {
      fontSize: typography.sizes.md,
      color: colors.primary,
      fontWeight: typography.weights.bold,
    },
    addToListButton: {
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border.medium,
      alignItems: 'center',
    },
    addToListText: {
      fontSize: typography.sizes.sm,
      color: colors.primary,
      fontWeight: typography.weights.medium,
    },
    listsSearchRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    listsCol: {
      flex: 1,
      minWidth: 0, // lets the chip row wrap instead of overflowing the column
    },
    searchRecipesButton: {
      // 2026-06-04: shares the lists row — content-sized + pinned top-right so
      // its Y position is independent of how the list chips wrap.
      flexShrink: 0,
      flexDirection: 'column',
      alignItems: 'flex-end',
      justifyContent: 'flex-start',
      paddingTop: 2,
    },
    searchLine1: {
      lineHeight: 16,
      textAlign: 'right',
    },
    searchIngredientName: {
      fontSize: typography.sizes.sm,
      color: colors.text.primary, // black
      fontWeight: typography.weights.semibold,
    },
    searchLine2: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    line2Wrap: {
      // 2026-06-04: own row (direct child of container); container `gap`
      // separates it. Open detail (left) + Location (right) via space-between.
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 0,
    },
    openDetailButton: {
      paddingVertical: 4,
      paddingHorizontal: 4,
    },
    openDetailText: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
      fontWeight: typography.weights.medium,
      textAlign: 'right',
    },
    footerLink: {
      fontSize: typography.sizes.sm,
      color: colors.primary,
      fontWeight: typography.weights.medium,
    },
    // View picker modal
    pickerOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    pickerCard: {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.xl,
      paddingTop: spacing.md,
      paddingBottom: 8,
      maxHeight: '70%',
    },
    pickerTitle: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold,
      color: colors.text.primary,
    },
    pickerHint: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
    },
    pickerScroll: {
      maxHeight: 320,
    },
    pickerRow: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    pickerRowLabel: {
      fontSize: typography.sizes.md,
      color: colors.text.primary,
      fontWeight: typography.weights.medium,
    },
    pickerRowMeta: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
      marginTop: 2,
    },
    pickerCancel: {
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    pickerCancelText: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
    },
  });
}
