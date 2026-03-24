// components/cooking/SectionDots.tsx
// Progress dots — one per section, current is elongated, past dimmed.

import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';

interface Props {
  current: number;
  total: number;
}

export default function SectionDots({ current, total }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              width: i === current ? 18 : 6,
              backgroundColor: i <= current ? colors.primary : colors.border.light,
              opacity: i < current ? 0.3 : 1,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 14,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
