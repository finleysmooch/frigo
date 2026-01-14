import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type IconType = 'chefHat1' | 'chefHat2' | 'fridge' | 'none';
type IconPosition = 'above-g' | 'left' | 'right' | 'overlay';
type FontWeight = '400' | '500' | '600' | '700';
type FontFamily = 'System' | 'Poppins' | 'Outfit';

export interface LogoConfig {
  icon?: IconType;
  position?: IconPosition;
  iconOffsetX?: number;
  iconOffsetY?: number;
  iconSize?: number;
  fontSize?: number;
  fontWeight?: FontWeight;
  letterSpacing?: number;
  textColor?: string;
  iconColor?: string;
  fontFamily?: FontFamily;
  iconStrokeWidth?: number;
  iconOpacity?: number;
}

interface LogoConfigContextValue {
  appLogoConfig: LogoConfig | null;
  setAppLogoConfig: (config: LogoConfig) => Promise<void>;
  resetAppLogoConfig: () => Promise<void>;
}

const LogoConfigContext = createContext<LogoConfigContextValue | undefined>(undefined);

const STORAGE_KEY = '@frigo_app_logo_config';

export function LogoConfigProvider({ children }: { children: ReactNode }) {
  const [appLogoConfig, setAppLogoConfigState] = useState<LogoConfig | null>(null);

  // Load saved app logo config on mount
  useEffect(() => {
    loadAppLogoConfig();
  }, []);

  const loadAppLogoConfig = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const config = JSON.parse(stored);
        setAppLogoConfigState(config);
      }
    } catch (error) {
      console.error('Failed to load app logo config:', error);
    }
  };

  const setAppLogoConfig = async (config: LogoConfig) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      setAppLogoConfigState(config);
    } catch (error) {
      console.error('Failed to save app logo config:', error);
      throw error;
    }
  };

  const resetAppLogoConfig = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setAppLogoConfigState(null);
    } catch (error) {
      console.error('Failed to reset app logo config:', error);
      throw error;
    }
  };

  return (
    <LogoConfigContext.Provider value={{ appLogoConfig, setAppLogoConfig, resetAppLogoConfig }}>
      {children}
    </LogoConfigContext.Provider>
  );
}

export function useLogoConfig(): LogoConfigContextValue {
  const context = useContext(LogoConfigContext);
  if (context === undefined) {
    throw new Error('useLogoConfig must be used within a LogoConfigProvider');
  }
  return context;
}
