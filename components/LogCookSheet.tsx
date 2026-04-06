// components/LogCookSheet.tsx
// Phase 7B Revision: Unified cook-logging bottom sheet with compact/full modes
// Compact: from RecipeDetailScreen "I Made This" — lightweight popup (~55%)
// Full: from CookingScreen post-cook — replaces PostCookFlow (~90%)

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  PanResponder,
  LayoutChangeEvent,
  Dimensions,
  InputAccessoryView,
} from 'react-native';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { useTheme } from '../lib/theme/ThemeContext';
import { StarIcon, FriendsIcon } from './icons';

// ── Inline SVG icons ──

function CameraIcon({ size = 20, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="13" r="4" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

function ImageIcon({ size = 20, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="18" height="18" rx="2" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="8.5" cy="8.5" r="1.5" fill={color} />
      <Path d="M21 15l-5-5L5 21" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function MicIcon({ size = 20, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="1" width="6" height="12" rx="3" stroke={color} strokeWidth={1.5} />
      <Path d="M19 10v1a7 7 0 01-14 0v-1" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1="12" y1="19" x2="12" y2="23" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1="8" y1="23" x2="16" y2="23" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function NoteIcon({ size = 20, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 2v6h6" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="8" y1="13" x2="16" y2="13" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1="8" y1="17" x2="13" y2="17" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function EditQtyIcon({ size = 20, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PlusDocIcon({ size = 20, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 2v6h6" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="12" y1="12" x2="12" y2="18" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1="9" y1="15" x2="15" y2="15" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function LockIcon({ size = 16, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="11" width="18" height="11" rx="2" stroke={color} strokeWidth={1.5} />
      <Path d="M7 11V7a5 5 0 0110 0v4" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function CloseIcon({ size = 20, color = '#475569' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// ── Types ──

export interface LogCookSheetProps {
  visible: boolean;
  mode: 'compact' | 'full';
  recipe: {
    id: string;
    title: string;
    book_title?: string;
    book_author?: string;
    page_number?: number;
  };
  modifications?: string;       // only used in 'full' mode
  onSubmit: (data: LogCookData) => void;
  onCancel: () => void;
  onNoteOnStep?: () => void;    // full mode only: close sheet, return to step view
}

export interface LogCookData {
  rating: number | null;
  thoughts: string;
  modifications: string;
  wantsToShare: boolean;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const KEYBOARD_ACCESSORY_ID = 'logcooksheet-keyboard-done';

// ── Component ──

export default function LogCookSheet({
  visible,
  mode,
  recipe,
  modifications: initialModifications,
  onSubmit,
  onCancel,
  onNoteOnStep,
}: LogCookSheetProps) {
  const { colors } = useTheme();
  const isCompact = mode === 'compact';

  const [rating, setRating] = useState<number | null>(null);
  const [thoughts, setThoughts] = useState('');
  const [modifications, setModifications] = useState('');
  const thoughtsRef = useRef<TextInput>(null);
  const modificationsRef = useRef<TextInput>(null);

  const dismissKeyboard = useCallback(() => {
    thoughtsRef.current?.blur();
    modificationsRef.current?.blur();
  }, []);

  // Reset form when sheet opens
  useEffect(() => {
    if (visible) {
      setRating(null);
      setThoughts('');
      setModifications(initialModifications?.trim() || '');
    }
  }, [visible, initialModifications]);

  // ── Half-star slide-to-rate ──
  const starsContainerRef = useRef<View>(null);
  const starsPageXRef = useRef(0);
  const isDraggingRef = useRef(false);

  const STAR_SIZE = 36;
  const STAR_GAP = 6;
  const STARS_TOTAL_WIDTH = 5 * STAR_SIZE + 4 * STAR_GAP; // 204

  const handleStarsLayout = useCallback(() => {
    starsContainerRef.current?.measureInWindow((x) => {
      starsPageXRef.current = x;
    });
  }, []);

  const ratingFromTouchX = useCallback((pageX: number): number | 'clear' | null => {
    const relativeX = pageX - starsPageXRef.current;
    // Way past the right edge — ignore
    if (relativeX > STARS_TOTAL_WIDTH + 8) return null;
    // Past left edge — clear the rating
    if (relativeX < 0) return 'clear';
    const clamped = Math.min(relativeX, STARS_TOTAL_WIDTH);

    for (let i = 0; i < 5; i++) {
      const starStart = i * (STAR_SIZE + STAR_GAP);
      const starEnd = starStart + STAR_SIZE;
      if (clamped <= starEnd) {
        const withinStar = Math.max(0, clamped - starStart);
        return withinStar < STAR_SIZE / 2 ? i + 0.5 : i + 1;
      }
      if (clamped < starStart + STAR_SIZE + STAR_GAP) {
        return i + 1;
      }
    }
    return 5;
  }, []);

  const starPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > 4 && Math.abs(gs.dx) > Math.abs(gs.dy),
        onPanResponderGrant: (evt) => {
          isDraggingRef.current = false;
          starsContainerRef.current?.measureInWindow((x) => {
            starsPageXRef.current = x;
          });
          const result = ratingFromTouchX(evt.nativeEvent.pageX);
          if (result === 'clear') setRating(null);
          else if (result !== null) setRating(result);
        },
        onPanResponderMove: (evt) => {
          isDraggingRef.current = true;
          const result = ratingFromTouchX(evt.nativeEvent.pageX);
          if (result === 'clear') setRating(null);
          else if (result !== null) setRating(result);
        },
      }),
    [ratingFromTouchX]
  );

  const renderStar = useCallback((starIndex: number, currentRating: number | null) => {
    const starNumber = starIndex + 1;
    const fillAmount = currentRating === null
      ? 0
      : currentRating >= starNumber
        ? 1
        : currentRating >= starNumber - 0.5
          ? 0.5
          : 0;

    const emptyColor = colors.border.medium;
    const filledColor = colors.primary;

    return (
      <View key={starIndex} style={{ width: STAR_SIZE, height: STAR_SIZE }}>
        <View style={{ position: 'absolute' }}>
          <StarIcon size={STAR_SIZE} color={emptyColor} />
        </View>
        {fillAmount > 0 && (
          <View style={{
            position: 'absolute',
            width: fillAmount === 1 ? STAR_SIZE : STAR_SIZE / 2,
            height: STAR_SIZE,
            overflow: 'hidden',
          }}>
            <StarIcon size={STAR_SIZE} color={filledColor} />
          </View>
        )}
      </View>
    );
  }, [colors]);

  const ratingLabel = rating !== null
    ? (Number.isInteger(rating) ? `${rating}.0` : `${rating}`)
    : null;

  const handleSubmit = (wantsToShare: boolean) => {
    onSubmit({
      rating,
      thoughts: thoughts.trim(),
      modifications: isCompact ? '' : modifications.trim(),
      wantsToShare,
    });
  };

  const comingSoon = (feature: string) => {
    Alert.alert('Coming soon', `${feature} will be available in a future update.`);
  };

  const bookRef = recipe.book_title
    ? `${recipe.book_title}${recipe.book_author ? ` \u00b7 ${recipe.book_author}` : ''}${recipe.page_number ? ` \u00b7 p.${recipe.page_number}` : ''}`
    : null;

  const sheetHeight = isCompact ? SCREEN_HEIGHT * 0.65 : SCREEN_HEIGHT * 0.9;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        },
        backdropTap: {
          flex: 1,
        },
        sheet: {
          backgroundColor: colors.background.card,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: sheetHeight,
        },
        dragHandle: {
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border.medium,
          alignSelf: 'center',
          marginTop: 10,
          marginBottom: 6,
        },
        compactBody: {
          paddingHorizontal: 20,
          paddingBottom: 8,
        },
        scrollContent: {
          paddingHorizontal: 20,
          paddingBottom: 16,
        },
        // Header
        headerRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          paddingTop: 4,
          paddingBottom: isCompact ? 16 : 20,
          paddingHorizontal: 20,
        },
        headerTextArea: {
          flex: 1,
          alignItems: 'center',
          paddingHorizontal: 32,
        },
        headerTitle: {
          fontSize: isCompact ? 18 : 20,
          fontWeight: '700',
          color: colors.text.primary,
          marginBottom: 4,
          textAlign: 'center',
        },
        headerRecipe: {
          fontSize: 15,
          color: colors.text.secondary,
          textAlign: 'center',
        },
        headerBook: {
          fontSize: 12,
          color: colors.text.tertiary,
          marginTop: 2,
          textAlign: 'center',
        },
        closeButton: {
          position: 'absolute',
          right: 16,
          top: 4,
          padding: 4,
        },
        // Section
        sectionLabel: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.text.primary,
          marginBottom: 10,
        },
        sectionSublabel: {
          fontSize: 12,
          color: colors.text.tertiary,
          marginTop: -6,
          marginBottom: 10,
        },
        section: {
          marginBottom: 22,
        },
        // Stars
        ratingHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        ratingBadgeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        ratingBadge: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.primary,
        },
        ratingClear: {
          fontSize: 13,
          color: colors.text.tertiary,
          textDecorationLine: 'underline',
        },
        starsRow: {
          flexDirection: 'row',
          gap: 6,
          paddingVertical: 16,  // generous vertical hit area
          marginVertical: -8,   // visually reclaim some space
        },
        // Remember chips (full mode)
        rememberChipsRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 18,
        },
        rememberChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          backgroundColor: colors.background.card,
          borderWidth: 1,
          borderColor: colors.border.light,
          borderRadius: 20,
          paddingHorizontal: 12,
          paddingVertical: 6,
        },
        rememberChipText: {
          fontSize: 12,
          color: colors.text.secondary,
        },
        // Modifications input (full mode)
        modificationsInput: {
          backgroundColor: colors.background.secondary,
          borderWidth: 1,
          borderColor: colors.border.light,
          borderRadius: 10,
          padding: 12,
          fontSize: 15,
          color: colors.text.primary,
          minHeight: 60,
          textAlignVertical: 'top',
        },
        // Photo area
        photoRow: {
          flexDirection: 'row',
          gap: 12,
        },
        photoBox: {
          flex: 1,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: colors.border.medium,
          borderRadius: 12,
          paddingVertical: 20,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        },
        photoBoxText: {
          fontSize: 12,
          color: colors.text.secondary,
          fontWeight: '500',
        },
        // Thoughts
        thoughtsInput: {
          backgroundColor: colors.background.secondary,
          borderWidth: 1,
          borderColor: colors.border.light,
          borderRadius: 10,
          padding: 12,
          fontSize: 15,
          color: colors.text.primary,
          minHeight: isCompact ? 60 : 80,
          textAlignVertical: 'top',
        },
        helperChipsRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 10,
        },
        helperChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          backgroundColor: colors.background.card,
          borderWidth: 1,
          borderColor: colors.border.light,
          borderRadius: 20,
          paddingHorizontal: 12,
          paddingVertical: 6,
        },
        helperChipText: {
          fontSize: 12,
          color: colors.text.secondary,
        },
        privacyHint: {
          fontSize: 11,
          color: colors.text.tertiary,
          marginTop: 8,
        },
        // Tag row
        tagRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border.light,
        },
        tagText: {
          fontSize: 14,
          color: colors.text.secondary,
        },
        // Multi-dish prompt
        multiDishRow: {
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: colors.border.medium,
          borderRadius: 12,
          padding: 14,
          gap: 12,
        },
        multiDishContent: {
          flex: 1,
        },
        multiDishTitle: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.text.primary,
        },
        multiDishSub: {
          fontSize: 12,
          color: colors.text.tertiary,
          marginTop: 2,
        },
        multiDishPlus: {
          fontSize: 20,
          fontWeight: '600',
          color: colors.primary,
        },
        // CTAs
        ctaArea: {
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Platform.OS === 'ios' ? 34 : 20,
          borderTopWidth: 1,
          borderTopColor: colors.border.light,
          backgroundColor: colors.background.card,
        },
        logShareButton: {
          backgroundColor: colors.primary,
          paddingVertical: 15,
          borderRadius: 12,
          alignItems: 'center',
          marginBottom: 8,
        },
        logShareButtonText: {
          color: '#ffffff',
          fontSize: 16,
          fontWeight: '600',
        },
        justLogButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 10,
        },
        justLogText: {
          fontSize: 14,
          color: colors.text.tertiary,
        },
        // Keyboard accessory bar
        keyboardBar: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background.secondary,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border.light,
          paddingHorizontal: 12,
          paddingVertical: 8,
        },
        keyboardDoneBtn: {
          paddingHorizontal: 12,
          paddingVertical: 4,
        },
        keyboardDoneText: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.primary,
        },
      }),
    [colors, isCompact, sheetHeight]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        {/* Backdrop tap to dismiss modal + keyboard */}
        <TouchableOpacity
          style={styles.backdropTap}
          activeOpacity={1}
          onPress={() => { dismissKeyboard(); onCancel(); }}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'position' : 'height'}
          keyboardVerticalOffset={0}
        >
        <View style={styles.sheet} onTouchStart={dismissKeyboard}>
          {/* Drag handle */}
          <View style={styles.dragHandle} />

          {/* Header with close button */}
          <View style={styles.headerRow}>
            <View style={styles.headerTextArea}>
              {isCompact ? (
                <Text style={styles.headerTitle}>Log Your Cook</Text>
              ) : (
                <Text style={styles.headerTitle}>{'\u{1F468}\u{200D}\u{1F373}'} Nice cook!</Text>
              )}
              <Text style={styles.headerRecipe} numberOfLines={2}>
                {recipe.title}
              </Text>
              {bookRef && <Text style={styles.headerBook}>{bookRef}</Text>}
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onCancel} activeOpacity={0.7}>
              <CloseIcon size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>

          {/* ── Compact mode: no scroll, everything visible ── */}
          {isCompact ? (
            <View style={styles.compactBody}>
              {/* Star rating */}
              <View style={[styles.section, { marginBottom: 10 }]}>
                <View style={styles.ratingHeader}>
                  <Text style={styles.sectionLabel}>Rate it (optional)</Text>
                  {rating !== null && (
                    <View style={styles.ratingBadgeRow}>
                      <Text style={styles.ratingBadge}>{ratingLabel}</Text>
                      <TouchableOpacity onPress={() => setRating(null)} activeOpacity={0.6}>
                        <Text style={styles.ratingClear}>clear</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <View
                  ref={starsContainerRef}
                  onLayout={handleStarsLayout}
                  style={styles.starsRow}
                  {...starPanResponder.panHandlers}
                >
                  {[0, 1, 2, 3, 4].map((i) => renderStar(i, rating))}
                </View>
              </View>

              {/* Thoughts */}
              <View style={styles.section}>
                <TextInput
                  ref={thoughtsRef}
                  style={styles.thoughtsInput}
                  multiline
                  placeholder="Any thoughts or notes for next time?"
                  placeholderTextColor={colors.text.placeholder}
                  value={thoughts}
                  onChangeText={setThoughts}
                  inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                />
              </View>

              {/* Photo area */}
              <View style={styles.section}>
                <View style={styles.photoRow}>
                  <TouchableOpacity
                    style={styles.photoBox}
                    onPress={() => comingSoon('Photo upload')}
                    activeOpacity={0.7}
                  >
                    <CameraIcon size={24} color={colors.text.tertiary} />
                    <Text style={styles.photoBoxText}>Take Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.photoBox}
                    onPress={() => comingSoon('Photo upload')}
                    activeOpacity={0.7}
                  >
                    <ImageIcon size={24} color={colors.text.tertiary} />
                    <Text style={styles.photoBoxText}>From Library</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            /* ── Full mode: scrollable ── */
            <ScrollView
              style={{ flexShrink: 1 }}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Remember chips */}
              <View style={styles.rememberChipsRow}>
                <TouchableOpacity
                  style={styles.rememberChip}
                  onPress={() => {
                    if (onNoteOnStep) {
                      onNoteOnStep();
                    } else {
                      comingSoon('Step-level notes');
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <NoteIcon size={14} color={colors.text.secondary} />
                  <Text style={styles.rememberChipText}>Note on a step</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rememberChip}
                  onPress={() => comingSoon('Voice recording')}
                  activeOpacity={0.7}
                >
                  <MicIcon size={14} color={colors.text.secondary} />
                  <Text style={styles.rememberChipText}>Voice memo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rememberChip}
                  onPress={() => comingSoon('Quantity editing')}
                  activeOpacity={0.7}
                >
                  <EditQtyIcon size={14} color={colors.text.secondary} />
                  <Text style={styles.rememberChipText}>Edit qty</Text>
                </TouchableOpacity>
              </View>

              {/* Star rating */}
              <View style={styles.section}>
                <View style={styles.ratingHeader}>
                  <Text style={styles.sectionLabel}>Rate it (optional)</Text>
                  {rating !== null && (
                    <View style={styles.ratingBadgeRow}>
                      <Text style={styles.ratingBadge}>{ratingLabel}</Text>
                      <TouchableOpacity onPress={() => setRating(null)} activeOpacity={0.6}>
                        <Text style={styles.ratingClear}>clear</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                <View
                  ref={starsContainerRef}
                  onLayout={handleStarsLayout}
                  style={styles.starsRow}
                  {...starPanResponder.panHandlers}
                >
                  {[0, 1, 2, 3, 4].map((i) => renderStar(i, rating))}
                </View>
              </View>

              {/* Modifications */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Modifications</Text>
                <TextInput
                  ref={modificationsRef}
                  style={styles.modificationsInput}
                  multiline
                  placeholder="What did you change about the recipe?"
                  placeholderTextColor={colors.text.placeholder}
                  value={modifications}
                  onChangeText={setModifications}
                  inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                />
              </View>

              {/* Thoughts */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Thoughts</Text>
                <Text style={styles.sectionSublabel}>quick notes for yourself</Text>
                <TextInput
                  ref={thoughtsRef}
                  style={styles.thoughtsInput}
                  multiline
                  placeholder="What did you notice? Ideas for next time..."
                  placeholderTextColor={colors.text.placeholder}
                  value={thoughts}
                  onChangeText={setThoughts}
                  inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                />
                <Text style={styles.privacyHint}>
                  Thoughts stay with you — not shared in posts unless you choose
                </Text>
              </View>

              {/* Photo area */}
              <View style={styles.section}>
                <View style={styles.photoRow}>
                  <TouchableOpacity
                    style={styles.photoBox}
                    onPress={() => comingSoon('Photo upload')}
                    activeOpacity={0.7}
                  >
                    <CameraIcon size={24} color={colors.text.tertiary} />
                    <Text style={styles.photoBoxText}>Take Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.photoBox}
                    onPress={() => comingSoon('Photo upload')}
                    activeOpacity={0.7}
                  >
                    <ImageIcon size={24} color={colors.text.tertiary} />
                    <Text style={styles.photoBoxText}>From Library</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Tag row */}
              <TouchableOpacity
                style={styles.tagRow}
                onPress={() => comingSoon('Tagging people')}
                activeOpacity={0.7}
              >
                <FriendsIcon size={20} color={colors.text.secondary} />
                <Text style={styles.tagText}>Tag who you ate with</Text>
              </TouchableOpacity>

              {/* Multi-dish prompt */}
              <View style={[styles.section, { marginTop: 14 }]}>
                <TouchableOpacity
                  style={styles.multiDishRow}
                  onPress={() => comingSoon('Multi-dish posts')}
                  activeOpacity={0.7}
                >
                  <PlusDocIcon size={22} color={colors.text.secondary} />
                  <View style={styles.multiDishContent}>
                    <Text style={styles.multiDishTitle}>Made other dishes too?</Text>
                    <Text style={styles.multiDishSub}>
                      Add more recipes or improvised items
                    </Text>
                  </View>
                  <Text style={styles.multiDishPlus}>+</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* Bottom CTAs (pinned) */}
          <View style={styles.ctaArea}>
            <TouchableOpacity
              style={styles.logShareButton}
              onPress={() => handleSubmit(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.logShareButtonText}>Log & Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.justLogButton}
              onPress={() => handleSubmit(false)}
              activeOpacity={0.7}
            >
              <LockIcon size={14} color={colors.text.tertiary} />
              <Text style={styles.justLogText}>Just log it (private)</Text>
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </View>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={KEYBOARD_ACCESSORY_ID}>
          <View style={styles.keyboardBar}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={dismissKeyboard} style={styles.keyboardDoneBtn} activeOpacity={0.7}>
              <Text style={styles.keyboardDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </Modal>
  );
}
