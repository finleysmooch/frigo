import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import {
  getSourceNotes,
  StoredSourceNote,
} from '../../lib/services/recipeExtraction/sourceNotesService';
import GlobeIcon from '../icons/recipe/GlobeIcon';
import ThumbsUpIcon from '../icons/recipe/ThumbsUpIcon';

interface SourceNotesSectionProps {
  recipeId: string;
  /** Friendly source name for the header, e.g. "NYT Cooking". */
  sourceLabel?: string;
}

const ACCENT = '#0d9488';

/**
 * Collapsible list of community notes/comments captured from the recipe source
 * (NYT Cooking). Self-fetches by recipeId; renders nothing if there are no
 * notes. Top-level notes first (recommended/helpful order from the service),
 * with replies indented under their parent.
 */
export default function SourceNotesSection({
  recipeId,
  sourceLabel = 'the source',
}: SourceNotesSectionProps) {
  const [notes, setNotes] = useState<StoredSourceNote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    getSourceNotes(recipeId).then((n) => {
      if (active) {
        setNotes(n);
        setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, [recipeId]);

  // Stay quiet until loaded; render nothing when there are no notes.
  if (!loaded || notes.length === 0) return null;

  const byId = new Map(notes.map((n) => [n.source_note_id, n]));
  const parents = notes
    .filter((n) => !n.parent_source_note_id || !byId.has(n.parent_source_note_id))
    // Most-upvoted first (defensive — service already orders this way).
    .sort((a, b) => (b.recommendations_count || 0) - (a.recommendations_count || 0));
  const repliesOf = (sourceNoteId: string) =>
    notes.filter((n) => n.parent_source_note_id === sourceNoteId);

  const renderNote = (n: StoredSourceNote, isReply = false) => (
    <View key={n.id} style={[styles.note, isReply && styles.reply]}>
      <View style={styles.noteHead}>
        <Text style={styles.author}>{n.author_name || 'NYT reader'}</Text>
        {n.is_recommended ? <Text style={styles.badge}>★ Recommended</Text> : null}
        {n.recommendations_count > 0 ? (
          <View style={styles.upvotes}>
            <ThumbsUpIcon size={13} color="#64748b" />
            <Text style={styles.upvoteCount}>{n.recommendations_count}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.message}>{n.message}</Text>
      {!isReply && repliesOf(n.source_note_id).map((r) => renderNote(r, true))}
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((e) => !e)}
        activeOpacity={0.7}
      >
        <GlobeIcon size={16} color={ACCENT} />
        <Text style={styles.headerText}>
          Most helpful notes from {sourceLabel} ({notes.length})
        </Text>
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
      </TouchableOpacity>
      {expanded && <View style={styles.list}>{parents.map((n) => renderNote(n))}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  chevron: {
    fontSize: 16,
    color: ACCENT,
  },
  list: {
    marginTop: 10,
    gap: 14,
  },
  note: {
    gap: 3,
  },
  reply: {
    marginTop: 8,
    marginLeft: 16,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: '#eee',
  },
  noteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  author: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  upvotes: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  upvoteCount: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    color: ACCENT,
  },
  message: {
    fontSize: 15,
    color: '#444',
    lineHeight: 21,
  },
});
