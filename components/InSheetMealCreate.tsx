// components/InSheetMealCreate.tsx
// Phase 7E Checkpoint 3: In-sheet meal creation form (state 1d) with inline tagging (D36/D37)
// Rendered inside LogCookSheet when "Create new meal" is tapped in the picker.

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Svg, { Path, Circle, Line, Polyline, Rect } from 'react-native-svg';
import { useTheme } from '../lib/theme/ThemeContext';
import { createMeal } from '../lib/services/mealService';
import { addParticipantsToPost } from '../lib/services/postParticipantsService';
import { supabase } from '../lib/supabase';

// ── Inline icons ──

function CloseSmallIcon({ size = 14, color = '#666' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

function PlusSmallIcon({ size = 14, color = '#0F6E56' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="12" y1="5" x2="12" y2="19" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

// ── Types ──

interface InSheetMealCreateProps {
  onCreated: (mealId: string, mealTitle: string, mealType?: string) => void;
  onCancel: () => void;
}

interface TaggedPerson {
  id: string;            // user_id or generated id for external
  displayName: string;
  isExternal: boolean;   // true = "Add as guest" person (no Frigo account)
  avatarUrl?: string;
}

interface FollowedUser {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
}

const TEAL_700 = '#0F6E56';
const TEAL_FAINT_BG = '#E1F5EE';

// ── Smart default title ──

function computeDefaultMealTitle(): string {
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const day = days[now.getDay()];
  const hour = now.getHours() + now.getMinutes() / 60;
  let mealType: string;
  if (hour < 10.5) mealType = 'Breakfast';
  else if (hour < 14) mealType = 'Lunch';
  else mealType = 'Dinner';
  return `${day} ${mealType}`;
}

// ── Component ──

export default function InSheetMealCreate({
  onCreated,
  onCancel,
}: InSheetMealCreateProps) {
  const { colors } = useTheme();

  // Form state
  const [title, setTitle] = useState(computeDefaultMealTitle);
  const [creating, setCreating] = useState(false);

  // Tagging state
  const [cookingWith, setCookingWith] = useState<TaggedPerson[]>([]);
  const [eatingWith, setEatingWith] = useState<TaggedPerson[]>([]);
  const [activeTagRow, setActiveTagRow] = useState<'cooking' | 'eating' | null>(null);
  const [tagSearchText, setTagSearchText] = useState('');
  const tagInputRef = useRef<TextInput>(null);

  // Followed users + recent partners
  const [followedUsers, setFollowedUsers] = useState<FollowedUser[]>([]);
  const [recentPartnerIds, setRecentPartnerIds] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Load followed users on mount
  useEffect(() => {
    loadFollowedAndRecent();
  }, []);

  const loadFollowedAndRecent = async () => {
    setLoadingUsers(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Load followed users
      const { data: followData } = await supabase
        .from('follows')
        .select(`
          following_id,
          user_profiles!follows_following_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('follower_id', session.user.id);

      if (followData) {
        const users = followData
          .map((f: any) => f.user_profiles)
          .filter(Boolean) as FollowedUser[];
        setFollowedUsers(users);
      }

      // Load recent partners (people this user has tagged before)
      const { data: recentData } = await supabase
        .from('post_participants')
        .select('participant_user_id')
        .eq('invited_by_user_id', session.user.id)
        .not('participant_user_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (recentData) {
        // Deduplicate and take first 5
        const seen = new Set<string>();
        const ids: string[] = [];
        for (const row of recentData) {
          if (row.participant_user_id && !seen.has(row.participant_user_id)) {
            seen.add(row.participant_user_id);
            ids.push(row.participant_user_id);
            if (ids.length >= 5) break;
          }
        }
        setRecentPartnerIds(ids);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Recent partners as FollowedUser objects
  const recentPartners = useMemo(() => {
    return recentPartnerIds
      .map(id => followedUsers.find(u => u.id === id))
      .filter(Boolean) as FollowedUser[];
  }, [recentPartnerIds, followedUsers]);

  // Search results
  const searchResults = useMemo(() => {
    if (!tagSearchText.trim()) return [];
    const q = tagSearchText.toLowerCase();
    // Exclude already-tagged users
    const taggedIds = new Set([
      ...cookingWith.filter(p => !p.isExternal).map(p => p.id),
      ...eatingWith.filter(p => !p.isExternal).map(p => p.id),
    ]);
    return followedUsers
      .filter(u => !taggedIds.has(u.id))
      .filter(u =>
        (u.display_name?.toLowerCase().includes(q)) ||
        (u.username?.toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [tagSearchText, followedUsers, cookingWith, eatingWith]);

  // Whether the typed text matches any followed user
  const hasExactMatch = useMemo(() => {
    if (!tagSearchText.trim()) return true;
    const q = tagSearchText.toLowerCase().trim();
    return followedUsers.some(u =>
      u.display_name?.toLowerCase() === q || u.username?.toLowerCase() === q
    );
  }, [tagSearchText, followedUsers]);

  const addTaggedPerson = (person: TaggedPerson) => {
    if (activeTagRow === 'cooking') {
      setCookingWith(prev => [...prev, person]);
    } else if (activeTagRow === 'eating') {
      setEatingWith(prev => [...prev, person]);
    }
    setTagSearchText('');
  };

  const removeTaggedPerson = (personId: string, row: 'cooking' | 'eating') => {
    if (row === 'cooking') {
      setCookingWith(prev => prev.filter(p => p.id !== personId));
    } else {
      setEatingWith(prev => prev.filter(p => p.id !== personId));
    }
  };

  const handleAddFollowedUser = (user: FollowedUser) => {
    addTaggedPerson({
      id: user.id,
      displayName: user.display_name || user.username,
      isExternal: false,
      avatarUrl: user.avatar_url,
    });
  };

  const handleAddAsGuest = () => {
    const name = tagSearchText.trim();
    if (!name) return;
    addTaggedPerson({
      id: `external_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      displayName: name,
      isExternal: true,
    });
  };

  const handleOpenTagInput = (row: 'cooking' | 'eating') => {
    setActiveTagRow(row);
    setTagSearchText('');
    setTimeout(() => tagInputRef.current?.focus(), 100);
  };

  const handleCloseTagInput = () => {
    setActiveTagRow(null);
    setTagSearchText('');
  };

  // Create the meal and attach participants
  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Give your meal a name.');
      return;
    }

    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        Alert.alert('Error', 'Please sign in.');
        return;
      }

      // Infer meal_type from current time (same logic as title)
      const hour = new Date().getHours() + new Date().getMinutes() / 60;
      let mealType: string;
      if (hour < 10.5) mealType = 'breakfast';
      else if (hour < 14) mealType = 'lunch';
      else mealType = 'dinner';

      const result = await createMeal(session.user.id, {
        title: title.trim(),
        meal_type: mealType,
      });

      if (!result.success || !result.mealId) {
        Alert.alert('Error', result.error || 'Failed to create meal.');
        return;
      }

      const mealId = result.mealId;

      // Add cooking-with participants (role='sous_chef')
      const cookingUserIds = cookingWith.filter(p => !p.isExternal).map(p => p.id);
      if (cookingUserIds.length > 0) {
        await addParticipantsToPost(mealId, cookingUserIds, 'sous_chef', session.user.id);
      }

      // Add eating-with participants (role='ate_with')
      const eatingUserIds = eatingWith.filter(p => !p.isExternal).map(p => p.id);
      if (eatingUserIds.length > 0) {
        await addParticipantsToPost(mealId, eatingUserIds, 'ate_with', session.user.id);
      }

      // Add external participants
      const externalCooking = cookingWith.filter(p => p.isExternal);
      const externalEating = eatingWith.filter(p => p.isExternal);
      for (const ext of externalCooking) {
        await supabase.from('post_participants').insert({
          post_id: mealId,
          external_name: ext.displayName,
          role: 'sous_chef',
          status: 'approved',
          invited_by_user_id: session.user.id,
        });
      }
      for (const ext of externalEating) {
        await supabase.from('post_participants').insert({
          post_id: mealId,
          external_name: ext.displayName,
          role: 'ate_with',
          status: 'approved',
          invited_by_user_id: session.user.id,
        });
      }

      onCreated(mealId, title.trim(), mealType);
    } catch (err) {
      console.error('Error creating meal:', err);
      Alert.alert('Error', 'Failed to create meal.');
    } finally {
      setCreating(false);
    }
  };

  // ── Tag row rendering ──
  const renderTagRow = (
    label: string,
    tagged: TaggedPerson[],
    row: 'cooking' | 'eating',
  ) => {
    const isActive = activeTagRow === row;

    return (
      <View style={styles.tagSection}>
        <Text style={styles.tagLabel}>{label}</Text>
        <View style={styles.tagPillRow}>
          {tagged.map(person => (
            <View key={person.id} style={styles.tagPill}>
              {!person.isExternal && (
                <View style={styles.tagPillAvatar}>
                  <Text style={styles.tagPillAvatarText}>
                    {(person.displayName || '?')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.tagPillText} numberOfLines={1}>{person.displayName}</Text>
              <TouchableOpacity
                onPress={() => removeTaggedPerson(person.id, row)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <CloseSmallIcon size={12} color={TEAL_700} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Add pill */}
          {isActive ? (
            <View style={styles.tagInputPill}>
              <TextInput
                ref={tagInputRef}
                style={styles.tagInputText}
                value={tagSearchText}
                onChangeText={setTagSearchText}
                placeholder="Search or type a name..."
                placeholderTextColor="#999"
                autoFocus
                onBlur={() => {
                  // Delay to allow button press to register
                  setTimeout(() => {
                    if (!tagSearchText.trim()) handleCloseTagInput();
                  }, 200);
                }}
              />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.tagAddPill}
              onPress={() => handleOpenTagInput(row)}
              activeOpacity={0.7}
            >
              <PlusSmallIcon size={12} color={TEAL_700} />
            </TouchableOpacity>
          )}
        </View>

        {/* Suggestion strip */}
        {isActive && (
          <View style={styles.suggestionStrip}>
            {tagSearchText.trim() ? (
              <>
                {searchResults.map(user => (
                  <TouchableOpacity
                    key={user.id}
                    style={styles.suggestionPill}
                    onPress={() => handleAddFollowedUser(user)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.suggestionAvatar}>
                      <Text style={styles.suggestionAvatarText}>
                        {(user.display_name || user.username || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.suggestionPillText} numberOfLines={1}>
                      {user.display_name || user.username}
                    </Text>
                  </TouchableOpacity>
                ))}
                {!hasExactMatch && tagSearchText.trim().length >= 2 && (
                  <TouchableOpacity
                    style={styles.addGuestRow}
                    onPress={handleAddAsGuest}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.addGuestText}>
                      "{tagSearchText.trim()}" — <Text style={{ fontWeight: '600' }}>Add as guest</Text>
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                {recentPartners.length > 0 && (
                  <>
                    <Text style={styles.recentLabel}>RECENT</Text>
                    <View style={styles.recentPillRow}>
                      {recentPartners.map(user => {
                        // Don't show if already tagged
                        const alreadyTagged = [...cookingWith, ...eatingWith].some(p => p.id === user.id);
                        if (alreadyTagged) return null;
                        return (
                          <TouchableOpacity
                            key={user.id}
                            style={styles.suggestionPill}
                            onPress={() => handleAddFollowedUser(user)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.suggestionAvatar}>
                              <Text style={styles.suggestionAvatarText}>
                                {(user.display_name || user.username || '?')[0].toUpperCase()}
                              </Text>
                            </View>
                            <Text style={styles.suggestionPillText} numberOfLines={1}>
                              {user.display_name || user.username}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 14,
    },
    titleInput: {
      backgroundColor: colors.background.secondary,
      borderWidth: 1,
      borderColor: colors.border.light,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
      fontWeight: '500',
      color: colors.text.primary,
    },
    hintText: {
      fontSize: 12,
      color: colors.text.tertiary,
      marginTop: 8,
      lineHeight: 17,
    },
    // Tag section
    tagSection: {
      marginTop: 18,
    },
    tagLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 8,
    },
    tagPillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      alignItems: 'center',
    },
    tagPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: TEAL_FAINT_BG,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: '#99D9C2',
    },
    tagPillAvatar: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: TEAL_700,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tagPillAvatarText: {
      fontSize: 10,
      fontWeight: '600',
      color: '#fff',
    },
    tagPillText: {
      fontSize: 13,
      color: TEAL_700,
      fontWeight: '500',
      maxWidth: 100,
    },
    tagAddPill: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: TEAL_700,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tagInputPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background.secondary,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: TEAL_700,
      minWidth: 140,
    },
    tagInputText: {
      fontSize: 13,
      color: colors.text.primary,
      flex: 1,
      paddingVertical: 2,
    },
    // Suggestion strip
    suggestionStrip: {
      marginTop: 8,
    },
    recentLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: colors.text.tertiary,
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    recentPillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    suggestionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.background.secondary,
      borderRadius: 14,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    suggestionAvatar: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.text.tertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    suggestionAvatarText: {
      fontSize: 10,
      fontWeight: '600',
      color: '#fff',
    },
    suggestionPillText: {
      fontSize: 12,
      color: colors.text.primary,
      maxWidth: 100,
    },
    addGuestRow: {
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    addGuestText: {
      fontSize: 13,
      color: TEAL_700,
    },
    // Buttons
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 24,
    },
    createButton: {
      flex: 1,
      backgroundColor: TEAL_700,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    createButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600',
    },
    cancelButton: {
      paddingVertical: 14,
      alignItems: 'center',
    },
    cancelText: {
      fontSize: 14,
      color: colors.text.tertiary,
    },
  }), [colors]);

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.header}>Name this meal</Text>

      <TextInput
        style={styles.titleInput}
        value={title}
        onChangeText={setTitle}
        placeholder="Monday Dinner"
        placeholderTextColor={colors.text.placeholder}
        autoFocus
      />

      <Text style={styles.hintText}>
        Pre-filled from the meal type and day. Tap to edit. Description, location, or time can be added later from the meal page.
      </Text>

      {/* Cooking with tag row */}
      {renderTagRow('Cooking with', cookingWith, 'cooking')}

      {/* Eating with tag row */}
      {renderTagRow('Eating with', eatingWith, 'eating')}

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreate}
          activeOpacity={0.7}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.createButtonText}>Create & attach</Text>
          )}
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.7}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
