import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import quoteService from '../services/quoteService';
import { formatMoney, formatDate } from '../utils/format';
import { downloadAndSharePdf } from '../utils/downloadPdf';
import { colors, radius, space, font } from '../theme';

const STATUS_LABEL = {
  draft: 'Taslak', sent: 'Gönderildi', accepted: 'Kabul Edildi', rejected: 'Reddedildi', expired: 'Süresi Doldu',
};

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value || '—'}</Text>
    </View>
  );
}

export default function QuoteDetailScreen({ route }) {
  const { id } = route.params;
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await quoteService.getById(id);
      setQuote(res.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Teklif yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // PDF'i sunucu üretir (puppeteer HTML→PDF); cihazda önbelleğe yazılıp
  // sistemin paylaş sayfasına devredilir — bkz. utils/downloadPdf.js.
  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      await downloadAndSharePdf(
        () => quoteService.getPdf(quote._id),
        `${quote.quoteNumber || 'teklif'}.pdf`,
      );
    } catch (err) {
      Alert.alert('PDF alınamadı', err.response?.data?.error || 'Dosya indirilemedi.');
    } finally {
      setPdfBusy(false);
    }
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }
  if (error || !quote) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || 'Teklif bulunamadı.'}</Text>
        <TouchableOpacity style={styles.retry} onPress={load}><Text style={styles.retryText}>Tekrar dene</Text></TouchableOpacity>
      </View>
    );
  }

  const cur = quote.currency;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.number}>{quote.quoteNumber}</Text>
      <View style={styles.statusPill}>
        <Text style={styles.statusPillText}>{STATUS_LABEL[quote.status] || quote.status}</Text>
      </View>

      {/* Quote info */}
      <Text style={styles.sectionTitle}>TEKLİF BİLGİSİ</Text>
      <View style={styles.card}>
        <View style={styles.infoGrid}>
          <InfoRow label="Müşteri" value={quote.customer?.name} />
          <InfoRow label="Firma" value={quote.customer?.company} />
          <InfoRow label="Sorumlu" value={quote.owner?.name} />
          <InfoRow label="Tarih" value={formatDate(quote.createdAt)} />
          <InfoRow label="Geçerlilik" value={formatDate(quote.validUntil)} />
          <InfoRow label="Gönderim Tarihi" value={formatDate(quote.sentAt)} />
        </View>
      </View>

      {/* Line items */}
      <Text style={styles.sectionTitle}>KALEMLER</Text>
      <View style={styles.card}>
        {quote.items?.map((it, idx) => (
          <View key={it._id || idx} style={[styles.itemRow, idx < quote.items.length - 1 && styles.itemDivider]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{it.name}</Text>
              <Text style={styles.itemCalc}>
                {it.quantity} × {formatMoney(it.unitPrice, cur)}
                {it.discountRate ? `  ·  -%${it.discountRate}` : ''}  ·  KDV %{it.taxRate}
              </Text>
            </View>
            <Text style={styles.itemTotal}>{formatMoney(it.total, cur)}</Text>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View style={styles.card}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Ara Toplam</Text>
          <Text style={styles.totalValue}>{formatMoney(quote.subtotal, cur)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>KDV Toplam</Text>
          <Text style={styles.totalValue}>{formatMoney(quote.totalTax, cur)}</Text>
        </View>
        <View style={[styles.totalRow, styles.grandRow]}>
          <Text style={styles.grandLabel}>Genel Toplam</Text>
          <Text style={styles.grandValue}>{formatMoney(quote.grandTotal, cur)}</Text>
        </View>
      </View>

      {!!quote.notes && (
        <>
          <Text style={styles.sectionTitle}>NOTLAR</Text>
          <View style={styles.card}><Text style={styles.notes}>{quote.notes}</Text></View>
        </>
      )}

      <TouchableOpacity
        style={[styles.pdfBtn, pdfBusy && styles.pdfBtnBusy]}
        activeOpacity={0.85}
        onPress={downloadPdf}
        disabled={pdfBusy}
      >
        {pdfBusy ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="download-outline" size={18} color={colors.primary} />
        )}
        <Text style={styles.pdfBtnText}>{pdfBusy ? 'Hazırlanıyor…' : 'PDF İndir'}</Text>
      </TouchableOpacity>

      <View style={{ height: space.xl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: space.xl },

  number: { fontSize: font.xxl, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  statusPill: { alignSelf: 'flex-start', backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, marginTop: space.sm, marginBottom: space.lg },
  statusPillText: { fontSize: font.xs, fontWeight: '700', color: colors.primary },

  sectionTitle: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: space.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, marginBottom: space.lg },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  infoItem: { width: '50%', paddingVertical: space.sm },
  infoLabel: { fontSize: font.xs, color: colors.textFaint, fontWeight: '600' },
  infoValue: { fontSize: font.sm, color: colors.text, fontWeight: '600', marginTop: 2 },

  itemRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: space.md, gap: space.md },
  itemDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  itemName: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  itemCalc: { fontSize: font.xs, color: colors.textMuted, marginTop: 3 },
  itemTotal: { fontSize: font.sm, fontWeight: '800', color: colors.text },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.xs },
  totalLabel: { fontSize: font.sm, color: colors.textMuted },
  totalValue: { fontSize: font.sm, color: colors.text, fontWeight: '600' },
  grandRow: { marginTop: space.sm, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  grandLabel: { fontSize: font.md, fontWeight: '800', color: colors.text },
  grandValue: { fontSize: font.lg, fontWeight: '800', color: colors.primary },

  notes: { fontSize: font.sm, color: colors.text, lineHeight: 20 },

  pdfBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primary,
    borderRadius: radius.md, height: 48,
  },
  pdfBtnBusy: { opacity: 0.6 },
  pdfBtnText: { color: colors.primary, fontSize: font.md, fontWeight: '700' },

  errorText: { color: colors.danger, textAlign: 'center', marginBottom: space.md },
  retry: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md },
  retryText: { color: '#fff', fontWeight: '700' },
});
