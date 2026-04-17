// screens/EditPostScreen.tsx
// Phase 7M Checkpoint 1 — Full edit cook form (Strava Edit Activity pattern).
// All editable fields visible in a scrollable form. Save logic in CP2.

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme/ThemeContext';
import { FeedStackParamList, PostPhoto } from '../App';
import { fetchSingleCookCardData } from '../lib/services/cookCardDataService';
import {
  getPostParticipants,
  PostParticipant,
} from '../lib/services/postParticipantsService';
import { optimizeStorageUrl } from '../components/feedCard/sharedCardElements';
import StarRating from '../components/StarRating';
import AddCookingPartnersModal from '../components/AddCookingPartnersModal';
import DateTimePicker from '../components/DateTimePicker';
import { COOKING_METHODS } from '../constants/cookingMethods';
import { updatePost, UpdatePostPatch } from '../lib/services/postService';
import { CookCardData } from '../lib/types/feed';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_SIZE = (SCREEN_WIDTH - 48 - 16) / 3; // 3 columns with padding + gaps
const BOTTOM_BAR_HEIGHT = 80;

type Props = NativeStackScreenProps<FeedStackParamList, 'EditPost'>;

export default function EditPostScreen({ navigation, route }: Props) {
  const { postId } = route.params;
  const { colors } = useTheme();

  // ── Loading state ──────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<CookCardData | null>(null);

  // ── Form state ─────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [cookingMethod, setCookingMethod] = useState('');
  const [cookedAt, setCookedAt] = useState<Date>(new Date());
  const [modifications, setModifications] = useState('');
  const [notes, setNotes] = useState('');
  const [visibility, setVisibility] = useState('everyone');
  const [parentMealId, setParentMealId] = useState<string | null>(null);
  const [parentMealTitle, setParentMealTitle] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PostPhoto[]>([]);

  // Cook partners
  const [cookPartners, setCookPartners] = useState<PostParticipant[]>([]);
  const [partnerIds, setPartnerIds] = useState<string[]>([]);

  // Eating partners (display-only stub)
  const [ateWithPartners, setAteWithPartners] = useState<PostParticipant[]>([]);

  // Cached user profiles for cook partner display (avoids refetch from DB on modal confirm)
  const userProfileCacheRef = useRef<Map<string, { display_name?: string; username?: string; avatar_url?: string }>>(new Map());

  // Auth
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Pickers
  const [methodPickerOpen, setMethodPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [visibilityPickerOpen, setVisibilityPickerOpen] = useState(false);
  const [partnersModalOpen, setPartnersModalOpen] = useState(false);
  const [mealPickerOpen, setMealPickerOpen] = useState(false);
  const [recentMeals, setRecentMeals] = useState<Array<{ id: string; title: string; created_at?: string }>>([]);
  const [mealPickerLoading, setMealPickerLoading] = useState(false);

  // Save state
  const [saving, setSaving] = useState(false);

  // Initial values ref (captured at load time for dirty detection)
  const initialValues = useRef<{
    title: string;
    description: string;
    rating: number | null;
    cookingMethod: string;
    cookedAt: string;
    modifications: string;
    notes: string;
    visibility: string;
    parentMealId: string | null;
    partnerIds: string[];
  }>({
    title: '',
    description: '',
    rating: null,
    cookingMethod: '',
    cookedAt: '',
    modifications: '',
    notes: '',
    visibility: 'everyone',
    parentMealId: null,
    partnerIds: [],
  });

  // ── Auth ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, []);

  // ── Data loading ────────────────────────────────────────────────────
  const loadPostData = useCallback(async () => {
    try {
      const cookCard = await fetchSingleCookCardData(postId);
      if (!cookCard) {
        console.warn(`[EditPostScreen] post not found: ${postId}`);
        return;
      }
      setPost(cookCard);

      // Populate form fields
      setTitle(cookCard.title || '');
      setDescription(cookCard.description || '');
      setRating(cookCard.rating);
      setCookingMethod(cookCard.cooking_method || '');
      setCookedAt(cookCard.cooked_at ? new Date(cookCard.cooked_at) : new Date());
      setModifications(cookCard.modifications || '');
      setNotes(cookCard.notes || '');
      setParentMealId(cookCard.parent_meal_id || null);

      // Normalize photos
      const raw = (cookCard.photos as any[]) || [];
      const normalized: PostPhoto[] = raw
        .map((p: any, i: number) => {
          if (typeof p === 'string' && p.trim()) return { url: p, order: i };
          if (p && typeof p === 'object' && typeof p.url === 'string' && p.url.trim())
            return { url: p.url, caption: p.caption, order: p.order ?? i, is_highlight: p.is_highlight };
          return null;
        })
        .filter((p: any): p is PostPhoto => p !== null);
      setPhotos(normalized);

      // Fetch visibility separately (not on CookCardData)
      const { data: visRow } = await supabase
        .from('posts')
        .select('visibility')
        .eq('id', postId)
        .single();
      if (visRow?.visibility) setVisibility(visRow.visibility);

      // Fetch parent meal title if attached
      if (cookCard.parent_meal_id) {
        const { data: mealRow } = await supabase
          .from('posts')
          .select('title')
          .eq('id', cookCard.parent_meal_id)
          .single();
        if (mealRow?.title) setParentMealTitle(mealRow.title);
      }

      // Fetch cook partners
      const participants = await getPostParticipants(postId);
      const partners = participants.filter(
        p => p.role === 'sous_chef' && p.status === 'approved'
      );
      setCookPartners(partners);
      const pIds = partners.map(p => p.participant_user_id).filter(Boolean);
      setPartnerIds(pIds);

      // Cache user profiles for partner display
      for (const p of participants) {
        if (p.participant_user_id && p.participant_profile) {
          userProfileCacheRef.current.set(p.participant_user_id, {
            display_name: p.participant_profile.display_name,
            username: p.participant_profile.username,
            avatar_url: p.participant_profile.avatar_url,
          });
        }
      }

      // Fetch eating partners (display-only stub)
      const eaters = participants.filter(
        p => p.role === 'ate_with' && p.status === 'approved'
      );
      setAteWithPartners(eaters);

      // Capture initial values for dirty detection
      initialValues.current = {
        title: cookCard.title || '',
        description: cookCard.description || '',
        rating: cookCard.rating,
        cookingMethod: cookCard.cooking_method || '',
        cookedAt: (cookCard.cooked_at ? new Date(cookCard.cooked_at) : new Date()).toISOString(),
        modifications: cookCard.modifications || '',
        notes: cookCard.notes || '',
        visibility: visRow?.visibility || 'everyone',
        parentMealId: cookCard.parent_meal_id || null,
        partnerIds: [...pIds],
      };
    } catch (err) {
      console.error('[EditPostScreen] loadPostData error:', err);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  // Refetch on focus (picks up EditMedia changes)
  useFocusEffect(
    useCallback(() => {
      loadPostData();
    }, [loadPostData])
  );

  // ── Dirty state detection ─────────────────────────────────────────
  const isDirty = useMemo(() => {
    const iv = initialValues.current;
    if (title !== iv.title) return true;
    if (description !== iv.description) return true;
    if (rating !== iv.rating) return true;
    if (cookingMethod !== iv.cookingMethod) return true;
    if (cookedAt.toISOString() !== iv.cookedAt) return true;
    if (modifications !== iv.modifications) return true;
    if (notes !== iv.notes) return true;
    if (visibility !== iv.visibility) return true;
    if (parentMealId !== iv.parentMealId) return true;
    // Compare partner ID sets
    const sortedCurrent = [...partnerIds].sort();
    const sortedInitial = [...iv.partnerIds].sort();
    if (sortedCurrent.length !== sortedInitial.length) return true;
    if (sortedCurrent.some((id, i) => id !== sortedInitial[i])) return true;
    return false;
  }, [title, description, rating, cookingMethod, cookedAt, modifications, notes, visibility, parentMealId, partnerIds]);

  // ── Meal picker ────────────────────────────────────────────────────
  const handleOpenMealPicker = useCallback(async () => {
    if (!currentUserId) return;
    setMealPickerLoading(true);
    setMealPickerOpen(true);
    try {
      const { data } = await supabase
        .from('posts')
        .select('id, title, created_at')
        .eq('user_id', currentUserId)
        .eq('post_type', 'meal_event')
        .order('created_at', { ascending: false })
        .limit(20);
      setRecentMeals(data || []);
    } catch (err) {
      console.warn('[EditPostScreen] meal picker fetch error:', err);
    } finally {
      setMealPickerLoading(false);
    }
  }, [currentUserId]);

  const handleCreateMealEvent = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: currentUserId,
          post_type: 'meal_event',
          title: 'Dinner',
          cooked_at: new Date().toISOString(),
          visibility: 'everyone',
        })
        .select('id, title, created_at')
        .single();
      if (error) throw error;
      console.warn(`[EditPostScreen] created new meal event: ${data.id}`);
      handleSelectMeal(data.id, data.title);
    } catch (err) {
      console.error('[EditPostScreen] create meal event error:', err);
      Alert.alert('Error', 'Failed to create meal event.');
    }
  }, [currentUserId, handleSelectMeal]);

  const handleSelectMeal = useCallback((mealId: string | null, mealTitle: string | null) => {
    setParentMealId(mealId);
    setParentMealTitle(mealTitle);
    setMealPickerOpen(false);
    console.warn(`[EditPostScreen] meal changed to: ${mealId ?? 'none'}`);
  }, []);

  // ── Navigate to EditMedia ──────────────────────────────────────────
  const handleEditPhotos = useCallback(() => {
    if (!post) return;
    console.warn(`[EditPostScreen] navigating to EditMedia — postId: ${post.id}`);
    navigation.navigate('EditMedia', {
      postId: post.id,
      existingPhotos: photos,
    });
  }, [navigation, post, photos]);

  // ── Save handler ────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!post || !currentUserId || saving) return;
    setSaving(true);
    console.warn('[EditPostScreen] save started');

    try {
      // Build patch from changed fields only
      const iv = initialValues.current;
      const patch: UpdatePostPatch = {};
      if (title !== iv.title) patch.title = title;
      if (description !== iv.description) patch.description = description || null;
      if (rating !== iv.rating) patch.rating = rating;
      if (cookingMethod !== iv.cookingMethod) patch.cooking_method = cookingMethod || null;
      if (cookedAt.toISOString() !== iv.cookedAt) patch.cooked_at = cookedAt.toISOString();
      if (modifications !== iv.modifications) patch.modifications = modifications || null;
      if (notes !== iv.notes) patch.notes = notes || null;
      if (visibility !== iv.visibility) patch.visibility = visibility;
      if (parentMealId !== iv.parentMealId) patch.parent_meal_id = parentMealId;

      // Save post-level fields
      if (Object.keys(patch).length > 0) {
        await updatePost(postId, patch);
        console.warn(`[EditPostScreen] post updated — fields: ${Object.keys(patch).join(', ')}`);
      }

      // Cook partner diff
      const currentSet = new Set(partnerIds);
      const initialSet = new Set(iv.partnerIds);
      const toAdd = partnerIds.filter(id => !initialSet.has(id));
      const toRemove = iv.partnerIds.filter(id => !currentSet.has(id));

      if (toAdd.length > 0) {
        const rows = toAdd.map(uid => ({
          post_id: postId,
          participant_user_id: uid,
          role: 'sous_chef' as const,
          status: 'approved' as const,
          invited_by_user_id: currentUserId,
        }));
        const { error: insertErr } = await supabase
          .from('post_participants')
          .insert(rows);
        if (insertErr) throw insertErr;
        console.warn(`[EditPostScreen] added ${toAdd.length} cook partner(s)`);
      }

      if (toRemove.length > 0) {
        const { error: deleteErr } = await supabase
          .from('post_participants')
          .delete()
          .eq('post_id', postId)
          .eq('role', 'sous_chef')
          .in('participant_user_id', toRemove);
        if (deleteErr) throw deleteErr;
        console.warn(`[EditPostScreen] removed ${toRemove.length} cook partner(s)`);
      }

      console.warn('[EditPostScreen] save complete — navigating back');
      navigation.goBack();
    } catch (err) {
      console.error('[EditPostScreen] save error:', err);
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [post, currentUserId, saving, postId, navigation, title, description, rating, cookingMethod, cookedAt, modifications, notes, visibility, parentMealId, partnerIds]);

  // ── Delete post ────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (saving) return;
    // 150ms delay to avoid iOS Modal/Alert race condition
    setTimeout(() => {
      Alert.alert(
        'Delete Post',
        'This will permanently delete this post. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from('posts')
                  .delete()
                  .eq('id', postId);
                if (error) throw error;
                console.warn(`[EditPostScreen] post deleted: ${postId}`);
                // Navigate back to feed (skip CookDetailScreen which would show deleted post)
                navigation.navigate('FeedMain' as any);
              } catch (err) {
                console.error('[EditPostScreen] delete error:', err);
                Alert.alert('Error', 'Failed to delete post.');
              }
            },
          },
        ]
      );
    }, 150);
  }, [postId, navigation, saving]);

  // ── Cancel ─────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    if (saving) return;
    console.warn('[EditPostScreen] cancel pressed');
    if (isDirty) {
      Alert.alert(
        'Discard changes?',
        'You have unsaved changes.',
        [
          { text: 'Keep editing' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  }, [navigation, isDirty, saving]);

  // ── Helpers ────────────────────────────────────────────────────────
  const formatDate = (date: Date): string => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const visibilityLabel = (v: string): string => {
    switch (v) {
      case 'everyone': return 'Everyone';
      case 'followers': return 'Followers';
      case 'private': return 'Just me';
      case 'meal_tagged': return 'People tagged in meal';
      default: return v;
    }
  };

  const ratingLabel = rating !== null
    ? (Number.isInteger(rating) ? `${rating}.0` : `${rating}`)
    : null;

  // ── Loading / not found ────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerSideButton}>
            <Text style={{ color: colors.primary, fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Edit Cook</Text>
          <View style={styles.headerSideButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerSideButton}>
            <Text style={{ color: colors.primary, fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Edit Cook</Text>
          <View style={styles.headerSideButton} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.text.secondary }}>Post not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background.primary }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border.light }]}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerSideButton}>
          <Text style={{ color: colors.primary, fontSize: 16 }}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Edit Cook</Text>
        <View style={styles.headerSideButton} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={10}
      >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Section 1: Core content ───────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Title</Text>
          <TextInput
            style={[styles.textInput, {
              color: colors.text.primary,
              borderColor: colors.border.light,
              backgroundColor: colors.background.card,
            }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor={colors.text.tertiary}
            maxLength={100}
          />

          <Text style={[styles.fieldLabel, { color: colors.text.secondary, marginTop: 16 }]}>
            Description
          </Text>
          <TextInput
            style={[styles.textInput, styles.textInputMultiline, {
              color: colors.text.primary,
              borderColor: colors.border.light,
              backgroundColor: colors.background.card,
            }]}
            value={description}
            onChangeText={setDescription}
            placeholder="How'd it go? Share more about your cook"
            placeholderTextColor={colors.text.tertiary}
            multiline
            maxLength={1000}
          />
        </View>

        {/* ── Section 2: Media ──────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.text.primary }]}>Photos</Text>
          <View style={styles.photoGrid}>
            {photos.map((photo, i) => (
              <TouchableOpacity key={`photo-${i}`} onPress={handleEditPhotos} activeOpacity={0.7}>
                <Image
                  source={{ uri: optimizeStorageUrl(photo.url) }}
                  style={[styles.photoThumb, { backgroundColor: colors.background.secondary }]}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
            {photos.length < 10 && (
              <TouchableOpacity
                style={[styles.addPhotoCard, { borderColor: colors.border.light }]}
                onPress={handleEditPhotos}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.text.tertiary, fontSize: 24 }}>+</Text>
                <Text style={{ color: colors.text.tertiary, fontSize: 11, marginTop: 2 }}>
                  Add Photos
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Section 3: Details ────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.text.primary }]}>Details</Text>

          {/* Rating */}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.text.primary }]}>Rating</Text>
            {ratingLabel && (
              <Text style={[styles.ratingBadge, { color: colors.primary }]}>{ratingLabel}</Text>
            )}
          </View>
          <StarRating rating={rating} onRatingChange={setRating} colors={colors} />

          {/* Cooking method */}
          <TouchableOpacity
            style={[styles.tappableRow, { borderColor: colors.border.light }]}
            onPress={() => setMethodPickerOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.detailLabel, { color: colors.text.primary }]}>Cooking method</Text>
            <View style={styles.tappableRowRight}>
              <Text style={{ color: cookingMethod ? colors.text.primary : colors.text.tertiary }}>
                {(cookingMethod && COOKING_METHODS.find(m => m.value === cookingMethod)?.label) || cookingMethod || 'Not set'}
              </Text>
              <Text style={{ color: colors.text.tertiary, marginLeft: 8 }}>›</Text>
            </View>
          </TouchableOpacity>

          {/* Date cooked */}
          <TouchableOpacity
            style={[styles.tappableRow, { borderColor: colors.border.light }]}
            onPress={() => setDatePickerOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.detailLabel, { color: colors.text.primary }]}>Date cooked</Text>
            <View style={styles.tappableRowRight}>
              <Text style={{ color: colors.text.primary }}>{formatDate(cookedAt)}</Text>
              <Text style={{ color: colors.text.tertiary, marginLeft: 8 }}>›</Text>
            </View>
          </TouchableOpacity>

          {/* Modifications */}
          <Text style={[styles.fieldLabel, { color: colors.text.secondary, marginTop: 16 }]}>
            Modifications
          </Text>
          <TextInput
            style={[styles.textInput, styles.textInputMultiline, {
              color: colors.text.primary,
              borderColor: colors.border.light,
              backgroundColor: colors.background.card,
            }]}
            value={modifications}
            onChangeText={setModifications}
            placeholder="What did you change from the recipe?"
            placeholderTextColor={colors.text.tertiary}
            multiline
            maxLength={1000}
          />

          {/* Notes */}
          <Text style={[styles.fieldLabel, { color: colors.text.secondary, marginTop: 16 }]}>
            Notes (private)
          </Text>
          <TextInput
            style={[styles.textInput, styles.textInputMultiline, {
              color: colors.text.primary,
              borderColor: colors.border.light,
              backgroundColor: colors.background.card,
            }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="🔒 Private notes — only you can see these"
            placeholderTextColor={colors.text.tertiary}
            multiline
            maxLength={2000}
          />

          {/* Recipe (read-only, non-tappable — view from CookDetailScreen) */}
          {post.recipe_id && (
            <View style={[styles.tappableRow, { borderColor: colors.border.light }]}>
              <Text style={[styles.detailLabel, { color: colors.text.primary }]}>Recipe</Text>
              <Text style={{ color: colors.text.secondary, flexShrink: 1 }} numberOfLines={1}>
                {post.recipe_title || 'Linked recipe'}
                {post.chef_name ? ` by ${post.chef_name}` : ''}
              </Text>
            </View>
          )}

          {/* Meal event */}
          <TouchableOpacity
            style={[styles.tappableRow, { borderColor: colors.border.light }]}
            onPress={handleOpenMealPicker}
            activeOpacity={0.7}
          >
            <Text style={[styles.detailLabel, { color: colors.text.primary }]}>Meal event</Text>
            <View style={styles.tappableRowRight}>
              <Text style={{
                color: parentMealId ? colors.text.primary : colors.text.tertiary,
                flexShrink: 1,
              }} numberOfLines={1}>
                {parentMealTitle || (parentMealId ? 'Attached' : 'Not attached to a meal event')}
              </Text>
              <Text style={{ color: colors.text.tertiary, marginLeft: 8 }}>›</Text>
            </View>
          </TouchableOpacity>

          {/* Cook partners */}
          <TouchableOpacity
            style={[styles.tappableRow, { borderColor: colors.border.light }]}
            onPress={() => setPartnersModalOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.detailLabel, { color: colors.text.primary }]}>Cook partners</Text>
            <View style={styles.tappableRowRight}>
              <Text style={{ color: cookPartners.length > 0 ? colors.text.primary : colors.text.tertiary }}>
                {cookPartners.length > 0
                  ? cookPartners.map(p => p.participant_profile?.display_name || p.participant_profile?.username || 'Partner').join(', ')
                  : 'No cook partners'}
              </Text>
              <Text style={{ color: colors.text.tertiary, marginLeft: 8 }}>›</Text>
            </View>
          </TouchableOpacity>

          {/* Eating with (display-only stub) */}
          <TouchableOpacity
            style={[styles.tappableRow, { borderColor: colors.border.light }]}
            onPress={() => Alert.alert('Coming soon', 'Eating partner tagging will be available in a future update.')}
            activeOpacity={0.7}
          >
            <Text style={[styles.detailLabel, { color: colors.text.primary }]}>Eating with</Text>
            <View style={styles.tappableRowRight}>
              <Text style={{ color: ateWithPartners.length > 0 ? colors.text.primary : colors.text.tertiary }}>
                {ateWithPartners.length > 0
                  ? ateWithPartners.map(p => p.participant_profile?.display_name || p.participant_profile?.username || 'Guest').join(', ')
                  : 'No eating partners'}
              </Text>
              <Text style={{ color: colors.text.tertiary, marginLeft: 8 }}>›</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Section 4: Visibility ─────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.text.primary }]}>Visibility</Text>
          <TouchableOpacity
            style={[styles.tappableRow, { borderColor: colors.border.light }]}
            onPress={() => setVisibilityPickerOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.detailLabel, { color: colors.text.primary }]}>Who can see</Text>
            <View style={styles.tappableRowRight}>
              <Text style={{ color: colors.text.primary }}>{visibilityLabel(visibility)}</Text>
              <Text style={{ color: colors.text.tertiary, marginLeft: 8 }}>›</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Delete post ───────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteButtonText}>Delete Post</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Sticky bottom bar ─────────────────────────────────────── */}
      <View style={[styles.bottomBar, {
        backgroundColor: colors.background.primary,
        borderTopColor: colors.border.light,
      }]}>
        <TouchableOpacity
          style={[styles.updateButton, {
            backgroundColor: isDirty && !saving ? colors.primary : colors.border.medium,
          }]}
          disabled={!isDirty || saving}
          onPress={handleSave}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={[styles.updateButtonText, {
              color: isDirty ? '#fff' : colors.text.tertiary,
            }]}>
              Update Cook
            </Text>
          )}
        </TouchableOpacity>
      </View>

      </KeyboardAvoidingView>

      {/* ── Cooking method picker modal ───────────────────────────── */}
      {methodPickerOpen && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setMethodPickerOpen(false)}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setMethodPickerOpen(false)}
          >
            <View style={[styles.pickerBody, { backgroundColor: colors.background.card }]}>
              <Text style={[styles.pickerTitle, { color: colors.text.primary }]}>Cooking Method</Text>
              {COOKING_METHODS.map(method => (
                <TouchableOpacity
                  key={method.value}
                  style={[
                    styles.pickerItem,
                    cookingMethod === method.value && { backgroundColor: colors.background.secondary },
                  ]}
                  onPress={() => {
                    setCookingMethod(method.value);
                    setMethodPickerOpen(false);
                    console.warn(`[EditPostScreen] cooking method changed to: ${method.value}`);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.pickerItemText,
                    { color: cookingMethod === method.value ? colors.primary : colors.text.primary },
                  ]}>
                    {method.label}
                  </Text>
                  {cookingMethod === method.value && (
                    <Text style={{ color: colors.primary }}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.pickerItem}
                onPress={() => {
                  setCookingMethod('');
                  setMethodPickerOpen(false);
                  console.warn('[EditPostScreen] cooking method cleared');
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerItemText, { color: colors.text.tertiary }]}>
                  Clear
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* ── Visibility picker modal ───────────────────────────────── */}
      {visibilityPickerOpen && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setVisibilityPickerOpen(false)}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setVisibilityPickerOpen(false)}
          >
            <View style={[styles.pickerBody, { backgroundColor: colors.background.card }]}>
              <Text style={[styles.pickerTitle, { color: colors.text.primary }]}>Who can see</Text>
              {(['everyone', 'followers', 'private', 'meal_tagged'] as const).map(opt => {
                const disabled = opt === 'meal_tagged' && !parentMealId;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.pickerItem,
                      visibility === opt && { backgroundColor: colors.background.secondary },
                      disabled && { opacity: 0.4 },
                    ]}
                    onPress={() => {
                      if (disabled) return;
                      setVisibility(opt);
                      setVisibilityPickerOpen(false);
                      console.warn(`[EditPostScreen] visibility changed to: ${opt}`);
                    }}
                    activeOpacity={disabled ? 1 : 0.7}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      { color: visibility === opt ? colors.primary : colors.text.primary },
                    ]}>
                      {visibilityLabel(opt)}
                    </Text>
                    {visibility === opt && (
                      <Text style={{ color: colors.primary }}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* ── Meal picker modal ─────────────────────────────────────── */}
      {mealPickerOpen && (
        <Modal transparent animationType="slide" visible onRequestClose={() => setMealPickerOpen(false)}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setMealPickerOpen(false)}
          >
            <View style={[styles.pickerBody, { backgroundColor: colors.background.card, maxHeight: 400 }]}>
              <Text style={[styles.pickerTitle, { color: colors.text.primary }]}>Meal Event</Text>
              {mealPickerLoading ? (
                <ActivityIndicator style={{ padding: 20 }} color={colors.primary} />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.pickerItem}
                    onPress={handleCreateMealEvent}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerItemText, { color: colors.primary, fontWeight: '500' }]}>
                      + Create new meal event
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.pickerItem,
                      !parentMealId && { backgroundColor: colors.background.secondary },
                    ]}
                    onPress={() => handleSelectMeal(null, null)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pickerItemText, {
                      color: !parentMealId ? colors.primary : colors.text.tertiary,
                    }]}>
                      No meal event
                    </Text>
                  </TouchableOpacity>
                  <ScrollView style={{ maxHeight: 300 }}>
                    {recentMeals.map(meal => (
                      <TouchableOpacity
                        key={meal.id}
                        style={[
                          styles.pickerItem,
                          parentMealId === meal.id && { backgroundColor: colors.background.secondary },
                        ]}
                        onPress={() => handleSelectMeal(meal.id, meal.title)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.pickerItemText, {
                            color: parentMealId === meal.id ? colors.primary : colors.text.primary,
                          }]} numberOfLines={1}>
                            {meal.title}
                          </Text>
                          {meal.created_at && (
                            <Text style={{ color: colors.text.tertiary, fontSize: 13, marginTop: 2 }}>
                              {formatDate(new Date(meal.created_at))}
                            </Text>
                          )}
                        </View>
                        {parentMealId === meal.id && (
                          <Text style={{ color: colors.primary }}>✓</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* ── Date picker ───────────────────────────────────────────── */}
      <DateTimePicker
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        onSelect={(date) => {
          setCookedAt(date);
          setDatePickerOpen(false);
          console.warn(`[EditPostScreen] date changed to: ${date.toISOString()}`);
        }}
        initialDate={cookedAt}
        maximumDate={new Date()}
        mode="date"
        quickSelectPreset="past"
      />

      {/* ── Cook partners modal ───────────────────────────────────── */}
      {currentUserId && (
        <AddCookingPartnersModal
          visible={partnersModalOpen}
          onClose={() => setPartnersModalOpen(false)}
          onConfirm={async (selectedIds) => {
            setPartnerIds(selectedIds);
            setPartnersModalOpen(false);
            console.warn(`[EditPostScreen] partners changed: ${selectedIds.length} selected`);

            // Build display list from cached profiles + existing cookPartners.
            // Don't refetch from DB — new partners haven't been written yet.
            const existingById = new Map(
              cookPartners.map(p => [p.participant_user_id, p])
            );

            // For any selected IDs not in cache, fetch their profiles now
            const uncachedIds = selectedIds.filter(
              id => !userProfileCacheRef.current.has(id) && !existingById.has(id)
            );
            if (uncachedIds.length > 0) {
              try {
                const { data: profiles } = await supabase
                  .from('user_profiles')
                  .select('id, display_name, username, avatar_url')
                  .in('id', uncachedIds);
                for (const p of (profiles || [])) {
                  userProfileCacheRef.current.set(p.id, {
                    display_name: p.display_name,
                    username: p.username,
                    avatar_url: p.avatar_url,
                  });
                }
              } catch {
                // Non-critical — will show "Partner" as fallback
              }
            }

            const displayPartners: PostParticipant[] = selectedIds.map(id => {
              // Reuse existing entry if available
              const existing = existingById.get(id);
              if (existing) return existing;
              // Build from cache
              const cached = userProfileCacheRef.current.get(id);
              return {
                id: `pending-${id}`,
                post_id: postId,
                participant_user_id: id,
                role: 'sous_chef' as const,
                status: 'approved' as const,
                invited_by_user_id: currentUserId || '',
                created_at: new Date().toISOString(),
                participant_profile: cached ? {
                  id,
                  display_name: cached.display_name,
                  username: cached.username || '',
                  avatar_url: cached.avatar_url,
                } : undefined,
              };
            });
            setCookPartners(displayPartners);
          }}
          currentUserId={currentUserId}
          defaultRole="sous_chef"
          existingParticipantIds={partnerIds}
        />
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerSideButton: {
    minWidth: 60,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  textInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  // Photo grid
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoThumb: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
  },
  addPhotoCard: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Detail rows
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  ratingBadge: {
    fontSize: 15,
    fontWeight: '600',
  },
  tappableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  tappableRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    maxWidth: '60%',
  },
  // Delete
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 20,
    marginHorizontal: 16,
    marginTop: 8,
  },
  deleteButtonText: {
    color: '#cc4444',
    fontSize: 15,
    fontWeight: '500',
  },
  // Bottom bar
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 0.5,
  },
  updateButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerBody: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 34,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  pickerItemText: {
    fontSize: 16,
  },
});
