import { useEffect, useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { MyPostsStackParamList } from '../App';
import { useTheme } from '../lib/theme/ThemeContext';
import UserAvatar from '../components/UserAvatar';

type Props = NativeStackScreenProps<MyPostsStackParamList, 'YasChefsList'>;

interface Chef {
  user_id: string;
  name: string;
  location?: string;
  created_at: string;
  avatar_url?: string | null;
  subscription_tier?: string;
}

// Get name from friend_references or fallback to "Chef"
const getChefName = (userId: string, friendName?: string): string => {
  if (friendName) return friendName;
  return `Chef ${userId.substring(0, 4)}`;
};

export default function YasChefsScreen({ route, navigation }: Props) {
  const { postId, postTitle } = route.params;
  const { colors, functionalColors } = useTheme();
  const [chefs, setChefs] = useState<Chef[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.card,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 60,
      paddingBottom: 15,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.medium,
    },
    backButton: {
      width: 60,
    },
    backButtonText: {
      fontSize: 18,
      color: colors.text.primary,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text.primary,
      flex: 1,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 60,
    },
    sectionHeader: {
      backgroundColor: colors.background.secondary,
      paddingVertical: 12,
      paddingHorizontal: 15,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.secondary,
      letterSpacing: 0.5,
    },
    listContainer: {
      paddingBottom: 20,
    },
    chefRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 15,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    avatarContainer: {
      position: 'relative',
      marginRight: 15,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.background.secondary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.border.medium,
    },
    avatarText: {
      fontSize: 32,
    },
    arrowBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#FC4C02', // Strava orange
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.background.card,
    },
    arrowText: {
      color: colors.background.card,
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: -2,
    },
    chefInfo: {
      flex: 1,
    },
    chefName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 2,
    },
    chefLocation: {
      fontSize: 14,
      color: colors.text.secondary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 100,
    },
    emptyText: {
      fontSize: 16,
      color: colors.text.tertiary,
    },
  }), [colors]);

  useEffect(() => {
    loadYasChefs();
  }, []);

  const loadYasChefs = async () => {
    try {
      // Get all likes for this post with friend names if available
      const { data: likesData, error } = await supabase
        .from('post_likes')
        .select(`
          user_id,
          created_at
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true }); // First zesters first

      if (error) throw error;

      if (!likesData || likesData.length === 0) {
        setChefs([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      // Try to get friend names
      const { data: friendsData } = await supabase
        .from('friend_references')
        .select('user_id, name')
        .in('user_id', likesData.map(l => l.user_id));

      // Get user profiles for avatars and subscription tiers
      const { data: profilesData } = await supabase
        .from('user_profiles')
        .select('id, avatar_url, subscription_tier')
        .in('id', likesData.map(l => l.user_id));

      // Combine the data
      const friendsMap = new Map(
        friendsData?.map(f => [f.user_id, f.name]) || []
      );

      const profilesMap = new Map(
        profilesData?.map(p => [p.id, { avatar_url: p.avatar_url, subscription_tier: p.subscription_tier }]) || []
      );

      const chefsWithNames: Chef[] = likesData.map(like => ({
        user_id: like.user_id,
        name: getChefName(like.user_id, friendsMap.get(like.user_id)),
        location: 'Portland, Oregon', // You can add real locations later
        created_at: like.created_at,
        avatar_url: profilesMap.get(like.user_id)?.avatar_url || null,
        subscription_tier: profilesMap.get(like.user_id)?.subscription_tier || 'free'
      }));

      setChefs(chefsWithNames);
      setTotalCount(chefsWithNames.length);
    } catch (error) {
      console.error('Error loading yas chefs:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderChef = ({ item }: { item: Chef }) => (
    <TouchableOpacity style={styles.chefRow}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <UserAvatar
          user={{
            avatar_url: item.avatar_url,
            subscription_tier: item.subscription_tier
          }}
          size={56}
        />
        {/* Orange arrow (Strava style) */}
        <View style={styles.arrowBadge}>
          <Text style={styles.arrowText}>›</Text>
        </View>
      </View>

      {/* Chef Info */}
      <View style={styles.chefInfo}>
        <Text style={styles.chefName}>{item.name}</Text>
        {item.location && (
          <Text style={styles.chefLocation}>{item.location}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>‹ You</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yas Chefs</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>CHEFS YOU FOLLOW</Text>
      </View>

      {/* Chefs List */}
      {chefs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No yas chefs yet</Text>
        </View>
      ) : (
        <FlatList
          data={chefs}
          renderItem={renderChef}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}