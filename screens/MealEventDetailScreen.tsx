// screens/MealEventDetailScreen.tsx
// Phase 7I Checkpoint 6 / L7 — meal event detail screen.
//
// Reached from L4 meal event preheads and L5 nested-meal-event group
// headers on the feed. 8 content blocks top to bottom, plus a sticky
// engagement bar at the bottom (same pattern as CookDetailScreen).
//
// Pass 1 (6.1–6.4): full screen + eater ratings pill wiring + navigation
// rewiring. The host/attendee overflow menu buttons exist but are stubbed
// with `console.warn` — Pass 2 (6.5) wires the 6 host + 3 attendee items.
//
// See docs/CC_PROMPT_7I_CHECKPOINT_6_MEALEVENTDETAIL.md for the spec.

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme/ThemeContext';
import { FeedStackParamList } from '../App';
import {
  NoPhotoPlaceholder,
  optimizeStorageUrl,
} from '../components/feedCard/sharedCardElements';
import UserAvatar from '../components/UserAvatar';
import DateTimePicker from '../components/DateTimePicker';
import AddCookingPartnersModal from '../components/AddCookingPartnersModal';
import {
  getMealEventDetail,
  MealEventDetail,
} from '../lib/services/mealService';
import {
  getEaterRatingsForMeal,
  upsertEaterRating,
} from '../lib/services/eaterRatingsService';
import { getCommentsForPost, Comment } from '../lib/services/commentsService';
import { updatePost } from '../lib/services/postService';
import {
  chooseImageSource,
  uploadPostImages,
} from '../lib/services/imageStorageService';
import { sharePost } from '../lib/services/shareService';

type Props = NativeStackScreenProps<FeedStackParamList, 'MealEventDetail'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const HERO_HEIGHT = SCREEN_WIDTH * 0.75;
const STICKY_BAR_HEIGHT = 64;

// ============================================================================
// SCREEN
// ============================================================================

export default function MealEventDetailScreen({ route, navigation }: Props) {
  const { colors, functionalColors } = useTheme();
  const { mealEventId } = route.params;

  // ── State ──────────────────────────────────────────────────────────────

  const [detail, setDetail] = useState<MealEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [eaterRatings, setEaterRatings] = useState<Map<string, number>>(
    new Map()
  );
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [likesCount, setLikesCount] = useState<number>(0);
  const [hasLike, setHasLike] = useState<boolean>(false);

  // Rating picker state — which dish post ID is currently showing the
  // 5-star picker row (null when none).
  const [ratingPickerOpen, setRatingPickerOpen] = useState<string | null>(
    null
  );

  // Pass 2 (Sub-section 6.5) state — overflow menu + inline edit.
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationDraft, setLocationDraft] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [highlightPickerOpen, setHighlightPickerOpen] = useState(false);
  const [manageAttendeesOpen, setManageAttendeesOpen] = useState(false);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  // ── Data load ──────────────────────────────────────────────────────────

  useEffect(() => {
    const loadCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, mealEventId]);

  // Refetch on focus so "Add photo" and other Pass 2 mutations reflect
  // without a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      if (currentUserId && detail) {
        console.warn('[MealEventDetailScreen] useFocusEffect refetch triggered');
        loadDetail();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUserId])
  );

  const loadDetail = async () => {
    setLoading(true);
    try {
      const eventData = await getMealEventDetail(mealEventId, currentUserId);
      if (!eventData) {
        setDetail(null);
        setLoading(false);
        return;
      }
      setDetail(eventData);
      setLoading(false);

      // Hydrate side data in parallel — eater ratings, likes, comments.
      await Promise.all([
        (async () => {
          try {
            const map = await getEaterRatingsForMeal(
              mealEventId,
              currentUserId
            );
            setEaterRatings(map);
          } catch (e) {
            console.warn(
              '[MealEventDetailScreen] getEaterRatingsForMeal failed:',
              e
            );
          }
        })(),
        (async () => {
          try {
            const rows = await getCommentsForPost(mealEventId);
            setComments(rows);
          } catch (e) {
            console.warn(
              '[MealEventDetailScreen] getCommentsForPost failed:',
              e
            );
            setComments([]);
          }
        })(),
        (async () => {
          try {
            const { data: likeRows } = await supabase
              .from('post_likes')
              .select('user_id')
              .eq('post_id', mealEventId);
            const rows = (likeRows || []) as Array<{ user_id: string }>;
            setLikesCount(rows.length);
            setHasLike(rows.some(r => r.user_id === currentUserId));
          } catch (e) {
            console.warn('[MealEventDetailScreen] likes fetch failed:', e);
          }
        })(),
      ]);
    } catch (err) {
      console.error('[MealEventDetailScreen] loadDetail failed:', err);
      setLoading(false);
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────

  const isHost = !!detail && detail.host.user_id === currentUserId;
  const isAttendee =
    !!detail &&
    (detail.attendees.some(a => a.user_id === currentUserId) ||
      detail.cooks.some(c => c.user_id === currentUserId));
  const showMenuButton = isHost || isAttendee;

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleShare = useCallback(() => {
    if (!detail) return;
    sharePost({
      title: detail.event.title,
      author_name: detail.host.display_name || detail.host.username || 'Someone',
    });
  }, [detail]);

  const handleMenuPress = useCallback(() => {
    setMenuOpen(true);
  }, []);

  // ── Host menu handlers (Sub-section 6.5) ──────────────────────────────

  // Host #1 — Edit title
  const handleMenuEditTitle = useCallback(() => {
    if (!detail) return;
    console.warn(
      `[MealEventDetailScreen] handleMenuEditTitle started — eventId: ${detail.event.id}`
    );
    setMenuOpen(false);
    setTitleDraft(detail.event.title || '');
    setTitleError(null);
    setEditingTitle(true);
  }, [detail]);

  const handleTitleSave = useCallback(async () => {
    if (!detail) return;
    const trimmed = titleDraft.trim();
    if (trimmed.length === 0) {
      console.warn('[MealEventDetailScreen] handleTitleSave rejected — empty');
      setTitleError("Title can't be empty");
      return;
    }
    try {
      await updatePost(detail.event.id, { title: trimmed });
      setDetail(prev =>
        prev ? { ...prev, event: { ...prev.event, title: trimmed } } : prev
      );
      setEditingTitle(false);
      setTitleError(null);
      console.warn(
        `[MealEventDetailScreen] handleTitleSave succeeded — "${trimmed}"`
      );
    } catch (err) {
      console.warn('[MealEventDetailScreen] handleTitleSave FAILED:', err);
      Alert.alert('Error', 'Failed to update title');
    }
  }, [detail, titleDraft]);

  const handleTitleCancel = useCallback(() => {
    setEditingTitle(false);
    setTitleError(null);
  }, []);

  // Host #2 — Edit date/time
  const handleMenuEditDateTime = useCallback(() => {
    if (!detail) return;
    console.warn(
      `[MealEventDetailScreen] handleMenuEditDateTime started — eventId: ${detail.event.id}`
    );
    setMenuOpen(false);
    setDatePickerOpen(true);
  }, [detail]);

  const handleDateTimeSelect = useCallback(
    async (newDate: Date) => {
      if (!detail) return;
      const iso = newDate.toISOString();
      console.warn(
        `[MealEventDetailScreen] handleDateTimeSelect — new meal_time: ${iso}`
      );
      try {
        await updatePost(detail.event.id, { meal_time: iso });
        setDetail(prev =>
          prev ? { ...prev, event: { ...prev.event, meal_time: iso } } : prev
        );
        setDatePickerOpen(false);
        console.warn('[MealEventDetailScreen] handleDateTimeSelect succeeded');
      } catch (err) {
        console.warn(
          '[MealEventDetailScreen] handleDateTimeSelect FAILED:',
          err
        );
        Alert.alert('Error', 'Failed to update date/time');
      }
    },
    [detail]
  );

  // Host #3 — Edit location
  const handleMenuEditLocation = useCallback(() => {
    if (!detail) return;
    console.warn(
      `[MealEventDetailScreen] handleMenuEditLocation started — eventId: ${detail.event.id}`
    );
    setMenuOpen(false);
    setLocationDraft(detail.event.meal_location || '');
    setEditingLocation(true);
  }, [detail]);

  const handleLocationSave = useCallback(async () => {
    if (!detail) return;
    const trimmed = locationDraft.trim();
    try {
      await updatePost(detail.event.id, { meal_location: trimmed || null });
      setDetail(prev =>
        prev
          ? {
              ...prev,
              event: { ...prev.event, meal_location: trimmed || undefined },
            }
          : prev
      );
      setEditingLocation(false);
      console.warn(
        `[MealEventDetailScreen] handleLocationSave succeeded — cleared: ${!trimmed}`
      );
    } catch (err) {
      console.warn('[MealEventDetailScreen] handleLocationSave FAILED:', err);
      Alert.alert('Error', 'Failed to update location');
    }
  }, [detail, locationDraft]);

  const handleLocationCancel = useCallback(() => {
    setEditingLocation(false);
  }, []);

  // Host #4 — Edit highlight photo
  const handleMenuEditHighlight = useCallback(() => {
    if (!detail) return;
    console.warn(
      `[MealEventDetailScreen] handleMenuEditHighlight started — eventId: ${detail.event.id}`
    );
    setMenuOpen(false);
    setHighlightPickerOpen(true);
  }, [detail]);

  const handleHighlightSelect = useCallback(
    async (url: string) => {
      if (!detail) return;
      console.warn(
        `[MealEventDetailScreen] handleHighlightSelect — url: ${url}`
      );
      try {
        // Read the current photos jsonb (may be string-form or object-form).
        // We want to set is_highlight=true on the matching entry and clear
        // it on all others. If the URL isn't yet in photos (e.g., it came
        // from meal_photos or a dish's photos), prepend a new object entry.
        const { data: eventRow } = await supabase
          .from('posts')
          .select('photos')
          .eq('id', detail.event.id)
          .maybeSingle();

        const rawPhotos: any[] = Array.isArray((eventRow as any)?.photos)
          ? (eventRow as any).photos
          : [];

        const normalized = rawPhotos.map((p: any, i: number) => {
          if (typeof p === 'string') {
            return { url: p, order: i, is_highlight: false };
          }
          if (p && typeof p === 'object' && typeof p.url === 'string') {
            return { ...p, is_highlight: false };
          }
          return null;
        }).filter((p: any) => p !== null);

        const existingIdx = normalized.findIndex(
          (p: any) => p.url === url
        );
        let nextPhotos: any[];
        if (existingIdx >= 0) {
          nextPhotos = normalized.map((p: any, i: number) =>
            i === existingIdx ? { ...p, is_highlight: true } : p
          );
        } else {
          nextPhotos = [
            { url, order: 0, is_highlight: true },
            ...normalized,
          ];
        }

        const { error } = await supabase
          .from('posts')
          .update({ photos: nextPhotos })
          .eq('id', detail.event.id);
        if (error) throw error;

        // Optimistic local update so the hero reflects the new highlight.
        setDetail(prev =>
          prev
            ? {
                ...prev,
                event: { ...prev.event, highlight_photo: { url, is_highlight: true } },
              }
            : prev
        );
        setHighlightPickerOpen(false);
        console.warn(
          '[MealEventDetailScreen] handleHighlightSelect succeeded'
        );
      } catch (err) {
        console.warn(
          '[MealEventDetailScreen] handleHighlightSelect FAILED:',
          err
        );
        Alert.alert('Error', 'Failed to update highlight photo');
      }
    },
    [detail]
  );

  // Host #5 — Manage attendees
  const handleMenuManageAttendees = useCallback(() => {
    if (!detail) return;
    console.warn(
      `[MealEventDetailScreen] handleMenuManageAttendees started — eventId: ${detail.event.id}`
    );
    setMenuOpen(false);
    setManageAttendeesOpen(true);
  }, [detail]);

  const handleManageAttendeesConfirm = useCallback(
    async (selectedUserIds: string[]) => {
      if (!detail) return;

      const current = new Set(
        detail.attendees
          .map(a => a.user_id)
          .filter((id): id is string => !!id)
      );
      const next = new Set(selectedUserIds);
      const toAdd = [...next].filter(id => !current.has(id));
      const toRemove = [...current].filter(id => !next.has(id));

      console.warn(
        `[MealEventDetailScreen] handleManageAttendeesConfirm — adding: [${toAdd.join(',')}], removing: [${toRemove.join(',')}]`
      );

      try {
        // Same inline-bypass pattern as CookDetailScreen's Manage cook
        // partners: postParticipantsService hardcodes status='pending' and
        // only supports self-removal, neither of which fits host-driven
        // manage-mode. Direct insert/delete below.
        if (toAdd.length > 0) {
          const rows = toAdd.map(uid => ({
            post_id: detail.event.id,
            participant_user_id: uid,
            role: 'ate_with' as const,
            status: 'approved' as const,
            invited_by_user_id: currentUserId,
          }));
          const { error: insertErr } = await supabase
            .from('post_participants')
            .insert(rows);
          if (insertErr) throw insertErr;
        }

        if (toRemove.length > 0) {
          const { error: deleteErr } = await supabase
            .from('post_participants')
            .delete()
            .eq('post_id', detail.event.id)
            .eq('role', 'ate_with')
            .in('participant_user_id', toRemove);
          if (deleteErr) throw deleteErr;
        }

        // Refetch detail to refresh Blocks 5, 6 with new attendee set.
        await loadDetail();
        console.warn(
          '[MealEventDetailScreen] handleManageAttendeesConfirm succeeded'
        );
      } catch (err) {
        console.warn(
          '[MealEventDetailScreen] handleManageAttendeesConfirm FAILED:',
          err
        );
        Alert.alert('Error', 'Failed to update attendees');
      }
    },
    // loadDetail is stable enough — intentionally excluded to avoid stale-closure cycles
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detail, currentUserId]
  );

  // Host #6 — Delete event
  const handleMenuDeleteEvent = useCallback(() => {
    if (!detail) return;
    console.warn(
      `[MealEventDetailScreen] handleMenuDeleteEvent started — eventId: ${detail.event.id}`
    );
    setMenuOpen(false);
    const dishCount = detail.stats.total_dishes;
    // Same iOS Modal/Alert race workaround as CookDetailScreen — delay
    // the Alert past the menu Modal close animation.
    setTimeout(() => {
      Alert.alert(
        `Delete ${detail.event.title || 'this event'}?`,
        `This will remove the event. The ${dishCount} cook post${dishCount === 1 ? '' : 's'} from attendees will remain as solo posts.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              console.warn(
                '[MealEventDetailScreen] handleMenuDeleteEvent — cancelled'
              );
            },
          },
          {
            text: 'Delete event',
            style: 'destructive',
            onPress: async () => {
              console.warn(
                `[MealEventDetailScreen] handleMenuDeleteEvent — confirming delete ${detail.event.id}`
              );
              try {
                // 1. Detach linked cook posts first (parent_meal_id=null).
                const { error: detachErr } = await supabase
                  .from('posts')
                  .update({ parent_meal_id: null })
                  .eq('parent_meal_id', detail.event.id);
                if (detachErr) throw detachErr;

                // 2. Delete the meal_event row. FK cascade handles
                //    post_likes, post_comments, post_participants, meal_photos.
                const { error: deleteErr } = await supabase
                  .from('posts')
                  .delete()
                  .eq('id', detail.event.id);
                if (deleteErr) throw deleteErr;

                console.warn(
                  '[MealEventDetailScreen] handleMenuDeleteEvent succeeded'
                );
                Alert.alert('Event deleted', '', [
                  { text: 'OK', onPress: () => navigation.goBack() },
                ]);
              } catch (err) {
                console.warn(
                  '[MealEventDetailScreen] handleMenuDeleteEvent FAILED:',
                  err
                );
                Alert.alert(
                  'Error',
                  'Failed to delete event. Please try again.'
                );
              }
            },
          },
        ]
      );
    }, 150);
  }, [detail, navigation]);

  // ── Attendee menu handlers (Sub-section 6.5) ──────────────────────────

  // Attendee #1 — Add photo to shared media
  const handleMenuAddSharedPhoto = useCallback(async () => {
    if (!detail || !currentUserId) return;
    console.warn(
      `[MealEventDetailScreen] handleMenuAddSharedPhoto started — eventId: ${detail.event.id}`
    );
    setMenuOpen(false);
    try {
      const uri = await chooseImageSource();
      if (!uri) {
        console.warn(
          '[MealEventDetailScreen] handleMenuAddSharedPhoto — user cancelled picker'
        );
        return;
      }
      const uploaded = await uploadPostImages([uri], currentUserId);
      if (uploaded.length === 0) {
        throw new Error('Upload returned no URLs');
      }
      const photoUrl = uploaded[0].url;
      const { error } = await supabase.from('meal_photos').insert({
        meal_id: detail.event.id,
        user_id: currentUserId,
        photo_url: photoUrl,
      });
      if (error) throw error;
      await loadDetail();
      console.warn(
        '[MealEventDetailScreen] handleMenuAddSharedPhoto succeeded'
      );
    } catch (err) {
      console.warn(
        '[MealEventDetailScreen] handleMenuAddSharedPhoto FAILED:',
        err
      );
      Alert.alert('Error', 'Failed to add photo');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, currentUserId]);

  // Attendee #2 — Add event comment (delegates to CommentsList)
  const handleMenuAddComment = useCallback(() => {
    if (!detail) return;
    console.warn(
      `[MealEventDetailScreen] handleMenuAddComment — navigating to CommentsList for ${detail.event.id}`
    );
    setMenuOpen(false);
    navigation.navigate('CommentsList', { postId: detail.event.id });
  }, [detail, navigation]);

  // Attendee #3 — Leave event
  const handleMenuLeaveEvent = useCallback(() => {
    if (!detail || !currentUserId) return;
    console.warn(
      `[MealEventDetailScreen] handleMenuLeaveEvent started — eventId: ${detail.event.id}`
    );
    setMenuOpen(false);
    setTimeout(() => {
      Alert.alert(
        `Leave ${detail.event.title || 'this event'}?`,
        "You'll still keep any cook posts you made for this event.",
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              console.warn(
                '[MealEventDetailScreen] handleMenuLeaveEvent — cancelled'
              );
            },
          },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from('post_participants')
                  .delete()
                  .eq('post_id', detail.event.id)
                  .eq('participant_user_id', currentUserId)
                  .eq('role', 'ate_with');
                if (error) throw error;
                console.warn(
                  '[MealEventDetailScreen] handleMenuLeaveEvent succeeded'
                );
                Alert.alert('Left event', '', [
                  { text: 'OK', onPress: () => navigation.goBack() },
                ]);
              } catch (err) {
                console.warn(
                  '[MealEventDetailScreen] handleMenuLeaveEvent FAILED:',
                  err
                );
                Alert.alert('Error', 'Failed to leave event');
              }
            },
          },
        ]
      );
    }, 150);
  }, [detail, currentUserId, navigation]);

  const handleHostPress = useCallback(() => {
    if (!detail) return;
    const chefName =
      detail.host.display_name || detail.host.username || 'Someone';
    navigation.navigate('AuthorView', { chefName });
  }, [navigation, detail]);

  const handleDishRowPress = useCallback(
    (postId: string) => {
      navigation.navigate('CookDetail', { postId });
    },
    [navigation]
  );

  const handleRatingPillPress = useCallback((postId: string) => {
    setRatingPickerOpen(prev => {
      if (prev === postId) {
        console.warn(`[MealEventDetailScreen] star picker dismissed`);
        return null;
      }
      console.warn(`[MealEventDetailScreen] star picker opened for postId: ${postId}`);
      return postId;
    });
  }, []);

  const handleRatingSelect = useCallback(
    async (postId: string, rating: number) => {
      if (!currentUserId) return;
      const prevRating = eaterRatings.get(postId);
      // Tap same rating to clear; otherwise set new rating.
      const nextRating = prevRating === rating ? null : rating;

      // Optimistic local update
      setEaterRatings(prev => {
        const next = new Map(prev);
        if (nextRating === null) next.delete(postId);
        else next.set(postId, nextRating);
        return next;
      });
      // P7N CP2 Item 5: picker stays open after selection so user can
      // verify or adjust. Dismissed via × button or tap-outside overlay.

      try {
        await upsertEaterRating(postId, currentUserId, nextRating);
        console.warn(
          `[MealEventDetailScreen] upsertEaterRating succeeded — postId: ${postId}, rating: ${nextRating}`
        );
      } catch (err) {
        console.warn(
          `[MealEventDetailScreen] upsertEaterRating FAILED — postId: ${postId}:`,
          err
        );
        // Revert on error
        setEaterRatings(prev => {
          const next = new Map(prev);
          if (prevRating == null) next.delete(postId);
          else next.set(postId, prevRating);
          return next;
        });
        Alert.alert('Error', 'Failed to update rating');
      }
    },
    [currentUserId, eaterRatings]
  );

  const handleAttendeePress = useCallback(
    (attendee: MealEventDetail['attendees'][number]) => {
      const chefName =
        attendee.display_name || attendee.username || 'Someone';
      navigation.navigate('AuthorView', { chefName });
    },
    [navigation]
  );

  const handleCommentPress = useCallback(() => {
    if (!detail) return;
    navigation.navigate('CommentsList', { postId: detail.event.id });
  }, [navigation, detail]);

  const handleLikeToggle = useCallback(async () => {
    if (!detail || !currentUserId) return;
    const wasLiked = hasLike;
    setHasLike(!wasLiked);
    setLikesCount(prev => (wasLiked ? Math.max(0, prev - 1) : prev + 1));
    try {
      if (wasLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', detail.event.id)
          .eq('user_id', currentUserId);
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: detail.event.id, user_id: currentUserId });
      }
    } catch (err) {
      setHasLike(wasLiked);
      setLikesCount(prev => (wasLiked ? prev + 1 : Math.max(0, prev - 1)));
      Alert.alert('Error', 'Failed to update like');
    }
  }, [detail, currentUserId, hasLike]);

  // ── Loading / not-found states ─────────────────────────────────────────

  if (loading && !detail) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
            <Text
              style={[styles.headerButtonText, { color: colors.primary }]}
            >
              ←
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
            Meal Event
          </Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.text.secondary }}>
            Meal event not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Derived display values ─────────────────────────────────────────────

  const hostDisplayName =
    detail.host.display_name || detail.host.username || 'Someone';

  const eventDateTime = formatEventDateTime(detail.event.meal_time);

  // Hero photo: the highlight_photo from getMealEventDetail can be a
  // string URL, an object with a `url`/`photo_url` property, or undefined.
  const heroPhotoUrl = normalizeHighlightPhotoUrl(detail.event.highlight_photo);
  const showHeroPlaceholder = !heroPhotoUrl;

  // "At the table" — dedupe cooks + attendees by user_id, with a role
  // descriptor per row. Cooks take precedence over attendees for the
  // descriptor.
  const tableRows = buildTableRows(detail, hostUserId => hostUserId);

  // Comments preview — most recent 2
  const commentsPreview = (comments || []).slice(-2);
  const commentsCount = comments?.length ?? 0;

  // Shared media visibility — absent when empty AND viewer isn't an attendee
  const showSharedMedia = detail.shared_media.length > 0 || isAttendee || isHost;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Block 1 — Header bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
          <Text
            style={[styles.headerButtonText, { color: colors.primary }]}
          >
            ←
          </Text>
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: colors.text.primary }]}
          numberOfLines={1}
        >
          {detail.event.title || 'Meal Event'}
        </Text>
        <View style={styles.headerRight}>
          {showMenuButton && (
            <TouchableOpacity
              onPress={handleMenuPress}
              style={styles.headerButton}
            >
              <Text
                style={[
                  styles.headerButtonText,
                  { color: colors.text.primary },
                ]}
              >
                •••
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
            <Text
              style={[
                styles.headerButtonText,
                { color: colors.text.primary, fontSize: 16 },
              ]}
            >
              ↗
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* P7N CP2: full-screen transparent overlay to dismiss star picker.
            Rendered inside ScrollView so zIndex works relative to the picker row. */}
        {ratingPickerOpen && (
          <Pressable
            style={styles.ratingPickerOverlay}
            onPress={() => {
              console.warn(`[MealEventDetailScreen] star picker dismissed`);
              setRatingPickerOpen(null);
            }}
          />
        )}
        {/* Block 2 — Hero photo */}
        {showHeroPlaceholder ? (
          <NoPhotoPlaceholder
            width={SCREEN_WIDTH}
            height={HERO_HEIGHT}
            colors={colors}
          />
        ) : (
          <Image
            source={{ uri: optimizeStorageUrl(heroPhotoUrl!) }}
            style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT }}
            resizeMode="cover"
          />
        )}

        {/* Block 3 — Event metadata */}
        <View style={styles.metadataBlock}>
          {editingTitle ? (
            <View style={styles.inlineEditContainer}>
              <TextInput
                style={[
                  styles.title,
                  styles.inlineEditInput,
                  { color: colors.text.primary, borderColor: colors.primary },
                ]}
                value={titleDraft}
                onChangeText={setTitleDraft}
                onBlur={handleTitleSave}
                onSubmitEditing={handleTitleSave}
                autoFocus
                returnKeyType="done"
                placeholder="Event title"
                placeholderTextColor={colors.text.tertiary}
              />
              {titleError && (
                <Text
                  style={[
                    styles.inlineEditError,
                    { color: colors.text.secondary },
                  ]}
                >
                  {titleError}
                </Text>
              )}
              <View style={styles.inlineEditActions}>
                <TouchableOpacity
                  onPress={handleTitleCancel}
                  style={styles.inlineEditButton}
                >
                  <Text
                    style={[
                      styles.inlineEditButtonText,
                      { color: colors.text.secondary },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleTitleSave}
                  style={styles.inlineEditButton}
                >
                  <Text
                    style={[
                      styles.inlineEditButtonText,
                      { color: colors.primary, fontWeight: '600' },
                    ]}
                  >
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={[styles.title, { color: colors.text.primary }]}>
              {detail.event.title || 'Meal Event'}
            </Text>
          )}
          {eventDateTime && (
            <Text
              style={[styles.metadataLine, { color: colors.text.secondary }]}
            >
              {eventDateTime}
            </Text>
          )}
          {editingLocation ? (
            <View style={styles.inlineEditContainer}>
              <TextInput
                style={[
                  styles.inlineEditInputMultiline,
                  { color: colors.text.primary, borderColor: colors.primary },
                ]}
                value={locationDraft}
                onChangeText={setLocationDraft}
                autoFocus
                placeholder="Location"
                placeholderTextColor={colors.text.tertiary}
              />
              <View style={styles.inlineEditActions}>
                <TouchableOpacity
                  onPress={handleLocationCancel}
                  style={styles.inlineEditButton}
                >
                  <Text
                    style={[
                      styles.inlineEditButtonText,
                      { color: colors.text.secondary },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleLocationSave}
                  style={styles.inlineEditButton}
                >
                  <Text
                    style={[
                      styles.inlineEditButtonText,
                      { color: colors.primary, fontWeight: '600' },
                    ]}
                  >
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            detail.event.meal_location && (
              <Text
                style={[styles.metadataLine, { color: colors.text.secondary }]}
              >
                {detail.event.meal_location}
              </Text>
            )
          )}
          <TouchableOpacity
            style={styles.hostChip}
            onPress={handleHostPress}
            activeOpacity={0.7}
          >
            <UserAvatar
              user={{ avatar_url: detail.host.avatar_url }}
              size={28}
            />
            <Text style={[styles.hostChipText, { color: colors.text.primary }]}>
              Hosted by {hostDisplayName}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Block 4 — Stats grid */}
        <View
          style={[
            styles.statsGrid,
            { backgroundColor: '#faf7ef', borderColor: colors.border.light },
          ]}
        >
          <View style={styles.statCell}>
            <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>
              Cooks
            </Text>
            <Text style={[styles.statValue, { color: colors.text.primary }]}>
              {detail.stats.unique_cooks}
            </Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>
              Dishes
            </Text>
            <Text style={[styles.statValue, { color: colors.text.primary }]}>
              {detail.stats.total_dishes}
            </Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statLabel, { color: colors.text.tertiary }]}>
              At table
            </Text>
            <Text style={[styles.statValue, { color: colors.text.primary }]}>
              {detail.stats.total_attendees}
            </Text>
          </View>
          {detail.stats.avg_rating != null && (
            <View style={styles.statCell}>
              <Text
                style={[styles.statLabel, { color: colors.text.tertiary }]}
              >
                Avg rating
              </Text>
              <Text
                style={[styles.statValue, { color: colors.text.primary }]}
              >
                ★ {detail.stats.avg_rating.toFixed(1)}
              </Text>
            </View>
          )}
        </View>

        {/* Block 5 — What everyone brought (dish rows) */}
        <View style={styles.dishesBlock}>
          <Text style={[styles.sectionHeader, { color: colors.text.primary }]}>
            What everyone brought
          </Text>
          {detail.cooks.length === 0 ? (
            <Text
              style={[styles.emptyLine, { color: colors.text.tertiary }]}
            >
              No dishes logged yet
            </Text>
          ) : (
            detail.cooks.map(cook => {
              const cookIsHost = cook.user_id === detail.host.user_id;
              const dishName =
                cook.post_title || cook.recipe_title || 'Dish';
              const cookDisplayName =
                cook.display_name || cook.username || 'Someone';
              const thumbUrl = firstPhotoUrl(cook.photos);
              const rating = eaterRatings.get(cook.post_id);
              const ratingPickerIsOpen = ratingPickerOpen === cook.post_id;
              const showRatingPill = isAttendee || isHost;

              return (
                <View key={cook.post_id} style={styles.dishRowWrap}>
                  <TouchableOpacity
                    style={styles.dishRow}
                    onPress={() => handleDishRowPress(cook.post_id)}
                    activeOpacity={0.7}
                  >
                    {thumbUrl ? (
                      <Image
                        source={{ uri: optimizeStorageUrl(thumbUrl) }}
                        style={styles.dishThumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.dishThumb,
                          {
                            backgroundColor:
                              colors.background.secondary || '#f4f4f2',
                          },
                        ]}
                      />
                    )}
                    <View style={styles.dishBody}>
                      <Text
                        style={[
                          styles.dishName,
                          { color: colors.text.primary },
                        ]}
                        numberOfLines={2}
                      >
                        {dishName}
                      </Text>
                      <View style={styles.dishAttribution}>
                        <UserAvatar
                          user={{ avatar_url: cook.avatar_url }}
                          size={18}
                        />
                        <Text
                          style={[
                            styles.dishAttributionText,
                            { color: colors.text.secondary },
                          ]}
                          numberOfLines={1}
                        >
                          {cookDisplayName}
                          {cookIsHost && (
                            <Text
                              style={{ color: colors.text.tertiary }}
                            >
                              {' '}
                              (host)
                            </Text>
                          )}
                        </Text>
                      </View>
                    </View>
                    {showRatingPill && (
                      <TouchableOpacity
                        style={[
                          styles.ratingPill,
                          {
                            borderColor:
                              rating != null
                                ? colors.primary
                                : colors.border.light,
                            backgroundColor:
                              rating != null ? '#faf7ef' : 'transparent',
                          },
                        ]}
                        onPress={() => handleRatingPillPress(cook.post_id)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.ratingPillText,
                            {
                              color:
                                rating != null
                                  ? colors.primary
                                  : colors.text.secondary,
                            },
                          ]}
                        >
                          {rating != null ? `★ ${rating}` : 'Tap to rate'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                  {ratingPickerIsOpen && showRatingPill && (
                    <>
                      <View style={styles.ratingPickerRow}>
                        {[1, 2, 3, 4, 5].map(n => (
                          <TouchableOpacity
                            key={n}
                            style={styles.ratingStarButton}
                            onPress={() =>
                              handleRatingSelect(cook.post_id, n)
                            }
                            activeOpacity={0.6}
                          >
                            <Text
                              style={[
                                styles.ratingStar,
                                {
                                  color:
                                    rating != null && n <= rating
                                      ? colors.primary
                                      : colors.text.tertiary,
                                },
                              ]}
                            >
                              ★
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Block 6 — At the table */}
        <View style={styles.tableBlock}>
          <Text style={[styles.sectionHeader, { color: colors.text.primary }]}>
            At the table
          </Text>
          {tableRows.length === 0 ? (
            <Text style={[styles.emptyLine, { color: colors.text.tertiary }]}>
              No attendees yet
            </Text>
          ) : (
            tableRows.map(row => (
              <TouchableOpacity
                key={row.key}
                style={styles.tableRow}
                onPress={() =>
                  row.attendee && handleAttendeePress(row.attendee)
                }
                activeOpacity={0.7}
              >
                <UserAvatar user={{ avatar_url: row.avatar_url }} size={32} />
                <View style={styles.tableRowBody}>
                  <Text
                    style={[
                      styles.tableRowName,
                      { color: colors.text.primary },
                    ]}
                    numberOfLines={1}
                  >
                    {row.displayName}
                  </Text>
                  <Text
                    style={[
                      styles.tableRowDescriptor,
                      { color: colors.text.tertiary },
                    ]}
                    numberOfLines={1}
                  >
                    {row.descriptor}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Block 7 — Shared media */}
        {showSharedMedia && (
          <View style={styles.sharedMediaBlock}>
            <Text
              style={[styles.sectionHeader, { color: colors.text.primary }]}
            >
              Shared media
            </Text>
            <Text style={[styles.hintLine, { color: colors.text.tertiary }]}>
              Photos shared by attendees — visible only to people at this event.
            </Text>
            {detail.shared_media.length === 0 ? (
              <Text
                style={[styles.emptyLine, { color: colors.text.tertiary }]}
              >
                No photos yet
              </Text>
            ) : (
              <View style={styles.galleryGrid}>
                {detail.shared_media.slice(0, 9).map((m, i) => (
                  <View key={m.id} style={styles.galleryThumb}>
                    <Image
                      source={{ uri: optimizeStorageUrl(m.photo_url) }}
                      style={styles.galleryThumbImage}
                      resizeMode="cover"
                    />
                  </View>
                ))}
              </View>
            )}
            {detail.shared_media.length > 9 && (
              <Text
                style={[
                  styles.gallerySeeAll,
                  { color: colors.text.secondary },
                ]}
              >
                +{detail.shared_media.length - 9} more
              </Text>
            )}
          </View>
        )}

        {/* Block 8 — About the evening (comments) */}
        <View style={styles.commentsBlock}>
          <Text style={[styles.sectionHeader, { color: colors.text.primary }]}>
            About the evening
          </Text>
          <Text style={[styles.hintLine, { color: colors.text.tertiary }]}>
            Comments about the evening — not about any specific dish.
          </Text>
          {comments === null ? (
            <ActivityIndicator size="small" color={colors.text.tertiary} />
          ) : commentsCount === 0 ? (
            <TouchableOpacity onPress={handleCommentPress} activeOpacity={0.7}>
              <Text
                style={[styles.commentsEmpty, { color: colors.text.tertiary }]}
              >
                No comments yet · be the first
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              {commentsPreview.map(c => (
                <View key={c.id} style={styles.commentRow}>
                  <Text
                    style={[styles.commentName, { color: colors.text.primary }]}
                  >
                    {c.user_name || 'Someone'}
                  </Text>
                  <Text
                    style={[styles.commentText, { color: colors.text.secondary }]}
                    numberOfLines={3}
                  >
                    {c.comment_text}
                  </Text>
                </View>
              ))}
              <TouchableOpacity
                onPress={handleCommentPress}
                style={styles.commentsSeeAll}
              >
                <Text
                  style={[styles.commentsSeeAllText, { color: colors.primary }]}
                >
                  View all {commentsCount} comment
                  {commentsCount === 1 ? '' : 's'} · add a comment
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Inline engagement bar (P7N CP2 Item 6: moved inside ScrollView) */}
        <View
          style={[
            styles.stickyBar,
            {
              backgroundColor: colors.background.card,
              borderTopColor: colors.border.light,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.stickyButton}
            onPress={handleLikeToggle}
            activeOpacity={0.7}
          >
            <Image
              source={
                hasLike
                  ? require('../assets/icons/like-outline-2-filled.png')
                  : require('../assets/icons/like-outline-2-thick.png')
              }
              style={[
                styles.stickyIcon,
                hasLike && { tintColor: functionalColors?.like || '#0d9488' },
              ]}
              resizeMode="contain"
            />
            <Text style={[styles.stickyCount, { color: colors.text.primary }]}>
              {likesCount}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stickyButton}
            onPress={handleCommentPress}
            activeOpacity={0.7}
          >
            <Image
              source={require('../assets/icons/comment.png')}
              style={[styles.stickyIcon, { tintColor: colors.text.primary }]}
              resizeMode="contain"
            />
            <Text style={[styles.stickyCount, { color: colors.text.primary }]}>
              {commentsCount}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Overflow menu bottom sheet (Sub-section 6.5). Host sees 6 items,
          attendee sees 3 items. Non-participants don't see the menu
          button at all. */}
      {menuOpen && (
        <Modal
          transparent
          animationType="fade"
          visible={menuOpen}
          onRequestClose={() => setMenuOpen(false)}
        >
          <TouchableOpacity
            style={styles.menuBackdrop}
            activeOpacity={1}
            onPress={() => setMenuOpen(false)}
          >
            <View
              style={[
                styles.menuBody,
                { backgroundColor: colors.background.card },
              ]}
            >
              {isHost && (
                <>
                  <MenuItem
                    label="Edit title"
                    onPress={handleMenuEditTitle}
                    colors={colors}
                  />
                  <MenuSeparator colors={colors} />
                  <MenuItem
                    label="Edit date/time"
                    onPress={handleMenuEditDateTime}
                    colors={colors}
                  />
                  <MenuSeparator colors={colors} />
                  <MenuItem
                    label="Edit location"
                    onPress={handleMenuEditLocation}
                    colors={colors}
                  />
                  <MenuSeparator colors={colors} />
                  <MenuItem
                    label="Edit highlight photo"
                    onPress={handleMenuEditHighlight}
                    colors={colors}
                  />
                  <MenuSeparator colors={colors} />
                  <MenuItem
                    label="Manage attendees"
                    onPress={handleMenuManageAttendees}
                    colors={colors}
                  />
                  <MenuSeparator colors={colors} />
                  <MenuItem
                    label="Delete event"
                    onPress={handleMenuDeleteEvent}
                    colors={colors}
                    destructive
                  />
                </>
              )}
              {!isHost && isAttendee && (
                <>
                  <MenuItem
                    label="Add photo to shared media"
                    onPress={handleMenuAddSharedPhoto}
                    colors={colors}
                  />
                  <MenuSeparator colors={colors} />
                  <MenuItem
                    label="Add event comment"
                    onPress={handleMenuAddComment}
                    colors={colors}
                  />
                  <MenuSeparator colors={colors} />
                  <MenuItem
                    label="Leave event"
                    onPress={handleMenuLeaveEvent}
                    colors={colors}
                    destructive
                  />
                </>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Edit date/time picker */}
      <DateTimePicker
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        onSelect={handleDateTimeSelect}
        initialDate={
          detail.event.meal_time
            ? new Date(detail.event.meal_time)
            : new Date()
        }
        mode="datetime"
      />

      {/* Manage attendees modal */}
      <AddCookingPartnersModal
        visible={manageAttendeesOpen}
        onClose={() => setManageAttendeesOpen(false)}
        onConfirm={(selectedUserIds /* , role unused in manage mode */) => {
          void handleManageAttendeesConfirm(selectedUserIds);
          setManageAttendeesOpen(false);
        }}
        currentUserId={currentUserId}
        defaultRole="ate_with"
        existingParticipantIds={detail.attendees
          .map(a => a.user_id)
          .filter((id): id is string => !!id)}
      />

      {/* Highlight photo picker */}
      {highlightPickerOpen && (
        <Modal
          transparent
          animationType="slide"
          visible={highlightPickerOpen}
          onRequestClose={() => setHighlightPickerOpen(false)}
        >
          <View style={styles.sheetBackdrop}>
            <View
              style={[
                styles.sheetBody,
                { backgroundColor: colors.background.card },
              ]}
            >
              <View style={styles.sheetHeader}>
                <Text
                  style={[styles.sheetTitle, { color: colors.text.primary }]}
                >
                  Choose highlight photo
                </Text>
                <TouchableOpacity
                  onPress={() => setHighlightPickerOpen(false)}
                  style={styles.sheetClose}
                >
                  <Text
                    style={[
                      styles.sheetCloseText,
                      { color: colors.text.primary },
                    ]}
                  >
                    ×
                  </Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.sheetScroll}>
                {(() => {
                  // Dual-pool sourcing: (a) shared_media (meal_photos) and
                  // (b) photos from linked dish posts. De-duplicated by URL.
                  const urls = new Set<string>();
                  const candidates: Array<{ url: string; source: string }> = [];
                  detail.shared_media.forEach(m => {
                    if (m.photo_url && !urls.has(m.photo_url)) {
                      urls.add(m.photo_url);
                      candidates.push({ url: m.photo_url, source: 'shared' });
                    }
                  });
                  detail.cooks.forEach(c => {
                    const raw = (c.photos as any[]) || [];
                    raw.forEach((p: any) => {
                      const u = typeof p === 'string' ? p : p?.url;
                      if (u && !urls.has(u)) {
                        urls.add(u);
                        candidates.push({ url: u, source: 'dish' });
                      }
                    });
                  });
                  if (candidates.length === 0) {
                    return (
                      <Text
                        style={[
                          styles.mealPickerEmpty,
                          { color: colors.text.tertiary },
                        ]}
                      >
                        No photos available to choose from
                      </Text>
                    );
                  }
                  return (
                    <View style={styles.highlightGrid}>
                      {candidates.map(c => (
                        <TouchableOpacity
                          key={c.url}
                          style={styles.highlightThumb}
                          onPress={() => handleHighlightSelect(c.url)}
                          activeOpacity={0.7}
                        >
                          <Image
                            source={{ uri: optimizeStorageUrl(c.url) }}
                            style={styles.highlightThumbImage}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })()}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// MENU ITEM SUBCOMPONENTS
// ============================================================================

function MenuItem({
  label,
  onPress,
  colors,
  destructive,
}: {
  label: string;
  onPress: () => void;
  colors: any;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity
      style={{ paddingHorizontal: 20, paddingVertical: 16 }}
      onPress={onPress}
    >
      <Text
        style={{
          fontSize: 16,
          color: destructive ? '#cc4444' : colors.text.primary,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function MenuSeparator({ colors }: { colors: any }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        marginHorizontal: 14,
        backgroundColor: colors.border.light,
      }}
    />
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatEventDateTime(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const weekdays = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const weekday = weekdays[d.getDay()];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${weekday}, ${month} ${day}, ${year} · ${time}`;
}

function normalizeHighlightPhotoUrl(photo: any): string | null {
  if (!photo) return null;
  if (typeof photo === 'string') return photo.trim() || null;
  if (typeof photo === 'object') {
    if (typeof photo.url === 'string' && photo.url.trim()) return photo.url;
    if (typeof photo.photo_url === 'string' && photo.photo_url.trim())
      return photo.photo_url;
  }
  return null;
}

function firstPhotoUrl(photos: any[] | undefined): string | null {
  if (!Array.isArray(photos) || photos.length === 0) return null;
  for (const p of photos) {
    if (typeof p === 'string' && p.trim()) return p;
    if (p && typeof p === 'object') {
      if (typeof p.url === 'string' && p.url.trim()) return p.url;
      if (typeof p.photo_url === 'string' && p.photo_url.trim())
        return p.photo_url;
    }
  }
  return null;
}

interface TableRow {
  key: string;
  displayName: string;
  descriptor: string;
  avatar_url?: string | null;
  attendee?: MealEventDetail['attendees'][number];
}

function buildTableRows(
  detail: MealEventDetail,
  _unused: (x: string) => string
): TableRow[] {
  const rows = new Map<string, TableRow>();

  // Host first — prefer their cook row if they have one.
  const hostId = detail.host.user_id;
  const hostCook = detail.cooks.find(c => c.user_id === hostId);
  const hostDishName =
    hostCook?.post_title || hostCook?.recipe_title || null;

  rows.set(hostId, {
    key: `host-${hostId}`,
    displayName:
      detail.host.display_name || detail.host.username || 'Host',
    descriptor: hostDishName ? `Host · cooked ${hostDishName}` : 'Host',
    avatar_url: detail.host.avatar_url,
  });

  // Other cooks
  detail.cooks.forEach(cook => {
    if (cook.user_id === hostId) return;
    if (rows.has(cook.user_id)) return;
    const dishName = cook.post_title || cook.recipe_title || 'a dish';
    rows.set(cook.user_id, {
      key: `cook-${cook.user_id}`,
      displayName: cook.display_name || cook.username || 'Someone',
      descriptor: `Cooked ${dishName}`,
      avatar_url: cook.avatar_url,
    });
  });

  // Non-cook attendees (ate_with)
  detail.attendees.forEach(a => {
    if (a.user_id && rows.has(a.user_id)) return;
    const key = a.user_id || `ext-${a.username || a.display_name || 'guest'}`;
    if (rows.has(key)) return;
    rows.set(key, {
      key,
      displayName: a.display_name || a.username || 'Guest',
      descriptor: 'Guest',
      avatar_url: a.avatar_url,
      attendee: a,
    });
  });

  return Array.from(rows.values());
}

// ============================================================================
// STYLES
// ============================================================================

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.card,
    },
    scroll: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border.light,
      backgroundColor: colors.background.card,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerButton: {
      minWidth: 40,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerButtonText: {
      fontSize: 22,
      fontWeight: '600',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 15,
      fontWeight: '600',
      marginHorizontal: 8,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    metadataBlock: {
      paddingHorizontal: 14,
      paddingTop: 16,
      paddingBottom: 10,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.2,
      lineHeight: 27,
      marginBottom: 6,
    },
    metadataLine: {
      fontSize: 13,
      marginTop: 2,
    },
    hostChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 10,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 16,
      backgroundColor: 'rgba(0,0,0,0.04)',
      alignSelf: 'flex-start',
    },
    hostChipText: {
      fontSize: 13,
      fontWeight: '500',
    },
    statsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginHorizontal: 14,
      marginVertical: 10,
      paddingVertical: 14,
      borderRadius: 8,
      borderWidth: 0.5,
    },
    statCell: {
      alignItems: 'center',
      paddingHorizontal: 6,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '500',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    sectionHeader: {
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 10,
    },
    hintLine: {
      fontSize: 12,
      fontStyle: 'italic',
      marginTop: -6,
      marginBottom: 10,
    },
    emptyLine: {
      fontSize: 13,
      fontStyle: 'italic',
      paddingVertical: 10,
    },
    dishesBlock: {
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    dishRowWrap: {
      marginBottom: 10,
    },
    dishRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    dishThumb: {
      width: 56,
      height: 56,
      borderRadius: 6,
      backgroundColor: '#f0f0f0',
    },
    dishBody: {
      flex: 1,
    },
    dishName: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 4,
    },
    dishAttribution: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dishAttributionText: {
      fontSize: 12,
      flex: 1,
    },
    ratingPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
    },
    ratingPillText: {
      fontSize: 12,
      fontWeight: '600',
    },
    ratingPickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
      marginLeft: 68,
      zIndex: 20,
    },
    ratingStarButton: {
      padding: 4,
    },
    ratingStar: {
      fontSize: 24,
    },
    ratingPickerOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 9999,
      zIndex: 10,
    },
    tableBlock: {
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
    },
    tableRowBody: {
      flex: 1,
    },
    tableRowName: {
      fontSize: 14,
      fontWeight: '600',
    },
    tableRowDescriptor: {
      fontSize: 12,
      marginTop: 2,
    },
    sharedMediaBlock: {
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    galleryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    galleryThumb: {
      width: (SCREEN_WIDTH - 28 - 12) / 3,
      aspectRatio: 1,
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: '#f0f0f0',
    },
    galleryThumbImage: {
      width: '100%',
      height: '100%',
    },
    gallerySeeAll: {
      marginTop: 8,
      fontSize: 12,
    },
    commentsBlock: {
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    commentRow: {
      paddingVertical: 6,
    },
    commentName: {
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 2,
    },
    commentText: {
      fontSize: 13,
      lineHeight: 18,
    },
    commentsEmpty: {
      fontSize: 13,
      fontStyle: 'italic',
    },
    commentsSeeAll: {
      paddingTop: 10,
    },
    commentsSeeAllText: {
      fontSize: 13,
      fontWeight: '500',
    },
    stickyBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      borderTopWidth: 0.5,
      marginTop: 12,
      height: STICKY_BAR_HEIGHT,
    },
    stickyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      padding: 8,
    },
    stickyIcon: {
      width: 28,
      height: 28,
    },
    stickyCount: {
      fontSize: 15,
      fontWeight: '600',
    },
    // Inline edit styles (Sub-section 6.5)
    inlineEditContainer: {
      marginBottom: 10,
    },
    inlineEditInput: {
      borderBottomWidth: 1,
      paddingVertical: 4,
      paddingHorizontal: 0,
    },
    inlineEditInputMultiline: {
      borderWidth: 1,
      borderRadius: 6,
      padding: 10,
      minHeight: 60,
      fontSize: 14,
      lineHeight: 20,
      textAlignVertical: 'top',
    },
    inlineEditError: {
      fontSize: 12,
      marginTop: 4,
      fontStyle: 'italic',
    },
    inlineEditActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      marginTop: 8,
    },
    inlineEditButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    inlineEditButtonText: {
      fontSize: 14,
    },
    // Overflow menu
    menuBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    menuBody: {
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingVertical: 8,
      paddingBottom: 32,
    },
    // Sheet (highlight picker)
    sheetBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheetBody: {
      maxHeight: '75%',
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingBottom: 24,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 10,
    },
    sheetTitle: {
      fontSize: 17,
      fontWeight: '700',
    },
    sheetClose: {
      padding: 4,
    },
    sheetCloseText: {
      fontSize: 28,
      fontWeight: '400',
    },
    sheetScroll: {
      paddingHorizontal: 14,
    },
    mealPickerEmpty: {
      fontSize: 14,
      textAlign: 'center',
      paddingVertical: 32,
      fontStyle: 'italic',
    },
    highlightGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    highlightThumb: {
      width: (SCREEN_WIDTH - 28 - 12) / 3,
      aspectRatio: 1,
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: '#f0f0f0',
    },
    highlightThumbImage: {
      width: '100%',
      height: '100%',
    },
  });
}
