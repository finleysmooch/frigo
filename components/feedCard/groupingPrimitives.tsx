// components/feedCard/groupingPrimitives.tsx
// Phase 7I Checkpoint 3 + 3.5 — grouping primitives that wrap CookCard to
// render L3a / L3b / L4 / L5 wireframe states plus the Checkpoint 3.5
// shared-recipe merged-group pattern (L3b same-recipe + L5 sub-merge).
//
//   L3a                — CookPartnerPrehead above a solo CookCard
//   L3b (different rec)— LinkedCookStack, 2+ cards, no header (DEFERRED P7-68)
//   L3b (same recipe)  — SharedRecipeLinkedGroup with linking header on top
//   L4                 — MealEventPrehead above a solo CookCard
//   L5                 — LinkedCookStack, 2+ cards, MealEventGroupHeader
//   L5.5 (nested)      — LinkedCookStack where one or more sub-units use
//                        SharedRecipeLinkedGroup inline (no secondary
//                        linking header — meal event header serves context)
//
// Checkpoint 3.5 key refactor: linked groups now render under a SINGLE outer
// CardWrapper so stacked content reads as one continuous card with hairline
// dividers between sub-sections instead of full gray gaps between separate
// cards. LinkedCookStack uses CookCardInner internally and passes hairlines
// between consecutive renders.
//
// No direct DB access here — all data comes via props. Checkpoint 4's
// FeedScreen assembles the right prehead / header / sub-unit renderer based
// on FeedGroup.type and FeedGroup.subUnits from buildFeedGroups.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import FriendsIcon from '../icons/recipe/FriendsIcon';
import CookCard, {
  CookCardInner,
  CookCardProps,
} from './CookCard';
import {
  CookCardData,
  MealEventContext,
  FeedGroupSubUnit,
} from '../../lib/types/feed';
import {
  CardWrapper,
  PhotoCarousel,
  CarouselPhoto,
  HighlightSpec,
} from './sharedCardElements';
import { VibeTag } from '../../lib/services/vibeService';

// ============================================================================
// PREHEAD — shared visual primitive for L3a and L4
// ============================================================================

function PreheadRow({
  children,
  onPress,
  colors,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  colors: any;
}) {
  const body = (
    <View style={preheadStyles.container}>
      <View style={{ marginTop: 0.5 }}>
        <FriendsIcon size={12} color={colors.text.tertiary} />
      </View>
      <Text
        style={[preheadStyles.text, { color: colors.text.tertiary }]}
        numberOfLines={1}
      >
        {children}
      </Text>
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
        {body}
      </TouchableOpacity>
    );
  }
  return body;
}

const preheadStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  text: {
    fontSize: 11,
    flex: 1,
  },
});

// ============================================================================
// MealEventPrehead (L4)
// ============================================================================

export interface MealEventPreheadProps {
  mealEvent: MealEventContext;
  onPress?: () => void;
}

export function MealEventPrehead({
  mealEvent,
  onPress,
}: MealEventPreheadProps) {
  const { colors } = useTheme();
  const hostName =
    mealEvent.host_display_name || mealEvent.host_username || 'someone';
  return (
    <PreheadRow onPress={onPress} colors={colors}>
      at <Text style={{ fontWeight: '600' }}>{mealEvent.title}</Text> ·{' '}
      {hostName}
    </PreheadRow>
  );
}

// ============================================================================
// CookPartnerPrehead (L3a)
// ============================================================================

export interface CookPartnerPreheadProps {
  partnerName: string;
}

export function CookPartnerPrehead({ partnerName }: CookPartnerPreheadProps) {
  const { colors } = useTheme();
  return (
    <PreheadRow colors={colors}>
      cooking with <Text style={{ fontWeight: '600' }}>{partnerName}</Text>
    </PreheadRow>
  );
}

// ============================================================================
// MealEventGroupHeader (L5)
// ============================================================================

export interface MealEventGroupHeaderProps {
  mealEvent: MealEventContext;
  onPress?: () => void;
}

export function MealEventGroupHeader({
  mealEvent,
  onPress,
}: MealEventGroupHeaderProps) {
  const { colors } = useTheme();
  const hostName =
    mealEvent.host_display_name || mealEvent.host_username || 'someone';

  const metaParts: string[] = [hostName];
  if (mealEvent.meal_time) {
    metaParts.push(formatShortDate(mealEvent.meal_time));
  }
  if (mealEvent.total_contributor_count > 0) {
    metaParts.push(
      `${mealEvent.total_contributor_count} ${mealEvent.total_contributor_count === 1 ? 'cook' : 'cooks'}`
    );
  }
  const meta = metaParts.join(' · ');

  const body = (
    <View
      style={[
        groupHeaderStyles.container,
        { backgroundColor: colors.background.card },
      ]}
    >
      <Text
        style={[groupHeaderStyles.title, { color: colors.text.primary }]}
        numberOfLines={1}
      >
        {mealEvent.title}
      </Text>
      <Text
        style={[groupHeaderStyles.meta, { color: colors.text.tertiary }]}
        numberOfLines={1}
      >
        {meta}
      </Text>
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
        {body}
      </TouchableOpacity>
    );
  }
  return body;
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  } catch {
    return '';
  }
}

const groupHeaderStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  meta: {
    fontSize: 11,
    marginTop: 2,
  },
});

// ============================================================================
// LinkingHeader (Checkpoint 3.5) — used by standalone SharedRecipeLinkedGroup
// ============================================================================

/**
 * "Tom cooked with Anthony · Apr 14" header rendered at the top of a
 * standalone (non-meal-event) shared-recipe merged group. Omitted when the
 * group is nested inside a meal event (the meal event header provides
 * context — a second header would be redundant).
 */
function LinkingHeader({
  primaryAuthorName,
  otherAuthorNames,
  timestamp,
  colors,
}: {
  primaryAuthorName: string;
  otherAuthorNames: string[];
  timestamp: string;
  colors: any;
}) {
  const title = (() => {
    if (otherAuthorNames.length === 0) return `${primaryAuthorName} cooked`;
    if (otherAuthorNames.length === 1)
      return `${primaryAuthorName} cooked with ${otherAuthorNames[0]}`;
    if (otherAuthorNames.length === 2)
      return `${primaryAuthorName} cooked with ${otherAuthorNames[0]} and ${otherAuthorNames[1]}`;
    return `${primaryAuthorName} cooked with ${otherAuthorNames.slice(0, -1).join(', ')}, and ${otherAuthorNames[otherAuthorNames.length - 1]}`;
  })();

  return (
    <View
      style={[
        groupHeaderStyles.container,
        { backgroundColor: colors.background.card },
      ]}
    >
      <Text
        style={[groupHeaderStyles.title, { color: colors.text.primary }]}
        numberOfLines={2}
      >
        {title}
      </Text>
      <Text
        style={[groupHeaderStyles.meta, { color: colors.text.tertiary }]}
        numberOfLines={1}
      >
        {formatShortDate(timestamp)}
      </Text>
    </View>
  );
}

// ============================================================================
// SubSectionDivider (Checkpoint 3.5) — hairline between sub-sections
// ============================================================================

function SubSectionDivider({ colors }: { colors: any }) {
  return (
    <View
      style={{
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.light,
        marginTop: 6,
        marginBottom: 0,
      }}
    />
  );
}

// ============================================================================
// LinkedCookStack (L3b different-recipe + L5 different-recipe)
// ============================================================================
//
// Checkpoint 3.5 refactor: uses a single outer CardWrapper, CookCardInner
// internally, and hairline dividers between consecutive cook sub-sections.
// The left gutter connector is retained via borderLeftWidth on an inner
// indent container spanning from below the header to the last section.
//
// For an L5 meal event that contains shared-recipe sub-groups, use
// NestedMealEventGroup (below) instead — it iterates `subUnits` rather than
// raw posts.

export interface LinkedCookStackProps {
  posts: CookCardData[];
  currentUserId: string;
  mealEventContext?: MealEventContext;
  getLikeDataForPost: (postId: string) => CookCardProps['likeData'];
  getHighlightForPost: (postId: string) => HighlightSpec | null;
  getVibeForPost: (postId: string) => VibeTag | null;
  onCardPress: (postId: string) => void;
  onRecipePress: (recipeId: string) => void;
  onChefPress: (chefName: string) => void;
  onCardMenu: (postId: string) => void;
  onCardLike: (postId: string) => void;
  onCardComment: (postId: string) => void;
  onCardViewLikes: (postId: string) => void;
  onGroupHeaderPress?: () => void;
}

export function LinkedCookStack({
  posts,
  currentUserId,
  mealEventContext,
  getLikeDataForPost,
  getHighlightForPost,
  getVibeForPost,
  onCardPress,
  onRecipePress,
  onChefPress,
  onCardMenu,
  onCardLike,
  onCardComment,
  onCardViewLikes,
  onGroupHeaderPress,
}: LinkedCookStackProps) {
  const { colors } = useTheme();

  // Defensive degradation
  if (posts.length === 0) return null;
  if (posts.length === 1) {
    const only = posts[0];
    return (
      <CookCard
        post={only}
        currentUserId={currentUserId}
        likeData={getLikeDataForPost(only.id)}
        highlight={getHighlightForPost(only.id)}
        vibe={getVibeForPost(only.id)}
        onPress={() => onCardPress(only.id)}
        onRecipePress={onRecipePress}
        onChefPress={onChefPress}
        onMenu={() => onCardMenu(only.id)}
        onLike={() => onCardLike(only.id)}
        onComment={() => onCardComment(only.id)}
        onViewLikes={() => onCardViewLikes(only.id)}
      />
    );
  }

  return (
    <CardWrapper colors={colors}>
      {/* L5 group header, if applicable — inside the outer CardWrapper */}
      {mealEventContext && (
        <MealEventGroupHeader
          mealEvent={mealEventContext}
          onPress={onGroupHeaderPress}
        />
      )}

      {/* Indented content — the borderLeft doubles as the Strava-style
          connector line and spans from here to the end of the last card. */}
      <View
        style={[
          stackStyles.indentContainer,
          { borderLeftColor: colors.border.light },
        ]}
      >
        {posts.map((post, i) => (
          <View key={post.id}>
            {i > 0 && <SubSectionDivider colors={colors} />}
            <CookCardInner
              post={post}
              currentUserId={currentUserId}
              likeData={getLikeDataForPost(post.id)}
              highlight={getHighlightForPost(post.id)}
              vibe={getVibeForPost(post.id)}
              onPress={() => onCardPress(post.id)}
              onRecipePress={onRecipePress}
              onChefPress={onChefPress}
              onMenu={() => onCardMenu(post.id)}
              onLike={() => onCardLike(post.id)}
              onComment={() => onCardComment(post.id)}
              onViewLikes={() => onCardViewLikes(post.id)}
            />
          </View>
        ))}
      </View>
    </CardWrapper>
  );
}

const stackStyles = StyleSheet.create({
  indentContainer: {
    marginLeft: 12,
    borderLeftWidth: 1,
    paddingLeft: 0,
  },
});

// ============================================================================
// SharedRecipeLinkedGroup (Checkpoint 3.5) — same-recipe merged card
// ============================================================================

export interface SharedRecipeLinkedGroupProps {
  /** 2+ posts, all sharing the same recipe_id (or at minimum the same title). */
  posts: CookCardData[];
  currentUserId: string;
  /** True for standalone L3b same-recipe (renders the linking header).
   *  False when nested inside a meal event group (meal event header provides
   *  context — no second header needed). */
  showLinkingHeader: boolean;
  getLikeDataForPost: (postId: string) => CookCardProps['likeData'];
  getHighlightForPost: (postId: string) => HighlightSpec | null;
  getVibeForPost: (postId: string) => VibeTag | null;
  onCardPress: (postId: string) => void;
  onRecipePress: (recipeId: string) => void;
  onChefPress: (chefName: string) => void;
  onCardMenu: (postId: string) => void;
  onCardLike: (postId: string) => void;
  onCardComment: (postId: string) => void;
  onCardViewLikes: (postId: string) => void;
}

function buildSharedHeroPhotos(posts: CookCardData[]): CarouselPhoto[] {
  // Tier 1: recipe_image_url (all posts share the same recipe_id, so any post's
  // recipe_image_url is the same — take the first non-empty).
  const heroRecipeImage = posts.find(
    p => p.recipe_image_url && p.recipe_image_url.trim() !== ''
  )?.recipe_image_url;
  if (heroRecipeImage) {
    return [{ url: heroRecipeImage, isRecipePhoto: true }];
  }
  // Tier 2: first post that has any personal photos.
  const firstWithPhotos = posts.find(
    p => p.photos && p.photos.length > 0
  );
  if (firstWithPhotos && firstWithPhotos.photos.length > 0) {
    return [...firstWithPhotos.photos]
      .sort((a: any, b: any) => {
        if (a.is_highlight) return -1;
        if (b.is_highlight) return 1;
        return (a.order ?? 0) - (b.order ?? 0);
      })
      .map((p: any) => ({ url: p.url, caption: p.caption }));
  }
  // Tier 3: empty hero. PhotoCarousel renders nothing — acceptable.
  return [];
}

function hasPersonalPhotos(post: CookCardData): boolean {
  return !!(post.photos && post.photos.length > 0);
}

/**
 * Render body of a shared-recipe merged group. Extracted so this can be used
 * either inside its own CardWrapper (standalone L3b) or inline inside a
 * larger LinkedCookStack (L5 sub-merge).
 *
 * `indentSubSections` (default true): wraps per-cook sub-sections in an
 * indent container with a left gutter borderLeft, matching LinkedCookStack's
 * L5 treatment. Pass `false` when SharedRecipeBody is rendered inside
 * another indent container (NestedMealEventGroup's outer wrapper) so we
 * don't double-indent.
 */
function SharedRecipeBody({
  posts,
  currentUserId,
  showLinkingHeader,
  getLikeDataForPost,
  getHighlightForPost,
  getVibeForPost,
  onCardPress,
  onRecipePress,
  onChefPress,
  onCardMenu,
  onCardLike,
  onCardComment,
  onCardViewLikes,
  colors,
  indentSubSections = true,
}: SharedRecipeLinkedGroupProps & {
  colors: any;
  indentSubSections?: boolean;
}) {
  const sharedHeroPhotos = buildSharedHeroPhotos(posts);
  const primary = posts[0];
  const others = posts.slice(1);

  const subSections = posts.map((post, index) => (
    <View key={post.id}>
      {index > 0 && <SubSectionDivider colors={colors} />}
      <CookCardInner
        post={post}
        currentUserId={currentUserId}
        likeData={getLikeDataForPost(post.id)}
        highlight={getHighlightForPost(post.id)}
        vibe={getVibeForPost(post.id)}
        onPress={() => onCardPress(post.id)}
        onRecipePress={onRecipePress}
        onChefPress={onChefPress}
        onMenu={() => onCardMenu(post.id)}
        onLike={() => onCardLike(post.id)}
        onComment={() => onCardComment(post.id)}
        onViewLikes={() => onCardViewLikes(post.id)}
        /* Suppress this cook's own carousel when they have no personal
           photos — the shared hero above is already serving the role. */
        photosOverride={hasPersonalPhotos(post) ? undefined : null}
      />
    </View>
  ));

  return (
    <>
      {showLinkingHeader && (
        <LinkingHeader
          primaryAuthorName={
            primary.author.display_name || primary.author.username || 'Someone'
          }
          otherAuthorNames={others.map(
            p => p.author.display_name || p.author.username || 'Someone'
          )}
          timestamp={primary.created_at}
          colors={colors}
        />
      )}

      {/* Shared hero carousel — full width, renders null if empty */}
      <PhotoCarousel photos={sharedHeroPhotos} colors={colors} />

      {/* Per-cook sub-sections — indented with left gutter connector to
          match L5's LinkedCookStack treatment. Skipped when we're already
          inside a parent indent container (NestedMealEventGroup). */}
      {indentSubSections ? (
        <View
          style={[
            stackStyles.indentContainer,
            { borderLeftColor: colors.border.light },
          ]}
        >
          {subSections}
        </View>
      ) : (
        subSections
      )}
    </>
  );
}

export function SharedRecipeLinkedGroup(props: SharedRecipeLinkedGroupProps) {
  const { colors } = useTheme();
  if (props.posts.length < 2) return null;
  return (
    <CardWrapper colors={colors}>
      <SharedRecipeBody {...props} colors={colors} />
    </CardWrapper>
  );
}

// ============================================================================
// NestedMealEventGroup (Checkpoint 3.5) — L5 with sub-unit dispatch
// ============================================================================
//
// Renders a meal-event-linked group whose posts are structured as an array
// of sub-units (some solo, some shared-recipe). Used when `FeedGroup.subUnits`
// is present in the output from buildFeedGroups.

export interface NestedMealEventGroupProps {
  subUnits: FeedGroupSubUnit[];
  currentUserId: string;
  mealEventContext: MealEventContext;
  getLikeDataForPost: (postId: string) => CookCardProps['likeData'];
  getHighlightForPost: (postId: string) => HighlightSpec | null;
  getVibeForPost: (postId: string) => VibeTag | null;
  onCardPress: (postId: string) => void;
  onRecipePress: (recipeId: string) => void;
  onChefPress: (chefName: string) => void;
  onCardMenu: (postId: string) => void;
  onCardLike: (postId: string) => void;
  onCardComment: (postId: string) => void;
  onCardViewLikes: (postId: string) => void;
  onGroupHeaderPress?: () => void;
}

export function NestedMealEventGroup({
  subUnits,
  currentUserId,
  mealEventContext,
  getLikeDataForPost,
  getHighlightForPost,
  getVibeForPost,
  onCardPress,
  onRecipePress,
  onChefPress,
  onCardMenu,
  onCardLike,
  onCardComment,
  onCardViewLikes,
  onGroupHeaderPress,
}: NestedMealEventGroupProps) {
  const { colors } = useTheme();
  if (subUnits.length === 0) return null;

  // Flatten the callbacks into a single object the inner renders share
  const childCallbacks = {
    currentUserId,
    getLikeDataForPost,
    getHighlightForPost,
    getVibeForPost,
    onCardPress,
    onRecipePress,
    onChefPress,
    onCardMenu,
    onCardLike,
    onCardComment,
    onCardViewLikes,
  };

  return (
    <CardWrapper colors={colors}>
      {/* L5 header */}
      <MealEventGroupHeader
        mealEvent={mealEventContext}
        onPress={onGroupHeaderPress}
      />

      {/* Indented content with left gutter connector */}
      <View
        style={[
          stackStyles.indentContainer,
          { borderLeftColor: colors.border.light },
        ]}
      >
        {subUnits.map((unit, i) => {
          const isFirst = i === 0;
          if (unit.kind === 'solo') {
            const post = unit.posts[0];
            return (
              <View key={post.id}>
                {!isFirst && <SubSectionDivider colors={colors} />}
                <CookCardInner
                  post={post}
                  {...childCallbacks}
                  likeData={getLikeDataForPost(post.id)}
                  highlight={getHighlightForPost(post.id)}
                  vibe={getVibeForPost(post.id)}
                  onPress={() => onCardPress(post.id)}
                  onMenu={() => onCardMenu(post.id)}
                  onLike={() => onCardLike(post.id)}
                  onComment={() => onCardComment(post.id)}
                  onViewLikes={() => onCardViewLikes(post.id)}
                />
              </View>
            );
          }
          // shared_recipe sub-unit: render inline, no linking header because
          // the meal event header above already provides the "together"
          // context. indentSubSections={false} because the outer
          // NestedMealEventGroup indent container is already applying the
          // left gutter — double-indenting would look cramped.
          const key = `shared-${unit.posts[0].id}`;
          return (
            <View key={key}>
              {!isFirst && <SubSectionDivider colors={colors} />}
              <SharedRecipeBody
                posts={unit.posts}
                currentUserId={currentUserId}
                showLinkingHeader={false}
                getLikeDataForPost={getLikeDataForPost}
                getHighlightForPost={getHighlightForPost}
                getVibeForPost={getVibeForPost}
                onCardPress={onCardPress}
                onRecipePress={onRecipePress}
                onChefPress={onChefPress}
                onCardMenu={onCardMenu}
                onCardLike={onCardLike}
                onCardComment={onCardComment}
                onCardViewLikes={onCardViewLikes}
                colors={colors}
                indentSubSections={false}
              />
            </View>
          );
        })}
      </View>
    </CardWrapper>
  );
}
