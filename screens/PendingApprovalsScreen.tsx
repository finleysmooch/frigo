// screens/PendingApprovalsScreen.tsx
// Screen to view and respond to pending cooking partner invitations
// Created: November 19, 2025

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../lib/theme/ThemeContext';
import {
  getPendingApprovals,
  PendingApproval,
} from '../lib/services/postParticipantsService';
import { supabase } from '../lib/supabase';
import CookingPartnerApprovalModal from '../components/CookingPartnerApprovalModal';

type Props = NativeStackScreenProps<any, 'PendingApprovals'>;

export default function PendingApprovalsScreen({ navigation }: Props) {
  const { colors, functionalColors } = useTheme();
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.secondary,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.background.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    backButton: {
      fontSize: 28,
      color: colors.primary,
      width: 30,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text.primary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContent: {
      padding: 16,
    },
    approvalCard: {
      flexDirection: 'row',
      backgroundColor: colors.background.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    roleIndicator: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.background.secondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    roleEmoji: {
      fontSize: 24,
    },
    approvalContent: {
      flex: 1,
    },
    approvalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    inviterName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginRight: 8,
    },
    roleText: {
      fontSize: 13,
      color: colors.text.secondary,
      backgroundColor: colors.background.secondary,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    postInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
    },
    methodEmoji: {
      fontSize: 16,
      marginRight: 6,
    },
    postTitle: {
      fontSize: 15,
      color: colors.text.secondary,
      flex: 1,
    },
    timestamp: {
      fontSize: 12,
      color: colors.text.tertiary,
    },
    chevron: {
      justifyContent: 'center',
      alignItems: 'center',
      width: 24,
    },
    chevronText: {
      fontSize: 24,
      color: colors.border.medium,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyEmoji: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 24,
    },
  }), [colors, functionalColors]);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadApprovals();
    }
  }, [currentUserId]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const loadApprovals = async () => {
    try {
      const data = await getPendingApprovals(currentUserId);
      setApprovals(data);
    } catch (error) {
      console.error('Error loading approvals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadApprovals();
  };

  const handleApprovalPress = (approval: PendingApproval) => {
    setSelectedApproval(approval);
    setModalVisible(true);
  };

  const handleApprovalComplete = (newPostId?: string) => {
    // Refresh the list
    loadApprovals();
    
    // Navigate to the new post if created
    if (newPostId) {
      navigation.navigate('MyPostDetails', { postId: newPostId });
    }
  };

  const getRoleEmoji = (role: string) => {
    switch (role) {
      case 'sous_chef': return '🧑‍🍳';
      case 'ate_with': return '🍽️';
      case 'host': return '🏠';
      default: return '👥';
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'sous_chef': return 'Cooked together';
      case 'ate_with': return 'Ate together';
      case 'host': return 'Hosted meal';
      default: return 'Participated';
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

  const renderApprovalItem = ({ item }: { item: PendingApproval }) => {
    return (
      <TouchableOpacity
        style={styles.approvalCard}
        onPress={() => handleApprovalPress(item)}
      >
        <View style={styles.roleIndicator}>
          <Text style={styles.roleEmoji}>{getRoleEmoji(item.role)}</Text>
        </View>

        <View style={styles.approvalContent}>
          <View style={styles.approvalHeader}>
            <Text style={styles.inviterName}>
              {item.inviter_name || `@${item.inviter_username}`}
            </Text>
            <Text style={styles.roleText}>{getRoleText(item.role)}</Text>
          </View>

          <View style={styles.postInfo}>
            {item.cooking_method && (
              <Text style={styles.methodEmoji}>
                {getCookingMethodEmoji(item.cooking_method)}
              </Text>
            )}
            <Text style={styles.postTitle} numberOfLines={1}>
              {item.post_title}
            </Text>
          </View>

          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })}
          </Text>
        </View>

        <View style={styles.chevron}>
          <Text style={styles.chevronText}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cooking Invitations</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cooking Invitations</Text>
        <View style={{ width: 30 }} />
      </View>

      {approvals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>✨</Text>
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptyText}>
            You don't have any pending cooking partner requests
          </Text>
        </View>
      ) : (
        <FlatList
          data={approvals}
          keyExtractor={(item) => item.id}
          renderItem={renderApprovalItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      <CookingPartnerApprovalModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSelectedApproval(null);
        }}
        approval={selectedApproval}
        onApproved={handleApprovalComplete}
        currentUserId={currentUserId} // ✅ ADDED: Pass current user ID
      />
    </SafeAreaView>
  );
}