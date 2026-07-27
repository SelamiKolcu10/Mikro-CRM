import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import quoteService from '../services/quoteService';
import { QUOTE_STATUS, quoteStatus } from '../config/quotes';
import { formatMoney, formatDate } from '../utils/format';
import { colors, radius, space, font } from '../theme';

const FILTERS = [
  { value: 'all', label: 'Tümü' },
  ...Object.entries(QUOTE_STATUS).map(([value, { label }]) => ({ value, label })),
];

function QuoteCard({ item, onPress }) {
  const st = quoteStatus(item.status);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardTop}>
        <View style={styles.docIcon}>
          <Ionicons name="document-text-outline" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.qNumber}>{item.quoteNumber}</Text>
          <Text style={styles.qCustomer} numberOfLines={1}>{item.customer?.name || 'Müşteri'}</Text>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
            <Text style={styles.qDate}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>
        <View style={[styles.statusChip, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusText, { color: st.fg }]}>{st.label}</Text>
        </View>
      </View>
      <Text style={styles.qTotal}>{formatMoney(item.grandTotal, item.currency)}</Text>
    </TouchableOpacity>
  );
}

export default function QuotesScreen({ navigation }) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await quoteService.getAll({ limit: 100 });
      setQuotes(res.data.data.items);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Teklifler yüklenemedi.');
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

  const data = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotes.filter((x) => {
      if (statusFilter !== 'all' && x.status !== statusFilter) return false;
      if (!q) return true;
      return (
        x.quoteNumber?.toLowerCase().includes(q) ||
        x.customer?.name?.toLowerCase().includes(q)
      );
    });
  }, [search, statusFilter, quotes]);

  const activeFilterLabel = FILTERS.find((f) => f.value === statusFilter)?.label;

  const header = (
    <View>
      <Text style={styles.title}>Teklifler</Text>
      <Text style={styles.subtitle}>Müşteri tekliflerini oluşturun ve takip edin.</Text>

      <TouchableOpacity style={styles.newBtn} activeOpacity={0.85} onPress={() => navigation.navigate('NewQuote')}>
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.newBtnText}>Yeni Teklif</Text>
      </TouchableOpacity>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Teklif No veya Müşteri ara..."
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
        />
      </View>

      <TouchableOpacity style={styles.filterBtn} activeOpacity={0.8} onPress={() => setFilterOpen(true)}>
        <Ionicons name="filter" size={16} color={colors.primary} />
        <Text style={styles.filterText}>
          Filtre{statusFilter !== 'all' ? `: ${activeFilterLabel}` : ''}
        </Text>
      </TouchableOpacity>
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
    <View style={styles.screen}>
      <FlatList
        data={data}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <QuoteCard item={item} onPress={() => navigation.navigate('QuoteDetail', { id: item._id })} />
        )}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Teklif bulunamadı.</Text>}
      />

      {/* Filter bottom sheet */}
      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setFilterOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Duruma göre filtrele</Text>
            <View style={styles.filterChips}>
              {FILTERS.map((f) => {
                const active = f.value === statusFilter;
                return (
                  <TouchableOpacity
                    key={f.value}
                    style={[styles.fchip, active && styles.fchipActive]}
                    onPress={() => {
                      setStatusFilter(f.value);
                      setFilterOpen(false);
                    }}
                  >
                    <Text style={[styles.fchipText, active && styles.fchipTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: space.xl },
  list: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },

  title: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: font.md, color: colors.textMuted, marginTop: 2, marginBottom: space.lg },

  newBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.primary, borderRadius: radius.md, height: 50, marginBottom: space.md,
    shadowColor: colors.primary, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  newBtnText: { color: '#fff', fontSize: font.md, fontWeight: '700' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: space.md, height: 48, marginBottom: space.sm,
  },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    height: 44, marginBottom: space.sm,
  },
  filterText: { fontSize: font.sm, fontWeight: '600', color: colors.primary },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#1B2130', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  docIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  qNumber: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3 },
  qCustomer: { fontSize: font.lg, fontWeight: '800', color: colors.text, marginTop: 1 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  qDate: { fontSize: font.sm, color: colors.textMuted },
  statusChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  statusText: { fontSize: 11, fontWeight: '800' },
  qTotal: { fontSize: font.xl, fontWeight: '800', color: colors.primary, marginTop: space.md },

  empty: { textAlign: 'center', color: colors.textMuted, marginTop: space.xl },
  errorText: { color: colors.danger, textAlign: 'center', marginBottom: space.md },
  retry: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md },
  retryText: { color: '#fff', fontWeight: '700' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.lg, paddingBottom: space.xxl },
  grabber: { width: 40, height: 4, borderRadius: radius.full, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: space.md },
  sheetTitle: { fontSize: font.lg, fontWeight: '800', color: colors.text, marginBottom: space.md },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fchip: { paddingHorizontal: space.md, paddingVertical: 9, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  fchipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  fchipText: { fontSize: font.sm, fontWeight: '600', color: colors.textMuted },
  fchipTextActive: { color: '#fff' },
});
