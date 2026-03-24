// components/cooking/ViewModeMenu.tsx
// Dropdown menu for switching between step-by-step and classic cooking views.

import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../lib/theme/ThemeContext';

export type ViewMode = 'step_by_step' | 'classic';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentMode: ViewMode;
  onSelectMode: (mode: ViewMode) => void;
}

const MODES: { mode: ViewMode; icon: string; label: string; desc: string }[] = [
  {
    mode: 'step_by_step',
    icon: '👆',
    label: 'Step-by-Step',
    desc: 'One step at a time, swipe to navigate',
  },
  {
    mode: 'classic',
    icon: '📖',
    label: 'Classic',
    desc: 'Full recipe, single scrollable page',
  },
];

export default function ViewModeMenu({ visible, onClose, currentMode, onSelectMode }: Props) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.menu, { backgroundColor: colors.background.card, borderColor: colors.border.light }]}>
          <Text style={[styles.title, { color: colors.text.tertiary }]}>COOKING VIEW</Text>

          {MODES.map(({ mode, icon, label, desc }) => {
            const isActive = mode === currentMode;
            return (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.option,
                  isActive && { backgroundColor: colors.primaryLight },
                ]}
                onPress={() => {
                  onSelectMode(mode);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.icon}>{icon}</Text>
                <View style={styles.optionText}>
                  <Text
                    style={[
                      styles.label,
                      { color: isActive ? colors.primary : colors.text.primary },
                      isActive && { fontWeight: '700' },
                    ]}
                  >
                    {label}
                  </Text>
                  <Text style={[styles.desc, { color: colors.text.tertiary }]}>{desc}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 12,
  },
  menu: {
    width: 200,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 2,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  icon: {
    fontSize: 16,
  },
  optionText: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  desc: {
    fontSize: 9,
    marginTop: 1,
  },
});
