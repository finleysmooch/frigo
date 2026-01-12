// ============================================
// FRIGO - REGULAR ITEMS MANAGEMENT SCREEN
// ============================================
// Screen for managing recurring grocery items
// Location: screens/RegularItemsScreen.tsx

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { typography, spacing } from '../lib/theme';
import { useTheme } from '../lib/theme/ThemeContext';
import {
  getRegularGroceryItems,
  updateRegularItem,
  deleteRegularItem,
} from '../lib/groceryService';  // ✅ FIXED: Removed _OLD_BACKUP
import {
  RegularGroceryItemWithIngredient,
  PurchaseFrequency,
} from '../lib/types/grocery';
import AddRegularItemModal from '../components/AddRegularItemModal';
import EditRegularItemModal from '../components/EditRegularItemModal';

type Props = NativeStackScreenProps<any, 'RegularItems'>;

// Urgency status for items
type UrgencyStatus = 'overdue' | 'due_soon' | 'good' | 'paused';

interface GroupedItems {
  overdue: RegularGroceryItemWithIngredient[];
  dueSoon: RegularGroceryItemWithIngredient[];
  good: RegularGroceryItemWithIngredient[];
  paused: RegularGroceryItemWithIngredient[];
}

export default function RegularItemsScreen({ navigation }: Props) {
  const { colors, functionalColors } = useTheme();
  const [items, setItems] = useState<RegularGroceryItemWithIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<RegularGroceryItemWithIngredient | null>(null);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.card,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
      backgroundColor: colors.background.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    backButton: {
      padding: spacing.sm,
    },
    backButtonText: {
      fontSize: typography.sizes.md,
      color: colors.primary,
      fontWeight: '600',
    },
    headerTitle: {
      fontSize: typography.sizes.xl,
      fontWeight: 'bold',
      color: colors.text.primary,
    },
    headerSpacer: {
      width: 60,
    },
    filterContainer: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.background.secondary,
      gap: spacing.sm,
    },
    filterTab: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 8,
      backgroundColor: colors.background.card,
      alignItems: 'center',
    },
    filterTabActive: {
      backgroundColor: colors.primary,
    },
    filterText: {
      fontSize: typography.sizes.sm,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    filterTextActive: {
      color: colors.background.card,
    },
    scrollView: {
      flex: 1,
    },
    section: {
      padding: spacing.md,
    },
    sectionTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: spacing.md,
    },
    itemCard: {
      backgroundColor: colors.background.card,
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    itemHeader: {
      marginBottom: spacing.md,
    },
    itemTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs,
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    itemName: {
      fontSize: typography.sizes.lg,
      fontWeight: '600',
      color: colors.text.primary,
    },
    overdueBadge: {
      fontSize: typography.sizes.sm,
      color: functionalColors.error,
      fontWeight: '600',
    },
    dueSoonBadge: {
      fontSize: typography.sizes.sm,
      color: functionalColors.warning,
      fontWeight: '600',
    },
    pausedBadge: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
      fontWeight: '600',
    },
    itemDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    itemQuantity: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
    },
    itemSeparator: {
      fontSize: typography.sizes.md,
      color: colors.text.tertiary,
    },
    itemFrequency: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
    },
    itemDueDate: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
    },
    itemActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    actionButton: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 8,
      alignItems: 'center',
    },
    editButton: {
      backgroundColor: colors.primary,
    },
    editButtonText: {
      color: colors.background.card,
      fontSize: typography.sizes.sm,
      fontWeight: '600',
    },
    pauseButton: {
      backgroundColor: functionalColors.warning,
    },
    pauseButtonText: {
      color: colors.background.card,
      fontSize: typography.sizes.sm,
      fontWeight: '600',
    },
    deleteButton: {
      backgroundColor: functionalColors.error,
      flex: 0,
      paddingHorizontal: spacing.md,
    },
    deleteButtonText: {
      fontSize: typography.sizes.md,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xl * 3,
      paddingHorizontal: spacing.xl,
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: spacing.md,
    },
    emptyTitle: {
      fontSize: typography.sizes.xl,
      fontWeight: 'bold',
      color: colors.text.primary,
      marginBottom: spacing.sm,
    },
    emptyText: {
      fontSize: typography.sizes.md,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    addButton: {
      backgroundColor: colors.primary,
      margin: spacing.md,
      paddingVertical: spacing.md,
      borderRadius: 12,
      alignItems: 'center',
    },
    addButtonText: {
      color: colors.background.card,
      fontSize: typography.sizes.lg,
      fontWeight: 'bold',
    },
  }), [colors, functionalColors]);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const regularItems = await getRegularGroceryItems(user.id);
      setItems(regularItems);
    } catch (error) {
      console.error('Error loading regular items:', error);
      Alert.alert('Error', 'Failed to load regular items');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  }, []);

  const getUrgencyStatus = (item: RegularGroceryItemWithIngredient): UrgencyStatus => {
    if (!item.is_active) return 'paused';

    if (!item.next_suggested_date) return 'good';

    const now = new Date();
    const nextDate = new Date(item.next_suggested_date);
    const daysUntilDue = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue <= 3) return 'due_soon';
    return 'good';
  };

  const groupItemsByUrgency = (): GroupedItems => {
    const grouped: GroupedItems = {
      overdue: [],
      dueSoon: [],
      good: [],
      paused: [],
    };

    items.forEach(item => {
      const status = getUrgencyStatus(item);
      switch (status) {
        case 'overdue':
          grouped.overdue.push(item);
          break;
        case 'due_soon':
          grouped.dueSoon.push(item);
          break;
        case 'good':
          grouped.good.push(item);
          break;
        case 'paused':
          grouped.paused.push(item);
          break;
      }
    });

    return grouped;
  };

  const getFilteredItems = (): RegularGroceryItemWithIngredient[] => {
    if (filter === 'active') {
      return items.filter(item => item.is_active);
    } else if (filter === 'paused') {
      return items.filter(item => !item.is_active);
    }
    return items;
  };

  const handlePauseToggle = async (item: RegularGroceryItemWithIngredient) => {
    try {
      await updateRegularItem(item.id, {
        isActive: !item.is_active,  // ✅ Use camelCase for service parameter
      });
      await loadItems();
    } catch (error) {
      console.error('Error toggling pause:', error);
      Alert.alert('Error', 'Failed to update item');
    }
  };

  const handleDelete = async (item: RegularGroceryItemWithIngredient) => {
    Alert.alert(
      'Delete Regular Item',
      `Are you sure you want to delete "${item.ingredient?.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRegularItem(item.id);
              await loadItems();
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const handleEdit = (item: RegularGroceryItemWithIngredient) => {
    setEditingItem(item);
  };

  const getFrequencyDisplay = (frequency: PurchaseFrequency, customDays?: number | null): string => {
    if (frequency === 'custom' && customDays) {
      return `Every ${customDays} days`;
    }
    const map: Record<PurchaseFrequency, string> = {
      weekly: 'Weekly',
      biweekly: 'Every 2 weeks',
      monthly: 'Monthly',
      custom: 'Custom',
    };
    return map[frequency] || frequency;
  };

  const getDaysUntilDue = (nextDate: string | null): string => {
    if (!nextDate) return 'Not scheduled';

    const now = new Date();
    const next = new Date(nextDate);
    const days = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (days < 0) {
      return `${Math.abs(days)} days overdue`;
    } else if (days === 0) {
      return 'Due today';
    } else if (days === 1) {
      return 'Due tomorrow';
    } else {
      return `Due in ${days} days`;
    }
  };

  const renderItem = (item: RegularGroceryItemWithIngredient) => {
    const status = getUrgencyStatus(item);
    const isOverdue = status === 'overdue';
    const isDueSoon = status === 'due_soon';
    const isPaused = status === 'paused';

    return (
      <View key={item.id} style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <View style={styles.itemTitleRow}>
            <Text style={styles.itemName}>
              {item.ingredient?.name || 'Unknown item'}
            </Text>
            {isOverdue && <Text style={styles.overdueBadge}>🔴 Overdue</Text>}
            {isDueSoon && <Text style={styles.dueSoonBadge}>⏰ Due Soon</Text>}
            {isPaused && <Text style={styles.pausedBadge}>⏸️ Paused</Text>}
          </View>
          <View style={styles.itemDetails}>
            <Text style={styles.itemQuantity}>
              {item.quantity_display} {item.unit_display}
            </Text>
            <Text style={styles.itemSeparator}>•</Text>
            <Text style={styles.itemFrequency}>
              {getFrequencyDisplay(item.purchase_frequency, item.frequency_days)}
            </Text>
          </View>
          {!isPaused && (
            <Text style={styles.itemDueDate}>
              {getDaysUntilDue(item.next_suggested_date)}
            </Text>
          )}
        </View>

        <View style={styles.itemActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => handleEdit(item)}
          >
            <Text style={styles.editButtonText}>✏️ Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.pauseButton]}
            onPress={() => handlePauseToggle(item)}
          >
            <Text style={styles.pauseButtonText}>
              {isPaused ? '▶️ Resume' : '⏸️ Pause'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item)}
          >
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSection = (
    title: string,
    items: RegularGroceryItemWithIngredient[],
    icon: string
  ) => {
    if (items.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {icon} {title} ({items.length})
        </Text>
        {items.map(renderItem)}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const filteredItems = getFilteredItems();
  const groupedItems = groupItemsByUrgency();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Regular Items</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All ({items.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'active' && styles.filterTabActive]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>
            Active ({items.filter(i => i.is_active).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'paused' && styles.filterTabActive]}
          onPress={() => setFilter('paused')}
        >
          <Text style={[styles.filterText, filter === 'paused' && styles.filterTextActive]}>
            Paused ({items.filter(i => !i.is_active).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Items List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyTitle}>No Regular Items</Text>
            <Text style={styles.emptyText}>
              {filter === 'paused'
                ? 'No paused items yet'
                : 'Add items that you buy regularly and we\'ll remind you when to restock'}
            </Text>
          </View>
        ) : (
          <>
            {filter === 'all' && (
              <>
                {renderSection('Overdue', groupedItems.overdue, '🔴')}
                {renderSection('Due Soon', groupedItems.dueSoon, '⏰')}
                {renderSection('Good Stock', groupedItems.good, '✅')}
                {renderSection('Paused', groupedItems.paused, '⏸️')}
              </>
            )}
            {filter === 'active' && (
              <>
                {renderSection('Overdue', groupedItems.overdue, '🔴')}
                {renderSection('Due Soon', groupedItems.dueSoon, '⏰')}
                {renderSection('Good Stock', groupedItems.good, '✅')}
              </>
            )}
            {filter === 'paused' && renderSection('Paused', groupedItems.paused, '⏸️')}
          </>
        )}
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowAddModal(true)}
      >
        <Text style={styles.addButtonText}>+ Add Regular Item</Text>
      </TouchableOpacity>

      {/* Modals */}
      <AddRegularItemModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadItems}
      />

      <EditRegularItemModal
        visible={editingItem !== null}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSuccess={loadItems}
      />
    </View>
  );
}
