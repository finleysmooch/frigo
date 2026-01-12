// Theme system entry point
// Import everything from here: import { useTheme, ThemeProvider, ... } from './lib/theme';

// Context and hooks
import { ThemeProvider, useTheme } from './ThemeContext';
export { ThemeProvider, useTheme };

// Color schemes
export {
  colorSchemes,
  defaultScheme,
  functionalColors,
  limeZing,
  softSage,
  tealMintSlate,
  tealMintWarm,
} from './schemes';
export type { ColorScheme, ColorSchemeName } from './schemes';

// Typography (new)
export {
  typography,
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
} from './typography';
export type { FontFamily, FontSize, FontWeight, LineHeight } from './typography';

// Backwards compatibility: re-export old theme utilities
// These are used by many components until they're migrated to useTheme()
export {
  colors,
  spacing,
  borderRadius,
  shadows,
  iconSizes,
} from '../oldTheme';
