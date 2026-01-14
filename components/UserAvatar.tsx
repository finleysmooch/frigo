import React, { useMemo } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';
import { useLogoConfig } from '../contexts/LogoConfigContext';
import ChefHat1 from './branding/icons/ChefHat1';
import ChefHat2 from './branding/icons/ChefHat2';
import Fridge from './branding/icons/Fridge';
import ChefHat1Inverse from './branding/icons/ChefHat1Inverse';
import ChefHat2Inverse from './branding/icons/ChefHat2Inverse';
import FridgeInverse from './branding/icons/FridgeInverse';

interface User {
  avatar_url?: string | null;
  subscription_tier?: string;
}

interface UserAvatarProps {
  user: User;
  size?: number;
}

export default function UserAvatar({ user, size = 40 }: UserAvatarProps) {
  const { colors } = useTheme();
  const { appLogoConfig } = useLogoConfig();
  const isPremium = user.subscription_tier && user.subscription_tier !== 'free';
  const badgeSize = Math.round(size * 0.45); // Increased from 0.38 to 0.45 for better visibility

  // Get logo config settings
  const iconType = appLogoConfig?.icon ?? 'chefHat1';
  const baseStrokeWidth = appLogoConfig?.iconStrokeWidth ?? 0;
  // Increase stroke width by 30%
  const iconStrokeWidth = baseStrokeWidth * 1.3;

  // Resolve icon color from logo config or theme
  const resolveIconColor = () => {
    const configColor = appLogoConfig?.iconColor;
    if (!configColor) return colors.primary;

    // If it's a theme reference (like "theme-accent"), resolve it from colors
    if (configColor.startsWith('theme-')) {
      const colorKey = configColor.replace('theme-', '');
      return (colors as any)[colorKey] || colors.primary;
    }

    // Otherwise use the color directly (hex value)
    return configColor;
  };

  const iconColor = resolveIconColor();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      position: 'relative',
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatar: {
      width: size,
      height: size,
      borderRadius: size / 2,
    },
    emojiAvatar: {
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: colors.background.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emojiText: {
      fontSize: size * 0.6,
    },
    badge: {
      position: 'absolute',
      top: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }), [size, colors, badgeSize]);

  const renderIcon = (iconSize?: number) => {
    const IconComponent = iconType === 'chefHat1' ? ChefHat1
      : iconType === 'chefHat2' ? ChefHat2
      : iconType === 'fridge' ? Fridge
      : ChefHat1;

    return <IconComponent size={iconSize || size} color={iconColor} strokeWidth={iconStrokeWidth} />;
  };

  const renderBadgeIcon = (badgeIconSize: number) => {
    return (
      <Image
        source={require('../assets/icons/chefhat2inverse.png')}
        style={{
          width: badgeIconSize,
          height: badgeIconSize,
          tintColor: colors.accent
        }}
      />
    );
  };

  // Check if avatar_url is an emoji
  const isEmoji = user.avatar_url && /^[\p{Emoji}\u200D]+$/u.test(user.avatar_url);

  // Check if it's a valid image URL
  const isImageUrl = user.avatar_url &&
                     user.avatar_url.trim().length > 0 &&
                     (user.avatar_url.startsWith('http://') || user.avatar_url.startsWith('https://'));

  return (
    <View style={styles.container}>
      {isImageUrl ? (
        <Image
          source={{ uri: user.avatar_url }}
          style={styles.avatar}
        />
      ) : isEmoji ? (
        <View style={styles.emojiAvatar}>
          <Text style={styles.emojiText}>{user.avatar_url}</Text>
        </View>
      ) : (
        renderIcon()
      )}
      {isPremium && (
        <View style={styles.badge}>
          {renderBadgeIcon(badgeSize)}
        </View>
      )}
    </View>
  );
}
