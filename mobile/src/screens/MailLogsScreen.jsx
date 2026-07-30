import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import mailLogService from '../services/mailLogService';
import {
  mailStatusMeta,
  MAIL_STATUS_FILTERS,
  MAIL_KIND_LABEL,
  mailModeText,
} from '../config/mailLogs';
import { colors, radius, space, font } from '../theme';

const fmt = (d) => {
  try {
    return new Date(d).toLocaleString('tr-TR');
  } catch {
    return '';
  }
};

/**
 * Mail Gönderimleri — web'deki MailLogs sayfasının mobil karşılığı.
 *
 * Ekranın asıl işi, mail gerçekten gönderilmeye başlanmadan önce "kime ne
 * gidecekti" sorusunu cevaplamak. Bu yüzden en üstte hattın o anki modu
 * açıkça yazıyor; deneme modunda kayıtlar "Taslak" olarak işaretlenir ki
 * kimse gitmiş sanmasın.
 *
 * Gövde önizlemesinde HTML değil DÜZ METİN gösteriliyor: HTML render etmek
 * react-native-webview bağımlılığı isterdi ve bu bir teşhis ekranı — kayıtta
 * `text` alternatifi zaten saklanıyor. Biçimli önizleme webde.
 */
export default function MailLogsScreen() {
  const [items, setItems] = useState([]);
  const [config, setConfig] = useState(null);
  const [counts, setCounts] = useState({});
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await mailLogService.getAll(status ? { status } : {});
      setItems(res.data.data || []);
      setConfig(res.data.config || null);
      setCounts(res.data.statusCounts || {});
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Mail kayıtları alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const openDetail = async (id) => {
    try {
      const res = await mailLogService.getById(id);
      setDetail(res.data.data);
    } catch (err) {
      Alert.alert('Açılamadı', err.response?.data?.error || 'Kayıt alınamadı.');
    }
  };

  const mode = mailModeText(config);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(m) => m._id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.h1}>Mail Gönderimleri</Text>
            <Text style={styles.h1sub}>Sistemin ürettiği e-postaların kaydı</Text>

            {/* Hattın modu */}
            <View style={[styles.modeBox, mode.live && styles.modeBoxLive]}>
              <Ionicons
                name={mode.live ? 'mail' : 'mail-unread-outline'}
                size={18}
                color={mode.live ? colors.success : '#B45309'}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.modeText, mode.live && styles.modeTextLive]}>{mode.text}</Text>
                <Text style={styles.modeHint}>
                  Gerçek gönderime geçmek için backend/.env içinde MAIL_PROVIDER=smtp yapıp
                  SMTP bilgilerini doldurmanız yeterli — kod değişikliği gerekmiyor.
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {MAIL_STATUS_FILTERS.map((f) => {
                const active = status === f.value;
                const n = f.value ? counts[f.value] : null;
                return (
                  <TouchableOpacity
                    key={f.value || 'all'}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setStatus(f.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {f.label}{n ? ` (${n})` : ''}
                    </Text>
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
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>Kayıt yok.</Text>}
        renderItem={({ item }) => {
          const st = mailStatusMeta(item.status);
          return (
            <TouchableOpacity style={styles.card} onPress={() => openDetail(item._id)} activeOpacity={0.85}>
              <View style={styles.cardTop}>
                <Text style={styles.subject} numberOfLines={2}>{item.subject}</Text>
                <View style={[styles.badge, { backgroundColor: st.bg }]}>
                  <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
                </View>
              </View>

              <Text style={styles.to} numberOfLines={1}>
                {item.recipientUser?.name ? `${item.recipientUser.name} · ` : ''}{item.to}
              </Text>

              <View style={styles.cardFoot}>
                <Text style={styles.kind}>{MAIL_KIND_LABEL[item.kind] || item.kind || '—'}</Text>
                <Text style={styles.date}>{fmt(item.createdAt)}</Text>
              </View>

              {!!item.reason && <Text style={styles.reason}>{item.reason}</Text>}
              {!!item.error && <Text style={styles.errorLine}>{item.error}</Text>}
            </TouchableOpacity>
          );
        }}
      />

      {/* Detay */}
      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle} numberOfLines={2}>{detail?.subject}</Text>
              <TouchableOpacity onPress={() => setDetail(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={{ padding: space.lg }}>
              <Row label="Alıcı" value={detail?.to} />
              <Row label="Tür" value={MAIL_KIND_LABEL[detail?.kind] || detail?.kind || '—'} />
              <Row label="Durum" value={mailStatusMeta(detail?.status).label} />
              <Row label="Sağlayıcı" value={detail?.provider} />
              <Row label="Tarih" value={fmt(detail?.createdAt)} />
              {!!detail?.reason && <Row label="Sebep" value={detail.reason} />}
              {!!detail?.error && <Row label="Hata" value={detail.error} />}
              {!!detail?.messageId && <Row label="Mesaj No" value={detail.messageId} />}

              <Text style={styles.bodyLabel}>GÖVDE (düz metin)</Text>
              <View style={styles.bodyBox}>
                <Text style={styles.bodyText}>{detail?.text || '—'}</Text>
              </View>
              <Text style={styles.bodyNote}>
                Biçimli (HTML) önizleme web panelinde.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  list: { padding: space.lg, paddingBottom: space.xxl },

  h1: { fontSize: font.xxl, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  h1sub: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },

  modeBox: {
    flexDirection: 'row', gap: space.sm, alignItems: 'flex-start',
    backgroundColor: colors.warnSoft, borderRadius: radius.lg,
    padding: space.md, marginTop: space.md,
  },
  modeBoxLive: { backgroundColor: colors.successSoft },
  modeText: { fontSize: font.sm, fontWeight: '700', color: '#B45309' },
  modeTextLive: { color: colors.success },
  modeHint: { fontSize: font.xs, color: colors.textMuted, marginTop: 3, lineHeight: 17 },

  filterRow: { gap: space.sm, paddingVertical: space.md },
  chip: {
    paddingHorizontal: 14, height: 32, justifyContent: 'center',
    borderRadius: radius.full, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted },
  chipTextActive: { color: '#fff' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.dangerSoft, borderRadius: radius.md,
    padding: space.md, marginBottom: space.sm,
  },
  errorText: { flex: 1, fontSize: font.sm, color: colors.danger },
  empty: { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', marginTop: space.xl },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: space.md, marginBottom: space.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  subject: { flex: 1, fontSize: font.sm, fontWeight: '700', color: colors.text },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full },
  badgeText: { fontSize: 10, fontWeight: '800' },
  to: { fontSize: font.xs, color: colors.textMuted, marginTop: 4 },
  cardFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: space.sm, paddingTop: space.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  kind: { fontSize: font.xs, fontWeight: '600', color: colors.primary },
  date: { fontSize: font.xs, color: colors.textFaint },
  reason: { fontSize: font.xs, color: colors.textMuted, marginTop: space.sm, lineHeight: 17 },
  errorLine: { fontSize: font.xs, color: colors.danger, marginTop: space.sm, lineHeight: 17 },

  backdrop: { flex: 1, backgroundColor: 'rgba(20,24,35,0.45)', justifyContent: 'center', padding: space.lg },
  modalCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl, maxHeight: '88%', overflow: 'hidden',
    shadowColor: '#1B2130', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8,
  },
  modalHead: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space.md,
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { flex: 1, fontSize: font.md, fontWeight: '800', color: colors.text },
  modalBody: { flexGrow: 0 },

  row: { flexDirection: 'row', gap: space.md, paddingVertical: 4 },
  rowLabel: { width: 88, fontSize: font.xs, fontWeight: '700', color: colors.textFaint },
  rowValue: { flex: 1, fontSize: font.xs, color: colors.text },

  bodyLabel: {
    fontSize: font.xs, fontWeight: '800', color: colors.textFaint,
    letterSpacing: 0.5, marginTop: space.lg, marginBottom: space.sm,
  },
  bodyBox: { backgroundColor: colors.bg, borderRadius: radius.md, padding: space.md },
  bodyText: { fontSize: font.sm, color: colors.text, lineHeight: 20 },
  bodyNote: { fontSize: font.xs, color: colors.textFaint, marginTop: space.sm },
});
