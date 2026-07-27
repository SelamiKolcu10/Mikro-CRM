import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dealService from '../services/dealService';
import { formatMoney, formatDate } from '../utils/format';
import { STAGE_LABEL, STAGE_STYLE, OPEN_STAGES } from '../config/deals';
import { colors, radius, space, font } from '../theme';

const CHIPS = ['Hepsi', ...Object.values(STAGE_LABEL)];
const LABEL_TO_STAGE = Object.fromEntries(Object.entries(STAGE_LABEL).map(([k, v]) => [v, k]));

function StatCard({ label, value, sub, icon }) {
  return (
    <View style={styles.statCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statSub}>{sub}</Text>
      </View>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
    </View>
  );
}

function DealCard({ item, onPress }) {
  const st = STAGE_STYLE[item.stage] || STAGE_STYLE.initial_contact;
  return (
    <TouchableOpacity style={[styles.card, { borderLeftColor: st.fg }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.stageBadge, { backgroundColor: st.bg }]}>
        <Text style={[styles.stageText, { color: st.fg }]}>{STAGE_LABEL[item.stage] || item.stage}</Text>
      </View>
      <Text style={styles.dealTitle} numberOfLines={2}>{item.title}</Text>
      <View style={styles.ownerRow}>
        <Ionicons name="person-circle-outline" size={15} color={colors.textMuted} />
        <Text style={styles.ownerName} numberOfLines={1}>{item.owner?.name || 'Atanmamış'}</Text>
      </View>
      <View style={styles.dealBottom}>
        <Text style={styles.dealAmount}>{formatMoney(item.value, item.currency)}</Text>
        <View style={styles.dealMetaRight}>
          <Text style={styles.dealPct}>%{Math.round(item.probability ?? 0)}</Text>
          <Text style={styles.dealDate}>{formatDate(item.expectedCloseDate)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function DealsScreen({ navigation }) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [chip, setChip] = useState('Hepsi');

  const load = useCallback(async () => {
    try {
      const res = await dealService.getAll();
      setDeals(res.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Fırsatlar yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const openDeals = useMemo(() => deals.filter((d) => OPEN_STAGES.includes(d.stage)), [deals]);
  const openPipeline = useMemo(() => openDeals.reduce((s, d) => s + (d.value || 0), 0), [openDeals]);
  const weightedForecast = useMemo(() => openDeals.reduce((s, d) => s + (d.weightedValue || 0), 0), [openDeals]);

  const data = useMemo(
    () => (chip === 'Hepsi' ? deals : deals.filter((d) => d.stage === LABEL_TO_STAGE[chip])),
    [chip, deals]
  );

  const header = (
    <View>
      <Text style={styles.subtitle}>Pipeline'ınızı yönetin ve takip edin.</Text>

      <TouchableOpacity style={styles.newBtn} activeOpacity={0.85} onPress={() => navigation.navigate('NewDeal')}>
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.newBtnText}>Yeni Fırsat</Text>
      </TouchableOpacity>

      <View style={styles.statRow}>
        <StatCard label="AÇIK PIPELINE" value={formatMoney(openPipeline, 'TRY')} sub={`${openDeals.length} açık fırsat`} icon="albums-outline" />
      </View>
      <StatCard label="AĞIRLIKLI TAHMİN" value={formatMoney(weightedForecast, 'TRY')} sub="olasılıkla ağırlıklı gelir" icon="stats-chart-outline" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
      >
        {CHIPS.map((c) => {
          const active = c === chip;
          return (
            <TouchableOpacity key={c} style={[styles.chip, active && styles.chipActive]} onPress={() => setChip(c)} activeOpacity={0.8}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={load}><Text style={styles.retryText}>Tekrar dene</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={data}
      keyExtractor={(item) => item._id}
      renderItem={({ item }) => <DealCard item={item} onPress={() => navigation.navigate('DealDetail', { deal: item })} />}
      ListHeaderComponent={header}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Text style={styles.empty}>Bu aşamada fırsat yok.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: space.xl },
  list: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  subtitle: { fontSize: font.md, color: colors.textMuted, marginBottom: space.md },

  newBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.primary, borderRadius: radius.md, height: 48, marginBottom: space.lg,
  },
  newBtnText: { color: '#fff', fontSize: font.md, fontWeight: '700' },

  statRow: {},
  statCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, marginBottom: space.md,
  },
  statLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.4 },
  statValue: { fontSize: font.xxl, fontWeight: '800', color: colors.text, marginTop: 4 },
  statSub: { fontSize: font.xs, color: colors.textMuted, marginTop: 4 },
  statIcon: { width: 46, height: 46, borderRadius: radius.full, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },

  chipsScroll: { marginTop: space.xs, marginBottom: space.md },
  chips: { flexDirection: 'row', gap: space.sm, paddingRight: space.lg },
  chip: { paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.sm, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: '#fff' },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 4, padding: space.lg,
  },
  stageBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, marginBottom: space.sm },
  stageText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  dealTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ownerName: { fontSize: font.sm, color: colors.textMuted },
  dealBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: space.md },
  dealAmount: { fontSize: font.lg, fontWeight: '800', color: colors.primary },
  dealMetaRight: { alignItems: 'flex-end' },
  dealPct: { fontSize: font.sm, fontWeight: '800', color: colors.text },
  dealDate: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },

  empty: { textAlign: 'center', color: colors.textMuted, marginTop: space.xl },
  errorText: { color: colors.danger, textAlign: 'center', marginBottom: space.md },
  retry: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md },
  retryText: { color: '#fff', fontWeight: '700' },
});
