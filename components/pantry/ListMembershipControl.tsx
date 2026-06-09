// ============================================
// FRIGO — LIST MEMBERSHIP CONTROL (2026-06-04)
// ============================================
// Inline editor that replaces the old "+ Add to grocery list" button in the
// SupplyRow expanded panel. Shows which grocery list(s) a supply is currently
// on (derived from its linked needs' status + urgency tag), and lets the user
// add / move / remove memberships. For Staples (tracking_mode='restock') a
// single compact "Auto-list" button opens a config modal explaining + setting
// the auto-list rule (Low → / Out → which list).
//
// Lists map to the default views (icons mirror the grocery page via
// lib/utils/listIcon):
//   Short List  → urgency=today      GroceryBagIcon
//   Medium List → urgency=this-week  ShoppingCartIcon
//   Long List   → status=need only   ReceiptIcon
//   In Cart     → status=in_cart     CartIcon
//
// Manual adds use added_from='manual' so the auto-list rule never removes them
// on restock; rule-driven needs (added_from='supply_spawn') are tagged "auto".
// Location: components/pantry/ListMembershipControl.tsx
// ============================================

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  addSupplyToListManual,
  deleteNeed,
  getActiveNeedsForSupply,
  setNeedListMembership,
  GroceryListTarget,
} from '../../lib/services/needsService';
import { setSupplyListingRule } from '../../lib/services/suppliesService';
import { ListTarget, SupplyWithTags } from '../../lib/types/supplies';
import { NeedWithTags } from '../../lib/types/needs';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../../lib/theme';
import GroceryBagIcon from '../icons/grocery/GroceryBagIcon';
import ShoppingCartIcon from '../icons/grocery/ShoppingCartIcon';
import ReceiptIcon from '../icons/grocery/ReceiptIcon';
import CartIcon from '../icons/grocery/CartIcon';
import AutomaticIcon from '../icons/AutomaticIcon';

type ListKey = 'short' | 'medium' | 'long' | 'in_cart';

const LIST_LABEL: Record<ListKey, string> = {
  short: 'Short List',
  medium: 'Medium List',
  long: 'Long List',
  in_cart: 'In Cart',
};

// Short labels for the compact rule segments.
const RULE_SHORT: Record<ListTarget, string> = {
  none: 'Off',
  short: 'Short',
  medium: 'Med',
  long: 'Long',
};

// Grocery-page icons (lib/utils/listIcon parity).
function ListIcon({
  list,
  size,
  color,
}: {
  list: ListKey;
  size: number;
  color: string;
}) {
  switch (list) {
    case 'short':
      return <GroceryBagIcon size={size} color={color} />;
    case 'medium':
      return <ShoppingCartIcon size={size} color={color} />;
    case 'long':
      return <ReceiptIcon size={size} color={color} />;
    case 'in_cart':
      return <CartIcon size={size} color={color} />;
  }
}

function listOfNeed(need: NeedWithTags): ListKey {
  if (need.status === 'in_cart') return 'in_cart';
  const urgency = need.tags.find((t) => t.dimension === 'urgency')?.value;
  if (urgency === 'today') return 'short';
  if (urgency === 'this-week') return 'medium';
  return 'long';
}

interface Membership {
  need: NeedWithTags;
  list: ListKey;
  auto: boolean;
}

type Picker =
  | { kind: 'add' }
  | { kind: 'chip'; need: NeedWithTags; list: ListKey }
  | { kind: 'config' }
  | null;

export interface ListMembershipControlProps {
  supply: SupplyWithTags;
  userId: string;
  /** Bubbles the updated supply up when the auto-list rule changes. */
  onSupplyChanged?: (next: SupplyWithTags) => void;
}

export default function ListMembershipControl({
  supply,
  userId,
  onSupplyChanged,
}: ListMembershipControlProps) {
  const { colors } = useTheme();
  const [needs, setNeeds] = useState<NeedWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<Picker>(null);

  const isStaple = supply.tracking_mode === 'restock';
  const storeTagIds = useMemo(
    () => supply.tags.filter((t) => t.dimension === 'store').map((t) => t.id),
    [supply.tags]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await getActiveNeedsForSupply(supply.id);
      setNeeds(rows);
    } catch (error) {
      console.error('❌ ListMembershipControl load error:', error);
      setNeeds([]);
    } finally {
      setLoading(false);
    }
  }, [supply.id]);

  // Reload when the supply identity OR anything that can change membership
  // (status / rule targets, which drive reconciliation) changes.
  useEffect(() => {
    load();
  }, [load, supply.status, supply.low_list_target, supply.out_list_target]);

  const memberships: Membership[] = useMemo(
    () =>
      needs.map((need) => ({
        need,
        list: listOfNeed(need),
        auto: need.added_from === 'supply_spawn',
      })),
    [needs]
  );

  const handleAdd = async (target: 'short' | 'medium' | 'long') => {
    setPicker(null);
    if (busy) return;
    try {
      setBusy(true);
      await addSupplyToListManual(
        {
          spaceId: supply.space_id,
          ingredientId: supply.ingredient_id,
          customName: supply.custom_name,
          supplyId: supply.id,
          forUserIds: supply.for_user_ids,
          storeTagIds,
        },
        target,
        userId
      );
      await load();
    } catch (error) {
      console.error('❌ ListMembershipControl add error:', error);
      Alert.alert('Error', 'Could not add to list.');
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (need: NeedWithTags, target: GroceryListTarget) => {
    setPicker(null);
    if (busy) return;
    try {
      setBusy(true);
      await setNeedListMembership(need.id, supply.space_id, target, userId);
      await load();
    } catch (error) {
      console.error('❌ ListMembershipControl move error:', error);
      Alert.alert('Error', 'Could not update list.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (need: NeedWithTags) => {
    setPicker(null);
    if (busy) return;
    try {
      setBusy(true);
      await deleteNeed(need.id);
      await load();
    } catch (error) {
      console.error('❌ ListMembershipControl remove error:', error);
      Alert.alert('Error', 'Could not remove from list.');
    } finally {
      setBusy(false);
    }
  };

  // Inline rule edit — keeps the config modal open so both Low + Out can be set.
  const handleSetRule = async (which: 'low' | 'out', target: ListTarget) => {
    if (busy) return;
    try {
      setBusy(true);
      const updated = await setSupplyListingRule(
        supply.id,
        which === 'low' ? { lowTarget: target } : { outTarget: target }
      );
      onSupplyChanged?.(updated);
      await load();
    } catch (error) {
      console.error('❌ ListMembershipControl rule error:', error);
      Alert.alert('Error', 'Could not update rule.');
    } finally {
      setBusy(false);
    }
  };

  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>Grocery lists</Text>
        {/* Auto-list rule settings — Staples only. Lives on the title row,
            right-aligned (not above the Search line). */}
        {isStaple && (
          <TouchableOpacity
            style={styles.autoIconButton}
            onPress={() => setPicker({ kind: 'config' })}
            disabled={busy}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Auto-list rule settings"
          >
            <AutomaticIcon size={17} color={colors.text.secondary} />
            <Text style={styles.autoCaret}>▾</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Chips + add pill share ONE wrapping row, so the whole block is just
          two lines (title row above + this row). The chip name is single-line +
          width-capped so a chip can never wrap and grow this row. */}
      <View style={styles.chipsRow}>
        {!loading && memberships.length === 0 && (
          <Text style={styles.emptyText}>Not on a list</Text>
        )}
        {memberships.map(({ need, list, auto }) => (
          <TouchableOpacity
            key={need.id}
            style={styles.chip}
            onPress={() => setPicker({ kind: 'chip', need, list })}
            disabled={busy}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`On ${LIST_LABEL[list]}${auto ? ', auto-managed' : ''} — tap to change`}
          >
            <ListIcon list={list} size={15} color={colors.primary} />
            <Text style={styles.chipText} numberOfLines={1}>
              {LIST_LABEL[list]}
            </Text>
            {auto && <AutomaticIcon size={13} color={colors.primary} />}
            <Text style={styles.chipCaret}>▾</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.addChip}
          onPress={() => setPicker({ kind: 'add' })}
          disabled={busy}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Add to a grocery list"
        >
          <Text style={styles.addChipText}>+ add to list</Text>
        </TouchableOpacity>
      </View>

      {/* Single action-sheet modal driven by `picker`. */}
      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setPicker(null)}>
          <Pressable style={styles.menuCard} onPress={() => {}}>
            {picker?.kind === 'add' && (
              <>
                <Text style={styles.menuTitle}>Add to a list</Text>
                {(['short', 'medium', 'long'] as const).map((t) => (
                  <MenuRow
                    key={t}
                    styles={styles}
                    icon={<ListIcon list={t} size={18} color={colors.text.primary} />}
                    label={LIST_LABEL[t]}
                    onPress={() => handleAdd(t)}
                  />
                ))}
              </>
            )}

            {picker?.kind === 'chip' && (
              <>
                <View style={styles.menuTitleRow}>
                  <ListIcon list={picker.list} size={18} color={colors.text.primary} />
                  <Text style={styles.menuTitle}>{LIST_LABEL[picker.list]}</Text>
                </View>
                {(['short', 'medium', 'long'] as const)
                  .filter((t) => t !== picker.list)
                  .map((t) => (
                    <MenuRow
                      key={t}
                      styles={styles}
                      icon={<ListIcon list={t} size={18} color={colors.text.primary} />}
                      label={`Move to ${LIST_LABEL[t]}`}
                      onPress={() => handleMove(picker.need, t)}
                    />
                  ))}
                {picker.list !== 'in_cart' ? (
                  <MenuRow
                    styles={styles}
                    icon={<ListIcon list="in_cart" size={18} color={colors.text.primary} />}
                    label="Move to Cart"
                    onPress={() => handleMove(picker.need, 'in_cart')}
                  />
                ) : (
                  <MenuRow
                    styles={styles}
                    icon={<ListIcon list="long" size={18} color={colors.text.primary} />}
                    label="Move out of cart → Long List"
                    onPress={() => handleMove(picker.need, 'long')}
                  />
                )}
                <MenuRow
                  styles={styles}
                  label="Remove from lists"
                  destructive
                  onPress={() => handleRemove(picker.need)}
                />
              </>
            )}

            {picker?.kind === 'config' && (
              <>
                <Text style={styles.menuTitle}>Auto-list rule</Text>
                <Text style={styles.configDesc}>
                  When this staple runs low or out, Frigo adds it to a grocery list
                  for you. Restocking it (back to In stock) takes it off again.
                  Lists you add by hand aren&apos;t affected.
                </Text>

                <View style={styles.configSection}>
                  <Text style={styles.configSectionLabel}>When it runs low</Text>
                  <View style={styles.segRow}>
                    {(['none', 'long', 'medium', 'short'] as const).map((t) => (
                      <SegOption
                        key={t}
                        target={t}
                        active={supply.low_list_target === t}
                        onPress={() => handleSetRule('low', t)}
                        disabled={busy}
                        styles={styles}
                        colors={colors}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.configSection}>
                  <Text style={styles.configSectionLabel}>When it runs out</Text>
                  <View style={styles.segRow}>
                    {(['none', 'long', 'medium', 'short'] as const).map((t) => (
                      <SegOption
                        key={t}
                        target={t}
                        active={supply.out_list_target === t}
                        onPress={() => handleSetRule('out', t)}
                        disabled={busy}
                        styles={styles}
                        colors={colors}
                      />
                    ))}
                  </View>
                </View>
              </>
            )}

            <TouchableOpacity
              style={styles.menuCancel}
              onPress={() => setPicker(null)}
              activeOpacity={0.7}
            >
              <Text style={styles.menuCancelText}>
                {picker?.kind === 'config' ? 'Done' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function SegOption({
  target,
  active,
  onPress,
  disabled,
  styles,
  colors,
}: {
  target: ListTarget;
  active: boolean;
  onPress: () => void;
  disabled: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <TouchableOpacity
      style={[styles.segOption, active && styles.segOptionActive]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={target === 'none' ? "Don't auto-add" : RULE_SHORT[target]}
    >
      {target === 'none' ? (
        <Text style={[styles.segOff, active && styles.segLabelActive]}>—</Text>
      ) : (
        <ListIcon
          list={target}
          size={18}
          color={active ? colors.primary : colors.text.secondary}
        />
      )}
      <Text style={[styles.segLabel, active && styles.segLabelActive]}>
        {RULE_SHORT[target]}
      </Text>
    </TouchableOpacity>
  );
}

function MenuRow({
  styles,
  label,
  onPress,
  active,
  destructive,
  icon,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  onPress: () => void;
  active?: boolean;
  destructive?: boolean;
  icon?: ReactNode;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuRow, active && styles.menuRowActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuRowLeft}>
        {icon ? <View style={styles.menuRowIcon}>{icon}</View> : <View style={styles.menuRowIcon} />}
        <Text
          style={[
            styles.menuRowText,
            active && styles.menuRowTextActive,
            destructive && styles.menuRowTextDestructive,
          ]}
        >
          {label}
        </Text>
      </View>
      {active && <Text style={styles.menuCheck}>✓</Text>}
    </TouchableOpacity>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      gap: 6,
      paddingTop: 4,
    },
    headerRow: {
      // Left-aligned: title + settings icon sit together. NOT space-between —
      // right-aligning the icon put it in the same right-hand column as the
      // right-aligned Search button below, which read as "floating over Search".
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionLabel: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
      fontWeight: typography.weights.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    autoIconButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingVertical: 2,
      paddingHorizontal: 2,
    },
    autoCaret: {
      fontSize: 10,
      color: colors.text.tertiary,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    emptyText: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
      fontStyle: 'italic',
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: typography.sizes.sm,
      color: colors.primary,
      fontWeight: typography.weights.semibold,
      // Cap width so a long (custom) list name truncates with "…" instead of
      // wrapping and growing the row height.
      maxWidth: 130,
    },
    chipCaret: {
      fontSize: 10,
      color: colors.primary,
    },
    addChip: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border.medium,
    },
    addChipText: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    },
    // Action-sheet modal
    menuOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    menuCard: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingTop: spacing.md,
      paddingBottom: 28,
      ...shadows.large,
    },
    menuTitle: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.bold,
      color: colors.text.primary,
      textAlign: 'center',
    },
    menuTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingBottom: 4,
    },
    // Config modal
    configDesc: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      lineHeight: 19,
    },
    configSection: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: 6,
    },
    configSectionLabel: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
      fontWeight: typography.weights.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    segRow: {
      flexDirection: 'row',
      gap: 6,
    },
    segOption: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingVertical: 10,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border.light,
      backgroundColor: colors.background.secondary,
    },
    segOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    segOff: {
      fontSize: 18,
      lineHeight: 18,
      color: colors.text.tertiary,
    },
    segLabel: {
      fontSize: 11,
      color: colors.text.secondary,
      fontWeight: typography.weights.medium,
    },
    segLabelActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
    },
    menuRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    menuRowIcon: {
      width: 22,
      alignItems: 'center',
    },
    menuRowActive: {
      backgroundColor: colors.primaryLight,
    },
    menuRowText: {
      fontSize: typography.sizes.md,
      color: colors.text.primary,
      fontWeight: typography.weights.medium,
    },
    menuRowTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    menuRowTextDestructive: {
      color: '#ef4444',
    },
    menuCheck: {
      fontSize: typography.sizes.md,
      color: colors.primary,
      fontWeight: typography.weights.bold,
    },
    menuCancel: {
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border.light,
      marginTop: 4,
    },
    menuCancelText: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
    },
  });
}
