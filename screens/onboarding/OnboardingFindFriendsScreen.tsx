// CP9b — T5 Find your friends (wireframes v4 screen 5). Sits between Profile
// (T4) and Router (T6). Viral-first: share your invite (the relocated
// CP7-minimal share surface, D-ON-11/17), then same-code cohort suggestions
// (hidden until the get_invite_cohort RPC lands — see onboardingFriendsService),
// then demoted name search. Skippable — never a dead end.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Switch,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../lib/theme/ThemeContext';
import { SearchIcon } from '../../components/icons';
import { getMyPassOnCode } from '../../lib/services/inviteCodeService';
import {
  searchPeople,
  followPerson,
  getInviteCohort,
  PersonResult,
} from '../../lib/services/onboardingFriendsService';
import type { PostAuthOnboardingParamList } from '../../App';

type Props = NativeStackScreenProps<PostAuthOnboardingParamList, 'FindFriends'> & {
  userId: string;
};

const initials = (name: string | null) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || '?';

export default function OnboardingFindFriendsScreen({ navigation, userId }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [sharePantry, setSharePantry] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [cohort, setCohort] = useState<PersonResult[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  useEffect(() => {
    getInviteCohort(userId).then(setCohort).catch(() => {});
  }, [userId]);

  // Debounced name search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const hits = await searchPeople(userId, q);
        if (active) setResults(hits);
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, userId]);

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const code = await getMyPassOnCode(sharePantry);
      await Share.share({
        message: `Join me on Frigo — a home for your home cooking. Your invite code: ${code} · cookfrigo.com`,
      });
    } catch (e) {
      console.error('❌ share invite failed:', e);
      Alert.alert('Hmm', 'Could not get your invite code — try again.');
    } finally {
      setSharing(false);
    }
  };

  const follow = async (person: PersonResult) => {
    if (followed.has(person.id)) return;
    setFollowed((prev) => new Set(prev).add(person.id));
    try {
      await followPerson(userId, person.id);
    } catch (e) {
      console.error('❌ follow failed:', e);
      setFollowed((prev) => {
        const next = new Set(prev);
        next.delete(person.id);
        return next;
      });
    }
  };

  const next = () => navigation.navigate('Router');

  const PersonRow = ({ person, badge }: { person: PersonResult; badge?: string }) => {
    const isFollowing = person.isFollowing || followed.has(person.id);
    return (
      <View style={styles.personRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(person.display_name)}</Text>
        </View>
        <View style={styles.personText}>
          <Text style={styles.personName} numberOfLines={1}>{person.display_name ?? 'Frigo cook'}</Text>
          {!!badge && <Text style={styles.personMeta}>{badge}</Text>}
        </View>
        <TouchableOpacity
          style={[styles.followButton, isFollowing && styles.followingButton]}
          onPress={() => follow(person)}
          disabled={isFollowing}
        >
          <Text style={[styles.followText, isFollowing && styles.followingText]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={results}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PersonRow person={item} />}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Find your friends</Text>

            {/* Share hero (relocated CP7-minimal surface). */}
            <View style={styles.hero}>
              <Text style={styles.heroTitle}>Invite the people you cook with</Text>
              <Text style={styles.heroSubtitle}>
                Frigo's better with friends — share your invite and they're in instantly.
              </Text>
              <TouchableOpacity style={styles.shareButton} onPress={handleShare} disabled={sharing}>
                {sharing ? (
                  <ActivityIndicator color={colors.background.card} />
                ) : (
                  <Text style={styles.shareButtonText}>Share your invite</Text>
                )}
              </TouchableOpacity>
              <View style={styles.toggleRow}>
                <Switch value={sharePantry} onValueChange={setSharePantry} />
                <Text style={styles.toggleLabel}>Invite them to your pantry too</Text>
              </View>
            </View>

            {/* Same-code cohort — hidden until the get_invite_cohort RPC lands. */}
            {cohort.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>SUGGESTED — PEOPLE YOU MAY KNOW</Text>
                {cohort.map((p) => (
                  <PersonRow key={p.id} person={p} badge="From your invite group" />
                ))}
              </View>
            )}

            {/* Demoted name search. */}
            <View style={styles.searchBar}>
              <SearchIcon size={18} color={colors.text.tertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name…"
                placeholderTextColor={colors.text.tertiary}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="words"
                autoCorrect={false}
              />
              {searching && <ActivityIndicator size="small" color={colors.primary} />}
            </View>
          </View>
        }
        ListEmptyComponent={
          query.trim().length >= 2 && !searching ? (
            <Text style={styles.emptyText}>No one by that name yet.</Text>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryButton} onPress={next}>
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryLink} onPress={next}>
          <Text style={styles.secondaryLinkText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.card },
    listContent: { padding: 24, paddingBottom: 8 },
    title: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginBottom: 16 },
    hero: {
      borderRadius: 14,
      backgroundColor: colors.background.secondary ?? (colors.primary + '14'),
      padding: 16,
      gap: 8,
      marginBottom: 20,
    },
    heroTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
    heroSubtitle: { fontSize: 13, color: colors.text.secondary, lineHeight: 18 },
    shareButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: 14,
      alignItems: 'center',
      marginTop: 4,
    },
    shareButtonText: { color: colors.background.card, fontSize: 15, fontWeight: '600' },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    toggleLabel: { fontSize: 12, color: colors.text.secondary },
    section: { marginBottom: 20, gap: 4 },
    sectionLabel: {
      fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
      color: colors.text.secondary, marginBottom: 8,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.background.secondary ?? (colors.border.medium + '33'),
      borderRadius: 12,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text.primary },
    personRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
    },
    avatar: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: colors.background.card, fontSize: 14, fontWeight: '700' },
    personText: { flex: 1 },
    personName: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
    personMeta: { fontSize: 12, color: colors.text.secondary },
    followButton: {
      borderWidth: 1, borderColor: colors.primary, borderRadius: 16,
      paddingHorizontal: 16, paddingVertical: 6,
    },
    followingButton: { backgroundColor: colors.primary, borderColor: colors.primary },
    followText: { fontSize: 13, fontWeight: '600', color: colors.primary },
    followingText: { color: colors.background.card },
    emptyText: { fontSize: 13, color: colors.text.tertiary, paddingVertical: 12 },
    footer: { padding: 24, paddingTop: 8, gap: 12 },
    primaryButton: {
      backgroundColor: colors.primary, padding: 16, borderRadius: 8, alignItems: 'center',
    },
    primaryButtonText: { color: colors.background.card, fontSize: 16, fontWeight: '600' },
    secondaryLink: { alignItems: 'center' },
    secondaryLinkText: { fontSize: 14, color: colors.primary, textDecorationLine: 'underline' },
  });
