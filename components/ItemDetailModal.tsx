// ============================================
// FRIGO - ITEM DETAIL MODAL
// ============================================
// View and edit pantry item details with quick actions
// Location: components/ItemDetailModal.tsx

import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { 
  updatePantryItem,
  markAsOpened,
  markAsUsed,
  deletePantryItem
} from '../lib/pantryService';
import { PantryItemWithIngredient } from '../lib/types/pantry';
import {
  getDaysUntilExpiration,
  getExpirationStatus,
  formatExpirationDisplay
} from '../utils/pantryConversions';
import { colors, typography, spacing, borderRadius, shadows } from '../lib/theme';

interface Props {
  visible: boolean;
  item: PantryItemWithIngredient | null;
  userId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ItemDetailModal({ visible, item, userId, onClose, onUpdate }: Props) {
  const [quantity, setQuantity] = useState('');
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Update local state when item changes
  useEffect(() => {
    if (item) {
      setQuantity(item.quantity_display.toString());
      if (item.expiration_date) {
        setExpirationDate(new Date(item.expiration_date));
      }
    }
  }, [item]);

  if (!item) return null;

  const daysUntil = getDaysUntilExpiration(item.expiration_date);
  const status = getExpirationStatus(item.expiration_date);
  const displayExpiry = formatExpirationDisplay(item.expiration_date);

  // Handle mark as opened
  const handleMarkAsOpened = async () => {
    try {
      setSaving(true);
      const result = await markAsOpened(item.id, userId);
      
      if (result.shouldMoveToFridge) {
        Alert.alert(
          'Moved to Fridge',
          'This item should be refrigerated now that it\'s opened.',
          [{ text: 'OK' }]
        );
      }
      
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error marking as opened:', error);
      Alert.alert('Error', 'Failed to mark as opened');
    } finally {
      setSaving(false);
    }
  };

  // Handle adjust quantity
  const handleAdjustQuantity = async (adjustment: number) => {
    try {
      const newQuantity = parseFloat(quantity) + adjustment;
      
      if (newQuantity <= 0) {
        // Confirm deletion
        Alert.alert(
          'Item Used Up',
          'Mark this item as completely used?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Yes, Used',
              onPress: async () => {
                await handleMarkAsUsed();
              }
            }
          ]
        );
        return;
      }

      setSaving(true);
      await updatePantryItem(
        item.id,
        { quantity_display: newQuantity },
        userId
      );
      
      setQuantity(newQuantity.toString());
      onUpdate();
      
    } catch (error) {
      console.error('Error adjusting quantity:', error);
      Alert.alert('Error', 'Failed to update quantity');
    } finally {
      setSaving(false);
    }
  };

  // Handle extend expiration
  const handleExtendExpiration = async (days: number) => {
    if (!expirationDate) return;

    try {
      setSaving(true);
      const newDate = new Date(expirationDate);
      newDate.setDate(newDate.getDate() + days);
      
      await updatePantryItem(
        item.id,
        { expiration_date: newDate.toISOString().split('T')[0] },
        userId
      );
      
      setExpirationDate(newDate);
      onUpdate();
      
    } catch (error) {
      console.error('Error extending expiration:', error);
      Alert.alert('Error', 'Failed to extend expiration');
    } finally {
      setSaving(false);
    }
  };

  // Handle mark as used
  const handleMarkAsUsed = async () => {
    try {
      setSaving(true);
      await markAsUsed(item.id, userId);
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error marking as used:', error);
      Alert.alert('Error', 'Failed to mark as used');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = () => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to remove this from your pantry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await deletePantryItem(item.id, userId);
              onUpdate();
              onClose();
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item');
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  // Handle view recipes
  const handleViewRecipes = () => {
    Alert.alert(
      'Recipe Integration',
      'Recipe matching coming soon! This will show recipes that use ' + item.ingredient.name,
      [{ text: 'OK' }]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{item.ingredient.name}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Status Card */}
            <View style={[
              styles.statusCard,
              status === 'expired' && styles.statusCardExpired,
              status === 'expiring-soon' && styles.statusCardExpiring
            ]}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Amount:</Text>
                <Text style={styles.statusValue}>
                  {quantity} {item.unit_display}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Storage:</Text>
                <Text style={styles.statusValue}>
                  {item.storage_location.charAt(0).toUpperCase() + item.storage_location.slice(1)}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Status:</Text>
                <Text style={[
                  styles.statusValue,
                  item.is_opened && styles.statusOpened
                ]}>
                  {item.is_opened ? 'Opened' : 'Unopened'}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Expires:</Text>
                <Text style={[
                  styles.statusValue,
                  status === 'expired' && styles.expiryExpired,
                  status === 'expiring-soon' && styles.expirySoon
                ]}>
                  {displayExpiry}
                  {daysUntil !== null && daysUntil <= 3 && (
                    <Text style={styles.expiryDays}> ({daysUntil}d)</Text>
                  )}
                </Text>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>

              {/* Mark as Opened */}
              {!item.is_opened && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleMarkAsOpened}
                  disabled={saving}
                >
                  <Text style={styles.actionButtonEmoji}>📦</Text>
                  <Text style={styles.actionButtonText}>Mark as Opened</Text>
                </TouchableOpacity>
              )}

              {/* View Recipes */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleViewRecipes}
              >
                <Text style={styles.actionButtonEmoji}>🍳</Text>
                <Text style={styles.actionButtonText}>View Recipes Using This</Text>
              </TouchableOpacity>

              {/* Mark as Used */}
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonDanger]}
                onPress={handleMarkAsUsed}
                disabled={saving}
              >
                <Text style={styles.actionButtonEmoji}>✓</Text>
                <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>
                  Mark as Used (Remove)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Adjust Quantity */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ADJUST QUANTITY</Text>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => handleAdjustQuantity(-1)}
                  disabled={saving}
                >
                  <Text style={styles.quantityButtonText}>− 1</Text>
                </TouchableOpacity>
                <View style={styles.quantityDisplay}>
                  <Text style={styles.quantityDisplayText}>
                    {quantity} {item.unit_display}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => handleAdjustQuantity(1)}
                  disabled={saving}
                >
                  <Text style={styles.quantityButtonText}>+ 1</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Extend Expiration */}
            {expirationDate && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>EXTEND EXPIRATION</Text>
                <View style={styles.expirationControls}>
                  <TouchableOpacity
                    style={styles.expirationButton}
                    onPress={() => handleExtendExpiration(1)}
                    disabled={saving}
                  >
                    <Text style={styles.expirationButtonText}>+1 day</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.expirationButton}
                    onPress={() => handleExtendExpiration(3)}
                    disabled={saving}
                  >
                    <Text style={styles.expirationButtonText}>+3 days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.expirationButton}
                    onPress={() => handleExtendExpiration(7)}
                    disabled={saving}
                  >
                    <Text style={styles.expirationButtonText}>+1 week</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Delete */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}
                disabled={saving}
              >
                <Text style={styles.deleteButtonText}>Delete Item</Text>
              </TouchableOpacity>
            </View>

            {/* Notes */}
            {item.notes && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>NOTES</Text>
                <Text style={styles.notesText}>{item.notes}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
    ...shadows.large,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text.primary,
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: typography.sizes.xl,
    color: colors.text.tertiary,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  
  // Status Card
  statusCard: {
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  statusCardExpiring: {
    borderColor: colors.warning,
    backgroundColor: '#FFF3E0',
  },
  statusCardExpired: {
    borderColor: colors.error,
    backgroundColor: '#FFEBEE',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  statusLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text.tertiary,
    fontWeight: typography.weights.medium,
  },
  statusValue: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  statusOpened: {
    color: colors.warning,
  },
  expiryExpired: {
    color: colors.error,
  },
  expirySoon: {
    color: colors.warning,
  },
  expiryDays: {
    fontSize: typography.sizes.sm,
  },

  // Sections
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },

  // Action Buttons
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.medium,
    ...shadows.small,
  },
  actionButtonDanger: {
    borderColor: colors.error,
    backgroundColor: '#FFEBEE',
  },
  actionButtonEmoji: {
    fontSize: typography.sizes.xl,
    marginRight: spacing.md,
  },
  actionButtonText: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
    flex: 1,
  },
  actionButtonTextDanger: {
    color: colors.error,
  },

  // Quantity Controls
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  quantityButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: typography.sizes.md,
    color: colors.background.primary,
    fontWeight: typography.weights.bold,
  },
  quantityDisplay: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  quantityDisplayText: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },

  // Expiration Controls
  expirationControls: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  expirationButton: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.medium,
  },
  expirationButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },

  // Delete Button
  deleteButton: {
    paddingVertical: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error,
  },
  deleteButtonText: {
    fontSize: typography.sizes.md,
    color: colors.error,
    fontWeight: typography.weights.semibold,
  },

  // Notes
  notesText: {
    fontSize: typography.sizes.md,
    color: colors.text.secondary,
    lineHeight: typography.sizes.md * typography.lineHeights.relaxed,
    fontStyle: 'italic',
  },
});