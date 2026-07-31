import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import feedbackService from '../services/feedbackService';
import {
  FEEDBACK_TYPES,
  FEEDBACK_PRIORITIES,
  FEEDBACK_STATUSES,
  PLAN_LABEL,
  typeMeta,
  priorityMeta,
  statusMeta,
} from '../config/feedbacks';
import { formatMoney } from '../utils/format';
import { colors, radius, space, font, chartColors } from '../theme';

// Web'deki Dashboard.jsx ile aynı iki uçtan beslenir:
//   GET /feedbacks/stats/summary  → kartlar + üç dağılım grafiği
//   GET /feedbacks?sort=-revenueImpact&limit=5 → gelir etkisi listesi
// Sayıların tamamı backend'den gelir; burada hiçbir şey hesaplanmaz, yalnız
// biçimlendirilir. MRR/revenueImpact USD (Customer.mrr web'de de $ gösterir).

// Donut yerine yığılmış çubuk: chartColors sırası web'in PLAN_COLORS'ıyla
// aynı anlamı taşır (ücretsiz → nötr gri, VIP → vurgulu turuncu).
const PLAN_ORDER = ['free', 'starter', 'premium', 'vip'];

// DİKKAT — alan adı bilerek `count`, `value` DEĞİL. Aşağıda bu sayılar inline
// style içinde kullanılıyor (flex, width) ve Reanimated'in babel plugin'i bir
// style prop'unda gördüğü her `.value` erişimini tip kontrolü yapmadan shared
// value sanıp render'a console.warn enjekte ediyor. Düz sayı olmaları fark
// etmiyor; isim `value` olduğu sürece sarı uyarı bandı geri gelir.
const toBars = (group, keys, meta) =>
  keys.map((key) => ({
    key,
    label: meta(key).label,
    count: group?.[key] || 0,
    color: meta(key).fg,
  }));

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function StatCard({ label, value, sub, unit, icon, tint, bg }) {
  return (
    <Card style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {!!unit && <Text style={styles.statValueUnit}>{unit}</Text>}
      </View>
      {!!sub && <Text style={styles.statSub} numberOfLines={1}>{sub}</Text>}
    </Card>
  );
}

// Ortak yatay çubuk listesi — tür/öncelik/durum dağılımlarının üçü de bunu
// kullanır. En uzun çubuk %100; bölen en az 1 (hepsi sıfırken NaN olmasın).
function BarCard({ items }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <Card>
      {items.map((it) => (
        <View key={it.key} style={styles.barRow}>
          <Text style={styles.barLabel} numberOfLines={1}>{it.label}</Text>
          <View style={styles.barTrack}>
            <View
              style={[styles.barFill, { width: `${(it.count / max) * 100}%`, backgroundColor: it.color }]}
            />
          </View>
          <Text style={styles.barValue}>{it.count}</Text>
        </View>
      ))}
    </Card>
  );
}

export default function DashboardScreen() {
  const [stats, setStats] = useState(null);
  const [topFeedbacks, setTopFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [statsRes, feedbacksRes] = await Promise.all([
        feedbackService.getStats(),
        feedbackService.getAll({ sort: '-revenueImpact', limit: 5 }),
      ]);
      setStats(statsRes.data.data);
      setTopFeedbacks(feedbacksRes.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Kontrol paneli yüklenemedi.');
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && !stats) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.textFaint} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const planDistribution = PLAN_ORDER.map((plan, i) => ({
    key: plan,
    label: PLAN_LABEL[plan],
    count: stats.customersByPlan?.[plan] || 0,
    color: chartColors[i],
  }));
  const planTotal = planDistribution.reduce((s, p) => s + p.count, 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.h1}>Kontrol Paneli</Text>
      <Text style={styles.h1sub}>Gelir odaklı geri bildirim özeti</Text>

      {/* Stat cards — 2×2 */}
      <View style={styles.statGrid}>
        <StatCard
          label="TOPLAM MÜŞTERİ"
          value={stats.totalCustomers}
          icon="people-outline"
          tint={colors.primary}
          bg={colors.primarySoft}
        />
        <StatCard
          label="AYLIK GELİR"
          value={formatMoney(stats.totalMRR, 'USD')}
          unit="/ay"
          icon="trending-up-outline"
          tint={colors.success}
          bg={colors.successSoft}
        />
        <StatCard
          label="AÇIK HATALAR"
          value={stats.openBugs}
          sub={`${stats.inProgressCount} çözüm bekliyor`}
          icon="alert-circle-outline"
          tint={colors.danger}
          bg={colors.dangerSoft}
        />
        <StatCard
          label="RİSK ALTINDAKİ GELİR"
          value={formatMoney(stats.revenueAtRisk, 'USD')}
          sub="Açık geri bildirimlerden"
          icon="warning-outline"
          tint={colors.warm}
          bg={colors.warnSoft}
        />
      </View>

      {/* Revenue-impacting feedback */}
      <SectionTitle>En Yüksek Gelir Etkili Geri Bildirimler</SectionTitle>
      <Card>
        {topFeedbacks.map((fb, idx) => {
          // Listede zaten gelir etkisine göre sıralı geldiği için ilk satır
          // "en kritik olan" — vurguyu ona veriyoruz, keyfi bir satıra değil.
          const highlight = idx === 0;
          const tags = [
            typeMeta(fb.type).label,
            fb.customer?.plan ? PLAN_LABEL[fb.customer.plan] : null,
            priorityMeta(fb.priority).label,
          ].filter(Boolean);

          return (
            <View
              key={fb._id}
              style={[
                styles.fbRow,
                highlight && styles.fbRowHighlight,
                idx < topFeedbacks.length - 1 && styles.fbDivider,
              ]}
            >
              <View style={[styles.fbRank, highlight && styles.fbRankHi]}>
                <Text style={[styles.fbRankText, highlight && styles.fbRankTextHi]}>{idx + 1}</Text>
              </View>
              <View style={styles.fbBody}>
                <Text style={styles.fbTitle} numberOfLines={2}>{fb.title}</Text>
                <View style={styles.fbTags}>
                  {tags.map((t) => (
                    <View key={t} style={styles.tag}>
                      <Text style={styles.tagText}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <Text style={styles.fbRevenue}>{formatMoney(fb.revenueImpact, 'USD')}/ay</Text>
            </View>
          );
        })}
        {topFeedbacks.length === 0 && <Text style={styles.empty}>Henüz geri bildirim yok.</Text>}
      </Card>

      {/* Plan distribution — stacked bar (no native chart lib needed) */}
      <SectionTitle>Plan Dağılımı</SectionTitle>
      <Card>
        <View style={styles.planHeader}>
          <Text style={styles.planTotal}>{planTotal}</Text>
          <Text style={styles.planTotalLabel}>Toplam Müşteri</Text>
        </View>
        <View style={styles.stackBar}>
          {planTotal === 0 ? (
            <View style={styles.stackEmpty} />
          ) : (
            planDistribution
              .filter((p) => p.count > 0)
              .map((p) => <View key={p.key} style={{ flex: p.count, backgroundColor: p.color }} />)
          )}
        </View>
        <View style={styles.planLegend}>
          {planDistribution.map((p) => (
            <View key={p.key} style={styles.planLegendItem}>
              <View style={[styles.legendDot, { backgroundColor: p.color }]} />
              <Text style={styles.legendLabel}>{p.label}</Text>
              <Text style={styles.legendValue}>{p.count}</Text>
            </View>
          ))}
        </View>
      </Card>

      <SectionTitle>Tür Dağılımı</SectionTitle>
      <BarCard items={toBars(stats.byType, FEEDBACK_TYPES, typeMeta)} />

      <SectionTitle>Öncelik Dağılımı</SectionTitle>
      <BarCard items={toBars(stats.byPriority, FEEDBACK_PRIORITIES, priorityMeta)} />

      <SectionTitle>Durum Dağılımı</SectionTitle>
      <BarCard items={toBars(stats.byStatus, FEEDBACK_STATUSES, statusMeta)} />

      <View style={{ height: space.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: space.xl,
    gap: space.md,
  },
  errorText: { fontSize: font.md, color: colors.textMuted, textAlign: 'center' },
  empty: { fontSize: font.sm, color: colors.textMuted, paddingVertical: space.md, textAlign: 'center' },
  h1: { fontSize: font.xxl, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  h1sub: { fontSize: font.md, color: colors.textMuted, marginTop: 2, marginBottom: space.lg },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginBottom: space.lg,
  },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { width: '48%', padding: space.md },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  statLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.4 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: space.xs },
  statValue: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  statValueUnit: { fontSize: font.xs, color: colors.textMuted, marginLeft: 2 },
  statSub: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },

  sectionTitle: { fontSize: font.md, fontWeight: '700', color: colors.text, marginBottom: space.md },

  fbRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: space.md, gap: space.md },
  fbDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  fbRowHighlight: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    marginHorizontal: -space.sm,
  },
  fbRank: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbRankHi: { backgroundColor: colors.primary },
  fbRankText: { fontSize: font.sm, fontWeight: '800', color: colors.textMuted },
  fbRankTextHi: { color: '#fff' },
  fbBody: { flex: 1 },
  fbTitle: { fontSize: font.sm, fontWeight: '600', color: colors.text, lineHeight: 18 },
  fbTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tag: { backgroundColor: colors.bg, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  fbRevenue: { fontSize: font.sm, fontWeight: '800', color: colors.warm },

  planHeader: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginBottom: space.md },
  planTotal: { fontSize: font.xxl, fontWeight: '800', color: colors.text },
  planTotalLabel: { fontSize: font.sm, color: colors.textMuted },
  stackBar: {
    flexDirection: 'row',
    height: 16,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: space.lg,
  },
  stackEmpty: { flex: 1, backgroundColor: colors.bg },
  planLegend: { flexDirection: 'row', flexWrap: 'wrap' },
  planLegendItem: { flexDirection: 'row', alignItems: 'center', width: '50%', paddingVertical: space.xs },
  legendDot: { width: 10, height: 10, borderRadius: radius.full, marginRight: space.sm },
  legendLabel: { flex: 1, fontSize: font.sm, color: colors.textMuted },
  legendValue: { fontSize: font.sm, fontWeight: '700', color: colors.text, marginRight: space.md },

  barRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, gap: space.md },
  barLabel: { width: 104, fontSize: font.sm, color: colors.text },
  barTrack: { flex: 1, height: 8, borderRadius: radius.full, backgroundColor: colors.bg, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.full },
  barValue: { width: 24, textAlign: 'right', fontSize: font.sm, fontWeight: '700', color: colors.text },
});
