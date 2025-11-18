import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';

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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
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
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
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
    backgroundColor: '#f8f8f8',
  },
  emojiButtonSelected: {
    backgroundColor: '#FFF3E0',
    borderWidth: 2,
    borderColor: '#FC4C02',
  },
  emoji: {
    fontSize: 32,
  },
});