// ============================================
// FRIGO - THEME & COLOR SYSTEM
// ============================================
// Central place for all colors, fonts, and styling constants
// Last updated: October 24, 2025

// COLORS
export const colors = {
  // Primary Brand Colors
  primary: '#4A9B4F',        // Fresh Celery/Cilantro Green - Main brand color, logo, active states
  primaryLight: '#5CAF61',   // Lighter celery green - hover/press states
  primaryDark: '#3A8B3F',    // Darker cilantro green - emphasis
  
  // Accent Colors (keep some blue for links/info)
  accent: '#007AFF',         // iOS Blue - links, info
  accentLight: '#E3F2FD',    // Light blue - backgrounds
  
  // Functional Colors
  success: '#34C759',        // Green - success states, finish buttons
  warning: '#FF9500',        // Orange - warnings, grocery button
  error: '#FF3B30',          // Red - errors, delete actions
  
  // Neutral Colors
  text: {
    primary: '#000000',      // Black - main text
    secondary: '#333333',    // Dark grey - headers
    tertiary: '#666666',     // Medium grey - metadata
    quaternary: '#888888',   // Light grey - secondary info
    placeholder: '#999999',  // Very light grey - placeholders
  },
  
  background: {
    primary: '#FFFFFF',      // White - main background
    secondary: '#F5F5F5',    // Light grey - secondary bg
    tertiary: '#F9F9F9',     // Off-white - cards, inputs
    card: '#FFFFFF',         // Card backgrounds
  },
  
  border: {
    light: '#F0F0F0',        // Very light grey - subtle borders
    medium: '#E0E0E0',       // Light grey - borders
    dark: '#DDDDDD',         // Medium grey - emphasized borders
  },
  
  // Social/Interaction Colors
  like: '#4A9B4F',           // Celery green - yas chef filled
  likeActive: '#5CAF61',     // Lighter green - yas chef pressed
  
  // Strava-inspired
  stravaOrange: '#FC4C02',   // Strava orange for special highlights
};

// TYPOGRAPHY
export const typography = {
  // Font Sizes
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 22,
    xxxl: 28,
  },
  
  // Font Weights (as strings for React Native)
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  
  // Line Heights (multipliers)
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

// SPACING (using 4px base unit)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// BORDER RADIUS
export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: 999, // Fully rounded (pills, avatars)
};

// SHADOWS (for cards and elevation)
export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
};

// ICON SIZES
export const iconSizes = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 30,
  xl: 48,
};

// USAGE EXAMPLES:
// import { colors, typography, spacing } from './theme';
// 
// const styles = StyleSheet.create({
//   container: {
//     backgroundColor: colors.background.primary,
//     padding: spacing.lg,
//   },
//   title: {
//     color: colors.text.primary,
//     fontSize: typography.sizes.xxxl,
//     fontWeight: typography.weights.bold,
//   },
//   likeButton: {
//     tintColor: colors.like, // Forest green for filled state
//   },
// });