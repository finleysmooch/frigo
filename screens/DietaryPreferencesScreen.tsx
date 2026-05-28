// screens/DietaryPreferencesScreen.tsx
// Phase 10F — per-user dietary preferences settings screen.
// Three sections: DIETARY STYLE (positive prefs), AVOID (restrictions), BEHAVIOR.
// Save-on-toggle (no Save button). Theme-aware Switch tracks/thumb (no hardcoded
// iOS green).

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../lib/theme/ThemeContext';
import { supabase } from '../lib/supabase';
import {
  getDietaryPreferences,
  upsertDietaryPreferences,
  DietaryPreferences,
  DietaryFlagKey,
} from '../lib/services/dietaryPreferencesService';

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

type PrefsState = Omit<DietaryPreferences, 'user_id' | 'created_at' | 'updated_at'>;

const DEFAULT_PREFS: PrefsState = {
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
  const [prefs, setPrefs] = useState<PrefsState>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
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

  const handleToggle = async (key: keyof PrefsState, value: boolean) => {
    if (!userId) return;
    const previous = prefs;
    const next: PrefsState = { ...prefs, [key]: value };
    setPrefs(next);
    const result = await upsertDietaryPreferences(userId, next);
    if (!result) {
      setPrefs(previous);
      Alert.alert('Save failed', 'Could not save your preference. Try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const renderPrefRow = (pref: PrefRow, idx: number) => (
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
        trackColor={{ false: colors.border.medium, true: colors.primary }}
        thumbColor={colors.background.card}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header — mirrors SettingsScreen idiom (border-bottom, primary back-action) */}
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
          {STYLE_PREFS.map(renderPrefRow)}
        </View>

        {/* AVOID */}
        <Text style={styles.sectionHeader}>AVOID</Text>
        <View style={styles.section}>
          {AVOID_PREFS.map(renderPrefRow)}
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
              trackColor={{ false: colors.border.medium, true: colors.primary }}
              thumbColor={colors.background.card}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.secondary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Mirrors SettingsScreen.tsx's header (border-bottom, 16/12 padding, primary back-action)
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
      backgroundColor: colors.background.card,
    },
    backBtn: {
      minWidth: 80,
    },
    backText: {
      color: colors.primary,
      fontSize: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 40,
    },
    intro: {
      fontSize: 13,
      color: colors.text.secondary,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
      lineHeight: 18,
    },
    sectionHeader: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.secondary,
      letterSpacing: 0.5,
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 6,
    },
    section: {
      backgroundColor: colors.background.card,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border.light,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      minHeight: 56,
    },
    rowBorder: {
      borderTopWidth: 0.5,
      borderTopColor: colors.border.light,
    },
    rowLabel: {
      flex: 1,
      marginRight: 12,
    },
    rowTitle: {
      fontSize: 16,
      color: colors.text.primary,
    },
    rowSubtitle: {
      fontSize: 12,
      color: colors.text.tertiary,
      marginTop: 2,
      lineHeight: 16,
    },
    safetyDisclaimer: {
      fontSize: 12,
      color: colors.text.tertiary,
      fontStyle: 'italic',
      paddingHorizontal: 16,
      paddingTop: 12,
      lineHeight: 16,
    },
  });
}
