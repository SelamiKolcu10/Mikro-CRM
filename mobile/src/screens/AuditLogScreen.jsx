import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import auditService from '../services/auditService';
import SelectField from '../components/SelectField';
import DateRangePickerModal from '../components/DateRangePickerModal';
import { useAuth } from '../context/AuthContext';
import {
  severityMeta,
  COLLECTION_LABEL,
  ACTION_LABEL,
  fieldLabel,
  formatValue,
  describeLog,
  dayHeading,
  timeOf,
  canFilterByActor,
} from '../config/audit';
import { colors, radius, space, font } from '../theme';

const PAGE_SIZE = 25;

/** Genişletilmiş kayıt gövdesi — teknik künye + alan bazlı değişim listesi. */
function LogDetail({ log }) {
  return (
    <View style={styles.detail}>
      <DetailRow label="Kayıt Türü" value={COLLECTION_LABEL[log.collectionName] || log.collectionName} />
      <DetailRow label="Yapan" value={log.actorEmail || (log.actorType === 'system' ? 'Sistem' : '—')} />
      <DetailRow label="İşlem" value={ACTION_LABEL[log.action] || log.action} />
      <DetailRow label="IP Adresi" value={log.ip || '—'} />
      <DetailRow label="Tarih" value={new Date(log.createdAt).toLocaleString('tr-TR')} />
      {!!log.userAgent && <DetailRow label="Tarayıcı" value={log.userAgent} />}

      {!!(log.changes || []).length && (
        <View style={styles.changes}>
          {log.changes.map((c, i) => (
            <View key={`${c.field}-${i}`} style={styles.changeRow}>
              <Text style={styles.changeField}>{fieldLabel(c.field)}</Text>
              <View style={styles.changeValues}>
                <Text style={styles.before} numberOfLines={2}>{formatValue(c.before)}</Text>
                <Ionicons name="arrow-forward" size={12} color={colors.textFaint} />
                <Text style={styles.after} numberOfLines={2}>{formatValue(c.after)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Zincir künyesi — bu kaydın sırası ve özeti; bütünlük doğrulaması
          bunların üzerinden yürüyor. */}
      <Text style={styles.hash} numberOfLines={1}>
        #{log.sequence} · {String(log.hash || '').slice(0, 16)}…
      </Text>
    </View>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

/**
 * Denetim Kaydı — web'deki AuditLog sayfasının mobil karşılığı.
 *
 * Kayıtlar `sequence`'a göre sıralı gelir (createdAt'e göre değil): zincirin
 * asıl sırası odur, sentetik genesis satırının createdAt'i göç anını
 * gösterdiği için tarih sıralaması onu yanlış yere atardı.
 *
 * intern de görebilir ama aktör e-postaları maskeli gelir ve aktör filtresi
 * ona kapalıdır.
 */
export default function AuditLogScreen() {
  const { session } = useAuth();
  const showActorFilter = canFilterByActor(session);

  const [logs, setLogs] = useState([]);
  const [counts, setCounts] = useState({ info: 0, sensitive: 0, critical: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const [severity, setSeverity] = useState('');
  const [search, setSearch] = useState('');
  const [actor, setActor] = useState('');
  const [range, setRange] = useState({ from: null, to: null });
  const [showPicker, setShowPicker] = useState(false);
  const [actors, setActors] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [chain, setChain] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const query = useMemo(() => {
    const q = { page: 1, limit: PAGE_SIZE };
    if (severity) q.severity = severity;
    if (search.trim()) q.search = search.trim();
    if (actor) q.actorEmail = actor;
    if (range.from) {
      // Aralık gün bazlı seçiliyor; sorgu ise zaman damgasıyla çalışıyor —
      // bitiş gününü de kapsaması için o günün sonuna kadar uzatıyoruz.
      const end = new Date(range.to || range.from);
      end.setHours(23, 59, 59, 999);
      q.dateFrom = range.from.toISOString();
      q.dateTo = end.toISOString();
    }
    return q;
  }, [severity, search, actor, range]);

  const load = useCallback(async () => {
    try {
      const res = await auditService.getAll(query);
      setLogs(res.data.data || []);
      setCounts(res.data.severityCounts || { info: 0, sensitive: 0, critical: 0 });
      setTotal(res.data.pagination?.total || 0);
      setPages(res.data.pagination?.pages || 1);
      setPage(1);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Denetim kaydı alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  // Arama yazarken her tuşta istek atmasın.
  useEffect(() => {
    const t = setTimeout(load, search ? 400 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const verify = useCallback(async () => {
    setVerifying(true);
    try {
      const res = await auditService.verify();
      setChain(res.data.data);
    } catch {
      setChain(null);
    } finally {
      setVerifying(false);
    }
  }, []);

  useEffect(() => {
    verify();
    if (showActorFilter) {
      auditService
        .getActors()
        .then((res) => setActors(res.data.data || []))
        .catch(() => setActors([]));
    }
  }, [verify, showActorFilter]);

  const loadMore = async () => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    try {
      const res = await auditService.getAll({ ...query, page: page + 1 });
      setLogs((prev) => [...prev, ...(res.data.data || [])]);
      setPage((p) => p + 1);
    } catch {
      // sessiz geç — mevcut liste duruyor
    } finally {
      setLoadingMore(false);
    }
  };

  // Gün gün grupla. Liste zaten sequence'a göre sıralı geldiği için
  // sıralamayı bozmadan sadece ardışık aynı günleri topluyoruz.
  const sections = useMemo(() => {
    const out = [];
    for (const log of logs) {
      const key = dayHeading(log.createdAt);
      const last = out[out.length - 1];
      if (last && last.title === key) last.data.push(log);
      else out.push({ title: key, data: [log] });
    }
    return out;
  }, [logs]);

  const FILTERS = [
    { value: '', label: `Tümü (${total})` },
    { value: 'info', label: `Bilgi (${counts.info})` },
    { value: 'sensitive', label: `Hassas (${counts.sensitive})` },
    { value: 'critical', label: `Kritik (${counts.critical})` },
  ];

  const actorOptions = [
    { value: '', label: 'Tüm Kullanıcılar' },
    ...actors.map((a) => ({ value: a, label: a })),
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); verify(); }} />
        }
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        ListHeaderComponent={
          <View>
            <Text style={styles.h1}>Denetim Kaydı</Text>
            <Text style={styles.h1sub}>
              Kim, ne zaman, neyi değiştirdi — kullanıcı ve müşteri kayıtlarındaki
              tüm değişikliklerin izi
            </Text>

            {/* Zincir bütünlüğü */}
            <View style={[styles.chainBox, chain && !chain.intact && styles.chainBroken]}>
              <View style={styles.chainRow}>
                <Ionicons
                  name={chain?.intact ? 'shield-checkmark' : 'alert-circle'}
                  size={18}
                  color={chain?.intact ? colors.success : colors.danger}
                />
                <Text style={[styles.chainText, chain && !chain.intact && styles.chainTextBroken]}>
                  {chain === null
                    ? 'Zincir durumu bilinmiyor'
                    : chain.intact
                      ? `Zincir bütünlüğü doğrulandı · ${chain.totalChecked} kayıt`
                      : `Zincir kırılmış · #${chain.brokenAtSequence} sırasında`}
                </Text>
              </View>
              {!!chain?.checkedAt && (
                <Text style={styles.chainMeta}>Son kontrol: {timeOf(chain.checkedAt)}</Text>
              )}
              <TouchableOpacity
                style={styles.verifyBtn}
                onPress={verify}
                disabled={verifying}
                activeOpacity={0.85}
              >
                {verifying ? (
                  <ActivityIndicator size="small" color={colors.success} />
                ) : (
                  <>
                    <Ionicons name="refresh" size={14} color={colors.success} />
                    <Text style={styles.verifyText}>Yeniden doğrula</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {FILTERS.map((f) => {
                const active = severity === f.value;
                return (
                  <TouchableOpacity
                    key={f.value || 'all'}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setSeverity(f.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.searchWrap}>
              <Ionicons name="search" size={17} color={colors.textFaint} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Ara: aktör, kayıt, özet…"
                placeholderTextColor={colors.textFaint}
              />
              {!!search && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color={colors.textFaint} />
                </TouchableOpacity>
              )}
            </View>

            {showActorFilter && (
              <SelectField
                value={actor}
                options={actorOptions}
                onSelect={setActor}
                placeholder="Tüm Kullanıcılar"
              />
            )}

            <TouchableOpacity
              style={styles.dateWrap}
              onPress={() => setShowPicker(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={17} color={colors.textFaint} />
              <Text style={[styles.dateText, !range.from && styles.datePlaceholder]} numberOfLines={1}>
                {range.from
                  ? `${range.from.toLocaleDateString('tr-TR')} — ${(range.to || range.from).toLocaleDateString('tr-TR')}`
                  : 'Tarih aralığı seçin'}
              </Text>
              {range.from ? (
                <TouchableOpacity onPress={() => setRange({ from: null, to: null })} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color={colors.textFaint} />
                </TouchableOpacity>
              ) : (
                <Ionicons name="chevron-down" size={17} color={colors.textMuted} />
              )}
            </TouchableOpacity>

            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const sv = severityMeta(item.severity);
          const open = expanded === item._id;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setExpanded(open ? null : item._id)}
              activeOpacity={0.85}
            >
              <View style={styles.cardTop}>
                <View style={[styles.sevChip, { backgroundColor: sv.bg }]}>
                  <Text style={[styles.sevText, { color: sv.fg }]}>{sv.label}</Text>
                </View>
                <Text style={styles.time}>{timeOf(item.createdAt)}</Text>
                <Ionicons
                  name={open ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textFaint}
                />
              </View>

              <Text style={styles.summary}>{describeLog(item)}</Text>

              {open && <LogDetail log={item} />}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Bu filtrelerle kayıt bulunamadı.</Text>}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: space.lg }} />
          ) : null
        }
      />

      <DateRangePickerModal
        visible={showPicker}
        from={range.from}
        to={range.to}
        onApply={(r) => { setRange(r); setShowPicker(false); }}
        onClose={() => setShowPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  list: { padding: space.lg, paddingBottom: space.xxl },

  h1: { fontSize: font.xxl, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  h1sub: { fontSize: font.sm, color: colors.textMuted, marginTop: 2, lineHeight: 19 },

  chainBox: {
    backgroundColor: colors.successSoft, borderRadius: radius.lg,
    padding: space.md, marginTop: space.md,
  },
  chainBroken: { backgroundColor: colors.dangerSoft },
  chainRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chainText: { flex: 1, fontSize: font.sm, fontWeight: '700', color: colors.success },
  chainTextBroken: { color: colors.danger },
  chainMeta: { fontSize: font.xs, color: colors.textMuted, marginTop: 4, marginLeft: 26 },
  verifyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    alignSelf: 'flex-start', marginTop: space.md,
    paddingHorizontal: space.md, height: 34, borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  verifyText: { fontSize: font.xs, fontWeight: '700', color: colors.success },

  filterRow: { gap: space.sm, paddingVertical: space.md },
  filterChip: {
    paddingHorizontal: 14, height: 32, justifyContent: 'center',
    borderRadius: radius.full, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted },
  filterTextActive: { color: '#fff' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: space.md, height: 46, marginBottom: space.md,
  },
  dateWrap: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: space.md, height: 46, marginBottom: space.md,
  },
  searchInput: { flex: 1, fontSize: font.sm, color: colors.text },
  dateText: { flex: 1, fontSize: font.sm, color: colors.text },
  datePlaceholder: { color: colors.textFaint },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.dangerSoft, borderRadius: radius.md,
    padding: space.md, marginBottom: space.sm,
  },
  errorText: { flex: 1, fontSize: font.sm, color: colors.danger },

  sectionHeader: {
    fontSize: font.xs, fontWeight: '800', color: colors.textFaint,
    letterSpacing: 0.5, marginTop: space.lg, marginBottom: space.sm,
  },
  empty: { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', marginTop: space.xl },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: space.md, marginBottom: space.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sevChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  sevText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  time: { flex: 1, fontSize: font.xs, color: colors.textFaint, textAlign: 'right' },
  summary: { fontSize: font.sm, color: colors.text, lineHeight: 20, marginTop: space.sm },

  detail: { marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  detailRow: { flexDirection: 'row', gap: space.sm, paddingVertical: 3 },
  detailLabel: { width: 92, fontSize: font.xs, fontWeight: '700', color: colors.textFaint },
  detailValue: { flex: 1, fontSize: font.xs, color: colors.text },

  changes: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    padding: space.sm, marginTop: space.md,
  },
  changeRow: { paddingVertical: 4 },
  changeField: { fontSize: font.xs, fontWeight: '700', color: colors.text },
  changeValues: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 2 },
  before: { flex: 1, fontSize: font.xs, color: colors.danger, textDecorationLine: 'line-through' },
  after: { flex: 1, fontSize: font.xs, color: colors.success, fontWeight: '700' },

  hash: { fontSize: 10, color: colors.textFaint, marginTop: space.md },
});
