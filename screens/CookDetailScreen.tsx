// screens/CookDetailScreen.tsx
// Phase 7I Checkpoint 5 / L6 — cook post detail screen.
//
// Every cook card in the feed taps through to this screen. 14 content
// blocks from top to bottom, plus a sticky engagement bar at the bottom.
// Pass 1 ships the full screen + all 14 blocks (or documented fallbacks).
// The overflow menu button appears on own posts with a stub onPress — the
// menu items themselves are wired in Pass 2 (Sub-section 5.3).
//
// See docs/CC_PROMPT_7I_CHECKPOINT_5_COOKDETAIL.md for the authoritative
// content spec per block. See docs/frigo_phase_7i_wireframes.html for the
// L6 wireframe companion (with modifications noted in the prompt).

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  Alert,
  Dimensions,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme/ThemeContext';
import { FeedStackParamList } from '../App';
import {
  CardHeader,
  DescriptionLine,
  RecipeLine,
  PhotoCarousel,
  CarouselPhoto,
  HighlightsPill,
  NoPhotoPlaceholder,
  optimizeStorageUrl,
} from '../components/feedCard/sharedCardElements';
import UserAvatar from '../components/UserAvatar';
// Phase 7M CP3: removed AddCookingPartnersModal import (editing via EditPostScreen)
import { fetchSingleCookCardData } from '../lib/services/cookCardDataService';
import {
  getPostParticipants,
  PostParticipant,
} from '../lib/services/postParticipantsService';
import { deletePost } from '../lib/services/postService';
import { sharePost } from '../lib/services/shareService';
import {
  getCookHistoryForUserRecipe,
  CookHistoryEntry,
} from '../lib/services/recipeHistoryService';
import {
  computeHighlightsForFeedBatch,
  Highlight,
} from '../lib/services/highlightsService';
import { getCommentsForPost, Comment } from '../lib/services/commentsService';
import type { CookCardData } from '../lib/types/feed';

type Props = NativeStackScreenProps<FeedStackParamList, 'CookDetail'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const HERO_HEIGHT = SCREEN_WIDTH * 0.75;
const STICKY_BAR_HEIGHT = 64;

// ============================================================================
// SCREEN
// ============================================================================

export default function CookDetailScreen({ route, navigation }: Props) {
  const { colors, functionalColors } = useTheme();
  const { postId, photoIndex } = route.params;

  // ── State ──────────────────────────────────────────────────────────────

  const [post, setPost] = useState<CookCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [cookPartners, setCookPartners] = useState<PostParticipant[]>([]);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [cookHistory, setCookHistory] = useState<CookHistoryEntry[]>([]);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [likesCount, setLikesCount] = useState<number>(0);
  const [hasLike, setHasLike] = useState<boolean>(false);

  // Photo viewer state
  const [heroTargetIndex, setHeroTargetIndex] = useState<number | null>(
    typeof photoIndex === 'number' ? photoIndex : null
  );
  const [historySheetOpen, setHistorySheetOpen] = useState(false);

  // Phase 7M: overflow menu (2 items: Edit post, Delete post)
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

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
      loadPostDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, postId]);

  // Phase 7I Checkpoint 5 / 5.3: refetch post data when screen regains
  // focus. Needed for the "Add photos → EditMedia → back" flow so the
  // newly-added photos surface in the hero carousel + gallery grid
  // without requiring a manual pull-to-refresh.
  // Phase 7M: refetch on every focus so edits from EditPostScreen appear
  const focusCountRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      focusCountRef.current += 1;
      if (focusCountRef.current > 1 && currentUserId) {
        console.warn('[CookDetailScreen] useFocusEffect refetch triggered');
        loadPostDetail();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUserId, postId])
  );

  const loadPostDetail = async () => {
    setLoading(true);
    try {
      // 1. Core post row + author + recipe
      const cookCard = await fetchSingleCookCardData(postId);
      if (!cookCard) {
        setPost(null);
        setLoading(false);
        return;
      }
      setPost(cookCard);
      setLoading(false); // unblock rest of UI; side-blocks hydrate async

      // 2. Secondary loads in parallel
      await Promise.all([
        // Cook partners (sous_chef, approved)
        (async () => {
          try {
            const participants = await getPostParticipants(postId);
            setCookPartners(
              participants.filter(
                p => p.role === 'sous_chef' && p.status === 'approved'
              )
            );
          } catch (e) {
            console.warn('[CookDetailScreen] getPostParticipants failed:', e);
          }
        })(),
        // Highlight — single-post call via batch function
        (async () => {
          try {
            const { postHighlights } = await computeHighlightsForFeedBatch(
              [
                {
                  id: cookCard.id,
                  user_id: cookCard.user_id,
                  recipe_id: cookCard.recipe_id ?? null,
                  created_at: cookCard.created_at,
                  times_cooked: cookCard.recipe_times_cooked ?? null,
                },
              ],
              [],
              currentUserId
            );
            const h = postHighlights.get(cookCard.id);
            setHighlight(h ?? null);
          } catch (e) {
            console.warn('[CookDetailScreen] highlight batch failed:', e);
          }
        })(),
        // Cook history — only when recipe-backed
        (async () => {
          if (!cookCard.recipe_id) return;
          try {
            const history = await getCookHistoryForUserRecipe(
              cookCard.user_id,
              cookCard.recipe_id
            );
            setCookHistory(history);
          } catch (e) {
            console.warn(
              '[CookDetailScreen] getCookHistoryForUserRecipe failed:',
              e
            );
          }
        })(),
        // Comments — fetch via the existing service, preview-only render below
        (async () => {
          try {
            const rows = await getCommentsForPost(postId);
            setComments(rows);
          } catch (e) {
            console.warn('[CookDetailScreen] getCommentsForPost failed:', e);
            setComments([]);
          }
        })(),
        // Likes count + hasLike
        (async () => {
          try {
            const { data: likeRows } = await supabase
              .from('post_likes')
              .select('user_id')
              .eq('post_id', postId);
            const rows = (likeRows || []) as Array<{ user_id: string }>;
            setLikesCount(rows.length);
            setHasLike(rows.some(r => r.user_id === currentUserId));
          } catch (e) {
            console.warn('[CookDetailScreen] likes fetch failed:', e);
          }
        })(),
      ]);
    } catch (err) {
      console.error('[CookDetailScreen] loadPostDetail failed:', err);
      setLoading(false);
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────

  const isOwnPost = !!post && post.user_id === currentUserId;
  const isRecipeBacked = !!post?.recipe_id;

  // Normalize photos the same way CookCardInner does — handle string-array
  // and object-array shapes (Checkpoint 4.5 fix applies here too).
  const normalizedPhotos: Array<{
    url: string;
    caption?: string;
    order?: number;
    is_highlight?: boolean;
  }> = useMemo(() => {
    const raw = (post?.photos as any[]) || [];
    return raw
      .map((p: any) => {
        if (typeof p === 'string') {
          return p.trim() !== '' ? { url: p } : null;
        }
        if (
          p &&
          typeof p === 'object' &&
          typeof p.url === 'string' &&
          p.url.trim() !== ''
        ) {
          return {
            url: p.url,
            caption: p.caption,
            order: p.order,
            is_highlight: p.is_highlight,
          };
        }
        return null;
      })
      .filter(
        (p: any): p is {
          url: string;
          caption?: string;
          order?: number;
          is_highlight?: boolean;
        } => p !== null
      );
  }, [post?.photos]);

  const heroCarouselPhotos: CarouselPhoto[] = useMemo(() => {
    if (normalizedPhotos.length > 0) {
      return [...normalizedPhotos]
        .sort((a, b) => {
          if (a.is_highlight) return -1;
          if (b.is_highlight) return 1;
          return (a.order ?? 0) - (b.order ?? 0);
        })
        .map(p => ({ url: p.url, caption: p.caption }));
    }
    if (post?.recipe_image_url) {
      return [{ url: post.recipe_image_url, isRecipePhoto: true }];
    }
    return [];
  }, [normalizedPhotos, post?.recipe_image_url]);

  const showHeroPlaceholder = heroCarouselPhotos.length === 0;

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleShare = useCallback(() => {
    if (!post) return;
    sharePost({
      title: postTitle,
      author_name: displayName,
      recipe_title: post.recipe_title || undefined,
    });
  }, [post, postTitle, displayName]);

  const handleMenuPress = useCallback(() => {
    setMenuOpen(true);
  }, []);

  // ── Overflow menu handlers (Phase 7M: Edit post + Delete) ──────────────
  // Phase 7M CP3: removed handleMenuAddPhotos, handleMenuEditTitle,
  // handleTitleSave, handleTitleCancel, handleMenuEditDescription,
  // handleDescriptionSave, handleDescriptionCancel, handleMenuManagePartners,
  // handleManagePartnersConfirm, handleMenuChangeMealEvent, handleSelectMealEvent.
  // All editing now flows through EditPostScreen.

  // (handleMenuAddPhotos removed — editing flows through EditPostScreen)

  // Menu item 6: Delete post — confirmation Alert.
  // Fix Pass #2 / Fix 2: the Alert was previously fired synchronously
  // after setMenuOpen(false), which on iOS races against the overflow
  // menu Modal's close animation and the native Alert silently drops.
  // setTimeout(100ms) delays the Alert past the Modal close so it always
  // appears. Also added console.warn instrumentation at every step so
  // Tom can see in Metro whether the delete is actually firing.
  const handleMenuDelete = useCallback(() => {
    if (!post) return;
    console.warn(
      `[CookDetailScreen] handleMenuDelete started — postId: ${post.id}`
    );
    setMenuOpen(false);
    // Delay so the menu Modal finishes animating out before the Alert
    // tries to mount (iOS Modal/Alert race workaround).
    setTimeout(() => {
      Alert.alert(
        'Delete this post?',
        "This can't be undone.",
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              console.warn(
                '[CookDetailScreen] handleMenuDelete — user cancelled'
              );
            },
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              console.warn(
                `[CookDetailScreen] handleMenuDelete — user confirmed, calling deletePost(${post.id})`
              );
              try {
                await deletePost(post.id);
                console.warn(
                  `[CookDetailScreen] deletePost(${post.id}) succeeded`
                );
                Alert.alert('Post deleted', '', [
                  { text: 'OK', onPress: () => navigation.goBack() },
                ]);
              } catch (err) {
                console.warn(
                  `[CookDetailScreen] deletePost(${post.id}) FAILED:`,
                  err
                );
                Alert.alert(
                  'Error',
                  'Failed to delete post. Please try again.'
                );
              }
            },
          },
        ]
      );
    }, 150);
  }, [post, navigation]);

  const handleAuthorPress = useCallback(() => {
    if (!post) return;
    const chefName =
      post.author.display_name || post.author.username || 'Someone';
    navigation.navigate('AuthorView', { chefName });
  }, [navigation, post]);

  const handleRecipePress = useCallback(() => {
    if (!post?.recipe_id) return;
    navigation.navigate('RecipeDetail', {
      recipe: { id: post.recipe_id },
    });
  }, [navigation, post?.recipe_id]);

  const handleCookPartnerPress = useCallback(
    (p: PostParticipant) => {
      const chefName =
        p.participant_profile?.display_name ||
        p.participant_profile?.username ||
        'Someone';
      navigation.navigate('AuthorView', { chefName });
    },
    [navigation]
  );

  const handleThumbnailPress = useCallback((index: number) => {
    setHeroTargetIndex(index);
    // Scroll outer ScrollView to top so the hero is visible.
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const handleHeroScrollComplete = useCallback(() => {
    setHeroTargetIndex(null);
  }, []);

  const handleLikeToggle = useCallback(async () => {
    if (!post || !currentUserId) return;
    const wasLiked = hasLike;
    // Optimistic update
    setHasLike(!wasLiked);
    setLikesCount(prev => (wasLiked ? Math.max(0, prev - 1) : prev + 1));
    try {
      if (wasLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', currentUserId);
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: post.id, user_id: currentUserId });
      }
    } catch (err) {
      // Revert on error
      setHasLike(wasLiked);
      setLikesCount(prev => (wasLiked ? prev + 1 : Math.max(0, prev - 1)));
      Alert.alert('Error', 'Failed to update like');
    }
  }, [post, currentUserId, hasLike]);

  const handleCommentPress = useCallback(() => {
    if (!post) return;
    navigation.navigate('CommentsList', { postId: post.id });
  }, [navigation, post]);

  // ── Loading / not-found states ─────────────────────────────────────────

  if (loading && !post) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
            <Text style={[styles.headerButtonText, { color: colors.primary }]}>
              ←
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
            Cook
          </Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.text.secondary }}>Post not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Derived display values ─────────────────────────────────────────────

  const displayName =
    post.author.display_name || post.author.username || 'Someone';
  const postTitle =
    post.title || post.recipe_title || 'Cooking Session';

  // Title cascade is already applied by transformToCookCardData, but keep
  // this defensive fallback for any freshly-fetched post with a null title.

  // Stats
  const cookTime = post.recipe_cook_time_min ?? 0; // aggregate (cook+prep)
  const rating = post.rating;
  const timesCooked = post.recipe_times_cooked ?? 0;

  // Full date for author block — Phase 7G: drive from cooked_at (when the
  // cook actually happened), fall back to created_at for legacy posts.
  const createdDate = new Date(post.cooked_at ?? post.created_at);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const fullDate = `${months[createdDate.getMonth()]} ${createdDate.getDate()}, ${createdDate.getFullYear()}`;
  const timeOfDay = createdDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const fullTimestamp = `${fullDate} · ${timeOfDay}`;

  // Cook history preview (2-3 most recent, excluding current if current matches)
  const historyPreview = cookHistory.slice(0, 3);
  const hasMoreHistory = cookHistory.length > 3;
  const historyBlockVisible =
    isRecipeBacked && cookHistory.length >= 2;

  // Comments preview
  const commentsPreview = (comments || []).slice(-2); // most recent 2
  const commentsCount = comments?.length ?? 0;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Block 1 — Back nav header. P7N-1C: show the post title (truncated)
          so the user knows what they're looking at, matching Strava's
          activity detail pattern. The "not found" fallback header above
          still says "Cook" because there's no post data to show. */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
          <Text style={[styles.headerButtonText, { color: colors.primary }]}>
            ←
          </Text>
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: colors.text.primary, flex: 1, textAlign: 'center' }]}
          numberOfLines={1}
        >
          {postTitle}
        </Text>
        <View style={styles.headerRight}>
          {isOwnPost && (
            <TouchableOpacity
              onPress={handleMenuPress}
              style={styles.headerButton}
            >
              <Text
                style={[styles.headerButtonText, { color: colors.text.primary }]}
              >
                •••
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
            <Text
              style={[styles.headerButtonText, { color: colors.text.primary, fontSize: 16 }]}
            >
              ↗
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Block 2 — Hero carousel */}
        {showHeroPlaceholder ? (
          <NoPhotoPlaceholder
            width={SCREEN_WIDTH}
            height={HERO_HEIGHT}
            colors={colors}
          />
        ) : (
          <PhotoCarousel
            photos={heroCarouselPhotos}
            colors={colors}
            scrollToIndex={heroTargetIndex}
            onScrollToIndexComplete={handleHeroScrollComplete}
          />
        )}

        {/* Block 3 — Author block */}
        <TouchableOpacity
          style={styles.authorBlock}
          onPress={handleAuthorPress}
          activeOpacity={0.7}
        >
          <UserAvatar
            user={{
              avatar_url: post.author.avatar_url,
              subscription_tier: post.author.subscription_tier,
            }}
            size={44}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text
              style={[styles.authorName, { color: colors.text.primary }]}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text
              style={[styles.authorMeta, { color: colors.text.tertiary }]}
              numberOfLines={1}
            >
              {fullTimestamp}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Block 4 — Post title (Phase 7M: read-only, editing via EditPostScreen) */}
        <Text style={[styles.title, { color: colors.text.primary }]}>
          {postTitle}
        </Text>

        {/* Block 5 — Description */}
        <DescriptionLine description={post.description} colors={colors} />

        {/* Block 6 — Recipe line with optional page number */}
        <RecipeLine
          recipeName={post.recipe_title || undefined}
          authorName={post.chef_name || undefined}
          isRecipeBacked={isRecipeBacked}
          onRecipePress={isRecipeBacked ? handleRecipePress : undefined}
          pageNumber={post.recipe_page_number ?? undefined}
          colors={colors}
        />

        {/* Block 7 — Cooked with row (sous_chef participants only) */}
        {cookPartners.length > 0 && (
          <View style={styles.cookedWithBlock}>
            <Text
              style={[styles.cookedWithLabel, { color: colors.text.secondary }]}
            >
              Cooked with
            </Text>
            <View style={styles.cookedWithChips}>
              {cookPartners.map(p => {
                const name =
                  p.participant_profile?.display_name ||
                  p.participant_profile?.username ||
                  p.external_name ||
                  'Someone';
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.cookedWithChip}
                    onPress={() => handleCookPartnerPress(p)}
                    activeOpacity={0.7}
                  >
                    <UserAvatar
                      user={{
                        avatar_url: p.participant_profile?.avatar_url,
                      }}
                      size={22}
                    />
                    <Text
                      style={[
                        styles.cookedWithChipText,
                        { color: colors.text.primary },
                      ]}
                    >
                      {name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Block 8 — Stats grid */}
        {(cookTime > 0 || (rating != null && rating > 0) || timesCooked > 0) && (
          <View
            style={[
              styles.statsGrid,
              { backgroundColor: '#faf7ef', borderColor: colors.border.light },
            ]}
          >
            {cookTime > 0 && (
              <View style={styles.statCell}>
                <Text
                  style={[styles.statLabel, { color: colors.text.tertiary }]}
                >
                  Cook time
                </Text>
                <Text
                  style={[styles.statValue, { color: colors.text.primary }]}
                >
                  {formatCookTime(cookTime)}
                </Text>
              </View>
            )}
            {rating != null && rating > 0 && (
              <View style={styles.statCell}>
                <Text
                  style={[styles.statLabel, { color: colors.text.tertiary }]}
                >
                  {isOwnPost ? 'Your rating' : `${displayName}'s rating`}
                </Text>
                <Text
                  style={[styles.statValue, { color: colors.text.primary }]}
                >
                  ★ {rating}
                </Text>
              </View>
            )}
            {timesCooked > 0 && (
              <View style={styles.statCell}>
                <Text
                  style={[styles.statLabel, { color: colors.text.tertiary }]}
                >
                  Times cooked
                </Text>
                <Text
                  style={[styles.statValue, { color: colors.text.primary }]}
                >
                  {timesCooked}×
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Block 9 — Highlights (pill only). The Pass 1 fix pass stripped
            the descriptive paragraph slot because it was visually redundant
            (echoed the same text as the pill). The proper longer-form
            descriptive sentence requires extending the Highlight data model
            with a `longText` field — captured as P7-81. */}
        {highlight && (
          <View style={styles.highlightsBlock}>
            <HighlightsPill
              text={highlight.text}
              viewerSide={highlight.viewerSide}
            />
          </View>
        )}

        {/* Block 10 — Modifications + notes */}
        {(post.modifications || post.notes) && (
          <View style={styles.modNotesContainer}>
            {post.modifications && (
              <View
                style={[
                  styles.modNotesBlock,
                  { backgroundColor: '#faf7ef', borderColor: colors.border.light },
                ]}
              >
                <Text
                  style={[
                    styles.modNotesHeader,
                    { color: colors.text.secondary },
                  ]}
                >
                  What I changed
                </Text>
                <Text
                  style={[
                    styles.modNotesBody,
                    { color: colors.text.primary },
                  ]}
                >
                  {post.modifications}
                </Text>
              </View>
            )}
            {post.notes && (
              <View
                style={[
                  styles.modNotesBlock,
                  { backgroundColor: '#faf7ef', borderColor: colors.border.light },
                ]}
              >
                <Text
                  style={[
                    styles.modNotesHeader,
                    { color: colors.text.secondary },
                  ]}
                >
                  Cook notes
                </Text>
                <Text
                  style={[
                    styles.modNotesBody,
                    { color: colors.text.primary },
                  ]}
                >
                  {post.notes}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Block 11 — Your history with this recipe */}
        {historyBlockVisible && (
          <View style={styles.historyBlock}>
            <Text
              style={[styles.sectionHeader, { color: colors.text.primary }]}
            >
              Your history with this recipe
            </Text>
            {historyPreview.map(h => {
              const isCurrent = h.post_id === post.id;
              return (
                <View
                  key={h.post_id}
                  style={[
                    styles.historyRow,
                    isCurrent && {
                      backgroundColor: '#faf7ef',
                      borderLeftWidth: 2,
                      borderLeftColor: colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.historyDate,
                      { color: colors.text.secondary },
                    ]}
                  >
                    {formatHistoryDate(h.cooked_at)}
                  </Text>
                  <Text
                    style={[
                      styles.historyRating,
                      { color: colors.text.primary },
                    ]}
                  >
                    {h.rating != null ? `★ ${h.rating}` : '—'}
                  </Text>
                  {isCurrent && (
                    <Text
                      style={[
                        styles.historyCurrentLabel,
                        { color: colors.primary },
                      ]}
                    >
                      this cook
                    </Text>
                  )}
                </View>
              );
            })}
            {hasMoreHistory && (
              <TouchableOpacity
                onPress={() => setHistorySheetOpen(true)}
                style={styles.historySeeAll}
              >
                <Text
                  style={[
                    styles.historySeeAllText,
                    { color: colors.primary },
                  ]}
                >
                  See all {cookHistory.length} cooks
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Block 12 — Photos gallery */}
        {normalizedPhotos.length > 0 && (
          <View style={styles.galleryBlock}>
            <Text
              style={[styles.sectionHeader, { color: colors.text.primary }]}
            >
              Photos
            </Text>
            <View style={styles.galleryGrid}>
              {normalizedPhotos.slice(0, 6).map((photo, i) => (
                <TouchableOpacity
                  key={`gallery-${i}`}
                  style={styles.galleryThumb}
                  onPress={() => handleThumbnailPress(i)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{ uri: optimizeStorageUrl(photo.url) }}
                    style={styles.galleryThumbImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </View>
            {normalizedPhotos.length > 6 && (
              <TouchableOpacity
                onPress={() => handleThumbnailPress(0)}
                style={styles.gallerySeeAll}
              >
                <Text
                  style={[
                    styles.gallerySeeAllText,
                    { color: colors.primary },
                  ]}
                >
                  View all {normalizedPhotos.length} photos
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Block 13 — Comments preview with tap-through */}
        <View style={styles.commentsBlock}>
          <Text
            style={[styles.sectionHeader, { color: colors.text.primary }]}
          >
            Comments
          </Text>
          {comments === null ? (
            <ActivityIndicator size="small" color={colors.text.tertiary} />
          ) : commentsCount === 0 ? (
            <TouchableOpacity
              onPress={handleCommentPress}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.commentsEmpty,
                  { color: colors.text.tertiary },
                ]}
              >
                No comments yet · be the first
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              {commentsPreview.map(c => (
                <View key={c.id} style={styles.commentRow}>
                  <Text
                    style={[
                      styles.commentName,
                      { color: colors.text.primary },
                    ]}
                  >
                    {c.user_name || 'Someone'}
                  </Text>
                  <Text
                    style={[
                      styles.commentText,
                      { color: colors.text.secondary },
                    ]}
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
                  style={[
                    styles.commentsSeeAllText,
                    { color: colors.primary },
                  ]}
                >
                  View all {commentsCount} comment
                  {commentsCount === 1 ? '' : 's'} · add a comment
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Block 14 — Inline engagement bar (P7N CP2 Item 6: moved inside ScrollView) */}
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
            <Text
              style={[styles.stickyCount, { color: colors.text.primary }]}
            >
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
            <Text
              style={[styles.stickyCount, { color: colors.text.primary }]}
            >
              {commentsCount}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* History "see all" sheet */}
      {historySheetOpen && (
        <Modal
          transparent
          animationType="slide"
          visible={historySheetOpen}
          onRequestClose={() => setHistorySheetOpen(false)}
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
                  All cooks of this recipe
                </Text>
                <TouchableOpacity
                  onPress={() => setHistorySheetOpen(false)}
                  style={styles.sheetClose}
                >
                  <Text
                    style={[styles.sheetCloseText, { color: colors.text.primary }]}
                  >
                    ×
                  </Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.sheetScroll}>
                {cookHistory.map(h => {
                  const isCurrent = h.post_id === post.id;
                  return (
                    <View
                      key={h.post_id}
                      style={[
                        styles.historyRow,
                        isCurrent && {
                          backgroundColor: '#faf7ef',
                          borderLeftWidth: 2,
                          borderLeftColor: colors.primary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.historyDate,
                          { color: colors.text.secondary },
                        ]}
                      >
                        {formatHistoryDate(h.cooked_at)}
                      </Text>
                      <Text
                        style={[
                          styles.historyRating,
                          { color: colors.text.primary },
                        ]}
                      >
                        {h.rating != null ? `★ ${h.rating}` : '—'}
                      </Text>
                      {isCurrent && (
                        <Text
                          style={[
                            styles.historyCurrentLabel,
                            { color: colors.primary },
                          ]}
                        >
                          this cook
                        </Text>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Overflow menu bottom sheet (Phase 7I Checkpoint 5 / 5.3).
          Six author-only menu items: Add photos, Edit title, Edit
          description, Manage cook partners, Change meal event, Delete post. */}
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
              {/* Phase 7M: 2-item overflow menu */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuOpen(false);
                  navigation.navigate('EditPost', { postId: post.id });
                }}
              >
                <Text style={[styles.menuItemText, { color: colors.text.primary }]}>
                  Edit post
                </Text>
              </TouchableOpacity>
              <View style={[styles.menuSeparator, { backgroundColor: colors.border.light }]} />
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleMenuDelete}
              >
                <Text style={[styles.menuItemText, { color: '#cc4444' }]}>
                  Delete post
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Phase 7M CP3: removed AddCookingPartnersModal + meal picker modal.
          All editing flows through EditPostScreen. */}
    </SafeAreaView>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function formatCookTime(minutes: number): string {
  if (minutes >= 60) {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }
  return `${minutes}min`;
}

function formatHistoryDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
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
      fontSize: 15,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    authorBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingTop: 16,
      paddingBottom: 10,
    },
    authorName: {
      fontSize: 17,
      fontWeight: '600',
    },
    authorMeta: {
      fontSize: 12,
      marginTop: 2,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.2,
      lineHeight: 27,
      marginHorizontal: 14,
      marginTop: 2,
      marginBottom: 8,
    },
    cookedWithBlock: {
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    cookedWithLabel: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    cookedWithChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    cookedWithChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 16,
      backgroundColor: 'rgba(0,0,0,0.04)',
    },
    cookedWithChipText: {
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
    highlightsBlock: {
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    modNotesContainer: {
      paddingHorizontal: 14,
    },
    modNotesBlock: {
      marginVertical: 6,
      padding: 12,
      borderRadius: 8,
      borderWidth: 0.5,
    },
    modNotesHeader: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    modNotesBody: {
      fontSize: 14,
      lineHeight: 20,
    },
    historyBlock: {
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    sectionHeader: {
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 10,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 4,
    },
    historyDate: {
      fontSize: 13,
      flex: 1,
    },
    historyRating: {
      fontSize: 13,
      fontWeight: '600',
    },
    historyCurrentLabel: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    historySeeAll: {
      paddingVertical: 10,
      paddingHorizontal: 10,
    },
    historySeeAllText: {
      fontSize: 13,
      fontWeight: '500',
    },
    galleryBlock: {
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
      paddingTop: 10,
    },
    gallerySeeAllText: {
      fontSize: 13,
      fontWeight: '500',
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
    // Overflow menu styles
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
    menuItem: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    menuItemText: {
      fontSize: 16,
    },
    menuSeparator: {
      height: StyleSheet.hairlineWidth,
      marginHorizontal: 14,
    },
    // Meal picker rows
    mealPickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.light,
    },
    mealPickerRowTitle: {
      fontSize: 15,
      fontWeight: '500',
    },
    mealPickerRowMeta: {
      fontSize: 12,
      marginTop: 2,
    },
    mealPickerCurrent: {
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    mealPickerEmpty: {
      fontSize: 14,
      textAlign: 'center',
      paddingVertical: 32,
      fontStyle: 'italic',
    },
  });
}
