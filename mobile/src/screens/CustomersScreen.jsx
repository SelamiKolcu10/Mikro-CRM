import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import customerService from '../services/customerService';
import { colors, radius, space, font } from '../theme';

// Real data comes from the backend Customer model:
// name, email, company, plan (free|starter|premium|vip), mrr (Number).
// The design is the target; the numbers are the user's own customers.

// plan (backend) → badge label + colors shown in the design
const PLAN_LABEL = { vip: 'VIP', premium: 'Premium', starter: 'Starter', free: 'Free' };
const TIER_STYLE = {
  VIP: { bg: colors.primarySoft, fg: colors.primary },
  Premium: { bg: '#EDE9FE', fg: '#6D28D9' },
  Starter: { bg: colors.warnSoft, fg: '#B45309' },
  Free: { bg: '#EEF1F4', fg: colors.textMuted },
};
const CHIPS = ['Tümü', 'VIP', 'Premium', 'Starter', 'Free'];
const CHIP_TO_PLAN = { VIP: 'vip', Premium: 'premium', Starter: 'starter', Free: 'free' };

// Match the web panel's formatting: `$` + grouped number.
const formatCurrency = (val) => `$${Number(val || 0).toLocaleString()}`;

const AVATAR_COLORS = ['#6366F1', '#0EA5E9', '#EC4899', '#F59E0B', '#10B981', '#8B5CF6'];
const initials = (name = '') =>
  name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const avatarColor = (name = '') =>
  AVATAR_COLORS[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];

function StatCard({ label, value, sub, icon, tint, bg }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statBody}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statSub}>{sub}</Text>
      </View>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
    </View>
  );
}

function CustomerCard({ item }) {
  const label = PLAN_LABEL[item.plan] || 'Free';
  const tier = TIER_STYLE[label];
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: avatarColor(item.name) }]}>
          <Text style={styles.avatarText}>{initials(item.name)}</Text>
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <View style={[styles.tierBadge, { backgroundColor: tier.bg }]}>
              <Text style={[styles.tierText, { color: tier.fg }]}>{label}</Text>
            </View>
          </View>
          <Text style={styles.sub} numberOfLines={1}>
            {item.company ? `${item.company} · ` : ''}{item.email}
          </Text>
        </View>
      </View>
      <View style={styles.cardBottom}>
        <View>
          <Text style={styles.mrrLabel}>MRR</Text>
          <Text style={styles.mrrValue}>{formatCurrency(item.mrr)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </View>
    </View>
  );
}

export default function CustomersScreen() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [chip, setChip] = useState('Tümü');

  const load = useCallback(async () => {
    try {
      const res = await customerService.getAll({ limit: 100, sort: '-mrr' });
      setCustomers(res.data.data);
      setTotal(res.data.pagination?.total ?? res.data.data.length);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Müşteriler yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const totalMrr = useMemo(
    () => customers.reduce((s, c) => s + (c.mrr || 0), 0),
    [customers]
  );

  const data = useMemo(
    () => (chip === 'Tümü' ? customers : customers.filter((c) => c.plan === CHIP_TO_PLAN[chip])),
    [chip, customers]
  );

  const header = (
    <View>
      <Text style={styles.subtitle}>Müşteri tabanını yönetin ve takip edin.</Text>

      <StatCard
        label="TOPLAM MÜŞTERİ"
        value={String(total)}
        sub="kayıtlı müşteri"
        icon="people"
        tint={colors.primary}
        bg={colors.primarySoft}
      />
      <StatCard
        label="AYLIK GELİR (MRR)"
        value={formatCurrency(totalMrr)}
        sub="toplam aylık yinelenen gelir"
        icon="cash-outline"
        tint={colors.success}
        bg={colors.successSoft}
      />

      <View style={styles.chips}>
        {CHIPS.map((c) => {
          const active = c === chip;
          return (
            <TouchableOpacity
              key={c}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setChip(c)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
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
        <TouchableOpacity style={styles.retry} onPress={load} activeOpacity={0.85}>
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
        renderItem={({ item }) => <CustomerCard item={item} />}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Bu kademede müşteri yok.</Text>}
      />

      <TouchableOpacity style={styles.fab} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: space.xl },
  list: { padding: space.lg, gap: space.md, paddingBottom: 96 },
  subtitle: { fontSize: font.md, color: colors.textMuted, marginBottom: space.lg },

  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.md,
  },
  statBody: { flex: 1 },
  statLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.4 },
  statValue: { fontSize: font.xxl, fontWeight: '800', color: colors.text, marginTop: 4 },
  statSub: { fontSize: font.xs, color: colors.textMuted, marginTop: 4 },
  statIcon: { width: 52, height: 52, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs, marginBottom: space.md },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: font.sm, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: '#fff' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: font.md },
  cardInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { fontSize: font.md, fontWeight: '700', color: colors.text, flexShrink: 1 },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
  tierText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  sub: { fontSize: font.sm, color: colors.textMuted, marginTop: 3 },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mrrLabel: { fontSize: 10, fontWeight: '700', color: colors.textFaint, letterSpacing: 0.4 },
  mrrValue: { fontSize: font.lg, fontWeight: '800', color: colors.text, marginTop: 1 },

  empty: { textAlign: 'center', color: colors.textMuted, marginTop: space.xl },
  errorText: { color: colors.danger, textAlign: 'center', marginBottom: space.md },
  retry: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md },
  retryText: { color: '#fff', fontWeight: '700' },

  fab: {
    position: 'absolute',
    right: space.lg,
    bottom: space.xl,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
