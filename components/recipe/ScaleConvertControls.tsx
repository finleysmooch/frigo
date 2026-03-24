import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';

const FIXED_SCALE_OPTIONS = [
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '3x', value: 3 },
];

interface ScaleControlsProps {
  currentScale: number;
  onScaleChange: (scale: number) => void;
  onShowScalePicker: () => void;
}

export default function ScaleConvertControls({
  currentScale,
  onScaleChange,
  onShowScalePicker,
}: ScaleControlsProps) {
  return (
    <View style={styles.controlsContainer}>
      <Text style={styles.scaleLabel}>Scale:</Text>
      <View style={styles.scaleButtons}>
        {FIXED_SCALE_OPTIONS.map(option => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.scaleButton,
              currentScale === option.value && styles.scaleButtonActive,
            ]}
            onPress={() => onScaleChange(option.value)}
          >
            <Text
              style={[
                styles.scaleButtonText,
                currentScale === option.value && styles.scaleButtonTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[
            styles.scaleButton,
            currentScale > 3 && styles.scaleButtonActive,
          ]}
          onPress={onShowScalePicker}
        >
          <Text
            style={[
              styles.scaleButtonText,
              currentScale > 3 && styles.scaleButtonTextActive,
            ]}
          >
            {currentScale > 3 ? `${currentScale}x` : 'More'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  scaleLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  scaleButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  scaleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: 'transparent',
  },
  scaleButtonActive: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
  },
  scaleButtonText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  scaleButtonTextActive: {
    color: '#fff',
  },
});
