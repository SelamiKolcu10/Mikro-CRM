import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import leadService from '../services/leadService';
import {
  LEAD_STATUSES,
  DEPARTMENTS,
  DEPARTMENT_LABEL,
  STATUS,
  statusMeta,
  tempMeta,
  summarizeLead,
} from '../config/leads';
import { formatDate } from '../utils/format';
import { colors, radius, space, font } from '../theme';

// Yatay kaydırılan filtre şeridi — durum ve departman satırları aynı bileşeni
// kullanır, tek fark seçenek listesi.
function ChipRow({ options, value, onChange }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={String(o.value)}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(o.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function LeadCard({ lead, onPress }) {
  const st = statusMeta(lead.status);
  const tm = tempMeta(lead.temperature);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.name} numberOfLines={1}>
        {lead.name}
        {!!lead.company && <Text style={styles.company}> · {lead.company}</Text>}
      </Text>
      <Text style={styles.summary} numberOfLines={2}>{summarizeLead(lead)}</Text>

      <View style={styles.metaRow}>
        {!!lead.assignedDepartment && (
          <View style={styles.deptPill}>
            <Text style={styles.deptText}>{DEPARTMENT_LABEL[lead.assignedDepartment]}</Text>
          </View>
        )}
        <View style={[styles.badge, { backgroundColor: st.bg }]}>
          <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: tm.bg }]}>
          <View style={[styles.tempDot, { backgroundColor: tm.fg }]} />
          <Text style={[styles.badgeText, { color: tm.fg }]}>
            {tm.label} · {lead.score}
          </Text>
        </View>
        <Text style={styles.date}>{formatDate(lead.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function LeadsScreen({ navigation }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [department, setDepartment] = useState('all');

  const load = useCallback(async () => {
    try {
      const res = await leadService.getAll();
      setLeads(res.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Talepler yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Detaydan geri dönüldüğünde liste tazelensin (durum/atama değişmiş olabilir).
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  // Durum sekmelerindeki sayılar tüm listeden hesaplanır (departman/arama
  // filtresinden bağımsız) — web Leads.jsx ile aynı davranış.
  const statusOptions = useMemo(
    () => [
      { value: 'all', label: `Tümü (${leads.length})` },
      ...LEAD_STATUSES.map((s) => ({
        value: s,
        label: `${STATUS[s].label} (${leads.filter((l) => l.status === s).length})`,
      })),
    ],
    [leads]
  );

  const departmentOptions = useMemo(
    () => [
      { value: 'all', label: 'Tüm Departmanlar' },
      ...DEPARTMENTS.map((d) => ({ value: d, label: DEPARTMENT_LABEL[d] })),
    ],
    []
  );

  const data = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    return leads.filter((l) => {
      if (status !== 'all' && l.status !== status) return false;
      if (department !== 'all' && l.assignedDepartment !== department) return false;
      if (!q) return true;
      return [l.name, l.company, l.email]
        .filter(Boolean)
        .some((f) => f.toLocaleLowerCase('tr').includes(q));
    });
  }, [leads, search, status, department]);

  const header = (
    <View>
      <Text style={styles.title}>Formlar</Text>
      <Text style={styles.subtitle}>Gelen talepleri görüntüle, skorla ve takip et.</Text>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Ad, şirket veya e-posta ara..."
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        )}
      </View>

      <ChipRow options={statusOptions} value={status} onChange={setStatus} />
      <ChipRow options={departmentOptions} value={department} onChange={setDepartment} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={data}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <LeadCard lead={item} onPress={() => navigation.navigate('LeadDetail', { lead: item })} />
        )}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Bu filtrede talep yok.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: space.xl },
  list: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },

  title: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: font.md, color: colors.textMuted, marginTop: 2, marginBottom: space.lg },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: space.md, height: 48, marginBottom: space.md,
  },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },

  chipRow: { gap: space.sm, paddingBottom: space.sm, paddingRight: space.lg },
  chip: {
    paddingHorizontal: space.md, height: 36, justifyContent: 'center',
    borderRadius: radius.full, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.sm, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: '#fff' },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#1B2130', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  name: { fontSize: font.lg, fontWeight: '800', color: colors.text },
  company: { fontSize: font.md, fontWeight: '600', color: colors.textMuted },
  summary: { fontSize: font.sm, color: colors.textMuted, marginTop: space.xs, lineHeight: 19 },

  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  deptPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, backgroundColor: '#EEF1F4' },
  deptText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  badgeText: { fontSize: 11, fontWeight: '800' },
  tempDot: { width: 6, height: 6, borderRadius: radius.full },
  date: { fontSize: font.xs, color: colors.textFaint, marginLeft: 'auto' },

  empty: { textAlign: 'center', color: colors.textMuted, marginTop: space.xl },
  errorText: { color: colors.danger, textAlign: 'center', marginBottom: space.md },
  retry: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md },
  retryText: { color: '#fff', fontWeight: '700' },
});
