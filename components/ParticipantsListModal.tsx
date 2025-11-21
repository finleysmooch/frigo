// components/ParticipantsListModal.tsx
// Modal to show all cooking participants (Strava-style)
// Created: November 20, 2025

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { colors } from '../lib/theme';

interface Participant {
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string | null;
  isFollowing?: boolean;
}

interface ParticipantsListModalProps {
  visible: boolean;
  onClose: () => void;
  postTitle: string;
  sousChefs: Participant[];
  ateWith: Participant[];
  currentUserId: string;
}

const AVATAR_EMOJIS = ['🧑‍🍳', '👨‍🍳', '👩‍🍳', '🍕', '🌮', '🍔', '🍜', '🥘', '🍱', '🥗', '🍝', '🥙'];

const getAvatarForUser = (userId: string): string => {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_EMOJIS[hash % AVATAR_EMOJIS.length];
};

export default function ParticipantsListModal({
  visible,
  onClose,
  postTitle,
  sousChefs,
  ateWith,
  currentUserId,
}: ParticipantsListModalProps) {
  
  const renderParticipant = (participant: Participant, role: 'sous_chef' | 'ate_with') => {
    const isYou = participant.user_id === currentUserId;
    const displayName = isYou ? 'You' : (participant.display_name || participant.username);
    
    // Get avatar
    const avatarUrl = participant.avatar_url;
    const isEmoji = avatarUrl && /^[\p{Emoji}\u200D]+$/u.test(avatarUrl);
    const avatar = isEmoji ? avatarUrl : getAvatarForUser(participant.user_id);
    
    return (
      <View key={participant.user_id} style={styles.participantRow}>
        <View style={styles.participantLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatar}</Text>
          </View>
          <View style={styles.participantInfo}>
            <Text style={styles.participantName}>{displayName}</Text>
            {!isYou && (
              <Text style={styles.participantUsername}>@{participant.username}</Text>
            )}
          </View>
        </View>
        
        <View style={styles.participantRight}>
          {role === 'sous_chef' && (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>👨‍🍳 Sous Chef</Text>
            </View>
          )}
          {role === 'ate_with' && (
            <View style={[styles.roleBadge, styles.roleBadgeAte]}>
              <Text style={styles.roleBadgeText}>🍽️ Ate With</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const totalParticipants = sousChefs.length + ateWith.length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Cooking Partners</Text>
          <TouchableOpacity onPress={onClose} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.postInfoBar}>
          <Text style={styles.postTitle} numberOfLines={2}>
            {postTitle}
          </Text>
          <Text style={styles.participantCount}>
            {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}
          </Text>
        </View>

        <ScrollView style={styles.scrollView}>
          {sousChefs.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>👨‍🍳 Sous Chefs</Text>
                <Text style={styles.sectionCount}>{sousChefs.length}</Text>
              </View>
              {sousChefs.map(participant => renderParticipant(participant, 'sous_chef'))}
            </View>
          )}

          {ateWith.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>🍽️ Ate With</Text>
                <Text style={styles.sectionCount}>{ateWith.length}</Text>
              </View>
              {ateWith.map(participant => renderParticipant(participant, 'ate_with'))}
            </View>
          )}

          {totalParticipants === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={styles.emptyText}>No cooking partners yet</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  postInfoBar: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  participantCount: {
    fontSize: 13,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  participantLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  avatarText: {
    fontSize: 24,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  participantUsername: {
    fontSize: 13,
    color: '#666',
  },
  participantRight: {
    marginLeft: 12,
  },
  roleBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeAte: {
    backgroundColor: '#DBEAFE',
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});