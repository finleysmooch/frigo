// components/feedCard/CookCard.tsx
// Phase 7I Checkpoint 3 — the new per-cook-post feed card.
// Checkpoint 3.5 — split into a thin outer `CookCard` (wraps CardWrapper)
// and a named export `CookCardInner` (wrapper-less content). LinkedCookStack
// and SharedRecipeLinkedGroup reuse CookCardInner so multiple cook sections
// can share a single outer card frame without gray gaps between them.
//
// Renders L1 (solo, single-dish). L2 (solo, multi-dish) is handled by
// rendering N independent CookCards, not by a new component.
//
// Structurally similar to PostCard but with Phase 7I differences:
//   - Description appears ABOVE the recipe line (D47 polish).
//   - Always shows display_name in the header (no "You" branching).
//   - Overflow menu (onMenu) only rendered when viewer is author.
//   - No ParticipantsListModal — partners render via the grouping layer.
//   - Consumes denormalized CookCardData instead of PostCardData.
//
// Does NOT render: posts.notes (detail screen only per D4), participants text.

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import {
  CardWrapper,
  CardHeader,
  DescriptionLine,
  RecipeLine,
  StatsRow,
  VibePillRow,
  EngagementRow,
  ActionRow,
  HighlightSpec,
  PhotoCarousel,
  CarouselPhoto,
} from './sharedCardElements';
import { VibeTag } from '../../lib/services/vibeService';
import { CookCardData } from '../../lib/types/feed';

// ============================================================================
// PROPS
// ============================================================================

export interface CookCardProps {
  post: CookCardData;
  currentUserId: string;
  /** Pre-computed highlight from highlightsService */
  highlight?: HighlightSpec | null;
  /** Pre-computed vibe tag */
  vibe?: VibeTag | null;
  /** Like state (same shape PostCard takes) */
  likeData?: {
    hasLike: boolean;
    likesText?: string;
    commentCount?: number;
    likes?: Array<{
      user_id: string;
      created_at: string;
      avatar_url?: string | null;
      subscription_tier?: string;
    }>;
  };
  /** Tap on card body → CookDetailScreen (L6). Checkpoint 3: no-op. */
  onPress?: () => void;
  /** Tap on recipe line → RecipeDetail */
  onRecipePress?: (recipeId: string) => void;
  /** Tap on chef name → AuthorView */
  onChefPress?: (chefName: string) => void;
  /** Like/comment callbacks */
  onLike?: () => void;
  onComment?: () => void;
  /** Overflow menu — only rendered when viewer is the author */
  onMenu?: () => void;
  /** View likers list */
  onViewLikes?: () => void;
}

/**
 * Inner-only props: identical to `CookCardProps` plus an optional
 * `photosOverride` escape hatch used by the shared-recipe group.
 *
 * `photosOverride` semantics:
 *   - `undefined` (default): inner component uses its own photo derivation
 *     (post.photos → recipe_image_url fallback).
 *   - explicit `null`: photo carousel is suppressed entirely (no carousel
 *     rendered). Used by SharedRecipeLinkedGroup when a cook has no
 *     personal photos and the shared hero is already serving the role.
 *   - explicit `CarouselPhoto[]`: replaces the default derivation with the
 *     passed array.
 */
export interface CookCardInnerProps extends CookCardProps {
  photosOverride?: CarouselPhoto[] | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

// ============================================================================
// CookCardInner — wrapper-less content (reused by linked-group components)
// ============================================================================

export function CookCardInner({
  post,
  currentUserId,
  highlight,
  vibe,
  likeData,
  onPress,
  onRecipePress,
  onChefPress: _onChefPress, // reserved for Checkpoint 4/5 wiring
  onLike,
  onComment,
  onMenu,
  onViewLikes,
  photosOverride,
}: CookCardInnerProps) {
  const { colors, functionalColors } = useTheme();

  // ── Data derivation ──────────────────────────────────────────

  const isOwnPost = post.user_id === currentUserId;

  // No "You" branching — see 7I D47 rationale in the Checkpoint 3 prompt.
  const displayName =
    post.author.display_name || post.author.username || 'Someone';

  // Title fallback cascade — mirrors PostCard but uses denormalized recipe_title.
  const postTitle =
    post.title || post.recipe_title || 'Cooking Session';

  const isRecipeBacked = !!post.recipe_id;

  // Phase 7I Checkpoint 4.5 / 4.5.1: normalize `post.photos` to a canonical
  // object-array form up front. The posts.photos jsonb column historically
  // contains TWO shapes depending on which write path created the post:
  //   - Object form: [{url, caption, order, is_highlight}, ...] (PostCard-era)
  //   - String form: [<url string>, ...] (earlier seed data + some write paths)
  // Downstream carouselPhotos derivation expects the object form. Normalize
  // here defensively so anything not matching one of the two expected shapes
  // (null entry, missing url, empty url, number, boolean, etc.) is filtered.
  // Underlying data shape cleanup tracked as P7-73.
  const normalizedPhotos: Array<{
    url: string;
    caption?: string;
    order?: number;
    is_highlight?: boolean;
  }> = ((post.photos as any[]) || [])
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

  const hasPhotos = normalizedPhotos.length > 0;
  const hasRecipeImage = !!post.recipe_image_url;
  const isPhotoless = !hasPhotos && !hasRecipeImage;

  // ── Stats data ───────────────────────────────────────────────

  // In CookCardData, recipe_cook_time_min is already the total (cook + prep).
  // PostCard separately tracks cook_time_min and prep_time_min off recipe;
  // here we rely on what Checkpoint 4's FeedScreen denormalizes.
  const totalTime = post.recipe_cook_time_min ?? 0;

  const stats: Array<{ label: string; value: string; unit?: string }> = [];
  if (totalTime > 0) {
    if (totalTime >= 60) {
      const hrs = Math.floor(totalTime / 60);
      const mins = totalTime % 60;
      stats.push({
        label: 'Cook time',
        value: String(hrs),
        unit: mins > 0 ? `h ${mins}m` : 'h',
      });
    } else {
      stats.push({ label: 'Cook time', value: String(totalTime), unit: 'min' });
    }
  }
  if (post.rating != null && post.rating > 0) {
    stats.push({ label: 'Rating', value: `★${post.rating}` });
  }
  const timesCookedVal = post.recipe_times_cooked ?? 0;
  if (timesCookedVal === 1) {
    stats.push({ label: 'Cooked', value: '1', unit: '×' });
  } else if (timesCookedVal >= 2) {
    stats.push({ label: 'Cooked', value: String(timesCookedVal), unit: '×' });
  }

  // ── Photo carousel prep ──────────────────────────────────────
  // photosOverride semantics:
  //   null      → suppress carousel entirely
  //   array     → use that array
  //   undefined → default derivation from post.photos + recipe_image_url

  let carouselPhotos: CarouselPhoto[];
  if (photosOverride === null) {
    carouselPhotos = [];
  } else if (photosOverride !== undefined) {
    carouselPhotos = photosOverride;
  } else if (!hasPhotos && !hasRecipeImage) {
    carouselPhotos = [];
  } else if (!hasPhotos && hasRecipeImage) {
    carouselPhotos = [{ url: post.recipe_image_url!, isRecipePhoto: true }];
  } else {
    // Uses normalizedPhotos from above — guarantees {url, ...} objects even
    // when the source jsonb held bare strings. See the P7-73 comment.
    carouselPhotos = [...normalizedPhotos]
      .sort((a, b) => {
        if (a.is_highlight) return -1;
        if (b.is_highlight) return 1;
        return (a.order ?? 0) - (b.order ?? 0);
      })
      .map(p => ({ url: p.url, caption: p.caption }));
  }

  // ── Vibe resolution ──────────────────────────────────────────
  // Vibe pill: no vibe on photoless cards, no vibe on freeform posts.
  const resolvedVibe = isPhotoless || !isRecipeBacked ? null : (vibe ?? null);

  // ── Render ───────────────────────────────────────────────────
  //
  // P7N CP2 Item 1: the card body is split into three zones:
  //   1. Top Pressable (header + title/description/recipe) — taps navigate
  //   2. PhotoCarousel (NOT in a Pressable) — swipe gestures go to the
  //      FlatList uncontested; per-photo Pressable handles clean taps
  //   3. Bottom Pressable (stats/vibe/engagement/actions) — taps navigate
  //
  // Inner interactive elements (RecipeLine, CardHeader menu, EngagementRow
  // like-row, ActionRow buttons) still intercept via "innermost touchable
  // wins" and do NOT propagate to the outer Pressable.

  return (
    <View>
      {/* Top section — tappable (header + title/description/recipe) */}
      <Pressable onPress={onPress}>
        {/* 1. Header — single avatar */}
        <CardHeader
          avatars={[
            {
              avatar_url: post.author.avatar_url,
              subscription_tier: post.author.subscription_tier,
            },
          ]}
          title={displayName}
          meta={`${formatDate(post.cooked_at ?? post.created_at)} · Portland, OR`}
          onMenu={isOwnPost ? onMenu : undefined}
          colors={colors}
        />

        {/* 2-4. Title + Description + Recipe — Phase 7I order (D47):
            title → description → recipe line. */}
        <View>
          <Text style={[titleStyle, { color: colors.text.primary }]}>
            {postTitle}
          </Text>
          <DescriptionLine description={post.description} colors={colors} />
          <RecipeLine
            recipeName={post.recipe_title || undefined}
            authorName={post.chef_name || undefined}
            isRecipeBacked={isRecipeBacked}
            onRecipePress={
              post.recipe_id ? () => onRecipePress?.(post.recipe_id!) : undefined
            }
            colors={colors}
          />
        </View>
      </Pressable>

      {/* 5. Photo carousel — NOT in a Pressable so swipe gestures go to FlatList.
          onPhotoPress handles tap-to-navigate on individual photos. */}
      <PhotoCarousel photos={carouselPhotos} colors={colors} onPhotoPress={onPress} />

      {/* Bottom section — tappable (stats, vibe, engagement, actions) */}
      <Pressable onPress={onPress}>
        {/* 6. Stats row with optional Highlights pill (4th slot) */}
        <StatsRow stats={stats} highlight={highlight} colors={colors} />

        {/* 7. Vibe pill row (conditional) */}
        <VibePillRow vibe={resolvedVibe} colors={colors} />

        {/* 8. Engagement row */}
        <EngagementRow
          likeData={likeData}
          onComment={onComment}
          onViewLikes={onViewLikes}
          colors={colors}
        />

        {/* 9. Action row (like/comment) */}
        <ActionRow
          onLike={onLike}
          onComment={onComment}
          hasLiked={likeData?.hasLike}
          colors={colors}
          functionalColors={functionalColors}
        />
      </Pressable>
    </View>
  );
}

// ============================================================================
// CookCard — thin outer wrapper around CookCardInner
// ============================================================================

export default function CookCard(props: CookCardProps) {
  const { colors } = useTheme();
  return (
    <CardWrapper colors={colors}>
      <CookCardInner {...props} />
    </CardWrapper>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const titleStyle: any = {
  fontSize: 17,
  fontWeight: '700',
  letterSpacing: -0.17,
  lineHeight: 21,
  marginHorizontal: 14,
  marginTop: 2,
  marginBottom: 8,
};
