import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';
import { useLogoConfig } from '../../contexts/LogoConfigContext';
import ChefHat1 from './icons/ChefHat1';
import ChefHat2 from './icons/ChefHat2';
import Fridge from './icons/Fridge';

type IconType = 'chefHat1' | 'chefHat2' | 'fridge' | 'none';
type IconPosition = 'above-g' | 'left' | 'right' | 'overlay';
type LogoSize = 'small' | 'medium' | 'large';
type FontFamily = 'System' | 'Poppins' | 'Outfit';

interface LogoProps {
  icon?: IconType;
  position?: IconPosition;
  iconOffsetX?: number;
  iconOffsetY?: number;
  iconSize?: number;
  fontSize?: number;
  fontWeight?: '400' | '500' | '600' | '700';
  letterSpacing?: number;
  textColor?: string;
  iconColor?: string;
  size?: LogoSize;
  fontFamily?: FontFamily;
  iconStrokeWidth?: number;
  iconOpacity?: number;
}

const SIZE_PRESETS = {
  small: {
    fontSize: 24,
    iconSize: 20,
  },
  medium: {
    fontSize: 36,
    iconSize: 32,
  },
  large: {
    fontSize: 48,
    iconSize: 42,
  },
};

export default function Logo({
  icon,
  position,
  iconOffsetX,
  iconOffsetY,
  iconSize,
  fontSize,
  fontWeight,
  letterSpacing,
  textColor,
  iconColor,
  size = 'medium',
  fontFamily,
  iconStrokeWidth,
  iconOpacity,
}: LogoProps) {
  const { colors } = useTheme();
  const { appLogoConfig } = useLogoConfig();

  // Merge context config with props (props take precedence)
  const finalIcon = icon ?? appLogoConfig?.icon ?? 'chefHat1';
  const finalPosition = position ?? appLogoConfig?.position ?? 'above-g';
  const finalIconOffsetX = iconOffsetX ?? appLogoConfig?.iconOffsetX ?? 0;
  const finalIconOffsetY = iconOffsetY ?? appLogoConfig?.iconOffsetY ?? 0;
  const finalFontWeight = fontWeight ?? appLogoConfig?.fontWeight ?? '600';
  const finalLetterSpacing = letterSpacing ?? appLogoConfig?.letterSpacing ?? -1;
  const finalFontFamily = fontFamily ?? appLogoConfig?.fontFamily ?? 'System';
  const finalIconStrokeWidth = iconStrokeWidth ?? appLogoConfig?.iconStrokeWidth ?? 0;
  const finalIconOpacity = iconOpacity ?? (appLogoConfig as any)?.iconOpacity ?? 1;

  // Apply size preset defaults, allow individual props or context to override
  const preset = SIZE_PRESETS[size];
  const finalFontSize = fontSize ?? appLogoConfig?.fontSize ?? preset.fontSize;
  const finalIconSize = iconSize ?? appLogoConfig?.iconSize ?? preset.iconSize;

  // Resolve theme-aware colors from context config
  const resolveColor = (colorValue: string | undefined): string => {
    if (!colorValue) return colors.primary;
    if (colorValue === 'theme-primary') return colors.primary;
    if (colorValue === 'theme-accent') return colors.accent;
    return colorValue;
  };

  const finalTextColor = textColor
    ? resolveColor(textColor)
    : (appLogoConfig?.textColor ? resolveColor(appLogoConfig.textColor) : colors.primary);
  const finalIconColor = iconColor
    ? resolveColor(iconColor)
    : (appLogoConfig?.iconColor ? resolveColor(appLogoConfig.iconColor) : colors.accent);

  // Map font family to React Native fontFamily based on fontWeight
  const getFontFamily = () => {
    if (finalFontFamily === 'System') return undefined;

    if (finalFontFamily === 'Poppins') {
      switch (finalFontWeight) {
        case '400': return 'Poppins-Regular';
        case '500': return 'Poppins-Medium';
        case '600': return 'Poppins-SemiBold';
        case '700': return 'Poppins-Bold';
        default: return 'Poppins-SemiBold';
      }
    }

    if (finalFontFamily === 'Outfit') {
      switch (finalFontWeight) {
        case '400': return 'Outfit-Regular';
        case '500': return 'Outfit-Medium';
        case '600': return 'Outfit-SemiBold';
        case '700': return 'Outfit-Bold';
        default: return 'Outfit-SemiBold';
      }
    }

    return undefined;
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: finalPosition === 'left' || finalPosition === 'right' ? 'row' : 'column',
      alignItems: 'center',
      gap: finalPosition === 'left' || finalPosition === 'right' ? 8 : 0,
    },
    overlayContainer: {
      position: 'relative',
      alignItems: 'center',
      justifyContent: 'center',
    },
    textContainer: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
    },
    text: {
      fontSize: finalFontSize,
      fontWeight: finalFontFamily === 'System' ? finalFontWeight : undefined, // Don't set fontWeight when using custom fonts
      letterSpacing: finalLetterSpacing,
      color: finalTextColor,
      fontFamily: getFontFamily(),
    },
    gContainer: {
      position: 'relative',
    },
    iconAboveG: {
      position: 'absolute',
      left: '50%',
      transform: [{ translateX: -finalIconSize / 2 }],
      top: -finalIconSize * 0.8 + finalIconOffsetY,
      marginLeft: finalIconOffsetX,
    },
    iconLeftRight: {
      marginLeft: finalIconOffsetX,
      marginTop: finalIconOffsetY,
    },
    iconOverlay: {
      position: 'absolute',
      opacity: finalIconOpacity,
      left: finalIconOffsetX,
      top: finalIconOffsetY,
    },
    textOverlay: {
      position: 'relative',
      zIndex: 1,
    },
  }), [finalPosition, finalFontSize, finalIconSize, finalTextColor, finalFontWeight, finalLetterSpacing, finalIconOffsetX, finalIconOffsetY, finalFontFamily, finalIconOpacity]);

  const renderIcon = () => {
    if (finalIcon === 'none') return null;

    const IconComponent = finalIcon === 'chefHat1' ? ChefHat1
      : finalIcon === 'chefHat2' ? ChefHat2
      : Fridge;

    return <IconComponent size={finalIconSize} color={finalIconColor} strokeWidth={finalIconStrokeWidth} />;
  };

  if (finalPosition === 'above-g') {
    return (
      <View style={styles.textContainer}>
        <Text style={styles.text}>fri</Text>
        <View style={styles.gContainer}>
          <Text style={styles.text}>g</Text>
          <View style={styles.iconAboveG}>
            {renderIcon()}
          </View>
        </View>
        <Text style={styles.text}>o</Text>
      </View>
    );
  }

  if (finalPosition === 'overlay') {
    return (
      <View style={styles.overlayContainer}>
        <View style={styles.iconOverlay}>
          {renderIcon()}
        </View>
        <Text style={[styles.text, styles.textOverlay]}>frigo</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {finalPosition === 'left' && (
        <View style={styles.iconLeftRight}>
          {renderIcon()}
        </View>
      )}
      <Text style={styles.text}>frigo</Text>
      {finalPosition === 'right' && (
        <View style={styles.iconLeftRight}>
          {renderIcon()}
        </View>
      )}
    </View>
  );
}
