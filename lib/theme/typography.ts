// Typography definitions for Frigo
// Font families are set to 'System' for now - can be updated to custom fonts
// like Outfit (headings) or Poppins (body) once fonts are loaded via expo-font

export const fontFamilies = {
  heading: 'System',
  body: 'System',
} as const;

export const fontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const lineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

// Combined typography object for easy importing
export const typography = {
  fonts: fontFamilies,
  sizes: fontSizes,
  weights: fontWeights,
  lineHeights,
} as const;

// Types for TypeScript
export type FontFamily = keyof typeof fontFamilies;
export type FontSize = keyof typeof fontSizes;
export type FontWeight = keyof typeof fontWeights;
export type LineHeight = keyof typeof lineHeights;
