import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font, chartColors } from '../theme';

// NOTE: Static placeholder data for now — laid out like the target design.
// Wiring these to real backend endpoints (customers, revenue, feedbacks) is
// the "devreye sokma" step we do next, one card at a time.
const STATS = [
  { key: 'customers', label: 'TOPLAM MÜŞTERİ', value: '15', icon: 'people-outline', tint: colors.primary, bg: colors.primarySoft },
  { key: 'revenue', label: 'AYLIK GELİR', value: '$1.771', sub: '/ay', icon: 'trending-up-outline', tint: colors.success, bg: colors.successSoft },
  { key: 'openBugs', label: 'AÇIK HATALAR', value: '5', sub: '4 çözüm bekliyor', icon: 'alert-circle-outline', tint: colors.danger, bg: colors.dangerSoft },
  { key: 'atRisk', label: 'RİSK ALTINDAKİ GELİR', value: '$1.421', sub: 'Premium müşterilerden', icon: 'warning-outline', tint: colors.warm, bg: colors.warnSoft },
];

const FEEDBACKS = [
  { rank: 1, title: 'Kontrol paneli 15+ saniyede yükleniyor', tags: ['Hata', 'VIP', 'Kritik'], revenue: '$499/ay' },
  { rank: 2, title: 'Giriş sayfası mobilde çöküyor', tags: ['Hata', 'VIP', 'Kritik'], revenue: '$499/ay' },
  { rank: 3, title: 'Veri dışa aktarımı bozuk CSV dosyaları oluşturuyor', tags: ['Hata', 'Premium', 'Kritik'], revenue: '$350/ay', highlight: true },
  { rank: 4, title: 'API istek limiti çok kısıtlayıcı', tags: ['İyileştirme', 'VIP', 'Kritik'], revenue: '$299/ay' },
];

// Alan adı bilerek `count` — `value` DEĞİL. Aşağıda bu sayılar inline style
// içinde kullanılıyor (flex, width) ve Reanimated'in babel plugin'i bir style
// prop'unda gördüğü her `.value` erişimini tip kontrolü yapmadan shared value
// sanıp render'a console.warn enjekte ediyor. Düz sayı olmaları fark etmiyor;
// isim `value` olduğu sürece uyarı geri gelir.
const PLAN_DISTRIBUTION = [
  { label: 'Ücretsiz', count: 3, color: chartColors[0] },
  { label: 'Başlangıç', count: 3, color: chartColors[1] },
  { label: 'Premium', count: 3, color: chartColors[2] },
  { label: 'VIP', count: 6, color: chartColors[3] },
];

const TYPE_DISTRIBUTION = [
  { label: 'Hata', count: 6, color: colors.danger },
  { label: 'Özellik', count: 7, color: colors.primary },
  { label: 'İyileştirme', count: 4, color: colors.success },
];

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export default function DashboardScreen() {
  const maxType = Math.max(...TYPE_DISTRIBUTION.map((t) => t.count));
  const planTotal = PLAN_DISTRIBUTION.reduce((s, p) => s + p.count, 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.h1}>Kontrol Paneli</Text>
      <Text style={styles.h1sub}>Gelir odaklı geri bildirim özeti</Text>

      {/* Stat cards — 2×2 */}
      <View style={styles.statGrid}>
        {STATS.map((s) => (
          <Card key={s.key} style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: s.bg }]}>
              <Ionicons name={s.icon} size={18} color={s.tint} />
            </View>
            <Text style={styles.statLabel} numberOfLines={1}>{s.label}</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{s.value}</Text>
              {!!s.sub && s.key === 'revenue' && <Text style={styles.statValueUnit}>{s.sub}</Text>}
            </View>
            {!!s.sub && s.key !== 'revenue' && <Text style={styles.statSub} numberOfLines={1}>{s.sub}</Text>}
          </Card>
        ))}
      </View>

      {/* Revenue-impacting feedback */}
      <SectionTitle>En Yüksek Gelir Etkili Geri Bildirimler</SectionTitle>
      <Card>
        {FEEDBACKS.map((f, idx) => (
          <View
            key={f.rank}
            style={[
              styles.fbRow,
              f.highlight && styles.fbRowHighlight,
              idx < FEEDBACKS.length - 1 && styles.fbDivider,
            ]}
          >
            <View style={[styles.fbRank, f.highlight && styles.fbRankHi]}>
              <Text style={[styles.fbRankText, f.highlight && styles.fbRankTextHi]}>{f.rank}</Text>
            </View>
            <View style={styles.fbBody}>
              <Text style={styles.fbTitle} numberOfLines={2}>{f.title}</Text>
              <View style={styles.fbTags}>
                {f.tags.map((t) => (
                  <View key={t} style={styles.tag}>
                    <Text style={styles.tagText}>{t}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Text style={styles.fbRevenue}>{f.revenue}</Text>
          </View>
        ))}
      </Card>

      {/* Plan distribution — stacked bar (no native chart lib needed) */}
      <SectionTitle>Plan Dağılımı</SectionTitle>
      <Card>
        <View style={styles.planHeader}>
          <Text style={styles.planTotal}>{planTotal}</Text>
          <Text style={styles.planTotalLabel}>Toplam Müşteri</Text>
        </View>
        <View style={styles.stackBar}>
          {PLAN_DISTRIBUTION.map((p) => (
            <View key={p.label} style={{ flex: p.count, backgroundColor: p.color }} />
          ))}
        </View>
        <View style={styles.planLegend}>
          {PLAN_DISTRIBUTION.map((p) => (
            <View key={p.label} style={styles.planLegendItem}>
              <View style={[styles.legendDot, { backgroundColor: p.color }]} />
              <Text style={styles.legendLabel}>{p.label}</Text>
              <Text style={styles.legendValue}>{p.count}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Type distribution — bars */}
      <SectionTitle>Tür Dağılımı</SectionTitle>
      <Card>
        {TYPE_DISTRIBUTION.map((t) => (
          <View key={t.label} style={styles.barRow}>
            <Text style={styles.barLabel}>{t.label}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${(t.count / maxType) * 100}%`, backgroundColor: t.color }]} />
            </View>
            <Text style={styles.barValue}>{t.count}</Text>
          </View>
        ))}
      </Card>

      <View style={{ height: space.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg },
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
  planLegend: { flexDirection: 'row', flexWrap: 'wrap' },
  planLegendItem: { flexDirection: 'row', alignItems: 'center', width: '50%', paddingVertical: space.xs },
  legendDot: { width: 10, height: 10, borderRadius: radius.full, marginRight: space.sm },
  legendLabel: { flex: 1, fontSize: font.sm, color: colors.textMuted },
  legendValue: { fontSize: font.sm, fontWeight: '700', color: colors.text, marginRight: space.md },

  barRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, gap: space.md },
  barLabel: { width: 84, fontSize: font.sm, color: colors.text },
  barTrack: { flex: 1, height: 8, borderRadius: radius.full, backgroundColor: colors.bg, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.full },
  barValue: { width: 20, textAlign: 'right', fontSize: font.sm, fontWeight: '700', color: colors.text },
});
