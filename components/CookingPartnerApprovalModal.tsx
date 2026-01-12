// components/CookingPartnerApprovalModal.tsx
// Modal for approving or declining cooking partner tags
// Created: November 19, 2025

import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';
import {
  PendingApproval,
  approveParticipantInvitation,
  declineParticipantInvitation,
} from '../lib/services/postParticipantsService';

interface CookingPartnerApprovalModalProps {
  visible: boolean;
  onClose: () => void;
  approval: PendingApproval | null;
  onApproved: (newPostId?: string) => void;
  currentUserId: string; // ← ADD THIS
}

export default function CookingPartnerApprovalModal({
  visible,
  onClose,
  approval,
  onApproved,
  currentUserId, // ← ADD THIS
}: CookingPartnerApprovalModalProps) {
  const { colors, functionalColors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [showCreatePostOption, setShowCreatePostOption] = useState(false);

  if (!approval) return null;

  const handleInitialApprove = () => {
    if (approval.role === 'sous_chef') {
      // For sous chefs, show option to create own post
      setShowCreatePostOption(true);
    } else {
      // For ate_with, just approve without creating post
      handleFinalApprove(false);
    }
  };

  const handleFinalApprove = async (createOwnPost: boolean) => {
    setLoading(true);
    try {
      const result = await approveParticipantInvitation(
        approval.id,
        currentUserId, // ✅ FIXED: Use current user ID (the person approving)
        createOwnPost
      );

      if (result.success) {
        Alert.alert(
          'Approved!',
          createOwnPost 
            ? 'Your cooking session post has been created'
            : 'You\'ve been added to the cooking session',
          [
            {
              text: 'OK',
              onPress: () => {
                onApproved(result.newPostId);
                onClose();
                setShowCreatePostOption(false);
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to approve invitation');
      }
    } catch (error) {
      console.error('Error approving:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    Alert.alert(
      'Decline Invitation?',
      'Are you sure you want to decline this invitation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await declineParticipantInvitation(
                approval.id,
                currentUserId // ✅ FIXED: Use current user ID
              );

              if (result.success) {
                Alert.alert('Declined', 'Invitation declined', [
                  { text: 'OK', onPress: onClose }
                ]);
              } else {
                Alert.alert('Error', result.error || 'Failed to decline');
              }
            } catch (error) {
              console.error('Error declining:', error);
              Alert.alert('Error', 'Something went wrong');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const getRoleDisplayText = () => {
    switch (approval.role) {
      case 'sous_chef':
        return 'cooked with them';
      case 'ate_with':
        return 'ate with them';
      case 'host':
        return 'hosted this meal';
      default:
        return 'participated';
    }
  };

  const getCookingMethodEmoji = (method: string | undefined) => {
    const emojiMap: { [key: string]: string } = {
      cook: '🍳',
      bake: '🥖',
      bbq: '🔥',
      meal_prep: '📦',
      snack: '🎃',
      eating_out: '🍽️',
      breakfast: '🥞',
      slow_cook: '🍲',
      soup: '🥘',
      preserve: '🫙',
    };
    return method ? emojiMap[method] || '🍽️' : '🍽️';
  };

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: colors.background.card,
      borderRadius: 16,
      width: '100%',
      maxWidth: 400,
      maxHeight: '80%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
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
      fontSize: 24,
      color: colors.text.secondary,
      lineHeight: 24,
    },
    scrollContent: {
      padding: 20,
    },
    inviterSection: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      padding: 16,
      backgroundColor: functionalColors.warning + '20',
      borderRadius: 12,
    },
    inviterEmoji: {
      fontSize: 32,
      marginRight: 12,
    },
    inviterText: {
      fontSize: 16,
      color: colors.text.primary,
      flex: 1,
    },
    inviterName: {
      fontWeight: '700',
      color: colors.primary,
    },
    postCard: {
      backgroundColor: colors.background.secondary,
      padding: 16,
      borderRadius: 12,
      marginBottom: 20,
    },
    postHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    cookingMethodEmoji: {
      fontSize: 24,
      marginRight: 10,
    },
    postTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
      flex: 1,
    },
    postDate: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    infoSection: {
      backgroundColor: colors.primary + '15',
      padding: 16,
      borderRadius: 12,
      marginBottom: 20,
    },
    infoTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 8,
    },
    infoText: {
      fontSize: 14,
      color: colors.text.primary,
      lineHeight: 20,
    },
    infoSubtext: {
      fontSize: 14,
      color: colors.text.secondary,
      marginTop: 8,
    },
    buttonContainer: {
      gap: 12,
    },
    button: {
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 50,
    },
    buttonPrimary: {
      backgroundColor: colors.primary,
    },
    buttonSecondary: {
      backgroundColor: colors.background.secondary,
    },
    buttonDanger: {
      backgroundColor: colors.background.card,
      borderWidth: 1,
      borderColor: functionalColors.error,
    },
    buttonTextPrimary: {
      color: colors.background.card,
      fontSize: 16,
      fontWeight: '600',
    },
    buttonTextSecondary: {
      color: colors.text.secondary,
      fontSize: 16,
      fontWeight: '600',
    },
    buttonTextDanger: {
      color: functionalColors.error,
      fontSize: 16,
      fontWeight: '600',
    },
  }), [colors, functionalColors]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {showCreatePostOption ? (
            // Step 2: Ask if they want to create own post (sous chefs only)
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Create Your Own Post?</Text>
              </View>

              <ScrollView style={styles.scrollContent}>
                <View style={styles.infoSection}>
                  <Text style={styles.infoText}>
                    Since you helped cook this dish, would you like to create your own post about it?
                  </Text>
                  <Text style={styles.infoSubtext}>
                    You can add your own photos, notes, and rating
                  </Text>
                </View>

                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonPrimary]}
                    onPress={() => handleFinalApprove(true)}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <>
                        <Text style={styles.buttonTextPrimary}>✓ Yes, Create Post</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, styles.buttonSecondary]}
                    onPress={() => handleFinalApprove(false)}
                    disabled={loading}
                  >
                    <Text style={styles.buttonTextSecondary}>Just Approve</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </>
          ) : (
            // Step 1: Initial approval screen
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Cooking Partner Request</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.scrollContent}>
                {/* Who invited */}
                <View style={styles.inviterSection}>
                  <Text style={styles.inviterEmoji}>👋</Text>
                  <Text style={styles.inviterText}>
                    <Text style={styles.inviterName}>
                      {approval.inviter_name || `@${approval.inviter_username}`}
                    </Text>
                    {' '}says you {getRoleDisplayText()}
                  </Text>
                </View>

                {/* Post details */}
                <View style={styles.postCard}>
                  <View style={styles.postHeader}>
                    {approval.cooking_method && (
                      <Text style={styles.cookingMethodEmoji}>
                        {getCookingMethodEmoji(approval.cooking_method)}
                      </Text>
                    )}
                    <Text style={styles.postTitle}>{approval.post_title}</Text>
                  </View>
                  <Text style={styles.postDate}>
                    {new Date(approval.post_created_at).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                </View>

                {/* Info about what happens */}
                <View style={styles.infoSection}>
                  <Text style={styles.infoTitle}>What happens if you approve?</Text>
                  {approval.role === 'sous_chef' ? (
                    <Text style={styles.infoText}>
                      • You'll be listed as a cooking partner{'\n'}
                      • Your mutual followers will see you cooked together{'\n'}
                      • You can create your own post about this cooking session
                    </Text>
                  ) : (
                    <Text style={styles.infoText}>
                      • You'll be listed as dining together{'\n'}
                      • Your mutual followers will see you ate together
                    </Text>
                  )}
                </View>

                {/* Action buttons */}
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonPrimary]}
                    onPress={handleInitialApprove}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={styles.buttonTextPrimary}>✓ Approve</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, styles.buttonDanger]}
                    onPress={handleDecline}
                    disabled={loading}
                  >
                    <Text style={styles.buttonTextDanger}>✕ Decline</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}