import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import approvalService from '../services/approvalService';
import { useAuth } from '../context/AuthContext';
import {
  approvalStatusMeta,
  STATUS_FILTERS,
  RESOURCE_LABEL,
  ACTION_LABEL,
  summarizePayload,
  canReviewApprovals,
} from '../config/approvals';
import { ROLE_LABELS } from '../config/users';
import { initialsOf } from '../config/projects';
import { formatDate } from '../utils/format';
import { colors, radius, space, font, chartColors } from '../theme';

/**
 * Onay Kuyruğu — web'deki PendingApprovals'ın mobil karşılığı.
 *
 * Buraya düşen her kayıt, rolü yetmediği halde kendisine geçici yetki
 * verilmiş bir kullanıcının yazma isteğidir (bkz. Erişim Kontrolü). Onay
 * verilene kadar veritabanına hiçbir şey yazılmaz.
 *
 * Okuma intern'e de açık; Onayla/Reddet yalnız super_admin'de görünür.
 */
export default function ApprovalsScreen() {
  const { session } = useAuth();
  const canReview = canReviewApprovals(session);

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const [rejectTarget, setRejectTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await approvalService.getAll(status ? { status } : {});
      setItems(res.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Onay kuyruğu alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const handleApprove = async (item) => {
    setBusyId(item._id);
    try {
      const res = await approvalService.approve(item._id);
      const result = res.data.data;
      // Onay her zaman uygulanmaz: hedef kayıt bu istek yapıldıktan sonra
      // değiştiyse sonuç "conflict" gelir ve yazma GERÇEKLEŞMEZ.
      if (result?.status === 'conflict') {
        Alert.alert(
          'Çakışma',
          'Kayıt bu istek oluşturulduktan sonra değişmiş, işlem uygulanmadı. Talebin yeniden oluşturulması gerekiyor.'
        );
      }
      load();
    } catch (err) {
      Alert.alert('Onaylanamadı', err.response?.data?.error || 'İşlem tamamlanamadı.');
    } finally {
      setBusyId('');
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    setSaving(true);
    try {
      await approvalService.reject(rejectTarget._id, reason);
      setRejectTarget(null);
      load();
    } catch (err) {
      Alert.alert('Reddedilemedi', err.response?.data?.error || 'İşlem tamamlanamadı.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterBar}
      >
        {STATUS_FILTERS.map((f) => {
          const active = status === f.value;
          return (
            <TouchableOpacity
              key={f.value || 'all'}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setStatus(f.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {!!error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(a) => a._id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {status === 'pending' ? 'Bekleyen talep yok.' : 'Bu durumda kayıt yok.'}
          </Text>
        }
        renderItem={({ item, index }) => {
          const st = approvalStatusMeta(item.status);
          const detail = summarizePayload(item.payload);
          const busy = busyId === item._id;

          return (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <View style={[styles.avatar, { backgroundColor: chartColors[index % chartColors.length] }]}>
                  <Text style={styles.avatarText}>{initialsOf(item.requestedBy?.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.requestedBy?.name || 'Bilinmeyen kullanıcı'}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {ROLE_LABELS[item.requestedBy?.role] || item.requestedBy?.role || '—'}
                    {item.createdAt ? ` · ${formatDate(item.createdAt)}` : ''}
                  </Text>
                </View>
                <View style={[styles.chip, { backgroundColor: st.bg }]}>
                  <Text style={[styles.chipText, { color: st.fg }]}>{st.label}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.metaGrid}>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>KAYNAK</Text>
                  <Text style={styles.metaValue}>
                    {RESOURCE_LABEL[item.resource] || item.resource}
                  </Text>
                </View>
                <View style={styles.metaCol}>
                  <Text style={styles.metaLabel}>İŞLEM</Text>
                  <Text style={[styles.metaValue, styles.metaAction]}>
                    {ACTION_LABEL[item.action] || item.action}
                  </Text>
                </View>
              </View>

              {!!detail && (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.metaLabel}>TALEP DETAYI</Text>
                  <Text style={styles.detail}>{detail}</Text>
                </>
              )}

              {item.status === 'rejected' && !!item.rejectionReason && (
                <Text style={styles.rejectReason}>Gerekçe: {item.rejectionReason}</Text>
              )}
              {item.status === 'conflict' && (
                <Text style={styles.conflictNote}>
                  Kayıt talepten sonra değişmiş — işlem uygulanmadı.
                </Text>
              )}
              {!!item.reviewedBy && (
                <Text style={styles.reviewedBy}>
                  İnceleyen: {item.reviewedBy.name}
                  {item.reviewedAt ? ` · ${formatDate(item.reviewedAt)}` : ''}
                </Text>
              )}

              {canReview && item.status === 'pending' && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.approveBtn, busy && styles.disabled]}
                    onPress={() => handleApprove(item)}
                    disabled={busy}
                    activeOpacity={0.85}
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={17} color="#fff" />
                        <Text style={styles.approveText}>Onayla</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rejectBtn, busy && styles.disabled]}
                    onPress={() => { setReason(''); setRejectTarget(item); }}
                    disabled={busy}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="close-circle-outline" size={17} color={colors.textMuted} />
                    <Text style={styles.rejectText}>Reddet</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />

      <Modal visible={!!rejectTarget} transparent animationType="fade" onRequestClose={() => setRejectTarget(null)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Talebi Reddet</Text>
            <Text style={styles.modalBody}>
              {rejectTarget?.requestedBy?.name} kullanıcısının{' '}
              {RESOURCE_LABEL[rejectTarget?.resource] || rejectTarget?.resource} —{' '}
              {ACTION_LABEL[rejectTarget?.action] || rejectTarget?.action} talebi reddedilecek.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={reason}
              onChangeText={setReason}
              placeholder="Gerekçe (isteğe bağlı, talep sahibine görünür)"
              placeholderTextColor={colors.textFaint}
              multiline
              textAlignVertical="top"
              editable={!saving}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setRejectTarget(null)} disabled={saving}>
                <Text style={styles.cancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerBtn, saving && styles.disabled]}
                onPress={confirmReject}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.dangerText}>Reddet</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },

  filterBar: { flexGrow: 0 },
  filterRow: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  filterChip: {
    paddingHorizontal: 14, height: 32, justifyContent: 'center',
    borderRadius: radius.full, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted },
  filterTextActive: { color: '#fff' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.dangerSoft, borderRadius: radius.md,
    padding: space.md, marginHorizontal: space.lg, marginBottom: space.sm,
  },
  errorText: { flex: 1, fontSize: font.sm, color: colors.danger },

  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  empty: { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', marginTop: space.xxl },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: space.md, marginBottom: space.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 38, height: 38, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: font.xs, fontWeight: '800', color: '#fff' },
  name: { fontSize: font.md, fontWeight: '700', color: colors.text },
  meta: { fontSize: font.xs, color: colors.textMuted, marginTop: 1 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  chipText: { fontSize: 10, fontWeight: '800' },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: space.md },

  metaGrid: { flexDirection: 'row', gap: space.md },
  metaCol: { flex: 1 },
  metaLabel: { fontSize: 10, fontWeight: '800', color: colors.textFaint, letterSpacing: 0.5 },
  metaValue: { fontSize: font.sm, fontWeight: '700', color: colors.text, marginTop: 3 },
  metaAction: { color: colors.primary },

  detail: { fontSize: font.sm, color: colors.text, lineHeight: 20, marginTop: 4, fontStyle: 'italic' },
  rejectReason: { fontSize: font.xs, color: colors.danger, marginTop: space.md, lineHeight: 18 },
  conflictNote: { fontSize: font.xs, color: '#B45309', marginTop: space.md, lineHeight: 18 },
  reviewedBy: { fontSize: font.xs, color: colors.textFaint, marginTop: space.sm },

  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 46, borderRadius: radius.md, backgroundColor: colors.primary,
  },
  approveText: { color: '#fff', fontSize: font.sm, fontWeight: '700' },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 46, borderRadius: radius.md, backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
  },
  rejectText: { color: colors.textMuted, fontSize: font.sm, fontWeight: '700' },
  disabled: { opacity: 0.6 },

  backdrop: { flex: 1, backgroundColor: 'rgba(20,24,35,0.45)', justifyContent: 'center', padding: space.lg },
  modalCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg,
    shadowColor: '#1B2130', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8,
  },
  modalTitle: { fontSize: font.lg, fontWeight: '800', color: colors.text },
  modalBody: { fontSize: font.sm, color: colors.textMuted, lineHeight: 20, marginTop: space.sm },
  modalInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    padding: space.md, minHeight: 84, marginTop: space.md,
    fontSize: font.sm, color: colors.text,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.md },
  cancelBtn: {
    paddingHorizontal: space.lg, height: 44, justifyContent: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  cancelText: { fontSize: font.md, fontWeight: '600', color: colors.textMuted },
  dangerBtn: {
    minWidth: 116, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, backgroundColor: colors.danger,
  },
  dangerText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
});
