// Color scheme definitions for Frigo
// All schemes share the primary teal color with different accents

// Functional colors shared across all schemes
export const functionalColors = {
  success: '#22c55e',
  successLight: '#dcfce7',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  error: '#ef4444',
  errorLight: '#fee2e2',
} as const;

// Base color scheme type
export type ColorScheme = {
  name: string;
  primary: string;
  primaryLight: string;
  accent: string;
  accentLight: string;
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    placeholder: string;
  };
  background: {
    primary: string;
    secondary: string;
    card: string;
  };
  border: {
    light: string;
    medium: string;
    dark: string;
  };
};

// Lime Zing - Vibrant lime accent
export const limeZing: ColorScheme = {
  name: 'limeZing',
  primary: '#0d9488',
  primaryLight: '#ccfbf1',
  accent: '#84cc16',
  accentLight: '#ecfccb',
  text: {
    primary: '#0f172a',
    secondary: '#475569',
    tertiary: '#94a3b8',
    placeholder: '#cbd5e1',
  },
  background: {
    primary: '#f0fdfa',
    secondary: '#e6f7f5',
    card: '#ffffff',
  },
  border: {
    light: '#e2e8f0',
    medium: '#cbd5e1',
    dark: '#94a3b8',
  },
};

// Soft Sage - Gentle mint accent
export const softSage: ColorScheme = {
  name: 'softSage',
  primary: '#0d9488',
  primaryLight: '#ccfbf1',
  accent: '#6ee7b7',
  accentLight: '#d1fae5',
  text: {
    primary: '#1c1917',
    secondary: '#57534e',
    tertiary: '#a8a29e',
    placeholder: '#d6d3d1',
  },
  background: {
    primary: '#fafaf9',
    secondary: '#f5f5f4',
    card: '#ffffff',
  },
  border: {
    light: '#e7e5e4',
    medium: '#d6d3d1',
    dark: '#a8a29e',
  },
};

// Teal Mint Slate - Cool slate undertones
export const tealMintSlate: ColorScheme = {
  name: 'tealMintSlate',
  primary: '#0d9488',
  primaryLight: '#ccfbf1',
  accent: '#34d399',
  accentLight: '#a7f3d0',
  text: {
    primary: '#0f172a',
    secondary: '#475569',
    tertiary: '#94a3b8',
    placeholder: '#cbd5e1',
  },
  background: {
    primary: '#f8fafc',
    secondary: '#f1f5f9',
    card: '#ffffff',
  },
  border: {
    light: '#e2e8f0',
    medium: '#cbd5e1',
    dark: '#94a3b8',
  },
};

// Teal Mint Warm - Warm stone undertones
export const tealMintWarm: ColorScheme = {
  name: 'tealMintWarm',
  primary: '#0d9488',
  primaryLight: '#ccfbf1',
  accent: '#34d399',
  accentLight: '#a7f3d0',
  text: {
    primary: '#1c1917',
    secondary: '#57534e',
    tertiary: '#a8a29e',
    placeholder: '#d6d3d1',
  },
  background: {
    primary: '#fafaf9',
    secondary: '#f5f5f4',
    card: '#ffffff',
  },
  border: {
    light: '#e7e5e4',
    medium: '#d6d3d1',
    dark: '#a8a29e',
  },
};

// All available schemes
export const colorSchemes = {
  limeZing,
  softSage,
  tealMintSlate,
  tealMintWarm,
} as const;

export type ColorSchemeName = keyof typeof colorSchemes;

// Default scheme
export const defaultScheme: ColorSchemeName = 'limeZing';
