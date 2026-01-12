import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useTheme } from '../lib/theme/ThemeContext';

const { width } = Dimensions.get('window');
const EMOJI_SIZE = (width - 80) / 6; // 6 columns with padding

interface EmojiPickerModalProps {
  visible: boolean;
  currentEmoji: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJIS = [
  // Chef & Cooking People
  '👨‍🍳', '👩‍🍳', '🧑‍🍳', '👨‍🌾', '👩‍🌾', '🧑‍🌾',
  '🤵', '🤵‍♀️', '🤵‍♂️', '👨‍🍼', '👩‍🍼', '🧑‍🍼',
  
  // Cooked Dishes
  '🍳', '🥘', '🍲', '🥗', '🍝', '🍕',
  '🍔', '🌮', '🌯', '🥙', '🍜', '🍛',
  '🍱', '🥟', '🍣', '🥡', '🧆', '🥞',
  '🧇', '🍿', '🥓', '🥚', '🍖', '🍗',
  '🦴', '🌭', '🥪', '🥨', '🧀', '🫔',
  
  // Breads & Baked Goods
  '🥐', '🥖', '🥯', '🍞', '🥧', '🧁',
  '🍰', '🎂', '🍪', '🍩', '🥠', '🥮',
  
  // Asian Foods
  '🍙', '🍘', '🍢', '🍡', '🥟', '🦪',
  '🍤', '🦞', '🦀', '🦐', '🦑', '🐙',
  
  // Fruits
  '🍎', '🍏', '🍊', '🍋', '🍌', '🍉',
  '🍇', '🍓', '🫐', '🍈', '🍒', '🍑',
  '🥭', '🍍', '🥥', '🥝', '🍐', '🫒',
  '🥑', '🍅', '🫚',
  
  // Vegetables
  '🥕', '🌽', '🥒', '🧅', '🥦', '🫑',
  '🥬', '🧄', '🍄', '🫘', '🥔', '🍠',
  '🫛', '🌶️', '🥜', '🌰', '🫚',
  
  // Sweets & Desserts
  '🍦', '🍧', '🍨', '🍮', '🍭', '🍬',
  '🍫', '🍿', '🍩', '🎂', '🧁', '🍰',
  '🥧', '🍪', '🍯',
  
  // Drinks
  '☕', '🍵', '🧃', '🥤', '🧋', '🍶',
  '🍾', '🍷', '🍸', '🍹', '🍺', '🍻',
  '🥂', '🧉', '🧊', '🥛', '🫗',
  
  // Kitchen Tools & Appliances
  '🔪', '🥄', '🍴', '🥢', '🧂', '🫕',
  '🥘', '🍳', '🥣', '🥛', '🍽️', '🫙',
  '🧴', '🧪', '⏲️', '⏰', '🔥', '💧',
  '🧊', '🌡️', '🧯', '🪔', '🕯️',
  
  // Dogs (lots!)
  '🐶', '🐕', '🦮', '🐕‍🦺', '🐩', '🐺',
  
  // Cats (lots!)
  '🐱', '🐈', '🐈‍⬛', '🦁', '🐯', '🐅',
  
  // Farm Animals
  '🐷', '🐖', '🐽', '🐮', '🐄', '🐂',
  '🐃', '🐴', '🐎', '🦄', '🐔', '🐓',
  '🐣', '🐤', '🐥', '🐦', '🦆', '🦅',
  '🦉', '🦚', '🦜', '🐧',
  
  // Seafood & Fish
  '🐟', '🐠', '🐡', '🦈', '🐙', '🦑',
  '🦀', '🦞', '🦐', '🐚', '🦪',
  
  // Other Animals
  '🐰', '🐇', '🐿️', '🦔', '🦇', '🐻',
  '🐼', '🐨', '🐯', '🦁', '🐮', '🐷',
  '🐸', '🐢', '🦎', '🐍', '🐛', '🦋',
  '🐌', '🐝', '🐞', '🦗', '🕷️', '🦂',
  
  // Fun & Celebration
  '⭐', '🌟', '✨', '💫', '💥', '🔥',
  '🎉', '🎊', '🎈', '🎁', '🏆', '🥇',
  '🥈', '🥉', '🏅', '👑', '💎', '🌈',
  '☀️', '🌙', '⚡', '❄️', '☃️', '⛄',
  
  // Hearts & Love
  '❤️', '🧡', '💛', '💚', '💙', '💜',
  '🖤', '🤍', '🤎', '💖', '💝', '💗',
  
  // Hands & Gestures
  '👍', '👎', '👊', '✊', '🤛', '🤜',
  '🤞', '✌️', '🤟', '🤘', '👌', '🤌',
  '👏', '🙌', '👐', '🤲', '🙏', '✋',
  '💪', '🦾', '🦿', '🦵', '🦶',
];

export default function EmojiPickerModal({
  visible,
  currentEmoji,
  onSelect,
  onClose
}: EmojiPickerModalProps) {
  const { colors, functionalColors } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.background.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.background.secondary,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
    },
    closeButton: {
      fontSize: 24,
      color: colors.text.secondary,
    },
    scrollView: {
      padding: 20,
    },
    emojiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    emojiButton: {
      width: EMOJI_SIZE,
      height: EMOJI_SIZE,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
    },
    emojiButtonSelected: {
      backgroundColor: colors.primary + '20',
      borderWidth: 2,
      borderColor: colors.primary,
    },
    emoji: {
      fontSize: 32,
    },
  }), [colors, functionalColors]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose Your Avatar</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView}>
            <View style={styles.emojiGrid}>
              {EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.emojiButton,
                    currentEmoji === emoji && styles.emojiButtonSelected,
                  ]}
                  onPress={() => {
                    onSelect(emoji);
                    onClose();
                  }}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}