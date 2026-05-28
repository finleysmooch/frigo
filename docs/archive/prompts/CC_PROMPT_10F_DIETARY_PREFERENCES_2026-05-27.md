# CC Prompt — Phase 10F: Dietary preferences (Settings + browse filter integration)

## Context

Final sub-phase of Phase 10. The `user_dietary_preferences` table was created via SQL migration earlier today 2026-05-27 (mirrors the 8 recipe dietary flag columns + `auto_apply_to_browse`). This step wires it into three surfaces:

1. **New screen** — `DietaryPreferencesScreen` with two semantic sections (DIETARY STYLE for positive prefs, AVOID for restrictions) plus BEHAVIOR toggle
2. **Settings entry** — new row in `SettingsScreen` PREFERENCES section
3. **Browse filter integration** — `RecipeListScreen` pre-applies user prefs as filter chips when `auto_apply_to_browse = true`

Stats compliance summary card is **deferred** — handled in a future iteration. Existing `DietarySection` tiles stay as-is.

## Inputs to read

1. `lib/services/nutritionGoalsService.ts` — reference for the service pattern (similar shape: single-row-per-user table, get/upsert functions)
2. `screens/SettingsScreen.tsx` — particularly the PREFERENCES section (lines ~327-381). New row inserts there.
3. `screens/RecipeListScreen.tsx` — particularly `advancedFilters` state and the dietary filter logic (lines ~1262-1269). The pre-applied filter merges into existing `advancedFilters.dietaryFlags`.
4. `components/FilterDrawer.tsx` — to understand `FilterState` shape and confirm dietary flags integration
5. `App.tsx` — to identify the stack where new screens are registered (likely a tab-internal stack)
6. The verified database schema for `user_dietary_preferences` (created via SQL migration, 12 columns, 3 RLS policies, updated_at trigger)

## Task

### File 1 — NEW: `lib/services/dietaryPreferencesService.ts`

```typescript
import { supabase } from '../supabase';

export interface DietaryPreferences {
  user_id: string;
  is_vegan: boolean;
  is_vegetarian: boolean;
  is_gluten_free: boolean;
  is_dairy_free: boolean;
  is_nut_free: boolean;
  is_shellfish_free: boolean;
  is_soy_free: boolean;
  is_egg_free: boolean;
  auto_apply_to_browse: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * 8 dietary flag keys (excludes user_id, auto_apply_to_browse, timestamps).
 * Used for iteration in UI and counting active prefs.
 */
export const DIETARY_FLAG_KEYS = [
  'is_vegan', 'is_vegetarian',
  'is_gluten_free', 'is_dairy_free', 'is_nut_free',
  'is_shellfish_free', 'is_soy_free', 'is_egg_free',
] as const;
export type DietaryFlagKey = typeof DIETARY_FLAG_KEYS[number];

/**
 * Fetch user's dietary preferences. Returns null if the user has never set them
 * (row doesn't exist yet — defaults apply, but caller decides whether to show "Not set").
 */
export async function getDietaryPreferences(
  userId: string
): Promise<DietaryPreferences | null> {
  const { data, error } = await supabase
    .from('user_dietary_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching dietary preferences:', error);
    return null;
  }
  return data;
}

/**
 * Upsert the user's dietary preferences. Pass partial — service merges with current row.
 */
export async function upsertDietaryPreferences(
  userId: string,
  prefs: Partial<Omit<DietaryPreferences, 'user_id' | 'created_at' | 'updated_at'>>
): Promise<DietaryPreferences | null> {
  const { data, error } = await supabase
    .from('user_dietary_preferences')
    .upsert(
      { user_id: userId, ...prefs },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error upserting dietary preferences:', error);
    return null;
  }
  return data;
}

/** Count how many of the 8 dietary flags are true. Used for Settings subtitle. */
export function countActivePreferences(prefs: DietaryPreferences | null): number {
  if (!prefs) return 0;
  return DIETARY_FLAG_KEYS.reduce((count, key) => count + (prefs[key] ? 1 : 0), 0);
}
```

### File 2 — NEW: `screens/DietaryPreferencesScreen.tsx`

Standard screen with back-nav header. Three sections separated by section headers. Saves auto on every toggle (no Save button — feels modern, no risk of data loss). React Native `Switch` primitive for toggles.

Use the existing theme via `useTheme()` hook. **All Switch components MUST use theme colors via the `trackColor` and `thumbColor` props** — never hardcode `#34C759`:

```typescript
<Switch
  value={prefs.is_vegan}
  onValueChange={(v) => handleToggle('is_vegan', v)}
  trackColor={{ false: colors.background.tertiary, true: colors.primary }}
  thumbColor={colors.background.primary}
/>
```

Skeleton structure:

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../lib/theme/ThemeContext';
import { supabase } from '../lib/supabase';
import {
  getDietaryPreferences,
  upsertDietaryPreferences,
  DietaryPreferences,
  DIETARY_FLAG_KEYS,
  DietaryFlagKey,
} from '../lib/services/dietaryPreferencesService';

// Display config — separate "style" prefs from "avoid" prefs for clearer UX
interface PrefRow {
  key: DietaryFlagKey;
  label: string;
  subtitle?: string;
}

const STYLE_PREFS: PrefRow[] = [
  { key: 'is_vegan', label: 'Vegan', subtitle: 'No animal products' },
  { key: 'is_vegetarian', label: 'Vegetarian', subtitle: 'No meat or seafood' },
];

const AVOID_PREFS: PrefRow[] = [
  { key: 'is_gluten_free', label: 'Gluten', subtitle: 'Wheat, barley, rye' },
  { key: 'is_dairy_free', label: 'Dairy', subtitle: 'Milk, cheese, butter, yogurt' },
  { key: 'is_nut_free', label: 'Nuts', subtitle: 'Tree nuts and peanuts' },
  { key: 'is_shellfish_free', label: 'Shellfish', subtitle: 'Crustaceans and mollusks' },
  { key: 'is_soy_free', label: 'Soy', subtitle: 'Tofu, tempeh, soy sauce, edamame' },
  { key: 'is_egg_free', label: 'Eggs', subtitle: 'Whole eggs and products containing eggs' },
];

const DEFAULT_PREFS: Omit<DietaryPreferences, 'user_id' | 'created_at' | 'updated_at'> = {
  is_vegan: false,
  is_vegetarian: false,
  is_gluten_free: false,
  is_dairy_free: false,
  is_nut_free: false,
  is_shellfish_free: false,
  is_soy_free: false,
  is_egg_free: false,
  auto_apply_to_browse: true,
};

export default function DietaryPreferencesScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const existing = await getDietaryPreferences(user.id);
      if (existing) {
        setPrefs({
          is_vegan: existing.is_vegan,
          is_vegetarian: existing.is_vegetarian,
          is_gluten_free: existing.is_gluten_free,
          is_dairy_free: existing.is_dairy_free,
          is_nut_free: existing.is_nut_free,
          is_shellfish_free: existing.is_shellfish_free,
          is_soy_free: existing.is_soy_free,
          is_egg_free: existing.is_egg_free,
          auto_apply_to_browse: existing.auto_apply_to_browse,
        });
      }
      setLoading(false);
    })();
  }, []);

  const handleToggle = async (key: keyof typeof prefs, value: boolean) => {
    if (!userId) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const result = await upsertDietaryPreferences(userId, next);
    if (!result) {
      // Revert on failure
      setPrefs(prefs);
      Alert.alert('Save failed', 'Could not save your preference. Try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Settings</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Dietary preferences</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.intro}>
          We'll use these to filter recipe browse and compute stats. Change anytime.
        </Text>

        {/* DIETARY STYLE */}
        <Text style={styles.sectionHeader}>DIETARY STYLE</Text>
        <View style={styles.section}>
          {STYLE_PREFS.map((pref, idx) => (
            <View
              key={pref.key}
              style={[styles.row, idx > 0 && styles.rowBorder]}
            >
              <View style={styles.rowLabel}>
                <Text style={styles.rowTitle}>{pref.label}</Text>
                {pref.subtitle && (
                  <Text style={styles.rowSubtitle}>{pref.subtitle}</Text>
                )}
              </View>
              <Switch
                value={prefs[pref.key]}
                onValueChange={(v) => handleToggle(pref.key, v)}
                trackColor={{ false: colors.background.tertiary, true: colors.primary }}
                thumbColor={colors.background.primary}
              />
            </View>
          ))}
        </View>

        {/* AVOID */}
        <Text style={styles.sectionHeader}>AVOID</Text>
        <View style={styles.section}>
          {AVOID_PREFS.map((pref, idx) => (
            <View
              key={pref.key}
              style={[styles.row, idx > 0 && styles.rowBorder]}
            >
              <View style={styles.rowLabel}>
                <Text style={styles.rowTitle}>{pref.label}</Text>
                {pref.subtitle && (
                  <Text style={styles.rowSubtitle}>{pref.subtitle}</Text>
                )}
              </View>
              <Switch
                value={prefs[pref.key]}
                onValueChange={(v) => handleToggle(pref.key, v)}
                trackColor={{ false: colors.background.tertiary, true: colors.primary }}
                thumbColor={colors.background.primary}
              />
            </View>
          ))}
        </View>

        <Text style={styles.safetyDisclaimer}>
          Recipe filtering is a guide, not medical advice. For severe allergies, always read ingredients carefully.
        </Text>

        {/* BEHAVIOR */}
        <Text style={styles.sectionHeader}>BEHAVIOR</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={[styles.rowLabel, { maxWidth: 240 }]}>
              <Text style={styles.rowTitle}>Auto-apply to browse</Text>
              <Text style={styles.rowSubtitle}>
                Pre-filter recipes by your preferences. Can override per view.
              </Text>
            </View>
            <Switch
              value={prefs.auto_apply_to_browse}
              onValueChange={(v) => handleToggle('auto_apply_to_browse', v)}
              trackColor={{ false: colors.background.tertiary, true: colors.primary }}
              thumbColor={colors.background.primary}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: any) {
  // Mirror SettingsScreen.tsx's styles — same fontSize, padding, colors, borders
  // The styles object below is illustrative; match the SettingsScreen idiom exactly
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.secondary },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { /* mirror SettingsScreen header */ },
    backBtn: { width: 80 },
    backText: { color: colors.primary, fontSize: 15 },
    title: { fontSize: 17, fontWeight: '500', color: colors.text.primary },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 40 },
    intro: { fontSize: 13, color: colors.text.secondary, padding: 16, lineHeight: 18 },
    sectionHeader: {
      fontSize: 11, fontWeight: '500', color: colors.text.tertiary,
      letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4,
    },
    section: { backgroundColor: colors.background.primary, marginHorizontal: 0 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    rowBorder: { borderTopWidth: 0.5, borderTopColor: colors.border.tertiary },
    rowLabel: { flex: 1, marginRight: 12 },
    rowTitle: { fontSize: 15, color: colors.text.primary },
    rowSubtitle: { fontSize: 12, color: colors.text.tertiary, marginTop: 2, lineHeight: 16 },
    safetyDisclaimer: {
      fontSize: 12, color: colors.text.tertiary, fontStyle: 'italic',
      paddingHorizontal: 16, paddingTop: 12, lineHeight: 16,
    },
  });
}
```

**Important style cleanup:** Read the existing `SettingsScreen.tsx` styles and copy any idioms that aren't matched in the skeleton above (e.g., specific padding values, divider colors, header height). The new screen should feel like a child of Settings — same visual rhythm.

### File 3 — EDIT: `screens/SettingsScreen.tsx`

Add a new row inside the PREFERENCES section (around line 343, just after Temperature row, before the divider at line 345).

Imports to add at top:
```typescript
import { useState, useEffect } from 'react';
import {
  getDietaryPreferences,
  countActivePreferences,
  DietaryPreferences,
} from '../lib/services/dietaryPreferencesService';
```

State + fetch (add inside the component, near other state):
```typescript
const [dietaryPrefs, setDietaryPrefs] = useState<DietaryPreferences | null>(null);

useEffect(() => {
  (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const prefs = await getDietaryPreferences(user.id);
    setDietaryPrefs(prefs);
  })();
}, []);

// Refresh when screen comes back into focus (user may have changed prefs)
useFocusEffect(useCallback(() => {
  (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const prefs = await getDietaryPreferences(user.id);
    setDietaryPrefs(prefs);
  })();
}, []));
```

(Use `useFocusEffect` from `@react-navigation/native` — already imported elsewhere; verify and add if missing.)

The new row JSX (inserted after Temperature row, before existing divider):
```typescript
<TouchableOpacity 
  style={styles.row} 
  onPress={() => navigation.navigate('DietaryPreferences' as never)}
>
  <View style={styles.rowLeft}>
    <Text style={styles.rowIcon}>🥬</Text>
    <View>
      <Text style={styles.rowTitle}>Dietary preferences</Text>
      <Text style={styles.rowSubtitle}>
        {dietaryPrefs && countActivePreferences(dietaryPrefs) > 0
          ? `${countActivePreferences(dietaryPrefs)} active`
          : 'Not set'}
      </Text>
    </View>
  </View>
  <Text style={styles.chevron}>›</Text>
</TouchableOpacity>
```

### File 4 — EDIT: Navigation stack (likely `App.tsx`)

Register the new `DietaryPreferences` route in whatever stack contains `Settings`. Find the existing `<Stack.Screen name="Settings" ... />` registration and add the new screen below it:

```typescript
import DietaryPreferencesScreen from './screens/DietaryPreferencesScreen';
// ...
<Stack.Screen
  name="DietaryPreferences"
  component={DietaryPreferencesScreen}
  options={{ headerShown: false }}
/>
```

Add the route name to the relevant `ParamList` type if there is one — search for `SettingsStackParamList` or similar in the file and add `DietaryPreferences: undefined;`.

### File 5 — EDIT: `screens/RecipeListScreen.tsx`

Two changes: (a) load user prefs on mount, (b) pre-populate the existing `advancedFilters.dietaryFlags` when `auto_apply_to_browse` is true, (c) render a small "From your dietary preferences" indicator with a "Show all" escape hatch.

**Imports:**
```typescript
import { getDietaryPreferences, DIETARY_FLAG_KEYS, DietaryPreferences } from '../lib/services/dietaryPreferencesService';
```

**State (near other useState calls around line 130-180):**
```typescript
const [userDietaryPrefs, setUserDietaryPrefs] = useState<DietaryPreferences | null>(null);
const [autoFilterDismissed, setAutoFilterDismissed] = useState(false);
```

**Effect to fetch on mount:**
```typescript
useEffect(() => {
  (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const prefs = await getDietaryPreferences(user.id);
    setUserDietaryPrefs(prefs);
    
    // Pre-populate advancedFilters.dietaryFlags if auto-apply is on
    if (prefs && prefs.auto_apply_to_browse) {
      const dietaryFlags: Record<string, boolean> = {};
      DIETARY_FLAG_KEYS.forEach(key => {
        if (prefs[key]) dietaryFlags[key] = true;
      });
      if (Object.keys(dietaryFlags).length > 0) {
        setAdvancedFilters(prev => ({
          ...prev,
          dietaryFlags: { ...(prev.dietaryFlags ?? {}), ...dietaryFlags },
        }));
      }
    }
  })();
}, []);
```

**"From your dietary preferences" indicator** — rendered just above the existing filter chips row when (a) user has prefs set AND (b) auto-apply is on AND (c) hasn't been dismissed this session:

```typescript
{userDietaryPrefs?.auto_apply_to_browse 
  && DIETARY_FLAG_KEYS.some(k => userDietaryPrefs[k])
  && !autoFilterDismissed && (
  <View style={styles.dietaryPrefIndicator}>
    <Text style={styles.dietaryPrefIndicatorIcon}>🥬</Text>
    <Text style={styles.dietaryPrefIndicatorText}>From your dietary preferences</Text>
    <TouchableOpacity 
      onPress={() => {
        setAdvancedFilters(prev => ({ ...prev, dietaryFlags: {} }));
        setAutoFilterDismissed(true);
      }}
    >
      <Text style={styles.dietaryPrefShowAll}>Show all</Text>
    </TouchableOpacity>
  </View>
)}
```

Add the styles. Match the existing filter-chip-area styling (font size ~11px, color tertiary text, padding consistent with surrounding):

```typescript
dietaryPrefIndicator: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 16,
  paddingVertical: 6,
  gap: 6,
},
dietaryPrefIndicatorIcon: { fontSize: 12 },
dietaryPrefIndicatorText: {
  fontSize: 11,
  color: colors.text.secondary,
  flex: 1,
},
dietaryPrefShowAll: {
  fontSize: 11,
  color: colors.primary,
  fontWeight: '500',
},
```

The position depends on the current layout — find the existing filter chips JSX (around lines 1750-1800 where filter chip row renders) and place the indicator immediately above the chips row. Look for the parent `<View>` of the chip row.

## Constraints

- DO NOT modify the existing filter logic (lines ~1262-1269) — it's already correctly applying `advancedFilters.dietaryFlags`. We're only pre-populating the state, not changing the filter mechanism.
- DO NOT change recipe filtering semantics — AND across multiple selected flags stays the same.
- All Switch components MUST use theme tokens (`colors.primary`, `colors.background.tertiary`, `colors.background.primary`) — never hardcode `#34C759` or any other hex.
- Safety disclaimer wording MUST be exactly: `"Recipe filtering is a guide, not medical advice. For severe allergies, always read ingredients carefully."`
- Allergen subtitles MUST be exactly as specified (Gluten: "Wheat, barley, rye", etc.) — these were carefully chosen for accuracy.
- The Settings row icon is `🥬` (leafy green).
- Compliance summary card is NOT in scope — do not add anything to `StatsNutrition.tsx`. Deferred.
- All TS must type-check with strict mode.

## Verification

Before reporting done:

1. `npx tsc --noEmit` — zero new type errors
2. `ls screens/DietaryPreferencesScreen.tsx lib/services/dietaryPreferencesService.ts` — both files exist
3. `grep "DietaryPreferences" App.tsx` — should return route registration
4. `grep "Recipe filtering is a guide" screens/DietaryPreferencesScreen.tsx` — exact disclaimer match
5. `grep "Wheat, barley, rye\|Tofu, tempeh\|Crustaceans and mollusks" screens/DietaryPreferencesScreen.tsx | wc -l` — should be ≥3 (subtitle samples present)
6. `grep "DIETARY_FLAG_KEYS" screens/RecipeListScreen.tsx` — should return the import + usage in pre-population
7. `grep "#34C759\|#34c759" screens/DietaryPreferencesScreen.tsx` — should return ZERO matches (theme tokens only)

## Smoke test guidance for Tom (post-CC)

1. Open Settings — verify new "🥬 Dietary preferences" row with "Not set" subtitle (on first launch)
2. Tap row — DietaryPreferencesScreen opens with empty state (all toggles off)
3. Toggle "Vegetarian" ON — verify the switch animates to active color (theme primary, not iOS green)
4. Go back to Settings — subtitle should now read "1 active"
5. Re-open the screen — toggle should persist (loaded from DB)
6. Go to RecipeListScreen / browse — verify "🥬 From your dietary preferences" indicator appears above the filter chips, recipes are filtered to vegetarian only
7. Tap "Show all" — indicator disappears, all recipes return
8. Navigate away and back to RecipeListScreen — the auto-apply should re-trigger (fresh session)
9. Go back to DietaryPreferencesScreen, turn off "Auto-apply to browse" — return to RecipeListScreen, verify recipes are NOT filtered and indicator doesn't appear
10. Re-enable Auto-apply — confirm pre-filtering returns

## SESSION_LOG entry

Append under today's 2026-05-27 day header, after the 10E entry:

```
### Phase 10F — Dietary preferences (Settings + filter integration) shipped

Added per-user dietary preferences with three integration surfaces.

Schema (via SQL migration earlier today):
- New `user_dietary_preferences` table mirroring 8 recipe dietary flags + `auto_apply_to_browse` boolean
- RLS policies for own-row read/insert/update
- updated_at trigger using existing `update_updated_at_column()` function

Files touched:
- NEW `lib/services/dietaryPreferencesService.ts` — get/upsert functions, DIETARY_FLAG_KEYS constant, countActivePreferences helper
- NEW `screens/DietaryPreferencesScreen.tsx` — DIETARY STYLE + AVOID + BEHAVIOR sections with theme-aware toggles. Allergen subtitles for accuracy ("Wheat, barley, rye" etc.). Safety disclaimer below AVOID section.
- `screens/SettingsScreen.tsx` — new row in PREFERENCES section, refreshes on focus
- `App.tsx` (or stack file) — DietaryPreferences route registered
- `screens/RecipeListScreen.tsx` — load user prefs on mount, pre-populate `advancedFilters.dietaryFlags` when `auto_apply_to_browse` is true, "From your dietary preferences" indicator with "Show all" escape

Design notes:
- Toggles use theme tokens (colors.primary) not iOS system green — adapts to dark mode
- Allergen labels carefully chosen for accuracy. FDA Big 9 coverage gaps noted in DEFERRED_WORK as P10F-future-1 (peanuts, fish, sesame as separate flags requires catalog work)
- Stats compliance summary deferred to v2 — existing dietary tiles unchanged
- Onboarding integration deferred to Phase 12 — F&F ships Settings-only

Pending: Tom smoke test in Expo Go.
```

## Reporting back

When done, paste:
1. Result of `npx tsc --noEmit`
2. The 7 grep verification counts
3. Any deviations / unexpected issues
4. The SESSION_LOG entry
