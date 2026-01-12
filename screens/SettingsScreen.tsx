import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme/ThemeContext';

interface SettingsScreenProps {
  navigation: any;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { colors, functionalColors } = useTheme();
  const [email, setEmail] = useState('');
  const [subscriptionTier, setSubscriptionTier] = useState('free');

  // Preferences state
  const [useMetric, setUseMetric] = useState(false);
  const [useCelsius, setUseCelsius] = useState(false);

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
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    backButton: {
      fontSize: 16,
      color: colors.primary,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
    },
    scrollView: {
      flex: 1,
    },
    section: {
      marginTop: 24,
      paddingHorizontal: 16,
    },
    sectionHeader: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text.secondary,
      marginBottom: 12,
      letterSpacing: 0.5,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      minHeight: 50,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    rowIcon: {
      fontSize: 24,
    },
    rowTitle: {
      fontSize: 16,
      color: colors.text.primary,
    },
    rowSubtitle: {
      fontSize: 13,
      color: colors.text.secondary,
      marginTop: 2,
    },
    chevron: {
      fontSize: 20,
      color: colors.text.tertiary,
    },
    preference: {
      fontSize: 16,
      color: colors.text.secondary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border.light,
      marginVertical: 8,
    },
    logoutButton: {
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 8,
      alignItems: 'center',
    },
    logoutText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
    },
  }), [colors, functionalColors]);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setEmail(user.email || '');

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .single();

        if (profile) {
          setSubscriptionTier(profile.subscription_tier || 'free');
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              // Navigation will be handled by App.tsx auth state change
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to log out');
            }
          },
        },
      ]
    );
  };

  const showComingSoon = () => {
    Alert.alert('Coming Soon', 'This feature is coming in a future update!');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Profile</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ACCOUNT {email.toUpperCase()}</Text>
          
          <TouchableOpacity style={styles.row} onPress={showComingSoon}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>💳</Text>
              <View>
                <Text style={styles.rowTitle}>Your Frigo Subscription</Text>
                <Text style={styles.rowSubtitle}>
                  {subscriptionTier === 'free' ? 'Free Plan' : subscriptionTier}
                </Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={showComingSoon}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>🎁</Text>
              <Text style={styles.rowTitle}>Gift a Subscription</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={showComingSoon}>
            <Text style={styles.rowTitle}>Change Password</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={showComingSoon}>
            <Text style={styles.rowTitle}>Change Email</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={showComingSoon}>
            <Text style={styles.rowTitle}>Add Backup Email</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={showComingSoon}>
            <Text style={styles.rowTitle}>Help</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PREFERENCES</Text>
          
          <View style={styles.row}>
            <Text style={styles.rowTitle}>Units of Measurement</Text>
            <TouchableOpacity onPress={() => setUseMetric(!useMetric)}>
              <Text style={styles.preference}>{useMetric ? 'Metric' : 'Imperial'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowTitle}>Temperature</Text>
            <TouchableOpacity onPress={() => setUseCelsius(!useCelsius)}>
              <Text style={styles.preference}>{useCelsius ? 'Celsius' : 'Fahrenheit'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={showComingSoon}>
            <Text style={styles.rowTitle}>Privacy Controls</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={showComingSoon}>
            <View>
              <Text style={styles.rowTitle}>Feed Ordering</Text>
              <Text style={styles.rowSubtitle}>Change how recipes are ordered in your feed</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={showComingSoon}>
            <Text style={styles.rowTitle}>Push Notifications</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={showComingSoon}>
            <Text style={styles.rowTitle}>Email Notifications</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={showComingSoon}>
            <Text style={styles.rowTitle}>Data Permissions</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.row} onPress={showComingSoon}>
            <Text style={styles.rowTitle}>Contacts</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}