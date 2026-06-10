// screens/VerificationReviewScreen.tsx
// CP6a-2 — gated in-app review portal for book-ownership verifications.
//
// TWO-LAYER GATE: (a) this screen checks isAdmin() and refuses to render the queue for non-admins
// (UI convenience); (b) the REAL boundary is that every action calls a SECURITY DEFINER RPC that
// self-checks is_admin() and raises for non-admins — so a non-admin who reaches this screen (deep
// link / stale nav) still cannot list or act. Separate from the unguarded AdminScreen by design.
//
// DELIVERS NO recipes: approve flips status to 'verified' (CP6b later delivers); deny = 'rejected'
// + note (the F&F "flag the user"). All DB work goes through ownershipVerificationService.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme/ThemeContext';
import {
  isAdmin,
  listPendingVerifications,
  reviewVerification,
  PendingVerification,
} from '../lib/services/ownershipVerificationService';

interface Props {
  navigation: any;
}

export default function VerificationReviewScreen({ navigation }: Props) {
  const { colors, functionalColors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [checking, setChecking] = useState(true); // admin-gate check
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false); // queue load
  const [items, setItems] = useState<PendingVerification[]>([]);
  const [actioningId, setActioningId] = useState<string | null>(null);

  // Deny-note modal state.
  const [denyTarget, setDenyTarget] = useState<PendingVerification | null>(null);
  const [denyNote, setDenyNote] = useState('');

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const pending = await listPendingVerifications();
      setItems(pending);
    } catch (e: any) {
      Alert.alert('Could not load queue', e?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const ok = await isAdmin();
      if (!active) return;
      setAuthorized(ok);
      setChecking(false);
      if (ok) await loadQueue();
    })();
    return () => {
      active = false;
    };
  }, [loadQueue]);

  const handleApprove = useCallback(
    async (item: PendingVerification) => {
      setActioningId(item.id);
      try {
        await reviewVerification(item.id, 'verified');
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      } catch (e: any) {
        Alert.alert('Approve failed', e?.message ?? 'Unknown error');
      } finally {
        setActioningId(null);
      }
    },
    []
  );

  const submitDeny = useCallback(async () => {
    if (!denyTarget) return;
    const target = denyTarget;
    setActioningId(target.id);
    setDenyTarget(null);
    try {
      await reviewVerification(target.id, 'rejected', denyNote.trim() || undefined);
      setItems((prev) => prev.filter((i) => i.id !== target.id));
    } catch (e: any) {
      Alert.alert('Deny failed', e?.message ?? 'Unknown error');
    } finally {
      setActioningId(null);
      setDenyNote('');
    }
  }, [denyTarget, denyNote]);

  if (checking) {
    return (
      <SafeAreaView style={styles.fill}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!authorized) {
    return (
      <SafeAreaView style={styles.fill}>
        <View style={styles.center}>
          <Text style={styles.deniedTitle}>Not authorized</Text>
          <Text style={styles.deniedBody}>This area is limited to verification reviewers.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.fill}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>Verification Review</Text>
        <Text style={styles.subheader}>
          {items.length} pending {items.length === 1 ? 'submission' : 'submissions'}
        </Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : items.length === 0 ? (
          <Text style={styles.empty}>No pending verifications. 🎉</Text>
        ) : (
          items.map((item) => {
            const busy = actioningId === item.id;
            return (
              <View key={item.id} style={styles.card}>
                <Text style={styles.bookTitle}>{item.book_title}</Text>
                {item.book_author ? <Text style={styles.bookAuthor}>by {item.book_author}</Text> : null}
                <Text style={styles.user}>
                  {item.user_display_name || 'Unknown'}
                  {item.user_email ? `  ·  ${item.user_email}` : ''}
                </Text>
                <Text style={styles.submitted}>
                  Submitted {new Date(item.submitted_at).toLocaleString()}
                </Text>

                {item.signed_url ? (
                  <Image source={{ uri: item.signed_url }} style={styles.proof} resizeMode="cover" />
                ) : (
                  <View style={[styles.proof, styles.proofMissing]}>
                    <Text style={styles.proofMissingText}>No proof image</Text>
                  </View>
                )}

                {/* AI recommendation slot — placeholder only; no logic, never auto-approves (deferred). */}
                <View style={styles.aiSlot}>
                  <Text style={styles.aiSlotText}>AI recommendation: — (coming later)</Text>
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: functionalColors.success }, busy && styles.btnDisabled]}
                    onPress={() => handleApprove(item)}
                    disabled={busy}
                  >
                    <Text style={styles.btnText}>{busy ? '…' : 'Approve'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: functionalColors.error }, busy && styles.btnDisabled]}
                    onPress={() => {
                      setDenyNote('');
                      setDenyTarget(item);
                    }}
                    disabled={busy}
                  >
                    <Text style={styles.btnText}>Deny</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Deny-note modal */}
      <Modal visible={!!denyTarget} transparent animationType="fade" onRequestClose={() => setDenyTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Deny submission</Text>
            <Text style={styles.modalBody}>
              Add an optional note (visible to reviewers; this flags the submission).
            </Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Reason / note (optional)"
              placeholderTextColor={colors.text.secondary}
              value={denyNote}
              onChangeText={setDenyNote}
              multiline
            />
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.background.secondary }]}
                onPress={() => setDenyTarget(null)}
              >
                <Text style={[styles.btnText, { color: colors.text.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: functionalColors.error }]}
                onPress={submitDeny}
              >
                <Text style={styles.btnText}>Confirm deny</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: colors.background.card },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
    scroll: { padding: 16, paddingBottom: 40 },
    header: { fontSize: 24, fontWeight: 'bold', color: colors.text.primary },
    subheader: { fontSize: 14, color: colors.text.secondary, marginTop: 2, marginBottom: 16 },
    empty: { fontSize: 15, color: colors.text.secondary, textAlign: 'center', marginTop: 40 },
    deniedTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text.primary, marginBottom: 6 },
    deniedBody: { fontSize: 14, color: colors.text.secondary, textAlign: 'center', paddingHorizontal: 24 },
    card: {
      backgroundColor: colors.background.secondary,
      borderRadius: 14,
      padding: 16,
      marginBottom: 16,
    },
    bookTitle: { fontSize: 17, fontWeight: '700', color: colors.text.primary },
    bookAuthor: { fontSize: 14, color: colors.text.secondary, marginTop: 1 },
    user: { fontSize: 14, color: colors.text.primary, marginTop: 8 },
    submitted: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
    proof: { width: '100%', height: 240, borderRadius: 10, marginTop: 12, backgroundColor: colors.border.light },
    proofMissing: { alignItems: 'center', justifyContent: 'center' },
    proofMissingText: { color: colors.text.secondary, fontSize: 13 },
    aiSlot: {
      marginTop: 12,
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border.medium,
    },
    aiSlotText: { fontSize: 12, color: colors.text.secondary, fontStyle: 'italic' },
    actions: { flexDirection: 'row', gap: 12, marginTop: 14 },
    btn: { flex: 1, paddingVertical: 13, borderRadius: 8, alignItems: 'center' },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: colors.text.inverse, fontSize: 15, fontWeight: '600' },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    modalCard: { width: '100%', backgroundColor: colors.background.card, borderRadius: 16, padding: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text.primary, marginBottom: 6 },
    modalBody: { fontSize: 13, color: colors.text.secondary, marginBottom: 12 },
    noteInput: {
      minHeight: 72,
      borderWidth: 1,
      borderColor: colors.border.medium,
      borderRadius: 8,
      padding: 12,
      fontSize: 14,
      color: colors.text.primary,
      textAlignVertical: 'top',
    },
  });
}
