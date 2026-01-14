import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';
import { Logo } from '../components/branding';

const LOADING_MESSAGES = [
  { text: 'Reading your recipe... 📖', duration: 1500 },
  { text: 'Finding ingredients... 🥕', duration: 2000 },
  { text: 'Organizing steps... 👨‍🍳', duration: 1500 },
];

interface Props {
  imageUri: string;
}

export function RecipeExtractionLoadingScreen({ imageUri }: Props) {
  const { colors } = useTheme();
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) =>
        prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev
      );
    }, LOADING_MESSAGES[messageIndex].duration);

    return () => clearInterval(interval);
  }, [messageIndex]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.text.primary,
    },
    image: {
      width: '100%',
      height: '100%',
      opacity: 0.4,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    message: {
      color: colors.background.card,
      fontSize: 20,
      fontWeight: 'bold',
      marginTop: 16,
      textAlign: 'center',
    },
    subtitle: {
      color: colors.background.card,
      fontSize: 14,
      marginTop: 8,
      opacity: 0.7,
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      {/* Dimmed recipe image as background */}
      <Image source={{ uri: imageUri }} style={styles.image} />

      {/* Overlay with progress */}
      <View style={styles.overlay}>
        <Logo size="large" textColor={colors.background.card} iconColor={colors.background.card} />
        <ActivityIndicator size="large" color={colors.background.card} style={{ marginTop: 24 }} />
        <Text style={styles.message}>
          {LOADING_MESSAGES[messageIndex].text}
        </Text>
        <Text style={styles.subtitle}>This usually takes 3-5 seconds</Text>
      </View>
    </View>
  );
}