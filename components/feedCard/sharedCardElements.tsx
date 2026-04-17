// components/feedCard/sharedCardElements.tsx
// Shared visual primitives for PostCard and MealPostCard (Phase 7F)
// Per the locked Pass 6 wireframe baseline (K1rrr–K5rrr)

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Image,
  FlatList,
  Dimensions,
} from 'react-native';
import UserAvatar from '../UserAvatar';
import BookIcon from '../icons/recipe/BookIcon';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CAROUSEL_HEIGHT = SCREEN_WIDTH * 0.75;
const CAROUSEL_GAP = 10;
const DEFAULT_PHOTO_RATIO = 4 / 3;

// ============================================================================
// SUPABASE STORAGE → RENDER IMAGE REWRITE
// ============================================================================

/**
 * Rewrite a Supabase Storage public object URL to the image transformation
 * endpoint with a target width + quality. Originals are often 3–5 MB per
 * photo; the render endpoint with width=800, quality=70 drops that to
 * ~150–300 KB, which is the single biggest feed performance win.
 *
 * Non-Supabase URLs and already-rewritten URLs pass through unchanged.
 */
export function optimizeStorageUrl(
  url: string | null | undefined,
  width: number = 1600,
  quality: number = 50
): string {
  if (!url || typeof url !== 'string') return url || '';
  if (url.includes('/storage/v1/render/image/')) return url; // already rewritten
  const marker = '/storage/v1/object/public/';
  const idx = url.indexOf(marker);
  if (idx === -1) return url;

  // Phase 7I Checkpoint 4.5 / 4.5.2: Supabase's /render/image/ endpoint
  // requires lowercase file extensions. Files with uppercase extensions
  // (.JPG, .JPEG, .PNG) or double extensions (.jpg.JPG from some
  // extraction pipelines) fail silently on the render endpoint. For those
  // URLs, fall back to the raw /object/public/ endpoint which serves bytes
  // verbatim and doesn't care about extension casing. Cost: no per-image
  // size optimization on ~347 affected recipes. Acceptable tradeoff until
  // a storage filename normalization migration runs (P7-72).
  // The regex matches lowercase extensions ONLY, either at end-of-path or
  // immediately before a query string.
  const lowercaseExtSafe = /\.(jpg|jpeg|png|webp|gif)(\?|$)/.test(url);
  if (!lowercaseExtSafe) return url;

  const prefix = url.slice(0, idx);
  const rest = url.slice(idx + marker.length);
  return `${prefix}/storage/v1/render/image/public/${rest}?width=${width}&quality=${quality}&resize=contain`;
}

// ============================================================================
// TYPES
// ============================================================================

export interface AvatarSpec {
  avatar_url?: string | null;
  subscription_tier?: string;
  /** For external guests: render as initials circle with dashed border */
  external?: boolean;
  /** Display name or initials for external guests */
  initials?: string;
}

export interface StatItem {
  label: string;
  value: string;
  unit?: string;
}

export interface HighlightSpec {
  text: string;
  /** true = viewer-side (cream tone), false = author-side (teal tone) */
  viewerSide: boolean;
}

export interface VibeSpec {
  emoji: string;
  label: string;
}

export interface LikeData {
  hasLike: boolean;
  likesText?: string;
  commentCount?: number;
  likes?: Array<{
    user_id: string;
    created_at: string;
    avatar_url?: string | null;
    subscription_tier?: string;
  }>;
}

// ============================================================================
// COLOR CONSTANTS (from wireframe CSS variables)
// ============================================================================

const TEAL_50 = '#E1F5EE';
const TEAL_100 = '#C6ECDD';
const TEAL_700 = '#0F6E56';
const TEAL_900 = '#04342C';

// Viewer-side Highlights pill (cream/gold tones)
const CREAM_BG = '#f5f0e0';
const CREAM_BORDER = '#e8dfc4';
const CREAM_FG = '#7a6a3e';

// ============================================================================
// CARD WRAPPER
// ============================================================================

/**
 * Full-width edge-to-edge card wrapper per wireframe spec.
 * No horizontal margin, top/bottom borders, white background.
 *
 * Fix Pass 8 / Fix 2 — no longer wraps in Pressable. Tap handling moved to
 * TappableTitleBlock so the outer card doesn't compete with nested touch
 * targets (yas chef, comment, carousel swipe) for gesture arbitration.
 */
export function CardWrapper({
  children,
  colors,
}: {
  children: React.ReactNode;
  colors: any;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.background.card,
        borderTopWidth: 0.5,
        borderBottomWidth: 0.5,
        borderTopColor: colors.border.light,
        borderBottomColor: colors.border.light,
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

/**
 * Tap-target wrapper for the title/description block. Replaces the previous
 * card-wide Pressable + unstable_pressDelay approach — scope-limiting the tap
 * surface means nested interactive elements win gesture arbitration cleanly.
 */
export function TappableTitleBlock({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress?: () => void;
}) {
  if (!onPress) return <>{children}</>;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {children}
    </TouchableOpacity>
  );
}

// ============================================================================
// PHOTO CAROUSEL (Fix Pass 8 / Fix 1)
// ============================================================================

export interface CarouselPhoto {
  url: string;
  caption?: string;
  isRecipePhoto?: boolean;
}

/**
 * Strava-style unified photo carousel. Photos render at their natural aspect
 * ratio within a fixed-height strip. Nothing is cropped or letterboxed.
 *
 * - Container: full screen width × SCREEN_WIDTH * 0.75, card bg fills gaps
 * - Photo height = container height
 * - Photo width = containerHeight × (natural_w / natural_h), discovered via
 *   Image.onLoad and cached in per-index state. Default 4:3 until loaded.
 * - resizeMode="cover" is a no-op crop because width/height match aspect.
 * - Single photo: plain centered View, no scroll.
 * - Multi photo: free horizontal FlatList (NOT pagingEnabled), snap-to-center,
 *   neighbors peek in from the sides, contentInset padding so first/last can
 *   center. decelerationRate="fast".
 * - No dot indicators.
 */
export function PhotoCarousel({
  photos,
  colors,
  accessory,
  scrollToIndex,
  onScrollToIndexComplete,
  onPhotoPress,
}: {
  photos: CarouselPhoto[];
  colors: any;
  accessory?: React.ReactNode;
  /** Phase 7I Checkpoint 5 / Block 12: imperatively scroll the multi-photo
   *  carousel to a specific index. When this prop changes from null to a
   *  number, the carousel scrolls to that slide. After the scroll settles
   *  the caller should reset it to null via `onScrollToIndexComplete` so
   *  subsequent taps re-trigger. Ignored for single-photo carousels. */
  scrollToIndex?: number | null;
  onScrollToIndexComplete?: () => void;
  /** P7N CP2: tap on a photo navigates to detail. Inside a horizontal
   *  FlatList a child Pressable only fires on a clean tap — swipes are
   *  intercepted by the scroll gesture handler automatically. */
  onPhotoPress?: () => void;
}) {
  // ── ALL HOOKS UNCONDITIONAL AT TOP ──────────────────────────────────
  // Fix Pass #2 / Fix 1: all useState + useRef + useEffect calls must run
  // on every render regardless of the photo count, otherwise React crashes
  // with "Rendered more hooks than during the previous render" when the
  // photos array changes size between renders (e.g., after EditMedia
  // roundtrip). The early-return guards are moved below all hooks.
  const [photoRatios, setPhotoRatios] = useState<Record<number, number>>({});
  // Phase 7I Checkpoint 5 / 5.2: per-slide load-failure tracking. Indices
  // refer to positions in the original `photos` array — filtering happens
  // at the render layer so indices stay stable across re-renders. When
  // every slide fails, the carousel returns null (D50 composition).
  const [failedIndices, setFailedIndices] = useState<Set<number>>(new Set());
  // P7N-1B: which slide is currently centered, for the "1/N" count pill.
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const flatListRef = useRef<FlatList<CarouselPhoto>>(null);

  // Compute widths + snapToOffsets unconditionally so the scroll-to-index
  // useEffect below can reference them without dodging an early return.
  // For zero-photo / single-photo cases these arrays are empty / single
  // and the computation is trivially cheap.
  //
  // P7N-1B (P7-87): clamp multi-photo slide widths to 88% of screen width
  // so adjacent slides visibly peek on either side. The existing aspect
  // ratio computation still governs shape — we just cap the max so a
  // landscape photo doesn't fill the whole screen and hide its neighbors.
  // Single-photo carousels are NOT clamped; they should fill naturally.
  const safePhotos = photos || [];
  const MULTI_PHOTO_MAX_WIDTH = SCREEN_WIDTH * 0.88;
  const widths = safePhotos.map((_, i) => {
    const ratio = photoRatios[i] ?? DEFAULT_PHOTO_RATIO;
    const naturalWidth = CAROUSEL_HEIGHT * ratio;
    if (safePhotos.length <= 1) return naturalWidth;
    return Math.min(naturalWidth, MULTI_PHOTO_MAX_WIDTH);
  });
  const snapToOffsets: number[] = [];
  {
    let cumulative = 0;
    for (let i = 0; i < widths.length; i++) {
      const offset =
        cumulative + CAROUSEL_GAP * i - (SCREEN_WIDTH - widths[i]) / 2;
      snapToOffsets.push(offset);
      cumulative += widths[i];
    }
  }

  // Phase 7I Checkpoint 5 / Block 12: imperative scroll-to-index support.
  // Runs whenever scrollToIndex changes (thumbnail tap) OR when photoRatios
  // change (so the scroll lands at the correct offset once natural-aspect
  // widths settle after onLoad). MUST be declared unconditionally above
  // the early returns below (Fix Pass #2 / Fix 1).
  useEffect(() => {
    if (
      typeof scrollToIndex !== 'number' ||
      scrollToIndex < 0 ||
      scrollToIndex >= safePhotos.length
    ) {
      return;
    }
    const targetOffset = snapToOffsets[scrollToIndex];
    if (typeof targetOffset !== 'number') return;
    flatListRef.current?.scrollToOffset({
      offset: Math.max(0, targetOffset),
      animated: true,
    });
    if (onScrollToIndexComplete) {
      const id = setTimeout(onScrollToIndexComplete, 50);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToIndex, photoRatios, safePhotos.length]);

  // ── Non-hook helpers (safe to declare after hooks) ──────────────────
  const markFailed = (index: number) => {
    setFailedIndices(prev => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  const getPhotoWidth = (index: number): number => {
    const ratio = photoRatios[index] ?? DEFAULT_PHOTO_RATIO;
    const naturalWidth = CAROUSEL_HEIGHT * ratio;
    // P7N-1B: match the clamp applied to the `widths` array above so
    // renderSlide and snap offsets agree on the same value.
    if (safePhotos.length <= 1) return naturalWidth;
    return Math.min(naturalWidth, MULTI_PHOTO_MAX_WIDTH);
  };

  const handleLoad = (index: number, e: any) => {
    const src = e?.nativeEvent?.source;
    if (!src || !src.width || !src.height) return;
    const ratio = src.width / src.height;
    setPhotoRatios(prev => {
      if (prev[index] === ratio) return prev;
      return { ...prev, [index]: ratio };
    });
  };

  // ── EARLY RETURNS (after all hooks) ─────────────────────────────────
  if (!photos || photos.length === 0) return null;
  const visibleCount = photos.length - failedIndices.size;
  if (visibleCount === 0) return null;

  const renderSlide = (photo: CarouselPhoto, index: number) => {
    const width = getPhotoWidth(index);
    return (
      <View
        key={`slide-${index}`}
        style={{ width, height: CAROUSEL_HEIGHT, position: 'relative' }}
      >
        <Image
          source={{ uri: optimizeStorageUrl(photo.url) }}
          style={{ width, height: CAROUSEL_HEIGHT }}
          resizeMode="cover"
          fadeDuration={0}
          onLoad={(e) => handleLoad(index, e)}
          onError={() => markFailed(index)}
        />
        {photo.isRecipePhoto && (
          <View style={carouselStyles.recipeBadge}>
            <Text style={carouselStyles.recipeBadgeText}>📖 Recipe photo</Text>
          </View>
        )}
        {photo.caption && (
          <View style={carouselStyles.captionOverlay}>
            <Text style={carouselStyles.captionText}>{photo.caption}</Text>
          </View>
        )}
      </View>
    );
  };

  const containerStyle = {
    position: 'relative' as const,
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
    backgroundColor: colors.background.card,
    marginBottom: 10,
    overflow: 'hidden' as const,
  };

  // Single-photo: centered, no scroll.
  if (photos.length === 1) {
    // If the single photo already failed, return null (visibleCount early
    // return handles this first, but keep the guard in case of re-render).
    if (failedIndices.has(0)) return null;
    return (
      <View style={containerStyle}>
        <Pressable
          onPress={onPhotoPress}
          style={{
            width: SCREEN_WIDTH,
            height: CAROUSEL_HEIGHT,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {renderSlide(photos[0], 0)}
        </Pressable>
        {accessory && (
          <View style={carouselStyles.accessorySlot}>{accessory}</View>
        )}
      </View>
    );
  }

  // Multi-photo: free scroll with snap-to-center. `widths` and
  // `snapToOffsets` are computed above (before the early returns) so the
  // scroll-to-index useEffect can reference them unconditionally.
  const leftPadding = (SCREEN_WIDTH - widths[0]) / 2;
  const rightPadding = (SCREEN_WIDTH - widths[widths.length - 1]) / 2;

  return (
    <View style={containerStyle}>
      <FlatList
        ref={flatListRef}
        data={photos}
        keyExtractor={(_, index) => `carousel-photo-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToOffsets={snapToOffsets}
        contentContainerStyle={{
          paddingLeft: Math.max(0, leftPadding),
          paddingRight: Math.max(0, rightPadding),
        }}
        ItemSeparatorComponent={() => <View style={{ width: CAROUSEL_GAP }} />}
        renderItem={({ item, index }) => {
          if (failedIndices.has(index)) return null;
          return (
            <Pressable onPress={onPhotoPress}>
              {renderSlide(item, index)}
            </Pressable>
          );
        }}
        onMomentumScrollEnd={(e) => {
          // P7N-1B: find the snap offset closest to the current scroll x
          // and report it as the active slide for the count pill.
          const x = e.nativeEvent.contentOffset.x;
          let closest = 0;
          let minDist = Infinity;
          for (let i = 0; i < snapToOffsets.length; i++) {
            const dist = Math.abs(snapToOffsets[i] - x);
            if (dist < minDist) {
              minDist = dist;
              closest = i;
            }
          }
          if (closest !== activeIndex) setActiveIndex(closest);
        }}
      />
      {/* P7N-1B: count pill — small semi-transparent badge in the top-right
          showing "N/Total". Only renders when there are multiple photos. */}
      <View style={carouselStyles.countPill} pointerEvents="none">
        <Text style={carouselStyles.countPillText}>
          {activeIndex + 1}/{photos.length}
        </Text>
      </View>
      {accessory && (
        <View style={carouselStyles.accessorySlot}>{accessory}</View>
      )}
    </View>
  );
}

const carouselStyles = StyleSheet.create({
  captionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  captionText: {
    color: '#fff',
    fontSize: 11,
  },
  recipeBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  recipeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  // P7N-1B: photo count pill (N/Total) in the top-right of multi-photo
  // carousels. Paired with the peek-clamped slide widths as a second
  // affordance signal that more photos are available.
  countPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  accessorySlot: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
});

// ============================================================================
// NO-PHOTO PLACEHOLDER (Phase 7I Checkpoint 5 / D50)
// ============================================================================

/**
 * Detail-screen placeholder rendered when a hero photo surface has no image
 * to display. Specification lives in D50 — light grey background, centered
 * BookIcon, muted "No photo yet" text. Feed cards still collapse the photo
 * slot entirely; this placeholder is for detail surfaces only
 * (CookDetailScreen, RecipeDetailScreen, and future MealEventDetailScreen).
 *
 * Dimensions default to CookDetailScreen's hero carousel size. Callers can
 * override for custom hero proportions.
 */
export function NoPhotoPlaceholder({
  width,
  height,
  colors,
}: {
  width?: number;
  height?: number;
  colors: any;
}) {
  const w = width ?? SCREEN_WIDTH;
  const h = height ?? CAROUSEL_HEIGHT;
  return (
    <View
      style={[
        noPhotoStyles.container,
        {
          width: w,
          height: h,
          backgroundColor: colors.background.secondary || '#f4f4f2',
        },
      ]}
    >
      <BookIcon size={48} color={colors.text.tertiary || '#9ca3af'} />
      <Text
        style={[
          noPhotoStyles.label,
          { color: colors.text.tertiary || '#9ca3af' },
        ]}
      >
        No photo yet
      </Text>
    </View>
  );
}

const noPhotoStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    letterSpacing: 0.5,
    marginTop: 8,
  },
});

// ============================================================================
// CARD HEADER
// ============================================================================

/**
 * Card header: avatar (single or stacked) + title text + meta line + menu button.
 * Per wireframe: padding 12px 14px 8px, gap 10px.
 */
export function CardHeader({
  avatars,
  title,
  meta,
  metaIcon,
  onMenu,
  colors,
}: {
  avatars: AvatarSpec[];
  title: string;
  meta: string;
  /** Small icon before the meta line. 'clock' for solo/single-cook, 'users' for multi-cook meals with eaters. */
  metaIcon?: 'clock' | 'users' | null;
  onMenu?: () => void;
  colors: any;
}) {
  const metaPrefix =
    metaIcon === 'clock' ? '⏱ ' : metaIcon === 'users' ? '👥 ' : '';
  return (
    <View style={headerStyles.container}>
      {/* Avatar stack */}
      <View style={headerStyles.avatarStack}>
        {avatars.slice(0, 3).map((avatar, index) => (
          <View
            key={index}
            style={[
              headerStyles.avatarItem,
              index > 0 && { marginLeft: -12, zIndex: 10 - index },
            ]}
          >
            {avatar.external ? (
              <View
                style={[
                  headerStyles.externalAvatar,
                  {
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    borderColor: colors.border.medium,
                  },
                ]}
              >
                <Text style={[headerStyles.externalInitials, { color: colors.text.secondary }]}>
                  {avatar.initials || '?'}
                </Text>
              </View>
            ) : (
              <UserAvatar
                user={{
                  avatar_url: avatar.avatar_url,
                  subscription_tier: avatar.subscription_tier,
                }}
                size={40}
              />
            )}
          </View>
        ))}
      </View>

      {/* Title + meta */}
      <View style={headerStyles.textContainer}>
        <Text style={[headerStyles.title, { color: colors.text.primary }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[headerStyles.meta, { color: colors.text.tertiary }]} numberOfLines={1}>
          {metaPrefix}{meta}
        </Text>
      </View>

      {/* Menu button */}
      {onMenu && (
        <TouchableOpacity style={headerStyles.menuButton} onPress={onMenu}>
          <Text style={[headerStyles.menuText, { color: colors.text.tertiary }]}>•••</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const headerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  avatarItem: {
    zIndex: 10,
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  meta: {
    fontSize: 11,
    marginTop: 2,
  },
  menuButton: {
    padding: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  menuText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
  externalAvatar: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f4',
  },
  externalInitials: {
    fontSize: 14,
    fontWeight: '600',
  },
});

// ============================================================================
// DESCRIPTION LINE
// ============================================================================

/**
 * Renders posts.description as a paragraph below the title.
 * Max 3 lines with ellipsis. Returns null when description is empty.
 * NOTE: This renders posts.description, NOT posts.notes (cook-time thoughts per D4).
 */
export function DescriptionLine({
  description,
  colors,
}: {
  description?: string | null;
  colors: any;
}) {
  if (!description || !description.trim()) return null;

  return (
    <Text
      style={{
        fontSize: 13,
        color: colors.text.secondary,
        lineHeight: 18,
        marginHorizontal: 14,
        marginBottom: 10,
      }}
      numberOfLines={3}
      ellipsizeMode="tail"
    >
      {description}
    </Text>
  );
}

// ============================================================================
// STATS ROW
// ============================================================================

/**
 * Flexbox row of stat items with optional Highlights pill in 4th slot.
 * Per wireframe: padding 6px 14px 10px, gap 14px.
 */
export function StatsRow({
  stats,
  highlight,
  colors,
}: {
  stats: StatItem[];
  highlight?: HighlightSpec | null;
  colors: any;
}) {
  if (stats.length === 0 && !highlight) return null;

  return (
    <View style={statsStyles.container}>
      {stats.map((stat, index) => (
        <View key={stat.label} style={statsStyles.statItem}>
          <Text style={[statsStyles.label, { color: colors.text.tertiary }]}>{stat.label}</Text>
          <Text style={[statsStyles.value, { color: colors.text.primary }]}>
            {stat.value}
            {stat.unit ? (
              <Text style={[statsStyles.unit, { color: colors.text.secondary }]}>{stat.unit}</Text>
            ) : null}
          </Text>
        </View>
      ))}
      {highlight && (
        <View style={{ flexShrink: 1, flexGrow: 0 }}>
          <HighlightsPill text={highlight.text} viewerSide={highlight.viewerSide} />
        </View>
      )}
    </View>
  );
}

const statsStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 14,
  },
  statItem: {
    flexDirection: 'column',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  value: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.1,
    lineHeight: 19,
  },
  unit: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 1,
  },
});

// ============================================================================
// HIGHLIGHTS PILL
// ============================================================================

/**
 * The Highlights slot content — sized to content width (not stretched).
 * Teal tone for author-side, cream tone for viewer-side.
 */
export function HighlightsPill({
  text,
  viewerSide,
}: {
  text: string;
  viewerSide: boolean;
}) {
  const bg = viewerSide ? CREAM_BG : TEAL_50;
  const borderColor = viewerSide ? CREAM_BORDER : TEAL_100;
  const fg = viewerSide ? CREAM_FG : TEAL_900;

  return (
    <View style={{ flexShrink: 1, minWidth: 0 }}>
      <Text style={[statsStyles.label, { color: '#999999' }]}>Highlights</Text>
      <View
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: 8,
          paddingVertical: 3,
          backgroundColor: bg,
          borderWidth: 0.5,
          borderColor: borderColor,
          borderRadius: 10,
          marginTop: 1,
        }}
      >
        <Text
          style={{
            fontSize: 10,
            fontWeight: '600',
            color: fg,
            lineHeight: 12,
          }}
          numberOfLines={2}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}

// ============================================================================
// VIBE PILL ROW
// ============================================================================

/**
 * Single vibe pill in its own row below the stats.
 * Returns null when vibe is null.
 * Photoless cards should pass null (no vibe pill per spec).
 *
 * Personalization is deferred (P7-40/P7-41). The pill is static for all viewers.
 */
export function VibePillRow({
  vibe,
  colors,
}: {
  vibe: VibeSpec | null;
  colors: any;
}) {
  if (!vibe) return null;

  return (
    <View style={vibeStyles.container}>
      {/* Gap Analysis Fix 3: vibe pills use sand/gold per wireframe, not teal. */}
      <View style={[vibeStyles.pill, { backgroundColor: '#f5f0e0', borderColor: '#e8dfc4' }]}>
        <Text style={[vibeStyles.text, { color: '#7a6a3e' }]}>
          {vibe.emoji} {vibe.label}
        </Text>
      </View>
    </View>
  );
}

const vibeStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 0.5,
  },
  text: {
    fontSize: 10,
    fontWeight: '500',
  },
});

// ============================================================================
// ENGAGEMENT ROW
// ============================================================================

/**
 * Liker avatars + "X gave yas chef" + comment count.
 * Per wireframe: padding 8px 14px 6px, border-top.
 */
export function EngagementRow({
  likeData,
  onComment,
  onViewLikes,
  colors,
}: {
  likeData?: LikeData;
  onComment?: () => void;
  onViewLikes?: () => void;
  colors: any;
}) {
  if (!likeData) return null;
  const hasLikes = !!likeData.likesText;
  const hasComments = (likeData.commentCount ?? 0) > 0;
  if (!hasLikes && !hasComments) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingTop: 8,
        paddingBottom: 6,
        borderTopWidth: 0.5,
        borderTopColor: colors.border.light,
        marginTop: 2,
      }}
    >
      {hasLikes && (
        <TouchableOpacity
          onPress={onViewLikes}
          activeOpacity={0.7}
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
        >
          {likeData.likes && likeData.likes.length > 0 && (
            <View style={{ flexDirection: 'row', marginRight: 8 }}>
              {likeData.likes.slice(0, 3).map((like, index) => (
                <View
                  key={like.user_id}
                  style={{ marginLeft: index > 0 ? -6 : 0, zIndex: 10 - index }}
                >
                  <UserAvatar user={{ avatar_url: like.avatar_url }} size={22} />
                </View>
              ))}
            </View>
          )}
          <Text style={{ fontSize: 12, color: colors.text.secondary, flex: 1 }}>
            {likeData.likesText}
          </Text>
        </TouchableOpacity>
      )}
      {hasComments && onComment && (
        <TouchableOpacity onPress={onComment} activeOpacity={0.7}>
          <Text style={{ fontSize: 12, color: colors.text.secondary }}>
            {likeData.commentCount} comment{likeData.commentCount !== 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ============================================================================
// ACTION ROW
// ============================================================================

/**
 * Like / Comment / Share buttons.
 * Per wireframe: padding 4px 14px 10px, gap 18px, share on right.
 */
export function ActionRow({
  onLike,
  onComment,
  onShare,
  hasLiked,
  colors,
  functionalColors,
}: {
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  hasLiked?: boolean;
  colors: any;
  functionalColors: any;
}) {
  if (!onLike && !onComment) return null;

  const iconTint = colors.text.primary;
  const likedTint = functionalColors?.like || '#0d9488';

  return (
    <View style={actionStyles.container}>
      {onLike && (
        <TouchableOpacity
          style={actionStyles.button}
          onPress={onLike}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {/* Original chef's kiss PNGs. `like-outline-2-thick.png` is RGB
              (no alpha), so we can NOT apply tintColor on the unliked state
              — it would fill the whole rectangle solid. The filled (liked)
              state is colormap and does tint correctly. */}
          <Image
            source={
              hasLiked
                ? require('../../assets/icons/like-outline-2-filled.png')
                : require('../../assets/icons/like-outline-2-thick.png')
            }
            style={[
              actionStyles.icon,
              hasLiked && { tintColor: likedTint },
            ]}
            resizeMode="contain"
          />
        </TouchableOpacity>
      )}
      {onComment && (
        <TouchableOpacity
          style={[actionStyles.button, { marginLeft: 'auto' }]}
          onPress={onComment}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Image
            source={require('../../assets/icons/comment.png')}
            style={[actionStyles.icon, { tintColor: iconTint }]}
            resizeMode="contain"
          />
        </TouchableOpacity>
      )}
      {/* Share button removed per user request — get rid of the bottom-right
          arrow. `onShare` prop is intentionally ignored here so callers don't
          break, but nothing renders for it. */}
    </View>
  );
}

const actionStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 18,
  },
  button: {
    padding: 6,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 28,
    height: 28,
  },
});

// ============================================================================
// RECIPE LINE (solo cards only)
// ============================================================================

/**
 * Recipe-vs-freeform line for solo dish cards.
 * Recipe-backed: "📖 [Recipe Name] · [Author]" in teal, tappable.
 * Freeform: "📖 Freeform · no recipe" in gray, not tappable.
 */
export function RecipeLine({
  recipeName,
  authorName,
  isRecipeBacked,
  onRecipePress,
  pageNumber,
  colors,
}: {
  recipeName?: string;
  authorName?: string;
  isRecipeBacked: boolean;
  onRecipePress?: () => void;
  /** Phase 7I Checkpoint 5 / Block 6: optional cookbook page number. When
   *  present, renders "· p. 98" appended to the line. Not tappable on its
   *  own — P7-53 deep-linking is deferred. */
  pageNumber?: number | null;
  colors: any;
}) {
  // Phase 7I Checkpoint 3 polish 3.3.1: replaced the 📖 emoji with the
  // BookIcon SVG component from components/icons/recipe/. The icon is
  // slightly offset downward (marginTop: 1) because the SVG viewBox sits
  // a hair higher than the text baseline at size 12.
  if (isRecipeBacked && recipeName) {
    return (
      <View style={recipeLineStyles.container}>
        <View style={{ marginTop: 1 }}>
          <BookIcon size={12} color={colors.primary} />
        </View>
        <TouchableOpacity
          onPress={onRecipePress}
          activeOpacity={onRecipePress ? 0.6 : 1}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
        >
          <Text style={[recipeLineStyles.name, { color: colors.primary, fontWeight: '500' }]}>
            {recipeName}
          </Text>
        </TouchableOpacity>
        {authorName && (
          <>
            <Text style={[recipeLineStyles.separator, { color: colors.text.tertiary }]}> · </Text>
            <Text style={[recipeLineStyles.author, { color: colors.text.tertiary }]}>
              {authorName}
            </Text>
          </>
        )}
        {typeof pageNumber === 'number' && pageNumber > 0 && (
          <>
            <Text style={[recipeLineStyles.separator, { color: colors.text.tertiary }]}> · </Text>
            <Text style={[recipeLineStyles.author, { color: colors.text.tertiary }]}>
              p. {pageNumber}
            </Text>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={recipeLineStyles.container}>
      <View style={{ marginTop: 1 }}>
        <BookIcon size={12} color={colors.text.secondary} />
      </View>
      <Text style={[recipeLineStyles.name, { color: colors.text.secondary }]}>Freeform</Text>
      <Text style={[recipeLineStyles.separator, { color: colors.text.tertiary }]}> · </Text>
      <Text style={[recipeLineStyles.author, { color: colors.text.tertiary }]}>no recipe</Text>
    </View>
  );
}

const recipeLineStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginHorizontal: 14,
    marginBottom: 8,
  },
  icon: {
    fontSize: 12,
  },
  name: {
    fontSize: 12,
  },
  separator: {
    fontSize: 12,
  },
  author: {
    fontSize: 12,
  },
});

// ============================================================================
// STARTED BY FOOTNOTE (meal cards only)
// ============================================================================

/**
 * "started by [Host Name] · [N people invited]" footnote.
 * Per D45/Q33-c: intentionally quiet.
 */
export function StartedByFootnote({
  hostName,
  invitedCount,
  colors,
}: {
  hostName: string;
  invitedCount?: number;
  colors: any;
}) {
  return (
    <Text
      style={{
        fontSize: 10,
        color: colors.text.tertiary,
        fontStyle: 'italic',
        paddingHorizontal: 14,
        paddingBottom: 4,
      }}
    >
      started by {hostName}
      {invitedCount != null && invitedCount > 0 ? ` · ${invitedCount} people invited` : ''}
    </Text>
  );
}
