// components/stats/StatsRecipes.tsx
// Recipes sub-page for the Stats dashboard.
// Reorganized into "Your Kitchen" and "Your Frontier" sections (Phase H Session 3).
// Kitchen: Most Cooked Podium, How You Cook (BubbleMap), Signature Ingredients (family chips),
//          Cuisines + Methods (side-by-side), Top Chefs + Top Books (side-by-side).
// Frontier: Worth Exploring (placeholder), Cookbook Progress, How You Discover.
// Each section fetches independently and handles its own loading/empty state.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../lib/theme/ThemeContext';
import { typography, spacing, borderRadius, shadows } from '../../lib/theme';
import {
  getMostCooked,
  getCookingConcepts,
  getTopIngredients,
  getCuisineBreakdown,
  getMethodBreakdown,
  getTopChefs,
  getTopBooks,
  getCookbookProgress,
  getRecipeDiscovery,
  getFrontierSuggestions,
} from '../../lib/services/statsService';
import type {
  MealTypeFilter,
  DateRange,
  StatsParams,
  MostCookedItem,
  ConceptCount,
  TopIngredientItem,
  CuisineBreakdownItem,
  MethodBreakdownItem,
  TopChefItem,
  TopBookItem,
  CookbookProgressItem,
  RecipeDiscoveryItem,
  FrontierSuggestion,
} from '../../lib/services/statsService';
import type { StatsStackParamList } from '../../App';
import CompactBarRow from './CompactBarRow';
import CookbookProgressRow from './CookbookProgressRow';
import SectionHeader from './SectionHeader';
import MostCookedPodium from './MostCookedPodium';
import MiniBarRow from './MiniBarRow';
import ConceptBubbleMap from './ConceptBubbleMap';
import FrontierCards from './FrontierCards';

/** Convert DB strings like "composed_plate" → "Composed Plate" */
function formatConcept(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

interface StatsRecipesProps {
  userId: string;
  mealType: MealTypeFilter;
  dateRange: DateRange;
  navigation: NativeStackNavigationProp<StatsStackParamList, 'StatsHome'>;
}

// ── Family color mapping for ingredient chips ────────────────────

const FAMILY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  produce:  { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
  pantry:   { bg: '#fffbeb', text: '#b45309', dot: '#f59e0b' },
  dairy:    { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' },
  proteins: { bg: '#fff1f2', text: '#be123c', dot: '#ef4444' },
  other:    { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' },
};

const FAMILY_ORDER = ['produce', 'pantry', 'dairy', 'proteins', 'other'];

function getFamilyColor(family: string | null) {
  const key = (family || 'other').toLowerCase();
  return FAMILY_COLORS[key] || FAMILY_COLORS.other;
}

// ── Classification toggle helpers ─────────────────────────────────

const HERO_COLOR = '#f59e0b';
const HERO_BG = '#fffbeb';
const PRIMARY_COLOR = '#0891b2';
const PRIMARY_BG = '#ecfeff';

const CLASSIFICATION_INFO = {
  hero: 'The star of the dish — the main ingredient the recipe is built around.',
  primary: 'Key supporting ingredients that define the dish\'s character.',
  secondary: 'Background ingredients — seasoning and supporting cast.',
};

function getSigToggleActiveStyle(v: string, colors: any) {
  if (v === 'all') return { backgroundColor: colors.text.primary };
  if (v === 'hero') return { backgroundColor: HERO_COLOR };
  if (v === 'primary') return { backgroundColor: PRIMARY_COLOR };
  return { backgroundColor: colors.text.tertiary };
}
function getSigToggleActiveTextStyle(_v: string, _colors: any) {
  return { color: '#fff' };
}

export default function StatsRecipes({ userId, mealType, dateRange, navigation }: StatsRecipesProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params: StatsParams = useMemo(
    () => ({ userId, dateRange, mealType }),
    [userId, dateRange, mealType]
  );

  return (
    <View style={styles.container}>
      {/* ── YOUR KITCHEN ── */}
      <MostCookedSection params={params} navigation={navigation} colors={colors} styles={styles} />
      <CookingConceptsSection params={params} navigation={navigation} colors={colors} styles={styles} />
      <SignatureIngredientsSection params={params} navigation={navigation} colors={colors} styles={styles} />
      <SideBySideRow>
        <CuisinesSection params={params} navigation={navigation} colors={colors} styles={styles} />
        <MethodsSection params={params} navigation={navigation} colors={colors} styles={styles} />
      </SideBySideRow>
      <SideBySideRow>
        <TopChefsSection params={params} navigation={navigation} colors={colors} styles={styles} />
        <TopBooksSection params={params} navigation={navigation} colors={colors} styles={styles} />
      </SideBySideRow>

      {/* ── YOUR FRONTIER ── */}
      <View style={{ height: spacing.md }} />
      <SectionHeader label="Your Frontier" variant="frontier" />

      <WorthExploringSection params={params} navigation={navigation} colors={colors} styles={styles} />

      <CookbookProgressSection userId={userId} navigation={navigation} colors={colors} styles={styles} />
      <RecipeDiscoverySection params={params} colors={colors} styles={styles} />

      <View style={styles.bottomPadding} />
    </View>
  );
}

// ── Helper: side-by-side wrapper ─────────────────────────────────

function SideBySideRow({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      {children}
    </View>
  );
}

// ── Section: Most Cooked (5-way toggle) ──────────────────────────

function MostCookedSection({
  params, navigation, colors, styles,
}: {
  params: StatsParams;
  navigation: NativeStackNavigationProp<StatsStackParamList, 'StatsHome'>;
  colors: any;
  styles: any;
}) {
  const [mostCooked, setMostCooked] = useState<MostCookedItem[]>([]);
  const [topChefs, setTopChefs] = useState<TopChefItem[]>([]);
  const [topBooks, setTopBooks] = useState<TopBookItem[]>([]);
  const [cuisines, setCuisines] = useState<CuisineBreakdownItem[]>([]);
  const [methods, setMethods] = useState<MethodBreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostCookedView, setMostCookedView] = useState<'recipes' | 'chefs' | 'books' | 'cuisines' | 'methods'>('recipes');

  useEffect(() => {
    load();
  }, [params.userId, params.dateRange.start, params.dateRange.end, params.mealType]);

  const load = async () => {
    setLoading(true);
    try {
      const [mc, chefs, books, cuis, meth] = await Promise.all([
        getMostCooked(params, 10),
        getTopChefs(params, 10),
        getTopBooks(params, 10),
        getCuisineBreakdown(params),
        getMethodBreakdown(params),
      ]);
      setMostCooked(mc);
      setTopChefs(chefs);
      setTopBooks(books);
      setCuisines(cuis);
      setMethods(meth);
    } catch (err) {
      console.error('Error loading most cooked:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMostCookedSeeAll = useCallback(() => {
    if (mostCookedView === 'recipes') {
      navigation.getParent()?.navigate('RecipesStack', {
        screen: 'RecipeList',
        params: { sortBy: 'cook_count' },
      });
    } else if (mostCookedView === 'chefs' || mostCookedView === 'books') {
      navigation.navigate('DrillDown', { type: 'concept', value: '', label: 'All' });
    } else {
      navigation.navigate('DrillDown', { type: mostCookedView as any, value: '', label: 'All' });
    }
  }, [mostCookedView, navigation]);

  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Most Cooked</Text>
        <SectionLoader color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Card header */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Most Cooked</Text>
        <TouchableOpacity onPress={handleMostCookedSeeAll}>
          <Text style={[styles.seeAllLink, { color: colors.primary }]}>See all ›</Text>
        </TouchableOpacity>
      </View>

      {/* 5-way toggle */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {(['recipes','chefs','books','cuisines','methods'] as const).map(v => (
            <TouchableOpacity
              key={v}
              style={[
                styles.mcToggleBtn,
                mostCookedView === v && styles.mcToggleBtnActive,
              ]}
              onPress={() => setMostCookedView(v)}
            >
              <Text style={[
                styles.mcToggleText,
                mostCookedView === v && styles.mcToggleTextActive,
              ]}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Content based on toggle */}
      {mostCookedView === 'recipes' && mostCooked.length > 0 && (
        <MostCookedPodium
          items={mostCooked}
          onRecipePress={recipeId => {
            const item = mostCooked.find(d => d.recipeId === recipeId);
            navigation.navigate('RecipeDetail', { recipe: { id: recipeId, title: item?.title || '' } });
          }}
          onSeeAll={handleMostCookedSeeAll}
          embedded
        />
      )}
      {mostCookedView === 'chefs' && topChefs.map((item, i) => (
        <MiniBarRow
          key={item.chefId}
          rank={i + 1}
          name={item.name}
          count={item.count}
          barPct={i === 0 ? 100 : Math.round((item.count / topChefs[0].count) * 100)}
          onPress={() => navigation.navigate('ChefDetail', { chefId: item.chefId })}
        />
      ))}
      {mostCookedView === 'books' && topBooks.map((item, i) => (
        <MiniBarRow
          key={item.bookId}
          rank={i + 1}
          name={item.title}
          count={item.count}
          barPct={i === 0 ? 100 : Math.round((item.count / topBooks[0].count) * 100)}
          onPress={() => navigation.navigate('BookDetail', { bookId: item.bookId })}
        />
      ))}
      {mostCookedView === 'cuisines' && cuisines.map((item, i) => (
        <MiniBarRow
          key={item.cuisine}
          rank={i + 1}
          name={item.cuisine.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          count={item.count}
          barPct={item.pct}
          onPress={() => navigation.navigate('DrillDown', { type: 'cuisine', value: item.cuisine, label: item.cuisine })}
        />
      ))}
      {mostCookedView === 'methods' && methods.map((item, i) => (
        <MiniBarRow
          key={item.method}
          rank={i + 1}
          name={item.method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          count={item.count}
          barPct={item.pct}
          onPress={() => navigation.navigate('DrillDown', { type: 'method', value: item.method, label: item.method })}
        />
      ))}
    </View>
  );
}

// ── Section: Cooking Concepts (BubbleMap) ────────────────────────

function CookingConceptsSection({
  params, navigation, colors, styles,
}: {
  params: StatsParams;
  navigation: NativeStackNavigationProp<StatsStackParamList, 'StatsHome'>;
  colors: any;
  styles: any;
}) {
  const [data, setData] = useState<ConceptCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [params.userId, params.dateRange.start, params.dateRange.end, params.mealType]);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getCookingConcepts(params));
    } catch (err) {
      console.error('Error loading concepts:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <View style={styles.card}><Text style={styles.cardTitle}>How You Cook</Text><SectionLoader color={colors.primary} /></View>;
  if (data.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>How You Cook</Text>
      <ConceptBubbleMap
        concepts={data}
        onConceptPress={(concept) => {
          navigation.navigate('DrillDown', { type: 'concept', value: concept, label: formatConcept(concept) });
        }}
      />
    </View>
  );
}

// ── Section: Signature Ingredients (family-grouped chips + classification toggle) ────────

function SignatureIngredientsSection({
  params, navigation, colors, styles,
}: {
  params: StatsParams;
  navigation: NativeStackNavigationProp<StatsStackParamList, 'StatsHome'>;
  colors: any;
  styles: any;
}) {
  const [data, setData] = useState<TopIngredientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingredientView, setIngredientView] = useState<'all' | 'hero' | 'primary' | 'secondary'>('all');

  useEffect(() => { load(); }, [params.userId, params.dateRange.start, params.dateRange.end, params.mealType]);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getTopIngredients(params));
    } catch (err) {
      console.error('Error loading ingredients:', err);
    } finally {
      setLoading(false);
    }
  };

  // Group ingredients by family
  const grouped = useMemo(() => {
    const groups: Record<string, TopIngredientItem[]> = {};
    for (const item of data) {
      const key = (item.family || 'other').toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    // Return in canonical order
    return FAMILY_ORDER
      .filter(f => groups[f] && groups[f].length > 0)
      .map(f => ({ family: f, items: groups[f] }));
  }, [data]);

  if (loading) return <View style={styles.card}><Text style={styles.cardTitle}>Signature Ingredients</Text><SectionLoader color={colors.primary} /></View>;
  if (data.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Signature Ingredients</Text>

      {/* Classification toggle */}
      <View style={styles.sigToggleRow}>
        {(['all', 'hero', 'primary', 'secondary'] as const).map(v => (
          <View key={v} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              style={[styles.sigToggleBtn, ingredientView === v && getSigToggleActiveStyle(v, colors)]}
              onPress={() => setIngredientView(v)}
            >
              <Text style={[styles.sigToggleText, ingredientView === v && getSigToggleActiveTextStyle(v, colors)]}>
                {v === 'all' ? 'All' : v === 'hero' ? '⭐ Hero' : v.charAt(0).toUpperCase() + v.slice(1)}
              </Text>
            </TouchableOpacity>
            {v !== 'all' && (
              <TouchableOpacity
                style={styles.sigInfoBtn}
                onPress={() => Alert.alert(
                  v.charAt(0).toUpperCase() + v.slice(1) + ' Ingredients',
                  CLASSIFICATION_INFO[v]
                )}
              >
                <Text style={styles.sigInfoText}>ⓘ</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {/* All: family-grouped chips (unchanged) */}
      {ingredientView === 'all' && grouped.map(({ family, items }) => {
        const fc = getFamilyColor(family);
        return (
          <View key={family} style={{ marginBottom: spacing.sm }}>
            {/* Family header: colored dot + uppercase label */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: fc.dot }} />
              <Text style={{ fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold as any, color: fc.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {family}
              </Text>
            </View>
            {/* Chips row */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {items.slice(0, 8).map((item) => (
                <TouchableOpacity
                  key={item.ingredientId}
                  style={{
                    backgroundColor: fc.bg,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs,
                    borderRadius: borderRadius.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  onPress={() => navigation.navigate('DrillDown', { type: 'ingredient', value: item.ingredientId, label: item.name })}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: typography.sizes.sm, color: fc.text, fontWeight: typography.weights.medium as any }}>
                    {item.name}
                  </Text>
                  <Text style={{ fontSize: typography.sizes.xs, color: fc.text, opacity: 0.6 }}>
                    {item.count}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      })}

      {/* Classification filter: MiniBarRow list */}
      {ingredientView !== 'all' && (() => {
        const filtered = data
          .filter(item => item.classification === ingredientView)
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
        const maxCount = filtered[0]?.count || 1;

        if (filtered.length === 0) {
          return <Text style={styles.placeholderText}>No {ingredientView} ingredients found in this period</Text>;
        }

        return (
          <View>
            {filtered.map((item, i) => (
              <MiniBarRow
                key={item.ingredientId}
                rank={i + 1}
                name={item.name}
                count={item.count}
                barPct={i === 0 ? 100 : Math.round((item.count / maxCount) * 100)}
                onPress={() => navigation.navigate('DrillDown', { type: 'ingredient', value: item.ingredientId, label: item.name })}
              />
            ))}
          </View>
        );
      })()}
    </View>
  );
}

// ── Section: Cuisines ────────────────────────────────────────────

function CuisinesSection({
  params, navigation, colors, styles,
}: {
  params: StatsParams;
  navigation: NativeStackNavigationProp<StatsStackParamList, 'StatsHome'>;
  colors: any;
  styles: any;
}) {
  const [data, setData] = useState<CuisineBreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [params.userId, params.dateRange.start, params.dateRange.end, params.mealType]);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getCuisineBreakdown(params));
    } catch (err) {
      console.error('Error loading cuisines:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.card, { flex: 1 }]}>
      <Text style={styles.cardTitle}>Cuisines</Text>
      {loading ? (
        <SectionLoader color={colors.primary} />
      ) : data.length === 0 ? (
        <EmptySection text="No data" colors={colors} />
      ) : (
        <>
          {data.slice(0, 5).map((item) => (
            <CompactBarRow
              key={item.cuisine}
              name={formatConcept(item.cuisine)}
              count={item.count}
              barPct={(item.count / (data[0]?.count || 1)) * 100}
              onPress={() => navigation.navigate('DrillDown', { type: 'cuisine', value: item.cuisine, label: formatConcept(item.cuisine) })}
            />
          ))}
          {data.length > 5 && (
            <TouchableOpacity onPress={() => navigation.navigate('DrillDown', { type: 'cuisine', value: '', label: 'All Cuisines' })}>
              <Text style={[styles.seeAllLink, { color: colors.primary }]}>See all ›</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

// ── Section: Methods ─────────────────────────────────────────────

function MethodsSection({
  params, navigation, colors, styles,
}: {
  params: StatsParams;
  navigation: NativeStackNavigationProp<StatsStackParamList, 'StatsHome'>;
  colors: any;
  styles: any;
}) {
  const [data, setData] = useState<MethodBreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [params.userId, params.dateRange.start, params.dateRange.end, params.mealType]);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getMethodBreakdown(params));
    } catch (err) {
      console.error('Error loading methods:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.card, { flex: 1 }]}>
      <Text style={styles.cardTitle}>Methods</Text>
      {loading ? (
        <SectionLoader color={colors.primary} />
      ) : data.length === 0 ? (
        <EmptySection text="No data" colors={colors} />
      ) : (
        <>
          {data.slice(0, 5).map((item) => (
            <CompactBarRow
              key={item.method}
              name={formatConcept(item.method)}
              count={item.count}
              barPct={(item.count / (data[0]?.count || 1)) * 100}
              onPress={() => navigation.navigate('DrillDown', { type: 'method', value: item.method, label: formatConcept(item.method) })}
            />
          ))}
          {data.length > 5 && (
            <TouchableOpacity onPress={() => navigation.navigate('DrillDown', { type: 'method', value: '', label: 'All Methods' })}>
              <Text style={[styles.seeAllLink, { color: colors.primary }]}>See all ›</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

// ── Section: Top Chefs ───────────────────────────────────────────

function TopChefsSection({
  params, navigation, colors, styles,
}: {
  params: StatsParams;
  navigation: NativeStackNavigationProp<StatsStackParamList, 'StatsHome'>;
  colors: any;
  styles: any;
}) {
  const [data, setData] = useState<TopChefItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [params.userId, params.dateRange.start, params.dateRange.end, params.mealType]);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getTopChefs(params, 5));
    } catch (err) {
      console.error('Error loading chefs:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <View style={[styles.card, { flex: 1 }]}><Text style={styles.cardTitle}>Top Chefs</Text><SectionLoader color={colors.primary} /></View>;
  if (data.length === 0) return <View style={[styles.card, { flex: 1 }]}><Text style={styles.cardTitle}>Top Chefs</Text><EmptySection text="No data" colors={colors} /></View>;

  const maxCount = data[0]?.count || 1;

  return (
    <View style={[styles.card, { flex: 1 }]}>
      <Text style={styles.cardTitle}>Top Chefs</Text>
      {data.slice(0, 4).map((item) => (
        <CompactBarRow
          key={item.chefId}
          name={item.name}
          count={item.count}
          barPct={Math.round((item.count / maxCount) * 100)}
          onPress={() => navigation.navigate('ChefDetail', { chefId: item.chefId })}
        />
      ))}
    </View>
  );
}

// ── Section: Top Books ───────────────────────────────────────────

function TopBooksSection({
  params, navigation, colors, styles,
}: {
  params: StatsParams;
  navigation: NativeStackNavigationProp<StatsStackParamList, 'StatsHome'>;
  colors: any;
  styles: any;
}) {
  const [data, setData] = useState<TopBookItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [params.userId, params.dateRange.start, params.dateRange.end, params.mealType]);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getTopBooks(params, 5));
    } catch (err) {
      console.error('Error loading books:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <View style={[styles.card, { flex: 1 }]}><Text style={styles.cardTitle}>Top Books</Text><SectionLoader color={colors.primary} /></View>;
  if (data.length === 0) return <View style={[styles.card, { flex: 1 }]}><Text style={styles.cardTitle}>Top Books</Text><EmptySection text="No data" colors={colors} /></View>;

  const maxCount = data[0]?.count || 1;

  return (
    <View style={[styles.card, { flex: 1 }]}>
      <Text style={styles.cardTitle}>Top Books</Text>
      {data.slice(0, 4).map((item) => (
        <CompactBarRow
          key={item.bookId}
          name={item.title}
          count={item.count}
          barPct={Math.round((item.count / maxCount) * 100)}
          onPress={() => navigation.navigate('BookDetail', { bookId: item.bookId })}
        />
      ))}
    </View>
  );
}

// ── Section: Worth Exploring (FrontierCards) ─────────────────────

function WorthExploringSection({
  params, navigation, colors, styles,
}: {
  params: StatsParams;
  navigation: NativeStackNavigationProp<StatsStackParamList, 'StatsHome'>;
  colors: any;
  styles: any;
}) {
  const [data, setData] = useState<FrontierSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [params.userId, params.dateRange.start, params.dateRange.end, params.mealType]);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getFrontierSuggestions(params));
    } catch (err) {
      console.error('Error loading frontier suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePress = (suggestion: FrontierSuggestion) => {
    if (suggestion.type === 'cookbook' && suggestion.bookId) {
      navigation.navigate('BookDetail', { bookId: suggestion.bookId });
    } else if (suggestion.type === 'cuisine') {
      navigation.navigate('DrillDown', { type: 'cuisine', value: suggestion.title, label: suggestion.title });
    } else if (suggestion.type === 'concept') {
      navigation.navigate('DrillDown', { type: 'concept', value: suggestion.title, label: formatConcept(suggestion.title) });
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Worth Exploring</Text>
      {!loading && data.length === 0 ? (
        <Text style={styles.placeholderText}>Keep cooking to unlock frontier suggestions</Text>
      ) : (
        <FrontierCards
          suggestions={data}
          onSuggestionPress={handlePress}
          loading={loading}
        />
      )}
    </View>
  );
}

// ── Section: Cookbook Progress ────────────────────────────────────

function CookbookProgressSection({
  userId, navigation, colors, styles,
}: {
  userId: string;
  navigation: NativeStackNavigationProp<StatsStackParamList, 'StatsHome'>;
  colors: any;
  styles: any;
}) {
  const [data, setData] = useState<CookbookProgressItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [userId]);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getCookbookProgress(userId));
    } catch (err) {
      console.error('Error loading cookbook progress:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <View style={styles.card}><Text style={styles.cardTitle}>Cookbook Progress</Text><SectionLoader color={colors.primary} /></View>;
  if (data.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Cookbook Progress</Text>
      {data.map((item) => (
        <CookbookProgressRow
          key={item.bookId}
          title={item.title}
          cooked={item.cooked}
          total={item.total}
          onPress={() => navigation.navigate('BookDetail', { bookId: item.bookId })}
        />
      ))}
    </View>
  );
}

// ── Section: Recipe Discovery ────────────────────────────────────

function RecipeDiscoverySection({
  params, colors, styles,
}: {
  params: StatsParams;
  colors: any;
  styles: any;
}) {
  const [data, setData] = useState<RecipeDiscoveryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [params.userId, params.dateRange.start, params.dateRange.end, params.mealType]);

  const load = async () => {
    setLoading(true);
    try {
      setData(await getRecipeDiscovery(params));
    } catch (err) {
      console.error('Error loading recipe discovery:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <View style={styles.card}><Text style={styles.cardTitle}>How You Discover</Text><SectionLoader color={colors.primary} /></View>;
  if (data.length === 0) return null;

  const SOURCE_LABELS: Record<string, string> = {
    photo: 'Photo',
    url: 'URL',
    manual: 'Manual',
    ai: 'AI',
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>How You Discover</Text>
      <View style={discoveryStyles.barContainer}>
        {data.map((item) => (
          <View key={item.sourceType} style={[discoveryStyles.barSegment, { flex: item.pct || 1 }]}>
            <View style={[discoveryStyles.bar, { backgroundColor: getDiscoveryColor(item.sourceType, colors) }]} />
            {item.pct >= 5 && (
              <>
                <Text style={[discoveryStyles.label, { color: colors.text.secondary }]}>
                  {SOURCE_LABELS[item.sourceType] || item.sourceType}
                </Text>
                <Text style={[discoveryStyles.pct, { color: colors.text.tertiary }]}>{item.pct}%</Text>
              </>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function getDiscoveryColor(sourceType: string, colors: any): string {
  switch (sourceType) {
    case 'photo': return colors.primary;
    case 'url': return colors.accent || '#f59e0b';
    case 'manual': return '#8b5cf6';
    case 'ai': return '#ec4899';
    default: return colors.border.medium;
  }
}

const discoveryStyles = StyleSheet.create({
  barContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  barSegment: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  bar: {
    width: '100%',
    height: 24,
    borderRadius: borderRadius.sm,
  },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium as any,
  },
  pct: {
    fontSize: typography.sizes.xs,
  },
});

// ── Shared helpers ───────────────────────────────────────────────

function SectionLoader({ color }: { color: string }) {
  return (
    <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
      <ActivityIndicator size="small" color={color} />
    </View>
  );
}

function EmptySection({ text, colors }: { text: string; colors: any }) {
  return (
    <Text style={{
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
      textAlign: 'center',
      paddingVertical: spacing.lg,
    }}>
      {text}
    </Text>
  );
}

// ── Styles ───────────────────────────────────────────────────────

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    card: {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border.light,
      ...shadows.small,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    cardTitle: {
      fontSize: typography.sizes.md,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.primary,
      marginBottom: spacing.sm,
    },
    seeAllLink: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.medium as any,
      textAlign: 'right',
      marginTop: spacing.xs,
    },
    placeholderText: {
      fontSize: typography.sizes.sm,
      color: colors.text.tertiary,
      textAlign: 'center',
      paddingVertical: spacing.lg,
      fontStyle: 'italic',
    },
    bottomPadding: {
      height: 40,
    },
    // Most Cooked 5-way toggle
    mcToggleBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.background.secondary,
    },
    mcToggleBtnActive: {
      backgroundColor: colors.text.primary,
    },
    mcToggleText: {
      fontSize: typography.sizes.sm,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.tertiary,
    },
    mcToggleTextActive: {
      color: '#fff',
    },
    // Signature Ingredients classification toggle
    sigToggleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    sigToggleBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: colors.border.light,
    },
    sigToggleText: {
      fontSize: typography.sizes.xs,
      fontWeight: typography.weights.semibold as any,
      color: colors.text.tertiary,
    },
    sigInfoBtn: {
      paddingHorizontal: 4,
    },
    sigInfoText: {
      fontSize: 13,
      color: colors.text.tertiary,
    },
  });
}
