// components/IngredientPopup.tsx
// Shows ingredient details when tapping ingredient names in instructions

import React, { useMemo } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';

interface IngredientPopupProps {
  visible: boolean;
  ingredientName: string;
  quantity: string;
  preparation?: string;
  position: { x: number; y: number };
  onClose: () => void;
}

const POPUP_WIDTH = 200;
const POPUP_PADDING = 16;
const GAP = 12;          // space between popup and tap point
const ARROW_SIZE = 8;
// Estimate popup height: padding 10*2 + name ~18 + quantity ~16 + prep ~15 + margins
const ESTIMATED_POPUP_HEIGHT = 70;

export default function IngredientPopup({
  visible,
  ingredientName,
  quantity,
  preparation,
  position,
  onClose
}: IngredientPopupProps) {
  const { colors, functionalColors } = useTheme();
  const { width: screenWidth } = Dimensions.get('window');

  // Decide whether popup goes above or below the tap point
  const fitsAbove = position.y - ESTIMATED_POPUP_HEIGHT - ARROW_SIZE - GAP > 60;
  const showBelow = !fitsAbove;

  // Vertical position
  let popupY: number;
  if (showBelow) {
    popupY = position.y + GAP + ARROW_SIZE;
  } else {
    popupY = position.y - ESTIMATED_POPUP_HEIGHT - ARROW_SIZE - GAP;
  }

  // Horizontal: center on tap X, clamp to screen edges
  let popupX = position.x - POPUP_WIDTH / 2;
  if (popupX < POPUP_PADDING) {
    popupX = POPUP_PADDING;
  } else if (popupX + POPUP_WIDTH > screenWidth - POPUP_PADDING) {
    popupX = screenWidth - POPUP_WIDTH - POPUP_PADDING;
  }

  // Arrow horizontal offset: point at the actual tap X relative to popup left
  let arrowLeft = position.x - popupX - ARROW_SIZE;
  arrowLeft = Math.max(12, Math.min(arrowLeft, POPUP_WIDTH - 12 - ARROW_SIZE * 2));

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    popup: {
      position: 'absolute',
      width: POPUP_WIDTH,
      backgroundColor: colors.background.card,
      borderRadius: 8,
      padding: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 5,
      borderWidth: 1,
      borderColor: colors.border.medium,
    },
    arrowDown: {
      position: 'absolute',
      bottom: -ARROW_SIZE,
      width: 0,
      height: 0,
      borderLeftWidth: ARROW_SIZE,
      borderRightWidth: ARROW_SIZE,
      borderTopWidth: ARROW_SIZE,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: colors.background.card,
    },
    arrowUp: {
      position: 'absolute',
      top: -ARROW_SIZE,
      width: 0,
      height: 0,
      borderLeftWidth: ARROW_SIZE,
      borderRightWidth: ARROW_SIZE,
      borderBottomWidth: ARROW_SIZE,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderBottomColor: colors.background.card,
    },
    ingredientName: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 4,
    },
    quantity: {
      fontSize: 12,
      color: functionalColors.success,
      fontWeight: '500',
      marginBottom: 2,
    },
    preparation: {
      fontSize: 11,
      color: colors.text.secondary,
      fontStyle: 'italic',
    },
  }), [colors, functionalColors]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.popup,
            { left: popupX, top: popupY },
          ]}
        >
          {/* Arrow points toward the tapped word */}
          <View
            style={[
              showBelow ? styles.arrowUp : styles.arrowDown,
              { left: arrowLeft },
            ]}
          />
          <Text style={styles.ingredientName}>{ingredientName}</Text>
          <Text style={styles.quantity}>{quantity}</Text>
          {preparation && (
            <Text style={styles.preparation}>{preparation}</Text>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}