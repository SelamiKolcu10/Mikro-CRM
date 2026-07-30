import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import reportService from '../services/reportService';
import { formatMoney, formatCompactMoney } from '../utils/format';
import { colors, radius, space, font, chartColors } from '../theme';

const VENDOR_PREVIEW = 6; // "Tümünü Gör" açılana kadar gösterilen satıcı sayısı

// Satıcı adları OCR'dan serbest metin geliyor — anlamlı bir ikon eşlemesi
// uyduramayız, o yüzden baş harf + palette'ten sabit bir renk kullanıyoruz
// (aynı satıcı her açılışta aynı rengi alsın diye index'e göre).
const vendorTint = (index) => chartColors[index % chartColors.length];

function StatCard({ label, value, sub, icon, tint, bg }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {!!sub && <Text style={styles.statSub} numberOfLines={1}>{sub}</Text>}
    </View>
  );
}

/**
 * Genel Harcama — web'deki SpendingDashboard'ın mobil karşılığı.
 *
 * Tek kaynak yerli OCR faturaları (backend reportController): dört toplam
 * kartı + satıcı bazında kırılım. Tutarlar milyonlara çıktığı için kartlarda
 * kısaltılmış (₺32,4 Mn), satıcı listesinde tam yazılıyor.
 */
export default function SpendingScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showAllVendors, setShowAllVendors] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await reportService.getSpendingSummary();
      setData(res.data.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Harcama özeti alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const overall = data?.overall || { totalSpend: 0, totalVat: 0, totalBase: 0, count: 0 };
  const vendors = data?.byVendor || [];
  const maxSpend = vendors.length ? Math.max(...vendors.map((v) => v.totalSpend)) : 0;
  const shownVendors = showAllVendors ? vendors : vendors.slice(0, VENDOR_PREVIEW);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.h1}>Genel Harcama</Text>
      <Text style={styles.h1sub}>Gelen faturalardan harcama ve KDV özeti</Text>

      {!!error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.statGrid}>
        <StatCard
          label="TOPLAM HARCAMA"
          value={formatCompactMoney(overall.totalSpend)}
          icon="wallet-outline"
          tint={colors.primary}
          bg={colors.primarySoft}
        />
        <StatCard
          label="TOPLAM KDV"
          value={formatCompactMoney(overall.totalVat)}
          icon="pricetag-outline"
          tint={colors.warm}
          bg={colors.warnSoft}
        />
        <StatCard
          label="TOPLAM MATRAH"
          value={formatCompactMoney(overall.totalBase)}
          icon="calculator-outline"
          tint={colors.success}
          bg={colors.successSoft}
        />
        <StatCard
          label="FATURA SAYISI"
          value={String(overall.count || 0)}
          sub={vendors.length ? `${vendors.length} satıcı` : null}
          icon="receipt-outline"
          tint={colors.textMuted}
          bg={colors.bg}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Satıcı Bazında Kırılım</Text>
        {vendors.length > VENDOR_PREVIEW && (
          <TouchableOpacity onPress={() => setShowAllVendors((s) => !s)} hitSlop={8}>
            <Text style={styles.link}>{showAllVendors ? 'Daha Az' : 'Tümünü Gör'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        {vendors.length === 0 ? (
          <Text style={styles.empty}>Bu dönemde kayıtlı gider faturası yok.</Text>
        ) : (
          shownVendors.map((v, idx) => {
            const tint = vendorTint(idx);
            const ratio = maxSpend > 0 ? v.totalSpend / maxSpend : 0;
            return (
              <View key={v.vendor || idx} style={[styles.vendorRow, idx > 0 && styles.vendorDivider]}>
                <View style={[styles.vendorBadge, { backgroundColor: `${tint}22` }]}>
                  <Text style={[styles.vendorInitial, { color: tint }]}>
                    {(v.vendor || '?').trim().charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.vendorMain}>
                  <View style={styles.vendorTop}>
                    <Text style={styles.vendorName} numberOfLines={1}>
                      {v.vendor || 'Bilinmeyen satıcı'}
                    </Text>
                    <Text style={styles.vendorAmount}>{formatMoney(v.totalSpend)}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[styles.barFill, { width: `${Math.max(ratio * 100, 2)}%`, backgroundColor: tint }]}
                    />
                  </View>
                  <Text style={styles.vendorMeta}>{v.count} fatura</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },

  h1: { fontSize: font.xxl, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  h1sub: { fontSize: font.md, color: colors.textMuted, marginTop: 2, marginBottom: space.lg },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.dangerSoft, borderRadius: radius.md,
    padding: space.md, marginBottom: space.lg,
  },
  errorText: { flex: 1, fontSize: font.sm, color: colors.danger },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: {
    width: '48%', padding: space.md, marginBottom: space.lg,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  statIcon: {
    width: 32, height: 32, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center', marginBottom: space.sm,
  },
  statLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.4 },
  statValue: { fontSize: font.xl, fontWeight: '800', color: colors.text, marginTop: space.xs },
  statSub: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: space.sm, marginBottom: space.md,
  },
  sectionTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  link: { fontSize: font.sm, fontWeight: '700', color: colors.primary },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: space.md,
  },
  empty: { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: space.lg },

  vendorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md },
  vendorDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  vendorBadge: {
    width: 36, height: 36, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  vendorInitial: { fontSize: font.md, fontWeight: '800' },

  vendorMain: { flex: 1 },
  vendorTop: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  vendorName: { flex: 1, fontSize: font.sm, fontWeight: '700', color: colors.text },
  vendorAmount: { fontSize: font.sm, fontWeight: '800', color: colors.text },

  barTrack: {
    height: 6, borderRadius: radius.full, backgroundColor: colors.bg,
    marginTop: space.sm, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.full },
  vendorMeta: { fontSize: font.xs, color: colors.textMuted, marginTop: space.xs },
});
