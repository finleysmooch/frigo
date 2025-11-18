// components/IngredientPopup.tsx
// Shows ingredient details when tapping ingredient names in instructions

import React from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, Dimensions } from 'react-native';

interface IngredientPopupProps {
  visible: boolean;
  ingredientName: string;
  quantity: string;
  preparation?: string;
  position: { x: number; y: number };
  onClose: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const POPUP_WIDTH = 200;
const POPUP_PADDING = 16;

export default function IngredientPopup({
  visible,
  ingredientName,
  quantity,
  preparation,
  position,
  onClose
}: IngredientPopupProps) {
  if (!visible) return null;

  // Calculate popup position to keep it on screen
  let popupX = position.x - POPUP_WIDTH / 2;
  let popupY = position.y - 70; // Position above the tapped text

  // Keep popup within screen bounds horizontally
  if (popupX < POPUP_PADDING) {
    popupX = POPUP_PADDING;
  } else if (popupX + POPUP_WIDTH > SCREEN_WIDTH - POPUP_PADDING) {
    popupX = SCREEN_WIDTH - POPUP_WIDTH - POPUP_PADDING;
  }

  // If popup would go off top of screen, position it below instead
  if (popupY < 100) {
    popupY = position.y + 25;
  }

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
            { 
              left: popupX,
              top: popupY
            }
          ]}
        >
          <View style={styles.arrow} />
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  popup: {
    position: 'absolute',
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  arrow: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
  ingredientName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  quantity: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    marginBottom: 2,
  },
  preparation: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
  },
});