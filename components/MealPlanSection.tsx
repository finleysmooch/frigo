// components/MealPlanSection.tsx
// Section showing meal plan items with their states
// Created: December 3, 2025
// Updated: December 10, 2025 - Added assignment support, fixed claim bug display

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { colors } from '../lib/theme';
import {
  getMealPlanItems,
  claimPlanItem,
  unclaimPlanItem,
  assignPlanItem,
  unassignPlanItem,
  MealPlanItem,
  getPlanItemDisplayName,
  getCourseDisplayName,
  getCourseEmoji,
  getStatusDisplayInfo,
  groupPlanItemsByCourse,
  CourseType,
} from '../lib/services/mealPlanService';

interface Participant {
  user_id: string;
  username?: string;
  display_name?: string;
  role: string;
  rsvp_status: string;
}

interface MealPlanSectionProps {
  mealId: string;
  currentUserId: string;
  isHost: boolean;
  isAcceptedParticipant: boolean;
  participants?: Participant[];
  onAddPlanItem?: () => void;
  onSelectRecipe?: (planItemId: string) => void;
  onCookItem?: (planItemId: string, recipeId?: string) => void;
  onRefresh?: () => void;
}

export default function MealPlanSection({
  mealId,
  currentUserId,
  isHost,
  isAcceptedParticipant,
  participants = [],
  onAddPlanItem,
  onSelectRecipe,
  onCookItem,
  onRefresh,
}: MealPlanSectionProps) {
  const [planItems, setPlanItems] = useState<MealPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedItemForAssign, setSelectedItemForAssign] = useState<string | null>(null);

  useEffect(() => {
    loadPlanItems();
  }, [mealId]);

  const loadPlanItems = async () => {
    try {
      const items = await getMealPlanItems(mealId);
      setPlanItems(items);
    } catch (error) {
      console.error('Error loading plan items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (planItemId: string) => {
    // Host can always claim
    if (!isHost && !isAcceptedParticipant) {
      Alert.alert('Cannot Claim', 'You must accept the meal invitation first');
      return;
    }

    setActionLoading(planItemId);
    try {
      const result = await claimPlanItem(planItemId, currentUserId);
      if (result.success) {
        await loadPlanItems();
        onRefresh?.();
      } else {
        // Show the actual error from the service
        Alert.alert('Cannot Claim', result.error || 'Failed to claim item');
      }
    } catch (error) {
      console.error('Unexpected error claiming item:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnclaim = async (planItemId: string) => {
    Alert.alert(
      'Unclaim Item',
      'Are you sure you want to release this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Release',
          onPress: async () => {
            setActionLoading(planItemId);
            try {
              const result = await unclaimPlanItem(planItemId, currentUserId);
              if (result.success) {
                await loadPlanItems();
                onRefresh?.();
              } else {
                Alert.alert('Error', result.error || 'Failed to release item');
              }
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleAssignPress = (planItemId: string) => {
    setSelectedItemForAssign(planItemId);
    setShowAssignModal(true);
  };

  const handleAssignToParticipant = async (participantUserId: string) => {
    if (!selectedItemForAssign) return;

    setShowAssignModal(false);
    setActionLoading(selectedItemForAssign);

    try {
      const result = await assignPlanItem(selectedItemForAssign, currentUserId, participantUserId);
      if (result.success) {
        await loadPlanItems();
        onRefresh?.();
      } else {
        Alert.alert('Error', result.error || 'Failed to assign item');
      }
    } finally {
      setActionLoading(null);
      setSelectedItemForAssign(null);
    }
  };

  const handleUnassign = async (planItemId: string) => {
    Alert.alert(
      'Unassign Item',
      'Remove the assignment? The item will become available for anyone to claim.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unassign',
          onPress: async () => {
            setActionLoading(planItemId);
            try {
              const result = await unassignPlanItem(planItemId, currentUserId);
              if (result.success) {
                await loadPlanItems();
                onRefresh?.();
              } else {
                Alert.alert('Error', result.error || 'Failed to unassign item');
              }
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  // Get accepted participants for assignment dropdown
  const acceptedParticipants = participants.filter(
    p => p.rsvp_status === 'accepted' && p.user_id !== currentUserId
  );

  const groupedItems = groupPlanItemsByCourse(planItems);
  const courseOrder: CourseType[] = ['appetizer', 'main', 'side', 'dessert', 'drink', 'other'];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (planItems.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>📝</Text>
        <Text style={styles.emptyTitle}>No plan items yet</Text>
        <Text style={styles.emptyText}>
          {isHost 
            ? 'Add dishes your meal needs and let guests claim them!' 
            : 'The host hasn\'t added any items to the plan yet.'}
        </Text>
        {isHost && (
          <TouchableOpacity style={styles.addButton} onPress={onAddPlanItem}>
            <Text style={styles.addButtonText}>+ Add Items</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const renderPlanItem = (item: MealPlanItem) => {
    const isMyItem = item.claimed_by === currentUserId;
    const isAssignedToMe = item.assigned_to === currentUserId && !item.claimed_by;
    const statusInfo = getStatusDisplayInfo(item.status);
    const displayName = getPlanItemDisplayName(item);

    // Determine who to show as the person responsible
    const responsibleName = item.claimer_display_name || item.claimer_username ||
                           item.assignee_display_name || item.assignee_username;

    return (
      <View key={item.id} style={styles.planItem}>
        {/* Left: Course emoji + Info */}
        <View style={styles.itemLeft}>
          <Text style={styles.itemEmoji}>{getCourseEmoji(item.course_type)}</Text>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={1}>{displayName}</Text>
            <View style={styles.itemMeta}>
              {item.status === 'unclaimed' ? (
                <Text style={[styles.statusText, { color: statusInfo.color }]}>
                  {statusInfo.emoji} {statusInfo.label}
                </Text>
              ) : item.status === 'assigned' ? (
                <Text style={[styles.statusText, { color: statusInfo.color }]}>
                  📌 Assigned to {isAssignedToMe ? 'You' : (item.assignee_display_name || item.assignee_username)}
                </Text>
              ) : responsibleName ? (
                <Text style={styles.claimerText}>
                  {isMyItem ? '👤 You' : `👤 ${responsibleName}`}
                  {item.status === 'has_recipe' && ' • 📋 Ready'}
                  {item.status === 'completed' && ' • ✅ Done'}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Right: Action button */}
        <View style={styles.itemRight}>
          {actionLoading === item.id ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : item.status === 'unclaimed' ? (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.claimButton}
                onPress={() => handleClaim(item.id)}
              >
                <Text style={styles.claimButtonText}>I'll make it</Text>
              </TouchableOpacity>
              {isHost && acceptedParticipants.length > 0 && (
                <TouchableOpacity
                  style={styles.assignButton}
                  onPress={() => handleAssignPress(item.id)}
                >
                  <Text style={styles.assignButtonText}>Assign</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : item.status === 'assigned' ? (
            <View style={styles.actionButtons}>
              {isAssignedToMe && (
                <TouchableOpacity
                  style={styles.claimButton}
                  onPress={() => handleClaim(item.id)}
                >
                  <Text style={styles.claimButtonText}>Accept</Text>
                </TouchableOpacity>
              )}
              {isHost && (
                <TouchableOpacity
                  style={styles.releaseButton}
                  onPress={() => handleUnassign(item.id)}
                >
                  <Text style={styles.releaseButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : item.status === 'claimed' && isMyItem ? (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.selectRecipeButton}
                onPress={() => onSelectRecipe?.(item.id)}
              >
                <Text style={styles.selectRecipeText}>+ Recipe</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.releaseButton}
                onPress={() => handleUnclaim(item.id)}
              >
                <Text style={styles.releaseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : item.status === 'has_recipe' && isMyItem ? (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.cookButton}
                onPress={() => onCookItem?.(item.id, item.recipe_id)}
              >
                <Text style={styles.cookButtonText}>Cook Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.releaseButton}
                onPress={() => handleUnclaim(item.id)}
              >
                <Text style={styles.releaseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : item.status === 'completed' ? (
            <View style={styles.completedBadge}>
              <Text style={styles.completedText}>✅</Text>
            </View>
          ) : (
            // Someone else claimed it (status is 'claimed' or 'has_recipe')
            <View style={styles.claimedBadge}>
              <Text style={styles.claimedText}>Claimed</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📋 Meal Plan</Text>
        {isHost && (
          <TouchableOpacity onPress={onAddPlanItem}>
            <Text style={styles.headerAddButton}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(planItems.filter(i => i.status === 'completed').length / planItems.length) * 100}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {planItems.filter(i => i.status === 'completed').length} of {planItems.length} done
        </Text>
      </View>

      {/* Grouped Items */}
      {courseOrder.map(course => {
        const items = groupedItems.get(course) || [];
        if (items.length === 0) return null;

        return (
          <View key={course} style={styles.courseGroup}>
            <Text style={styles.courseHeader}>
              {getCourseEmoji(course)} {getCourseDisplayName(course)}s
            </Text>
            {items.map(renderPlanItem)}
          </View>
        );
      })}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <Text style={styles.legendEmoji}>❓</Text>
          <Text style={styles.legendText}>Needs someone</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.legendEmoji}>📌</Text>
          <Text style={styles.legendText}>Assigned</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.legendEmoji}>🙋</Text>
          <Text style={styles.legendText}>Claimed</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.legendEmoji}>📋</Text>
          <Text style={styles.legendText}>Recipe chosen</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.legendEmoji}>✅</Text>
          <Text style={styles.legendText}>Cooked</Text>
        </View>
      </View>

      {/* Assignment Modal */}
      <Modal
        visible={showAssignModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAssignModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAssignModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign to...</Text>
            
            {acceptedParticipants.length === 0 ? (
              <Text style={styles.noParticipantsText}>
                No other accepted participants to assign to
              </Text>
            ) : (
              <FlatList
                data={acceptedParticipants}
                keyExtractor={(item) => item.user_id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.participantRow}
                    onPress={() => handleAssignToParticipant(item.user_id)}
                  >
                    <Text style={styles.participantName}>
                      {item.display_name || item.username}
                    </Text>
                    {item.role === 'host' && (
                      <Text style={styles.hostBadge}>👑 Host</Text>
                    )}
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity
              style={styles.cancelModalButton}
              onPress={() => setShowAssignModal(false)}
            >
              <Text style={styles.cancelModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderTopWidth: 8,
    borderTopColor: '#F3F4F6',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  headerAddButton: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  courseGroup: {
    marginBottom: 20,
  },
  courseHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  planItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemEmoji: {
    fontSize: 28,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  claimerText: {
    fontSize: 13,
    color: '#6B7280',
  },
  itemRight: {
    marginLeft: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  claimButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  claimButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  assignButton: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  assignButtonText: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '600',
  },
  selectRecipeButton: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  selectRecipeText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '600',
  },
  cookButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cookButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  releaseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  releaseButtonText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
  },
  claimedBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  claimedText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  completedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedText: {
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    margin: 20,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 16,
    textAlign: 'center',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  participantName: {
    fontSize: 16,
    color: '#374151',
  },
  hostBadge: {
    fontSize: 12,
    color: '#F59E0B',
  },
  noParticipantsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
  cancelModalButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelModalText: {
    fontSize: 16,
    color: '#6B7280',
  },
});