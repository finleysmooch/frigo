import React, { useEffect, useState } from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet } from 'react-native';

const LOADING_MESSAGES = [
  { text: 'Reading your recipe... 📖', duration: 1500 },
  { text: 'Finding ingredients... 🥕', duration: 2000 },
  { text: 'Organizing steps... 👨‍🍳', duration: 1500 },
];

interface Props {
  imageUri: string;
}

export function RecipeExtractionLoadingScreen({ imageUri }: Props) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) =>
        prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev
      );
    }, LOADING_MESSAGES[messageIndex].duration);

    return () => clearInterval(interval);
  }, [messageIndex]);

  return (
    <View style={styles.container}>
      {/* Dimmed recipe image as background */}
      <Image source={{ uri: imageUri }} style={styles.image} />
      
      {/* Overlay with progress */}
      <View style={styles.overlay}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.message}>
          {LOADING_MESSAGES[messageIndex].text}
        </Text>
        <Text style={styles.subtitle}>This usually takes 3-5 seconds</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
    opacity: 0.7,
  },
});