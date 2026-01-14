import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../lib/theme/ThemeContext';
import { Logo } from '../components/branding';
import { ColorSchemeName } from '../lib/theme/schemes';
import { useLogoConfig } from '../contexts/LogoConfigContext';

type IconType = 'chefHat1' | 'chefHat2' | 'fridge' | 'none';
type IconPosition = 'above-g' | 'left' | 'right' | 'overlay';
type FontWeight = '400' | '500' | '600' | '700';
type FontFamily = 'System' | 'Poppins' | 'Outfit';

interface SavedConfig {
  id: string;
  name: string;
  icon: IconType;
  position: IconPosition;
  iconSize: number;
  iconOffsetX: number;
  iconOffsetY: number;
  fontSize: number;
  fontWeight: FontWeight;
  letterSpacing: number;
  textColor: string;
  iconColor: string;
  fontFamily: FontFamily;
  iconStrokeWidth: number;
  iconOpacity: number;
}

const TEXT_COLOR_PRESETS = [
  { name: 'Theme Primary', value: 'theme-primary', isTheme: true },
  { name: 'Theme Accent', value: 'theme-accent', isTheme: true },
  { name: 'Teal Dark', value: '#0d9488', isTheme: false },
  { name: 'Teal Darker', value: '#134e4a', isTheme: false },
  { name: 'Teal Deep', value: '#115e59', isTheme: false },
  { name: 'Teal Night', value: '#042f2e', isTheme: false },
  { name: 'Black', value: '#000000', isTheme: false },
  { name: 'Gray Dark', value: '#1f2937', isTheme: false },
  { name: 'Gray Med', value: '#374151', isTheme: false },
];

const ICON_COLOR_PRESETS = [
  { name: 'Theme Primary', value: 'theme-primary', isTheme: true },
  { name: 'Theme Accent', value: 'theme-accent', isTheme: true },
  { name: 'Mint', value: '#34d399', isTheme: false },
  { name: 'Mint Light', value: '#6ee7b7', isTheme: false },
  { name: 'Lime', value: '#84cc16', isTheme: false },
  { name: 'Lime Light', value: '#bef264', isTheme: false },
  { name: 'Teal', value: '#0d9488', isTheme: false },
  { name: 'Teal Bright', value: '#14b8a6', isTheme: false },
  { name: 'White', value: '#ffffff', isTheme: false },
];

const BACKGROUND_PRESETS = [
  { name: 'White', value: '#ffffff' },
  { name: 'Light Gray', value: '#f3f4f6' },
  { name: 'Dark Gray', value: '#374151' },
  { name: 'Black', value: '#000000' },
  { name: 'Theme BG', value: 'theme-bg' },
];

const THEME_SCHEMES: ColorSchemeName[] = ['limeZing', 'softSage', 'tealMintSlate', 'tealMintWarm'];

const STORAGE_KEY = '@frigo_logo_configs';

export default function LogoPlaygroundScreen() {
  const { colors, functionalColors, scheme, switchScheme } = useTheme();
  const { appLogoConfig, setAppLogoConfig, resetAppLogoConfig } = useLogoConfig();

  // State for all logo props
  const [icon, setIcon] = useState<IconType>('chefHat1');
  const [position, setPosition] = useState<IconPosition>('above-g');
  const [iconSize, setIconSize] = useState(32);
  const [iconOffsetX, setIconOffsetX] = useState(0);
  const [iconOffsetY, setIconOffsetY] = useState(0);
  const [fontSize, setFontSize] = useState(36);
  const [fontWeight, setFontWeight] = useState<FontWeight>('600');
  const [letterSpacing, setLetterSpacing] = useState(-1);
  const [textColor, setTextColor] = useState('theme-primary');
  const [iconColor, setIconColor] = useState('theme-accent');
  const [fontFamily, setFontFamily] = useState<FontFamily>('System');
  const [iconStrokeWidth, setIconStrokeWidth] = useState(0);
  const [iconOpacity, setIconOpacity] = useState(1);
  const [previewBackground, setPreviewBackground] = useState('#ffffff');

  // Saved configurations
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [configNameInput, setConfigNameInput] = useState('');

  // Load saved configs on mount
  useEffect(() => {
    loadSavedConfigs();
  }, []);

  // Helper to resolve theme-aware colors
  const resolveColor = (colorValue: string): string => {
    if (colorValue === 'theme-primary') return colors.primary;
    if (colorValue === 'theme-accent') return colors.accent;
    if (colorValue === 'theme-bg') return colors.background.card;
    return colorValue;
  };

  // AsyncStorage functions
  const loadSavedConfigs = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const configs = JSON.parse(stored);
        setSavedConfigs(configs);
      }
    } catch (error) {
      console.error('Failed to load saved configs:', error);
    }
  };

  const saveConfigsToStorage = async (configs: SavedConfig[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
    } catch (error) {
      console.error('Failed to save configs:', error);
    }
  };

  // Save current configuration
  const handleSaveConfig = () => {
    const name = configNameInput.trim() || `Config ${savedConfigs.length + 1}`;
    const newConfig: SavedConfig = {
      id: Date.now().toString(),
      name,
      icon,
      position,
      iconSize,
      iconOffsetX,
      iconOffsetY,
      fontSize,
      fontWeight,
      letterSpacing,
      textColor,
      iconColor,
      fontFamily,
      iconStrokeWidth,
      iconOpacity,
    };

    const updatedConfigs = [...savedConfigs, newConfig];
    setSavedConfigs(updatedConfigs);
    saveConfigsToStorage(updatedConfigs);
    setConfigNameInput('');
    Alert.alert('Saved!', `Configuration "${name}" has been saved.`);
  };

  // Load a saved configuration
  const handleLoadConfig = (config: SavedConfig) => {
    setIcon(config.icon);
    setPosition(config.position);
    setIconSize(config.iconSize);
    setIconOffsetX(config.iconOffsetX);
    setIconOffsetY(config.iconOffsetY);
    setFontSize(config.fontSize);
    setFontWeight(config.fontWeight);
    setLetterSpacing(config.letterSpacing);
    setTextColor(config.textColor);
    setIconColor(config.iconColor);
    setFontFamily(config.fontFamily);
    setIconStrokeWidth(config.iconStrokeWidth);
    setIconOpacity(config.iconOpacity ?? 1);
    Alert.alert('Loaded!', `Configuration "${config.name}" has been loaded.`);
  };

  // Delete a saved configuration
  const handleDeleteConfig = (configId: string) => {
    Alert.alert(
      'Delete Configuration',
      'Are you sure you want to delete this configuration?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedConfigs = savedConfigs.filter(c => c.id !== configId);
            setSavedConfigs(updatedConfigs);
            saveConfigsToStorage(updatedConfigs);
          },
        },
      ]
    );
  };

  // Set current configuration as app logo
  const handleSetAsAppLogo = async () => {
    try {
      const config = {
        icon,
        position,
        iconSize,
        iconOffsetX,
        iconOffsetY,
        fontSize,
        fontWeight,
        letterSpacing,
        textColor,
        iconColor,
        fontFamily,
        iconStrokeWidth,
        iconOpacity,
      };
      await setAppLogoConfig(config);
      Alert.alert('Success!', 'This logo is now used across the app.');
    } catch (error) {
      Alert.alert('Error', 'Failed to set app logo');
    }
  };

  // Reset app logo to default
  const handleResetAppLogo = async () => {
    try {
      await resetAppLogoConfig();
      Alert.alert('Reset', 'App logo reset to default.');
    } catch (error) {
      Alert.alert('Error', 'Failed to reset app logo');
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.secondary,
    },
    previewSection: {
      backgroundColor: previewBackground === 'theme-bg' ? colors.background.card : previewBackground,
      padding: 32,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: colors.border.medium,
    },
    scrollContent: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 16,
      marginTop: 8,
    },
    controlGroup: {
      backgroundColor: colors.background.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    controlLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text.secondary,
      marginBottom: 8,
    },
    sliderContainer: {
      marginBottom: 8,
    },
    sliderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    sliderWrapper: {
      flex: 1,
    },
    sliderValue: {
      fontSize: 12,
      color: colors.text.tertiary,
      textAlign: 'right',
      marginTop: 4,
    },
    numericInput: {
      width: 60,
      backgroundColor: colors.background.secondary,
      borderWidth: 2,
      borderColor: colors.border.medium,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      fontSize: 14,
      color: colors.text.primary,
      textAlign: 'center',
    },
    pickerRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    pickerButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.background.secondary,
      borderWidth: 2,
      borderColor: colors.border.medium,
    },
    pickerButtonActive: {
      backgroundColor: colors.primary + '20',
      borderColor: colors.primary,
    },
    pickerButtonText: {
      fontSize: 14,
      color: colors.text.primary,
      fontWeight: '500',
    },
    colorPickerRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    colorOption: {
      width: 50,
      height: 50,
      borderRadius: 8,
      borderWidth: 3,
      borderColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    },
    colorOptionActive: {
      borderColor: colors.text.primary,
    },
    colorOptionLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: '#fff',
      textShadowColor: 'rgba(0, 0, 0, 0.75)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    actionButton: {
      flex: 1,
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    resetButton: {
      backgroundColor: colors.background.secondary,
      borderWidth: 2,
      borderColor: colors.border.medium,
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.background.card,
    },
    resetButtonText: {
      color: colors.text.primary,
    },
    input: {
      backgroundColor: colors.background.secondary,
      borderWidth: 2,
      borderColor: colors.border.medium,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text.primary,
      marginBottom: 12,
    },
    savedConfigItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.background.secondary,
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
    },
    savedConfigName: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text.primary,
      flex: 1,
    },
    savedConfigButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    smallButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: colors.primary,
    },
    deleteButton: {
      backgroundColor: functionalColors.error,
    },
    smallButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#ffffff',
    },
    emptyState: {
      padding: 16,
      alignItems: 'center',
    },
    emptyStateText: {
      fontSize: 14,
      color: colors.text.tertiary,
      fontStyle: 'italic',
    },
  }), [colors, functionalColors, previewBackground]);

  const handleCopyConfig = () => {
    const config = {
      icon,
      position,
      iconSize,
      iconOffsetX,
      iconOffsetY,
      fontSize,
      fontWeight,
      letterSpacing,
      textColor,
      iconColor,
      fontFamily,
      iconStrokeWidth,
      iconOpacity,
    };
    console.log('Logo Configuration:', config);
    console.log('\nUsage:');
    console.log(`<Logo
  icon="${icon}"
  position="${position}"
  iconSize={${iconSize}}
  iconOffsetX={${iconOffsetX}}
  iconOffsetY={${iconOffsetY}}
  fontSize={${fontSize}}
  fontWeight="${fontWeight}"
  letterSpacing={${letterSpacing}}
  textColor="${textColor}"
  iconColor="${iconColor}"
  fontFamily="${fontFamily}"
  iconStrokeWidth={${iconStrokeWidth}}
  iconOpacity={${iconOpacity}}
/>`);
    Alert.alert('Config Copied', 'Logo configuration logged to console');
  };

  const handleReset = () => {
    setIcon('chefHat1');
    setPosition('above-g');
    setIconSize(32);
    setIconOffsetX(0);
    setIconOffsetY(0);
    setFontSize(36);
    setFontWeight('600');
    setLetterSpacing(-1);
    setTextColor('theme-primary');
    setIconColor('theme-accent');
    setFontFamily('System');
    setIconStrokeWidth(0);
    setIconOpacity(1);
    setPreviewBackground('#ffffff');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Live Preview - Sticky at top */}
      <View style={styles.previewSection}>
        <Logo
          icon={icon}
          position={position}
          iconSize={iconSize}
          iconOffsetX={iconOffsetX}
          iconOffsetY={iconOffsetY}
          fontSize={fontSize}
          fontWeight={fontWeight}
          letterSpacing={letterSpacing}
          textColor={resolveColor(textColor)}
          iconColor={resolveColor(iconColor)}
          fontFamily={fontFamily}
          iconStrokeWidth={iconStrokeWidth}
          iconOpacity={iconOpacity}
        />
      </View>

      <ScrollView style={styles.scrollContent}>

        {/* Theme Scheme Picker */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>Color Scheme</Text>
          <View style={styles.pickerRow}>
            {THEME_SCHEMES.map((schemeName) => (
              <TouchableOpacity
                key={schemeName}
                style={[styles.pickerButton, scheme === schemeName && styles.pickerButtonActive]}
                onPress={() => switchScheme(schemeName)}
              >
                <Text style={styles.pickerButtonText}>{schemeName}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Background Color Picker */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>Preview Background</Text>
          <View style={styles.colorPickerRow}>
            {BACKGROUND_PRESETS.map((bgPreset) => {
              const displayColor = bgPreset.value === 'theme-bg' ? colors.background.card : bgPreset.value;
              return (
                <TouchableOpacity
                  key={bgPreset.name}
                  style={[
                    styles.colorOption,
                    { backgroundColor: displayColor },
                    previewBackground === bgPreset.value && styles.colorOptionActive,
                  ]}
                  onPress={() => setPreviewBackground(bgPreset.value)}
                >
                  <Text style={[
                    styles.colorOptionLabel,
                    (displayColor === '#ffffff' || displayColor === '#f3f4f6') && { color: '#000', textShadowColor: 'transparent' }
                  ]}>{bgPreset.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Icon Picker */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>Icon</Text>
          <View style={styles.pickerRow}>
            {(['chefHat1', 'chefHat2', 'fridge', 'none'] as IconType[]).map((iconType) => (
              <TouchableOpacity
                key={iconType}
                style={[styles.pickerButton, icon === iconType && styles.pickerButtonActive]}
                onPress={() => setIcon(iconType)}
              >
                <Text style={styles.pickerButtonText}>{iconType}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Position Picker */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>Position</Text>
          <View style={styles.pickerRow}>
            {(['above-g', 'left', 'right', 'overlay'] as IconPosition[]).map((pos) => (
              <TouchableOpacity
                key={pos}
                style={[styles.pickerButton, position === pos && styles.pickerButtonActive]}
                onPress={() => setPosition(pos)}
              >
                <Text style={styles.pickerButtonText}>{pos}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Icon Size */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>Icon Size</Text>
          <View style={styles.sliderContainer}>
            <View style={styles.sliderRow}>
              <View style={styles.sliderWrapper}>
                <Slider
                  minimumValue={10}
                  maximumValue={100}
                  step={1}
                  value={iconSize}
                  onValueChange={setIconSize}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border.medium}
                />
              </View>
              <TextInput
                style={styles.numericInput}
                value={iconSize.toString()}
                onChangeText={(text) => {
                  const num = parseInt(text) || 10;
                  setIconSize(Math.max(10, Math.min(100, num)));
                }}
                keyboardType="numeric"
                selectTextOnFocus
              />
            </View>
          </View>
        </View>

        {/* Icon Offset X */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>Icon Offset X</Text>
          <View style={styles.sliderContainer}>
            <View style={styles.sliderRow}>
              <View style={styles.sliderWrapper}>
                <Slider
                  minimumValue={-100}
                  maximumValue={100}
                  step={1}
                  value={iconOffsetX}
                  onValueChange={setIconOffsetX}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border.medium}
                />
              </View>
              <TextInput
                style={styles.numericInput}
                value={iconOffsetX.toString()}
                onChangeText={(text) => {
                  const num = parseInt(text) || 0;
                  setIconOffsetX(Math.max(-100, Math.min(100, num)));
                }}
                keyboardType="numeric"
                selectTextOnFocus
              />
            </View>
          </View>
        </View>

        {/* Icon Offset Y */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>Icon Offset Y</Text>
          <View style={styles.sliderContainer}>
            <View style={styles.sliderRow}>
              <View style={styles.sliderWrapper}>
                <Slider
                  minimumValue={-100}
                  maximumValue={100}
                  step={1}
                  value={iconOffsetY}
                  onValueChange={setIconOffsetY}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border.medium}
                />
              </View>
              <TextInput
                style={styles.numericInput}
                value={iconOffsetY.toString()}
                onChangeText={(text) => {
                  const num = parseInt(text) || 0;
                  setIconOffsetY(Math.max(-100, Math.min(100, num)));
                }}
                keyboardType="numeric"
                selectTextOnFocus
              />
            </View>
          </View>
        </View>

        {/* Icon Stroke Width */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>Icon Stroke Width</Text>
          <View style={styles.sliderContainer}>
            <View style={styles.sliderRow}>
              <View style={styles.sliderWrapper}>
                <Slider
                  minimumValue={0}
                  maximumValue={50}
                  step={1}
                  value={iconStrokeWidth}
                  onValueChange={setIconStrokeWidth}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border.medium}
                />
              </View>
              <TextInput
                style={styles.numericInput}
                value={iconStrokeWidth.toString()}
                onChangeText={(text) => {
                  const num = parseInt(text) || 0;
                  setIconStrokeWidth(Math.max(0, Math.min(50, num)));
                }}
                keyboardType="numeric"
                selectTextOnFocus
              />
            </View>
          </View>
        </View>

        {/* Icon Opacity */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>Icon Opacity</Text>
          <View style={styles.sliderContainer}>
            <View style={styles.sliderRow}>
              <View style={styles.sliderWrapper}>
                <Slider
                  minimumValue={0}
                  maximumValue={1}
                  step={0.05}
                  value={iconOpacity}
                  onValueChange={setIconOpacity}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border.medium}
                />
              </View>
              <TextInput
                style={styles.numericInput}
                value={iconOpacity.toFixed(2)}
                onChangeText={(text) => {
                  const num = parseFloat(text) || 0;
                  setIconOpacity(Math.max(0, Math.min(1, num)));
                }}
                keyboardType="numeric"
                selectTextOnFocus
              />
            </View>
          </View>
        </View>

        {/* Font Size */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>Font Size</Text>
          <View style={styles.sliderContainer}>
            <View style={styles.sliderRow}>
              <View style={styles.sliderWrapper}>
                <Slider
                  minimumValue={12}
                  maximumValue={100}
                  step={1}
                  value={fontSize}
                  onValueChange={setFontSize}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border.medium}
                />
              </View>
              <TextInput
                style={styles.numericInput}
                value={fontSize.toString()}
                onChangeText={(text) => {
                  const num = parseInt(text) || 12;
                  setFontSize(Math.max(12, Math.min(100, num)));
                }}
                keyboardType="numeric"
                selectTextOnFocus
              />
            </View>
          </View>
        </View>

        {/* Font Weight */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>Font Weight</Text>
          <View style={styles.pickerRow}>
            {(['400', '500', '600', '700'] as FontWeight[]).map((weight) => (
              <TouchableOpacity
                key={weight}
                style={[styles.pickerButton, fontWeight === weight && styles.pickerButtonActive]}
                onPress={() => setFontWeight(weight)}
              >
                <Text style={styles.pickerButtonText}>{weight}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Font Family */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>Font Family</Text>
          <View style={styles.pickerRow}>
            {(['System', 'Poppins', 'Outfit'] as FontFamily[]).map((family) => (
              <TouchableOpacity
                key={family}
                style={[styles.pickerButton, fontFamily === family && styles.pickerButtonActive]}
                onPress={() => setFontFamily(family)}
              >
                <Text style={styles.pickerButtonText}>{family}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Letter Spacing */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>Letter Spacing</Text>
          <View style={styles.sliderContainer}>
            <View style={styles.sliderRow}>
              <View style={styles.sliderWrapper}>
                <Slider
                  minimumValue={-5}
                  maximumValue={5}
                  step={0.5}
                  value={letterSpacing}
                  onValueChange={setLetterSpacing}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor={colors.border.medium}
                />
              </View>
              <TextInput
                style={styles.numericInput}
                value={letterSpacing.toString()}
                onChangeText={(text) => {
                  const num = parseFloat(text) || 0;
                  setLetterSpacing(Math.max(-5, Math.min(5, num)));
                }}
                keyboardType="numeric"
                selectTextOnFocus
              />
            </View>
          </View>
        </View>

        {/* Text Color Picker */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>Text Color</Text>
          <View style={styles.colorPickerRow}>
            {TEXT_COLOR_PRESETS.map((colorPreset) => {
              const displayColor = resolveColor(colorPreset.value);
              return (
                <TouchableOpacity
                  key={colorPreset.name}
                  style={[
                    styles.colorOption,
                    { backgroundColor: displayColor },
                    textColor === colorPreset.value && styles.colorOptionActive,
                  ]}
                  onPress={() => setTextColor(colorPreset.value)}
                >
                  <Text style={styles.colorOptionLabel}>{colorPreset.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Icon Color Picker */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>Icon Color</Text>
          <View style={styles.colorPickerRow}>
            {ICON_COLOR_PRESETS.map((colorPreset) => {
              const displayColor = resolveColor(colorPreset.value);
              return (
                <TouchableOpacity
                  key={colorPreset.name}
                  style={[
                    styles.colorOption,
                    { backgroundColor: displayColor },
                    iconColor === colorPreset.value && styles.colorOptionActive,
                  ]}
                  onPress={() => setIconColor(colorPreset.value)}
                >
                  <Text style={[
                    styles.colorOptionLabel,
                    displayColor === '#ffffff' && { color: '#000', textShadowColor: 'transparent' }
                  ]}>{colorPreset.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Save Configuration */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>Save Configuration</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter config name (optional)"
            placeholderTextColor={colors.text.placeholder}
            value={configNameInput}
            onChangeText={setConfigNameInput}
          />
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleSaveConfig}
          >
            <Text style={styles.actionButtonText}>Save Current Config</Text>
          </TouchableOpacity>
        </View>

        {/* App Logo Settings */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>App Logo</Text>
          {appLogoConfig && (
            <Text style={[styles.emptyStateText, { marginBottom: 12, fontStyle: 'normal' }]}>
              A custom logo is currently set for the app
            </Text>
          )}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.resetButton]}
              onPress={handleResetAppLogo}
              disabled={!appLogoConfig}
            >
              <Text style={[styles.actionButtonText, styles.resetButtonText, !appLogoConfig && { opacity: 0.4 }]}>Reset to Default</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleSetAsAppLogo}
            >
              <Text style={styles.actionButtonText}>Set as App Logo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Saved Configurations */}
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>Saved Configurations ({savedConfigs.length})</Text>
          {savedConfigs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No saved configurations yet</Text>
            </View>
          ) : (
            savedConfigs.map((config) => (
              <View key={config.id} style={styles.savedConfigItem}>
                <Text style={styles.savedConfigName}>{config.name}</Text>
                <View style={styles.savedConfigButtons}>
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() => handleLoadConfig(config)}
                  >
                    <Text style={styles.smallButtonText}>Load</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallButton, { backgroundColor: colors.accent }]}
                    onPress={async () => {
                      const { id, name, ...configWithoutMeta } = config;
                      await setAppLogoConfig(configWithoutMeta);
                      Alert.alert('Success!', `"${name}" is now the app logo.`);
                    }}
                  >
                    <Text style={styles.smallButtonText}>Use</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallButton, styles.deleteButton]}
                    onPress={() => handleDeleteConfig(config.id)}
                  >
                    <Text style={styles.smallButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.resetButton]}
            onPress={handleReset}
          >
            <Text style={[styles.actionButtonText, styles.resetButtonText]}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCopyConfig}
          >
            <Text style={styles.actionButtonText}>Copy Config</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
