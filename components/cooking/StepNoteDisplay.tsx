// components/cooking/StepNoteDisplay.tsx
// Saved note card displayed below a step — yellow bg, 💡 prefix, edit link.

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  noteText: string;
  updatedAt?: string;
  onEdit: () => void;
}

export default function StepNoteDisplay({ noteText, updatedAt, onEdit }: Props) {
  const dateStr = updatedAt
    ? new Date(updatedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <View style={styles.container}>
      <Text style={styles.noteText}>💡 {noteText}</Text>
      <View style={styles.footer}>
        {dateStr && <Text style={styles.date}>{dateStr}</Text>}
        <TouchableOpacity onPress={onEdit} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={styles.editLink}>Edit</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fef9e7',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#b8942d',
  },
  noteText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  date: {
    fontSize: 10,
    color: '#94a3b8',
  },
  editLink: {
    fontSize: 11,
    color: '#b8942d',
    fontWeight: '600',
  },
});
