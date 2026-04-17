// screens/FeedScreen.tsx
// Phase 7I Checkpoint 4 — cook-post-centric feed rewrite.
//
// The feed is now a list of FeedGroup objects produced by buildFeedGroups.
// Each group renders via CookCard (solo), SharedRecipeLinkedGroup
// (linked_shared_recipe), or NestedMealEventGroup (linked_meal_event).
// Meal events no longer render as feed units — they only surface as
// preheads / group headers on cook cards that link to them.
//
// PostCard, MealPostCard, LinkedPostsGroup are no longer imported here.
// They stay in the repo until Checkpoint 7 deletes them.

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useScrollToTop, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme/ThemeContext';
import CookCard from '../components/feedCard/CookCard';
import {
  MealEventPrehead,
  CookPartnerPrehead,
  SharedRecipeLinkedGroup,
  NestedMealEventGroup,
  LinkedCookStack,
} from '../components/feedCard/groupingPrimitives';
import { Logo } from '../components/branding';
import { SearchIcon, ProfileOutline, BellOutline, Messages1Outline } from '../components/icons';
import { FeedStackParamList } from '../App';
import { getPostParticipants } from '../lib/services/postParticipantsService';
import { buildFeedGroups } from '../lib/services/feedGroupingService';
import { getMealEventForCook } from '../lib/services/mealService';
import { transformToCookCardData } from '../lib/services/cookCardDataService';
import { getVibeFromTags, VibeTag } from '../lib/services/vibeService';
import {
  computeHighlightsForFeedBatch,
  Highlight,
} from '../lib/services/highlightsService';
import type {
  CookCardData,
  FeedGroup,
  MealEventContext,
} from '../lib/types/feed';

type Props = NativeStackScreenProps<FeedStackParamList, 'FeedMain'>;

// ============================================================================
// LOCAL STATE TYPES
// ============================================================================

interface Like {
  user_id: string;
  created_at: string;
  avatar_url?: string | null;
  subscription_tier?: string;
}

interface PostLikes {
  [postId: string]: {
    hasLike: boolean;
    totalCount: number;
    likes: Like[];
  };
}

interface PostComments {
  [postId: string]: number;
}

interface PostParticipants {
  [postId: string]: {
    sous_chefs: Array<{ user_id: string; username: string; avatar_url?: string | null; display_name?: string }>;
    ate_with: Array<{ user_id: string; username: string; avatar_url?: string | null; display_name?: string }>;
    hiddenSousChefs?: number;
    hiddenAteWith?: number;
  };
}

// ============================================================================
// COMPONENT
// ============================================================================
//
// Phase 7I Checkpoint 5 / 5.1.0: `transformToCookCardData` was migrated out
// of this file into `lib/services/cookCardDataService.ts` so CookDetailScreen
// can consume the same helper. The function is imported at the top of this
// file. See the new module for the full function + documentation.

export default function FeedScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [feedGroups, setFeedGroups] = useState<FeedGroup[]>([]);
  const [postById, setPostById] = useState<Map<string, CookCardData>>(new Map());
  const [postLikes, setPostLikes] = useState<PostLikes>({});
  const [postComments, setPostComments] = useState<PostComments>({});
  const [postParticipants, setPostParticipants] = useState<PostParticipants>({});
  const [postHighlights, setPostHighlights] = useState<Record<string, Highlight | null>>({});
  const [mealEventContextMap, setMealEventContextMap] = useState<
    Map<string, MealEventContext>
  >(new Map());
  const [cookPartnerPreheadMap, setCookPartnerPreheadMap] = useState<
    Map<string, { partnerName: string }>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const flatListRef = useRef<FlatList<FeedGroup>>(null);

  // Tapping the Home tab while already on the feed scrolls to top.
  // Matches the Frigo logo tap behavior in the header. React Navigation
  // walks up to the nearest tab navigator and fires this when the
  // already-focused tab is pressed again.
  useScrollToTop(flatListRef);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.card,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 6,
      backgroundColor: colors.background.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      position: 'relative',
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerCenter: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'box-none',
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconButton: {
      padding: 8,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background.card,
    },
    content: {
      flex: 1,
      // Grey background shows through the 8px marginBottom gaps between
      // CardWrapper instances so stacked solo cards have a visible separator
      // instead of butting against each other on a white field.
      backgroundColor: colors.background.primary,
    },
    listContent: {
      paddingBottom: 20,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyEmoji: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 22,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 16,
      color: colors.text.secondary,
      textAlign: 'center',
      lineHeight: 24,
    },
  }), [colors]);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadFeed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // Phase 7M: refetch feed when returning from detail screens after edits.
  // Only refetch if the last loadFeed was more than 5 seconds ago to avoid
  // unnecessary refetches on tab switches.
  const lastFeedLoadRef = useRef<number>(Date.now());
  useFocusEffect(
    useCallback(() => {
      const elapsed = Date.now() - lastFeedLoadRef.current;
      if (elapsed > 5000 && currentUserId) {
        console.warn(`[FeedScreen] useFocusEffect stale refetch (${Math.round(elapsed / 1000)}s elapsed)`);
        loadFeed();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUserId])
  );

  // Feed cap telemetry — one-shot log per feed load (P7-44 sizing signal).
  // Phase 7G: uses cooked_at (not created_at) because that's the new feed
  // sort key. "Oldest post" now means "earliest cook date in the current
  // feed window," which is the sizing signal we actually want.
  useEffect(() => {
    if (feedGroups.length === 0) return;
    const allPosts = feedGroups.flatMap(g => g.posts);
    if (allPosts.length === 0) return;
    const dateKey = (p: CookCardData) => p.cooked_at ?? p.created_at;
    const oldestPost = allPosts.reduce(
      (oldest, p) =>
        new Date(dateKey(p)).getTime() < new Date(dateKey(oldest)).getTime()
          ? p
          : oldest,
      allPosts[0]
    );
    console.log(
      '[FEED_CAP_TELEMETRY]',
      'groups:', feedGroups.length,
      'total posts:', allPosts.length,
      'oldest post date:', dateKey(oldestPost)
    );
  }, [feedGroups]);

  const loadCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  // ─── Feed load ──────────────────────────────────────────────────────────

  const loadFeed = async () => {
    console.time('[FeedScreen] loadFeed');
    try {
      // Follows
      console.time('[FeedScreen] loadFollows');
      const { data: followedUserIds } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId);
      const followedIds = followedUserIds?.map(f => f.following_id) || [];
      const allUserIds = [...followedIds, currentUserId]; // include own posts
      setFollowingIds(followedIds);
      console.timeEnd('[FeedScreen] loadFollows');

      // Dish posts → CookCardData[]
      console.time('[FeedScreen] loadDishPosts');
      const cookCards = await loadDishPosts(allUserIds);
      console.timeEnd('[FeedScreen] loadDishPosts');

      // Group via buildFeedGroups
      console.time('[FeedScreen] buildFeedGroups');
      const groups = await buildFeedGroups(cookCards, currentUserId, followedIds);
      console.timeEnd('[FeedScreen] buildFeedGroups');

      // Build postById lookup once per load
      const lookupMap = new Map<string, CookCardData>();
      for (const g of groups) {
        for (const p of g.posts) {
          lookupMap.set(p.id, p);
        }
      }

      // Hydrate engagement for the flat list of post IDs
      console.time('[FeedScreen] hydrateEngagement');
      const allPostIds = Array.from(lookupMap.keys());
      await Promise.all([
        (async () => {
          try {
            const { postHighlights: ph } = await computeHighlightsForFeedBatch(
              cookCards.map(p => ({
                id: p.id,
                user_id: p.user_id,
                recipe_id: p.recipe_id ?? null,
                created_at: p.created_at,
                times_cooked: p.recipe_times_cooked ?? null,
              })),
              [], // no meals in the feed anymore
              currentUserId
            );
            setPostHighlights(Object.fromEntries(ph));
          } catch (hErr) {
            console.error('Error computing feed highlights:', hErr);
          }
        })(),
        ...(allPostIds.length > 0
          ? [
              loadLikesForPosts(allPostIds),
              loadCommentsForPosts(allPostIds),
              loadParticipantsForPosts(allPostIds, lookupMap),
            ]
          : []),
      ]);
      console.timeEnd('[FeedScreen] hydrateEngagement');

      // Pre-fetch prehead context
      console.time('[FeedScreen] prefetchPreheadContext');
      const { mealEventCtxMap, cookPartnerMap } = await prefetchPreheadContext(
        groups,
        cookCards
      );
      console.timeEnd('[FeedScreen] prefetchPreheadContext');

      setPostById(lookupMap);
      setMealEventContextMap(mealEventCtxMap);
      setCookPartnerPreheadMap(cookPartnerMap);
      setFeedGroups(groups);
    } catch (err) {
      console.error('Error loading feed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      console.timeEnd('[FeedScreen] loadFeed');
      lastFeedLoadRef.current = Date.now();
    }
  };

  // ─── Dish post fetch + denormalization ─────────────────────────────────

  const loadDishPosts = async (userIds: string[]): Promise<CookCardData[]> => {
    // Phase 7I Checkpoint 4: removed `.is('parent_meal_id', null)` filter.
    // Meal-attached dishes now return to the feed as first-class items
    // with a MealEventPrehead / MealEventGroupHeader above them.
    const { data: postsData, error } = await supabase
      .from('posts')
      .select(
        'id, user_id, title, rating, cooking_method, created_at, cooked_at, photos, recipe_id, modifications, description, notes, post_type, parent_meal_id'
      )
      .in('user_id', userIds)
      .or('post_type.eq.dish,post_type.is.null')
      .or('visibility.eq.everyone,visibility.eq.followers,visibility.is.null')
      .order('cooked_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    if (!postsData || postsData.length === 0) return [];

    // Profiles lookup
    const userProfileIds = [...new Set(postsData.map(p => p.user_id))];
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, subscription_tier')
      .in('id', userProfileIds);
    const profilesMap = new Map((profiles || []).map(p => [p.id, p]));

    // Recipes lookup
    const recipeIds = postsData
      .map(p => p.recipe_id)
      .filter((id): id is string => id !== null);
    let recipesData: any[] = [];
    if (recipeIds.length > 0) {
      const { data } = await supabase
        .from('recipes')
        .select(
          'id, title, image_url, cook_time_min, prep_time_min, cuisine_types, vibe_tags, times_cooked, page_number, chefs(name)'
        )
        .in('id', recipeIds);
      recipesData = data || [];
    }
    const recipesMap = new Map(recipesData.map(r => [r.id, r]));

    return transformToCookCardData(postsData, profilesMap, recipesMap);
  };

  // ─── Prehead context pre-fetch ─────────────────────────────────────────
  //
  // Builds two maps so renderFeedItem can do a synchronous lookup:
  //   1. mealEventCtxMap:  parent_meal_id → MealEventContext (for L4/L5 headers)
  //   2. cookPartnerMap:   post_id → { partnerName } (for L3a preheads)
  //
  // L3a rule: a post qualifies for a CookPartnerPrehead when it has at least
  // one approved sous_chef participant whose user_id is NOT the author of any
  // other post in the current feed batch. (If the partner IS in the batch,
  // buildFeedGroups already formed an L3b linked group or the two posts will
  // render separately via P7-68 degradation — either way, no prehead.)

  const prefetchPreheadContext = async (
    groups: FeedGroup[],
    allCookCards: CookCardData[]
  ): Promise<{
    mealEventCtxMap: Map<string, MealEventContext>;
    cookPartnerMap: Map<string, { partnerName: string }>;
  }> => {
    const mealEventCtxMap = new Map<string, MealEventContext>();
    const cookPartnerMap = new Map<string, { partnerName: string }>();

    // --- Meal event contexts -----------------------------------------------
    // Collect unique parent_meal_id values. Solo groups with a parent_meal_id
    // need an L4 prehead; linked_meal_event groups need the header context.
    const mealEventIdToSamplePostId = new Map<string, string>();
    for (const g of groups) {
      for (const p of g.posts) {
        if (p.parent_meal_id && !mealEventIdToSamplePostId.has(p.parent_meal_id)) {
          mealEventIdToSamplePostId.set(p.parent_meal_id, p.id);
        }
      }
    }
    // Naive parallel fetch — profiled below in SESSION_LOG telemetry.
    if (mealEventIdToSamplePostId.size > 0) {
      const results = await Promise.all(
        Array.from(mealEventIdToSamplePostId.entries()).map(
          async ([mealEventId, samplePostId]) => {
            try {
              const ctx = await getMealEventForCook(samplePostId);
              return ctx ? ([mealEventId, ctx] as const) : null;
            } catch (e) {
              console.warn('Error fetching meal event context:', mealEventId, e);
              return null;
            }
          }
        )
      );
      for (const entry of results) {
        if (entry) mealEventCtxMap.set(entry[0], entry[1]);
      }
    }

    // --- Cook-partner prehead state ---------------------------------------
    // Only solo groups need this — if a group is linked_shared_recipe or
    // linked_meal_event, the partner surfaces through the linked-group render
    // path, not through a standalone prehead.
    const soloPostIds = groups
      .filter(g => g.type === 'solo')
      .map(g => g.posts[0].id);
    if (soloPostIds.length > 0) {
      const authorIdsInBatch = new Set(allCookCards.map(p => p.user_id));
      const { data: susChefRows } = await supabase
        .from('post_participants')
        .select(
          `post_id, participant_user_id,
           participant_profile:user_profiles!participant_user_id (
             id, username, display_name
           )`
        )
        .in('post_id', soloPostIds)
        .eq('role', 'sous_chef')
        .eq('status', 'approved');

      for (const row of (susChefRows || []) as any[]) {
        const partnerUid = row.participant_user_id;
        if (!partnerUid) continue;
        // Skip if the partner is ALSO in the feed batch — linked group path
        // will handle (or P7-68 degraded them both to solo cards already).
        if (authorIdsInBatch.has(partnerUid)) continue;
        // First matching partner wins — L3a shows one partner name
        if (cookPartnerMap.has(row.post_id)) continue;
        const prof = row.participant_profile;
        const partnerName =
          prof?.display_name || prof?.username || 'a friend';
        cookPartnerMap.set(row.post_id, { partnerName });
      }
    }

    return { mealEventCtxMap, cookPartnerMap };
  };

  // ─── Engagement loaders (mostly unchanged from pre-rewrite) ────────────

  const loadLikesForPosts = async (postIds: string[]) => {
    try {
      const { data: likesData, error } = await supabase
        .from('post_likes')
        .select('post_id, user_id, created_at')
        .in('post_id', postIds)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const likerUserIds = [...new Set(likesData?.map(l => l.user_id) || [])];
      let likerProfiles: Map<
        string,
        { avatar_url?: string | null; subscription_tier?: string }
      > = new Map();
      if (likerUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, avatar_url, subscription_tier')
          .in('id', likerUserIds);
        likerProfiles = new Map(
          profiles?.map(p => [
            p.id,
            { avatar_url: p.avatar_url, subscription_tier: p.subscription_tier },
          ]) || []
        );
      }

      const likesMap: PostLikes = {};
      postIds.forEach(postId => {
        const postLikesList = likesData?.filter(l => l.post_id === postId) || [];
        likesMap[postId] = {
          hasLike: postLikesList.some(l => l.user_id === currentUserId),
          totalCount: postLikesList.length,
          likes: postLikesList.map(l => ({
            user_id: l.user_id,
            created_at: l.created_at,
            avatar_url: likerProfiles.get(l.user_id)?.avatar_url || null,
            subscription_tier: likerProfiles.get(l.user_id)?.subscription_tier,
          })),
        };
      });
      setPostLikes(likesMap);
    } catch (error) {
      console.error('Error loading likes:', error);
    }
  };

  const loadCommentsForPosts = async (postIds: string[]) => {
    try {
      const { data: commentsData, error } = await supabase
        .from('post_comments')
        .select('post_id')
        .in('post_id', postIds);
      if (error) throw error;

      const commentsMap: PostComments = {};
      postIds.forEach(postId => {
        commentsMap[postId] = commentsData?.filter(c => c.post_id === postId).length || 0;
      });
      setPostComments(commentsMap);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const loadParticipantsForPosts = async (
    postIds: string[],
    postLookup: Map<string, CookCardData>
  ) => {
    try {
      const participantsMap: PostParticipants = {};

      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId);
      const followingIdsSet = new Set(followingData?.map(f => f.following_id) || []);

      await Promise.all(
        postIds.map(async postId => {
          const participants = await getPostParticipants(postId);
          const post = postLookup.get(postId);
          const postCreatorId = post?.user_id;

          const approvedParticipants = participants.filter(p => p.status === 'approved');

          const visibleParticipants = approvedParticipants.filter(p => {
            const participantId = p.participant_user_id;
            if (participantId === currentUserId || postCreatorId === currentUserId) {
              return true;
            }
            const followsCreator = followingIdsSet.has(postCreatorId || '');
            const followsParticipant = followingIdsSet.has(participantId);
            return followsCreator && followsParticipant;
          });

          const hiddenCount = {
            sous_chef: approvedParticipants.filter(
              p =>
                p.role === 'sous_chef' &&
                !visibleParticipants.find(
                  vp => vp.participant_user_id === p.participant_user_id
                )
            ).length,
            ate_with: approvedParticipants.filter(
              p =>
                p.role === 'ate_with' &&
                !visibleParticipants.find(
                  vp => vp.participant_user_id === p.participant_user_id
                )
            ).length,
          };

          participantsMap[postId] = {
            sous_chefs: visibleParticipants
              .filter(p => p.role === 'sous_chef')
              .map(p => ({
                user_id: p.participant_user_id,
                username: p.participant_profile?.username || 'Unknown',
                avatar_url: p.participant_profile?.avatar_url || null,
                display_name: p.participant_profile?.display_name,
              })),
            ate_with: visibleParticipants
              .filter(p => p.role === 'ate_with')
              .map(p => ({
                user_id: p.participant_user_id,
                username: p.participant_profile?.username || 'Unknown',
                avatar_url: p.participant_profile?.avatar_url || null,
                display_name: p.participant_profile?.display_name,
              })),
            hiddenSousChefs: hiddenCount.sous_chef,
            hiddenAteWith: hiddenCount.ate_with,
          };
        })
      );
      setPostParticipants(participantsMap);
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  // ─── Like toggle ────────────────────────────────────────────────────────

  const toggleLike = async (postId: string) => {
    try {
      const isCurrentlyLiked = postLikes[postId]?.hasLike;

      if (isCurrentlyLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUserId);
        setPostLikes(prev => ({
          ...prev,
          [postId]: {
            hasLike: false,
            totalCount: Math.max(0, (prev[postId]?.totalCount || 1) - 1),
            likes: prev[postId]?.likes.filter(l => l.user_id !== currentUserId) || [],
          },
        }));
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: currentUserId });
        const { data: currentUserProfile } = await supabase
          .from('user_profiles')
          .select('avatar_url, subscription_tier')
          .eq('id', currentUserId)
          .single();
        setPostLikes(prev => ({
          ...prev,
          [postId]: {
            hasLike: true,
            totalCount: (prev[postId]?.totalCount || 0) + 1,
            likes: [
              ...(prev[postId]?.likes || []),
              {
                user_id: currentUserId,
                created_at: new Date().toISOString(),
                avatar_url: currentUserProfile?.avatar_url || null,
                subscription_tier: currentUserProfile?.subscription_tier,
              },
            ],
          },
        }));
      }
    } catch (err) {
      console.error('Error toggling like:', err);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadFeed();
  };

  const formatLikesText = (postId: string) => {
    const likeData = postLikes[postId];
    if (!likeData || likeData.totalCount === 0) return undefined;
    const { hasLike, totalCount } = likeData;
    if (hasLike) {
      if (totalCount === 1) {
        return 'You gave yas chef';
      }
      return `You and ${totalCount - 1} other${totalCount - 1 !== 1 ? 's' : ''} gave yas chef`;
    }
    return `${totalCount} gave yas chef${totalCount !== 1 ? 's' : ''}`;
  };

  // ─── Render helpers ────────────────────────────────────────────────────

  const buildLikeData = useCallback(
    (postId: string) => {
      const likeRow = postLikes[postId];
      const commentCount = postComments[postId] || 0;
      const likesText = formatLikesText(postId);
      return {
        hasLike: likeRow?.hasLike || false,
        likesText,
        commentCount,
        likes: likeRow?.likes || [],
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [postLikes, postComments]
  );

  const resolveVibeForPost = useCallback(
    (postId: string): VibeTag | null => {
      const p = postById.get(postId);
      if (!p) return null;
      return getVibeFromTags(p.recipe_vibe_tags ?? undefined);
    },
    [postById]
  );

  const postTitleFor = useCallback(
    (postId: string): string => postById.get(postId)?.title || 'Post',
    [postById]
  );

  const navigateToCookDetail = useCallback(
    (postId: string, photoIndex?: number) => {
      // Phase 7I Checkpoint 5 / 5.4: routes to CookDetailScreen (L6).
      // `photoIndex` is optional — when set, CookDetailScreen's hero
      // carousel mounts scrolled to that slide. Future D49 renderer
      // dish-row taps will pass photoIndex; card-body taps pass undefined.
      navigation.navigate('CookDetail', { postId, photoIndex });
    },
    [navigation]
  );

  const navigateToRecipeDetail = useCallback(
    (recipeId: string) => {
      navigation.navigate('RecipeDetail', { recipe: { id: recipeId } });
    },
    [navigation]
  );

  const navigateToAuthor = useCallback(
    (chefName: string) => {
      navigation.navigate('AuthorView', { chefName });
    },
    [navigation]
  );

  const navigateToComments = useCallback(
    (postId: string) => {
      navigation.navigate('CommentsList', { postId });
    },
    [navigation]
  );

  const navigateToYasChefs = useCallback(
    (postId: string) => {
      navigation.navigate('YasChefsList', {
        postId,
        postTitle: postTitleFor(postId),
      });
    },
    [navigation, postTitleFor]
  );

  const navigateToMealEvent = useCallback(
    (mealEventId: string) => {
      navigation.navigate('MealEventDetail', { mealEventId });
    },
    [navigation]
  );

  const handleCardMenu = useCallback((postId: string) => {
    // Checkpoint 5 will wire this to the real overflow menu.
    console.log('[FeedScreen] Card menu tapped for post:', postId);
  }, []);

  const handleLogoTap = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  // ─── Render item dispatch ──────────────────────────────────────────────

  const renderFeedItem = ({ item: group }: { item: FeedGroup }) => {
    try {
      if (group.type === 'solo') {
        const post = group.posts[0];
        const mealEventCtx = post.parent_meal_id
          ? mealEventContextMap.get(post.parent_meal_id)
          : undefined;
        const cookPartnerCtx = cookPartnerPreheadMap.get(post.id);

        return (
          <View>
            {mealEventCtx && (
              <MealEventPrehead
                mealEvent={mealEventCtx}
                onPress={() => navigateToMealEvent(mealEventCtx.id)}
              />
            )}
            {!mealEventCtx && cookPartnerCtx && (
              <CookPartnerPrehead partnerName={cookPartnerCtx.partnerName} />
            )}
            <CookCard
              post={post}
              currentUserId={currentUserId}
              highlight={postHighlights[post.id] || null}
              vibe={resolveVibeForPost(post.id)}
              likeData={buildLikeData(post.id)}
              onPress={() => navigateToCookDetail(post.id)}
              onLike={() => toggleLike(post.id)}
              onComment={() => navigateToComments(post.id)}
              onMenu={() => handleCardMenu(post.id)}
              onRecipePress={navigateToRecipeDetail}
              onChefPress={navigateToAuthor}
              onViewLikes={() => navigateToYasChefs(post.id)}
            />
          </View>
        );
      }

      if (group.type === 'linked_shared_recipe') {
        return (
          <SharedRecipeLinkedGroup
            posts={group.posts}
            currentUserId={currentUserId}
            showLinkingHeader={true}
            getLikeDataForPost={buildLikeData}
            getHighlightForPost={postId => postHighlights[postId] || null}
            getVibeForPost={resolveVibeForPost}
            onCardPress={navigateToCookDetail}
            onRecipePress={navigateToRecipeDetail}
            onChefPress={navigateToAuthor}
            onCardMenu={handleCardMenu}
            onCardLike={toggleLike}
            onCardComment={navigateToComments}
            onCardViewLikes={navigateToYasChefs}
          />
        );
      }

      if (group.type === 'linked_meal_event') {
        const firstPost = group.posts[0];
        const mealEventCtx = firstPost.parent_meal_id
          ? mealEventContextMap.get(firstPost.parent_meal_id)
          : undefined;

        if (!mealEventCtx) {
          // Defensive fallback — should not happen after prefetch
          console.warn(
            '[FeedScreen] linked_meal_event group without mealEventContext',
            group.id
          );
          return (
            <LinkedCookStack
              posts={group.posts}
              currentUserId={currentUserId}
              getLikeDataForPost={buildLikeData}
              getHighlightForPost={postId => postHighlights[postId] || null}
              getVibeForPost={resolveVibeForPost}
              onCardPress={navigateToCookDetail}
              onRecipePress={navigateToRecipeDetail}
              onChefPress={navigateToAuthor}
              onCardMenu={handleCardMenu}
              onCardLike={toggleLike}
              onCardComment={navigateToComments}
              onCardViewLikes={navigateToYasChefs}
            />
          );
        }

        return (
          <NestedMealEventGroup
            mealEventContext={mealEventCtx}
            subUnits={group.subUnits ?? [{ kind: 'solo', posts: group.posts }]}
            currentUserId={currentUserId}
            getLikeDataForPost={buildLikeData}
            getHighlightForPost={postId => postHighlights[postId] || null}
            getVibeForPost={resolveVibeForPost}
            onCardPress={navigateToCookDetail}
            onRecipePress={navigateToRecipeDetail}
            onChefPress={navigateToAuthor}
            onCardMenu={handleCardMenu}
            onCardLike={toggleLike}
            onCardComment={navigateToComments}
            onCardViewLikes={navigateToYasChefs}
            onGroupHeaderPress={() => navigateToMealEvent(mealEventCtx.id)}
          />
        );
      }

      console.warn('[FeedScreen] Unknown FeedGroup type:', (group as any).type);
      return null;
    } catch (err) {
      console.error('❌ ERROR RENDERING FEED ITEM:', err);
      setError(`Error rendering feed item: ${err}`);
      return null;
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Logo size="large" />
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={colors.background.card} barStyle="dark-content" />
      {/* Header */}
      <View style={styles.header}>
        {/* Left — Profile + Search */}
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <ProfileOutline size={23} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('UserSearch')}
          >
            <SearchIcon size={23} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Center — Logo (absolutely positioned). 4.6.1: tap to scroll to top.
            Outer View uses pointerEvents='box-none' (on headerCenter style) so
            it doesn't block taps on the profile/search/bell siblings; the
            inner TouchableOpacity is the actual hit target for the logo. */}
        <View style={styles.headerCenter}>
          <TouchableOpacity onPress={handleLogoTap} activeOpacity={0.8}>
            <View style={{ transform: [{ scale: 0.75 }] }}>
              <Logo size="small" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Right — Messages + Bell */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              console.log('Messages pressed');
            }}
          >
            <Messages1Outline size={35} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('PendingApprovals')}
          >
            <BellOutline size={23} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {feedGroups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🍽️</Text>
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptyText}>
              Follow some people to see their cooking activity!
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={feedGroups}
            keyExtractor={group => group.id}
            renderItem={renderFeedItem}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
              />
            }
            contentContainerStyle={styles.listContent}
            initialNumToRender={5}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
