// screens/StatsScreen.tsx
// Main Stats dashboard container with sub-tab navigation.
// Header + Cooking Stats/My Posts toggle scroll away.
// Sub-tabs + global period/meal controls stay pinned (sticky bar).
// My Posts rendered inline with .map() to avoid nested VirtualizedList bug (D4-24).

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../lib/theme';
import { MealTypeDropdown } from '../components/stats';
import PeriodToggle from '../components/stats/PeriodToggle';
import type { PeriodOption } from '../components/stats/PeriodToggle';
import { SettingsOutline, SearchIcon } from '../components/icons';
import UserAvatar from '../components/UserAvatar';
import type { StatsStackParamList } from '../App';
import { computeDateRange } from '../lib/services/statsService';
import type { StatsPeriod, MealTypeFilter, DateRange } from '../lib/services/statsService';
import StatsOverview from '../components/stats/StatsOverview';
import StatsRecipes from '../components/stats/StatsRecipes';
import StatsNutrition from '../components/stats/StatsNutrition';
import StatsInsights from '../components/stats/StatsInsights';

type Props = NativeStackScreenProps<StatsStackParamList, 'StatsHome'>;

type SubTab = 'overview' | 'recipes' | 'nutrition' | 'insights';

interface MyPostItem {
  id: string;
  title: string;
  rating: number | null;
  cooking_method: string | null;
  created_at: string;
  recipe_id: string | null;
  recipes: {
    title: string;
    cuisine_types?: string[];
  } | null;
  photos: { url: string; order: number }[];
  yas_count: number;
  nutrition: {
    calories: number | null;
    protein: number | null;
  } | null;
}

const SUB_TABS: { label: string; value: SubTab }[] = [
  { label: 'Overview', value: 'overview' },
  { label: 'Cooking', value: 'recipes' },
  { label: 'Nutrition', value: 'nutrition' },
  { label: 'Insights', value: 'insights' },
];

const PERIOD_OPTIONS: PeriodOption[] = [
  { label: '12W', value: '12w' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
];

function getDateRangeLabel(dateRange: DateRange): string {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);
  const startStr = `${MONTHS[start.getMonth()]} ${start.getDate()}`;
  const endStr = `${MONTHS[end.getMonth()]} ${end.getDate()}`;
  if (start.getFullYear() !== end.getFullYear()) {
    return `${startStr}, ${start.getFullYear()} - ${endStr}, ${end.getFullYear()}`;
  }
  return `${startStr} - ${endStr}`;
}

function getSubtitleText(period: StatsPeriod, timeOffset: number, mealType: MealTypeFilter, dateRange: DateRange): string {
  let periodLabel: string;
  if (timeOffset === 0) {
    periodLabel = period === '12w' ? 'Last 12 Weeks'
      : period === '6m' ? 'Last 6 Months'
      : 'Last Year';
  } else {
    periodLabel = getDateRangeLabel(dateRange);
  }

  const mealLabels: Record<string, string> = {
    all: 'All Meals',
    dinner: 'Dinners Only',
    lunch: 'Lunches Only',
    breakfast: 'Breakfasts Only',
    dessert: 'Desserts Only',
    meal_prep: 'Meal Prep Only',
  };
  return `${periodLabel} · ${mealLabels[mealType] || mealType}`;
}

export default function StatsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [currentUserId, setCurrentUserId] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [activeToggle, setActiveToggle] = useState<'stats' | 'myposts'>('stats');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('overview');
  const [mealType, setMealType] = useState<MealTypeFilter>('all');
  const [period, setPeriod] = useState<StatsPeriod>('12w');
  const [timeOffset, setTimeOffset] = useState<number>(0);
  const [earliestDataDate, setEarliestDataDate] = useState<string | null>(null);

  // My Posts state
  const [myPosts, setMyPosts] = useState<MyPostItem[]>([]);
  const [myPostsLoading, setMyPostsLoading] = useState(false);
  const [myPostsSearchQuery, setMyPostsSearchQuery] = useState('');

  const dateRange = useMemo(() => computeDateRange(period, timeOffset), [period, timeOffset]);

  const isAtMaxOffset = useMemo(() => {
    if (!earliestDataDate) return timeOffset >= 4;
    const windowDays: Record<StatsPeriod, number> = { '12w': 84, '6m': 182, '1y': 365 };
    const days = windowDays[period];
    const earliest = new Date(earliestDataDate + 'T00:00:00');
    const windowStart = new Date(dateRange.start);
    return windowStart <= earliest;
  }, [earliestDataDate, dateRange.start, period, timeOffset]);

  const handlePeriodChange = (newPeriod: StatsPeriod) => {
    setPeriod(newPeriod);
    setTimeOffset(0);
  };

  const scrollRef = useRef<ScrollView>(null);
  const [controlStripScrolledAway, setControlStripScrolledAway] = useState(false);
  const [subtitleExpanded, setSubtitleExpanded] = useState(false);
  const controlStripY = useRef(0);
  const controlStripH = useRef(0);
  const stickyBarH = useRef(0);
  const contentViewY = useRef(0);

  const handleSubTabChange = (tab: SubTab) => {
    setActiveSubTab(tab);
    setControlStripScrolledAway(false);
    setSubtitleExpanded(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('avatar_url, display_name')
        .eq('id', user.id)
        .single();
      if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
      if (profile?.display_name) setDisplayName(profile.display_name);
    }
  };

  const loadMyPosts = async () => {
    if (!currentUserId) return;
    setMyPostsLoading(true);
    try {
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select(`
          id, title, rating, cooking_method, created_at, recipe_id, photos,
          recipes(title, cuisine_types)
        `)
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (postsError) {
        console.error('[MyPosts] Query error:', postsError);
        setMyPosts([]);
        setMyPostsLoading(false);
        return;
      }


      if (!posts) { setMyPosts([]); return; }

      // Fetch yas counts per post
      const postIds = posts.map(p => p.id);
      const { data: yasCounts } = await supabase
        .from('post_reactions')
        .select('post_id')
        .in('post_id', postIds);

      const yasMap = new Map<string, number>();
      (yasCounts || []).forEach(r => {
        yasMap.set(r.post_id, (yasMap.get(r.post_id) || 0) + 1);
      });

      // Fetch nutrition for recipes
      const recipeIds = [...new Set(posts.filter(p => p.recipe_id).map(p => p.recipe_id))] as string[];
      let nutritionMap = new Map<string, { calories: number; protein: number }>();
      if (recipeIds.length > 0) {
        const { data: nutrition } = await supabase
          .from('recipe_nutrition_computed')
          .select('recipe_id, cal_per_serving, protein_per_serving_g')
          .in('recipe_id', recipeIds);
        (nutrition || []).forEach(n => {
          nutritionMap.set(n.recipe_id, {
            calories: Math.round(n.cal_per_serving),
            protein: Math.round(n.protein_per_serving_g),
          });
        });
      }

      const enriched: MyPostItem[] = posts.map(p => ({
        ...p,
        recipes: Array.isArray(p.recipes) ? p.recipes[0] ?? null : p.recipes,
        photos: ((p.photos as any[]) || []).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)),
        yas_count: yasMap.get(p.id) || 0,
        nutrition: p.recipe_id ? nutritionMap.get(p.recipe_id) ?? null : null,
      }));

      setMyPosts(enriched);
    } catch (err) {
      console.error('Error loading my posts:', err);
    } finally {
      setMyPostsLoading(false);
    }
  };

  useEffect(() => {
    if (activeToggle === 'myposts' && currentUserId) {
      loadMyPosts();
    }
  }, [activeToggle, currentUserId]);

  const navigateToSubTab = useCallback((tab: SubTab) => {
    setActiveSubTab(tab);
  }, []);

  const renderContent = () => {
    if (activeToggle === 'myposts') {
      return (
        <MyPostsContent
          posts={myPosts}
          loading={myPostsLoading}
          searchQuery={myPostsSearchQuery}
          onSearchChange={setMyPostsSearchQuery}
          currentUserDisplayName={displayName}
          avatarUrl={avatarUrl}
          navigation={navigation}
        />
      );
    }

    switch (activeSubTab) {
      case 'overview':
        return (
          <StatsOverview
            userId={currentUserId}
            mealType={mealType}
            onMealTypeChange={setMealType}
            dateRange={dateRange}
            period={period}
            onPeriodChange={handlePeriodChange}
            timeOffset={timeOffset}
            onTimeOffsetChange={setTimeOffset}
            isAtMaxOffset={isAtMaxOffset}
            onNavigateSubTab={navigateToSubTab}
            onDataBoundsReady={setEarliestDataDate}
            navigation={navigation}
          />
        );
      case 'recipes':
        return (
          <>
            <ControlStrip
              mealType={mealType} onMealTypeChange={setMealType}
              period={period} onPeriodChange={handlePeriodChange}
              onLayout={(e) => {
                controlStripY.current = e.nativeEvent.layout.y;
                controlStripH.current = e.nativeEvent.layout.height;
              }}
            />
            <StatsRecipes userId={currentUserId} mealType={mealType} dateRange={dateRange} navigation={navigation} />
          </>
        );
      case 'nutrition':
        return (
          <>
            <ControlStrip
              mealType={mealType} onMealTypeChange={setMealType}
              period={period} onPeriodChange={handlePeriodChange}
              onLayout={(e) => {
                controlStripY.current = e.nativeEvent.layout.y;
                controlStripH.current = e.nativeEvent.layout.height;
              }}
            />
            <StatsNutrition userId={currentUserId} mealType={mealType} dateRange={dateRange} />
          </>
        );
      case 'insights':
        return (
          <>
            <ControlStrip
              mealType={mealType} onMealTypeChange={setMealType}
              period={period} onPeriodChange={handlePeriodChange}
              onLayout={(e) => {
                controlStripY.current = e.nativeEvent.layout.y;
                controlStripH.current = e.nativeEvent.layout.height;
              }}
            />
            <StatsInsights userId={currentUserId} mealType={mealType} dateRange={dateRange} />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[1]}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          if (activeSubTab === 'overview' || activeToggle !== 'stats') return;
          const y = e.nativeEvent.contentOffset.y;
          // ControlStrip Y in ScrollView coordinates = content View Y + strip's Y within content
          const stripBottomInScrollView = contentViewY.current + controlStripY.current + controlStripH.current;
          // The strip visually disappears when it scrolls behind the sticky bar
          const hidePoint = stripBottomInScrollView - stickyBarH.current;
          if (y > hidePoint && !controlStripScrolledAway) {
            setControlStripScrolledAway(true);
          } else if (y < hidePoint - 20 && controlStripScrolledAway) {
            setControlStripScrolledAway(false);
            setSubtitleExpanded(false);
          }
        }}
        scrollEventThrottle={16}
      >
        {/* ── Child 0: Header + Cooking Stats/My Posts (scrolls away) ── */}
        <View style={styles.scrollableHeader}>
          {/* Header row */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={() => navigation.navigate('Profile')}
            >
              <UserAvatar user={{ avatar_url: avatarUrl }} size={32} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>You</Text>
            <TouchableOpacity
              style={styles.headerRight}
              onPress={() => navigation.navigate('Settings')}
            >
              <SettingsOutline size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Cooking Stats / My Posts toggle — Strava underline style */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={styles.toggleTab}
              onPress={() => setActiveToggle('stats')}
            >
              <Text style={[
                styles.toggleText,
                activeToggle === 'stats' && styles.toggleTextActive
              ]}>
                Cooking Stats
              </Text>
              {activeToggle === 'stats' && <View style={styles.toggleUnderline} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.toggleTab}
              onPress={() => setActiveToggle('myposts')}
            >
              <Text style={[
                styles.toggleText,
                activeToggle === 'myposts' && styles.toggleTextActive
              ]}>
                My Posts
              </Text>
              {activeToggle === 'myposts' && <View style={styles.toggleUnderline} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Child 1: STICKY control bar (hidden when My Posts active) ── */}
        {activeToggle === 'stats' ? (
          <View style={styles.stickyBar} onLayout={(e) => { stickyBarH.current = e.nativeEvent.layout.height; }}>
            <View style={styles.subTabsRow}>
              {SUB_TABS.map((tab) => {
                const isActive = activeSubTab === tab.value;
                return (
                  <TouchableOpacity
                    key={tab.value}
                    style={[styles.subTabPill, isActive && styles.subTabPillActive]}
                    onPress={() => handleSubTabChange(tab.value)}
                  >
                    <Text style={[styles.subTabText, isActive && styles.subTabTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Sticky subtitle — only on non-Overview tabs when scrolled past controls */}
            {activeSubTab !== 'overview' && controlStripScrolledAway && (
              subtitleExpanded ? (
                <>
                  {/* Subtitle row stays in place — same as collapsed */}
                  <TouchableOpacity
                    style={styles.subtitleRow}
                    onPress={() => setSubtitleExpanded(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.subtitleText}>
                      {getSubtitleText(period, timeOffset, mealType, dateRange)}
                    </Text>
                    <Text style={styles.subtitleChevron}>▴</Text>
                  </TouchableOpacity>
                  {/* Overlay controls — positioned absolutely below the sticky bar */}
                  <View style={styles.expandedOverlay}>
                    <View style={styles.expandedControls}>
                      <View style={styles.expandedMain}>
                        <MealTypeDropdown selected={mealType} onSelect={setMealType} />
                        <PeriodToggle
                          options={PERIOD_OPTIONS}
                          selected={period}
                          onSelect={(v) => handlePeriodChange(v as StatsPeriod)}
                        />
                      </View>
                    </View>
                  </View>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.subtitleRow}
                  onPress={() => setSubtitleExpanded(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.subtitleText}>
                    {getSubtitleText(period, timeOffset, mealType, dateRange)}
                  </Text>
                  <Text style={styles.subtitleChevron}>▾</Text>
                </TouchableOpacity>
              )
            )}
          </View>
        ) : (
          <View style={{ height: 0 }} />
        )}

        {/* ── Child 2: Content (scrolls normally) ── */}
        <View style={styles.content} onLayout={(e) => { contentViewY.current = e.nativeEvent.layout.y; }}>
          {currentUserId ? renderContent() : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── MyPostsContent (inline, uses .map() — no FlatList) ── */

interface MyPostsContentProps {
  posts: MyPostItem[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  currentUserDisplayName: string;
  avatarUrl: string | null;
  navigation: any;
}

function MyPostsContent({ posts, loading, searchQuery, onSearchChange, currentUserDisplayName, avatarUrl, navigation }: MyPostsContentProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createMyPostsStyles(colors), [colors]);

  const filtered = searchQuery.trim()
    ? posts.filter(p =>
        p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.recipes?.title?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : posts;

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <SearchIcon size={16} color={colors.text.tertiary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your posts…"
          placeholderTextColor={colors.text.tertiary}
          value={searchQuery}
          onChangeText={onSearchChange}
        />
      </View>

      {filtered.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No posts yet</Text>
        </View>
      )}

      {filtered.map(post => (
        <ActivityCard
          key={post.id}
          post={post}
          avatarUrl={avatarUrl}
          displayName={currentUserDisplayName}
          colors={colors}
          styles={styles}
          onPress={() => {
            if (post.recipe_id && post.recipes) {
              navigation.navigate('RecipeDetail', { recipe: { id: post.recipe_id, title: post.recipes.title } });
            }
          }}
        />
      ))}

      <View style={{ height: 40 }} />
    </View>
  );
}

/* ── ActivityCard (Strava-style activity card) ── */

function ActivityCard({ post, avatarUrl, displayName, colors, styles, onPress }: any) {
  const date = new Date(post.created_at);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <TouchableOpacity style={styles.activityCard} onPress={onPress} activeOpacity={0.8}>
      {/* Header row */}
      <View style={styles.acHeader}>
        <UserAvatar user={{ avatar_url: avatarUrl }} size={42} />
        <View style={styles.acMeta}>
          <Text style={styles.acName}>{displayName}</Text>
          <View style={styles.acDateRow}>
            <Text style={styles.acDate}>{dateStr}</Text>
            {post.cooking_method && (
              <Text style={styles.acMethod}> · {post.cooking_method}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.acMenu}>
          <Text style={styles.acMenuDots}>···</Text>
        </TouchableOpacity>
      </View>

      {/* Title (large, bold — like Strava activity name) */}
      <Text style={styles.acTitle} numberOfLines={2}>
        {post.title || post.recipes?.title || 'Untitled Cook'}
      </Text>
      {post.recipes?.title && post.title && post.title !== post.recipes.title && (
        <Text style={styles.acSubtitle} numberOfLines={1}>{post.recipes.title}</Text>
      )}

      {/* Stats row (Strava-style bordered 3-column) */}
      <View style={styles.acStatsRow}>
        <View style={styles.acStat}>
          <Text style={styles.acStatVal}>
            {post.rating ? `⭐ ${post.rating.toFixed(1)}` : '—'}
          </Text>
          <Text style={styles.acStatLabel}>RATING</Text>
        </View>
        <View style={[styles.acStat, styles.acStatBorder]}>
          <Text style={styles.acStatVal}>
            {post.nutrition?.calories != null ? `${post.nutrition.calories}` : '—'}
          </Text>
          <Text style={styles.acStatLabel}>CAL/SERVING</Text>
        </View>
        <View style={[styles.acStat, styles.acStatBorder]}>
          <Text style={styles.acStatVal}>
            {post.nutrition?.protein != null ? `${post.nutrition.protein}g` : '—'}
          </Text>
          <Text style={styles.acStatLabel}>PROTEIN</Text>
        </View>
      </View>

      {/* Yas chefs row */}
      {post.yas_count > 0 && (
        <Text style={styles.acYasText}>{post.yas_count} gave yas chefs</Text>
      )}
    </TouchableOpacity>
  );
}

/* ── ControlStrip (shown atop non-Overview sub-pages) ── */

function ControlStrip({
  mealType, onMealTypeChange, period, onPeriodChange, onLayout,
}: {
  mealType: MealTypeFilter;
  onMealTypeChange: (v: MealTypeFilter) => void;
  period: StatsPeriod;
  onPeriodChange: (v: StatsPeriod) => void;
  onLayout?: (event: any) => void;
}) {
  const { colors } = useTheme();
  const cs = useMemo(() => createControlStripStyles(colors), [colors]);

  return (
    <View style={cs.strip} onLayout={onLayout}>
      <MealTypeDropdown selected={mealType} onSelect={onMealTypeChange} />
      <PeriodToggle
        options={PERIOD_OPTIONS}
        selected={period}
        onSelect={(v) => onPeriodChange(v as StatsPeriod)}
      />
    </View>
  );
}

function createControlStripStyles(colors: any) {
  return StyleSheet.create({
    strip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
  });
}

/* ── Styles ── */

function createStyles(colors: any) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background.card,
    },
    scrollableHeader: {
      backgroundColor: colors.background.card,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: spacing.sm,
      backgroundColor: colors.background.card,
    },
    avatarButton: {
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    headerTitle: {
      fontSize: typography.sizes.xl,
      fontWeight: typography.weights.bold as any,
      color: colors.text.primary,
      flex: 1,
      textAlign: 'center',
    },
    headerRight: {
      width: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toggleRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.background.card,
      gap: spacing.lg,
    },
    toggleTab: {
      flex: 1,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    toggleText: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.medium as any,
      color: colors.text.tertiary,
    },
    toggleTextActive: {
      fontWeight: typography.weights.bold as any,
      color: colors.text.primary,
    },
    toggleUnderline: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 3,
      backgroundColor: colors.primary,
      borderRadius: 1.5,
    },
    stickyBar: {
      backgroundColor: colors.background.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      zIndex: 10,
    },
    subTabsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      gap: spacing.sm,
      backgroundColor: colors.background.card,
    },
    subTabPill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: borderRadius.md,
    },
    subTabPillActive: {
      backgroundColor: colors.primary,
    },
    subTabText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      color: colors.text.tertiary,
    },
    subTabTextActive: {
      color: '#ffffff',
      fontWeight: typography.weights.semibold as any,
    },
    content: {
      backgroundColor: colors.background.secondary,
    },
    subtitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xs + 2,
      gap: spacing.xs,
    },
    subtitleText: {
      fontSize: typography.sizes.xs,
      color: colors.text.tertiary,
      fontWeight: typography.weights.medium as any,
      letterSpacing: 0.2,
    },
    subtitleChevron: {
      fontSize: 13,
      color: colors.primary,
    },
    expandedOverlay: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      zIndex: 10,
    },
    expandedControls: {
      backgroundColor: colors.background.card,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      ...shadows.medium,
    },
    expandedMain: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
  });
}

function createMyPostsStyles(colors: any) {
  return StyleSheet.create({
    container: { padding: spacing.md, gap: spacing.md },
    center: { paddingVertical: 60, alignItems: 'center' },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      backgroundColor: colors.background.secondary,
      borderRadius: borderRadius.lg, padding: spacing.sm,
      marginBottom: spacing.xs,
    },
    searchInput: {
      flex: 1, fontSize: typography.sizes.sm, color: colors.text.primary,
    },
    emptyState: { paddingVertical: 60, alignItems: 'center' },
    emptyText: { fontSize: typography.sizes.md, color: colors.text.tertiary },
    activityCard: {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.lg, padding: spacing.lg,
      borderWidth: 1, borderColor: colors.border.light,
      ...shadows.small,
    },
    acHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    acAvatar: { width: 42, height: 42, borderRadius: 21 },
    acMeta: { flex: 1 },
    acName: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold as any, color: colors.text.primary },
    acDateRow: { flexDirection: 'row', marginTop: 1 },
    acDate: { fontSize: typography.sizes.xs, color: colors.text.tertiary },
    acMethod: { fontSize: typography.sizes.xs, color: colors.text.tertiary },
    acMenu: { padding: spacing.xs },
    acMenuDots: { fontSize: 18, color: colors.text.tertiary, letterSpacing: 1 },
    acTitle: {
      fontSize: 19, fontWeight: '800' as any, color: colors.text.primary,
      marginBottom: 3, letterSpacing: -0.3,
    },
    acSubtitle: { fontSize: typography.sizes.sm, color: colors.text.secondary, marginBottom: spacing.sm },
    acStatsRow: {
      flexDirection: 'row',
      borderWidth: 1, borderColor: colors.border.light,
      borderRadius: borderRadius.md, overflow: 'hidden',
      marginVertical: spacing.sm,
    },
    acStat: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center' },
    acStatBorder: { borderLeftWidth: 1, borderLeftColor: colors.border.light },
    acStatVal: {
      fontSize: typography.sizes.md, fontWeight: typography.weights.bold as any,
      color: colors.text.primary,
    },
    acStatLabel: {
      fontSize: 9, color: colors.text.tertiary, fontWeight: '600' as any,
      letterSpacing: 0.5, marginTop: 1,
    },
    acYasText: { fontSize: typography.sizes.xs, color: colors.text.tertiary, marginTop: spacing.xs },
  });
}
