import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import {
  ColorScheme,
  ColorSchemeName,
  colorSchemes,
  defaultScheme,
  functionalColors,
} from './schemes';

// What the useTheme hook returns
type ThemeContextValue = {
  colors: ColorScheme;
  scheme: ColorSchemeName;
  switchScheme: (schemeName: ColorSchemeName) => void;
  functionalColors: typeof functionalColors;
};

// Create the context with undefined default (we'll check for it in useTheme)
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Props for ThemeProvider
type ThemeProviderProps = {
  children: ReactNode;
  initialScheme?: ColorSchemeName;
};

// ThemeProvider component - wrap your app with this
export function ThemeProvider({ children, initialScheme = defaultScheme }: ThemeProviderProps) {
  const [scheme, setScheme] = useState<ColorSchemeName>(initialScheme);

  // Get the actual color values for the current scheme
  const colors = colorSchemes[scheme];

  // Function to switch to a different scheme
  const switchScheme = (schemeName: ColorSchemeName) => {
    if (colorSchemes[schemeName]) {
      setScheme(schemeName);
    } else {
      console.warn(`Theme scheme "${schemeName}" not found. Available schemes: ${Object.keys(colorSchemes).join(', ')}`);
    }
  };

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo<ThemeContextValue>(
    () => ({
      colors,
      scheme,
      switchScheme,
      functionalColors,
    }),
    [colors, scheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// useTheme hook - use this in components to access theme
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
