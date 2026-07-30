import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import invoiceService from '../services/invoiceService';
import EInvoiceModal from '../components/EInvoiceModal';
import { useAuth } from '../context/AuthContext';
import { invoiceStatusMeta, eInvoiceStatusMeta, canWriteInvoices } from '../config/invoices';
import { formatMoney, formatDate } from '../utils/format';
import { downloadAndSharePdf } from '../utils/downloadPdf';
import { colors, radius, space, font } from '../theme';

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

/**
 * Satış faturası detayı — "Ödendi" işareti, PDF indirme ve resmî e-Fatura
 * kesimi. Fatura oluşturma/revize akışı web panelinde kalıyor.
 */
export default function SalesInvoiceDetailScreen({ route, navigation }) {
  const { session } = useAuth();
  const canWrite = canWriteInvoices(session?.role);

  const [invoice, setInvoice] = useState(route.params.invoice);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Resmî e-Fatura durumu, faturanın ödeme durumundan ayrı tutuluyor.
  const [ei, setEi] = useState(route.params.invoice?.eInvoice || { status: 'NONE' });
  const [eiBusy, setEiBusy] = useState(false);
  const [showEiForm, setShowEiForm] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: invoice.invoiceNumber || 'Fatura' });
  }, [navigation, invoice.invoiceNumber]);

  const st = invoiceStatusMeta(invoice.status);
  const currency = invoice.currency;
  const eiSt = eInvoiceStatusMeta(ei.status);
  const eiHasPdf = ei.hasPdf ?? !!ei.pdfBase64;

  const markPaid = () => {
    Alert.alert(
      'Ödendi olarak işaretle',
      `${invoice.invoiceNumber} faturası "Ödendi" olarak işaretlenecek.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'İşaretle',
          onPress: async () => {
            setBusy(true);
            try {
              const res = await invoiceService.updateStatus(invoice._id, 'paid');
              setInvoice(res.data.data);
            } catch (err) {
              Alert.alert('Güncellenemedi', err.response?.data?.error || 'Bir hata oluştu.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  // ---- PDF ----
  const downloadPdf = async (request, filename) => {
    setPdfBusy(true);
    try {
      await downloadAndSharePdf(request, filename);
    } catch (err) {
      Alert.alert('PDF alınamadı', err.response?.data?.error || 'Dosya indirilemedi.');
    } finally {
      setPdfBusy(false);
    }
  };

  // ---- Resmî e-Fatura akışı ----
  // Gönderim anında onaylanmaz: issue SENDING bırakır, ISSUED'a geçiş refresh
  // (poll) ile kesinleşir — web'deki akışın aynısı.
  const refreshEi = async (silent = false) => {
    setEiBusy(true);
    try {
      const res = await invoiceService.refreshEInvoice(invoice._id);
      setEi(res.data.data.eInvoice);
    } catch (err) {
      if (!silent) {
        Alert.alert('Güncellenemedi', err.response?.data?.error || 'Durum güncellenemedi.');
      }
    } finally {
      setEiBusy(false);
    }
  };

  const submitEInvoice = async (recipient) => {
    setEiBusy(true);
    try {
      const res = await invoiceService.issueEInvoice(invoice._id, recipient);
      setEi(res.data.data.eInvoice);
      setShowEiForm(false);
      refreshEi(true); // onayı bir kez otomatik yokla
    } catch (err) {
      Alert.alert('Kesim başarısız', err.response?.data?.error || 'Resmî kesim başarısız.');
    } finally {
      setEiBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.number}>{invoice.invoiceNumber}</Text>
          <Text style={styles.customer} numberOfLines={1}>
            {invoice.customer?.name || invoice.customer?.company || '—'}
          </Text>
        </View>
        <View style={[styles.chip, { backgroundColor: st.bg }]}>
          <Text style={[styles.chipText, { color: st.fg }]}>{st.label}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Row label="Fatura Tarihi" value={formatDate(invoice.issueDate)} />
        <Row label="Vade Tarihi" value={invoice.dueDate ? formatDate(invoice.dueDate) : '—'} />
        <Row label="İlişkili Teklif" value={invoice.quote?.quoteNumber} />
        <Row label="Fırsat" value={invoice.deal?.title} />
        <Row label="Düzenleyen" value={invoice.owner?.name} />
        {!!invoice.customer?.taxNumber && (
          <Row label="Vergi No" value={invoice.customer.taxNumber} />
        )}
      </View>

      <Text style={styles.sectionLabel}>KALEM DETAYLARI</Text>
      <View style={styles.card}>
        {(invoice.items || []).map((item, idx) => (
          <View key={item._id || idx} style={[styles.item, idx > 0 && styles.itemDivider]}>
            <View style={styles.itemTop}>
              <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.itemTotal}>{formatMoney(item.gross ?? item.total, currency, 2)}</Text>
            </View>
            <Text style={styles.itemMeta}>
              {item.quantity} × {formatMoney(item.unitPrice, currency, 2)} · KDV %{item.taxRate}
              {item.discountRate > 0 ? ` · İnd. %${item.discountRate}` : ''}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.totalsCard}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Ara Toplam</Text>
          <Text style={styles.totalValue}>{formatMoney(invoice.subtotal, currency, 2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Toplam KDV</Text>
          <Text style={styles.totalValue}>{formatMoney(invoice.totalTax, currency, 2)}</Text>
        </View>
        <View style={[styles.totalRow, styles.grandRow]}>
          <Text style={styles.grandLabel}>Genel Toplam</Text>
          <Text style={styles.grandValue}>{formatMoney(invoice.grandTotal, currency, 2)}</Text>
        </View>
      </View>

      {!!invoice.notes && (
        <>
          <Text style={styles.sectionLabel}>NOTLAR</Text>
          <View style={styles.card}>
            <Text style={styles.notes}>{invoice.notes}</Text>
          </View>
        </>
      )}

      {/* Resmî e-Fatura (GİB) — faturanın ödeme durumundan ayrı eksen, o yüzden
          "Ödendi"/"İptal" faturalarda da görünür. */}
      <Text style={styles.sectionLabel}>RESMÎ E-FATURA (GİB)</Text>
      <View style={styles.card}>
        <View style={styles.eiStatusRow}>
          <View style={[styles.chip, { backgroundColor: eiSt.bg }]}>
            <Text style={[styles.chipText, { color: eiSt.fg }]}>{eiSt.label}</Text>
          </View>
          {!!ei.officialNumber && (
            <Text style={styles.eiOfficial} numberOfLines={1}>No: {ei.officialNumber}</Text>
          )}
        </View>

        {ei.status === 'SENDING' && (
          <Text style={styles.eiHint}>Onay için durumu yenileyin.</Text>
        )}
        {ei.status === 'FAILED' && !!ei.error && (
          <Text style={styles.eiError}>{ei.error}</Text>
        )}

        {canWrite && (
          <View style={styles.eiActions}>
            {(ei.status === 'NONE' || ei.status === 'FAILED') && (
              <TouchableOpacity
                style={[styles.eiPrimaryBtn, eiBusy && styles.disabled]}
                onPress={() => setShowEiForm(true)}
                disabled={eiBusy}
                activeOpacity={0.85}
              >
                <Ionicons name="document-text-outline" size={18} color="#fff" />
                <Text style={styles.eiPrimaryText}>
                  {ei.status === 'FAILED' ? 'Tekrar Kes (E-Fatura)' : 'Resmî Fatura Kes (E-Fatura)'}
                </Text>
              </TouchableOpacity>
            )}

            {ei.status === 'SENDING' && (
              <TouchableOpacity
                style={[styles.secondaryBtn, eiBusy && styles.disabled]}
                onPress={() => refreshEi()}
                disabled={eiBusy}
                activeOpacity={0.85}
              >
                {eiBusy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="refresh-outline" size={18} color={colors.primary} />
                    <Text style={styles.secondaryText}>Durumu Yenile</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {eiHasPdf && (
              <TouchableOpacity
                style={[styles.secondaryBtn, pdfBusy && styles.disabled]}
                onPress={() =>
                  downloadPdf(
                    () => invoiceService.getEInvoicePdf(invoice._id),
                    `efatura-${invoice.invoiceNumber}.pdf`
                  )
                }
                disabled={pdfBusy}
                activeOpacity={0.85}
              >
                <Ionicons name="download-outline" size={18} color={colors.primary} />
                <Text style={styles.secondaryText}>E-Fatura PDF</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {invoice.status === 'issued' && (
        <TouchableOpacity
          style={[styles.paidBtn, busy && styles.disabled]}
          onPress={markPaid}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
              <Text style={styles.paidText}>Ödendi Olarak İşaretle</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.secondaryBtn, styles.pdfBtn, pdfBusy && styles.disabled]}
        onPress={() =>
          downloadPdf(
            () => invoiceService.getSalesPdf(invoice._id),
            `${invoice.invoiceNumber}.pdf`
          )
        }
        disabled={pdfBusy}
        activeOpacity={0.85}
      >
        {pdfBusy ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            <Ionicons name="download-outline" size={18} color={colors.primary} />
            <Text style={styles.secondaryText}>PDF İndir</Text>
          </>
        )}
      </TouchableOpacity>

      <EInvoiceModal
        visible={showEiForm}
        invoice={invoice}
        busy={eiBusy}
        onSubmit={submitEInvoice}
        onClose={() => setShowEiForm(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  number: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  customer: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  chipText: { fontSize: 11, fontWeight: '800' },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md,
    borderWidth: 1, borderColor: colors.border, marginTop: space.md,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: 6 },
  rowLabel: { width: 110, fontSize: font.xs, fontWeight: '700', color: colors.textFaint },
  rowValue: { flex: 1, fontSize: font.sm, color: colors.text, textAlign: 'right' },

  sectionLabel: {
    fontSize: font.xs, fontWeight: '800', color: colors.textFaint,
    letterSpacing: 0.6, marginTop: space.xl,
  },

  item: { paddingVertical: space.sm },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  itemName: { flex: 1, fontSize: font.sm, fontWeight: '700', color: colors.text },
  itemTotal: { fontSize: font.sm, fontWeight: '800', color: colors.text },
  itemMeta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },

  totalsCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md,
    borderWidth: 1, borderColor: colors.border, marginTop: space.md,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  totalLabel: { fontSize: font.sm, color: colors.textMuted },
  totalValue: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  grandRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6, paddingTop: space.sm },
  grandLabel: { fontSize: font.md, fontWeight: '800', color: colors.text },
  grandValue: { fontSize: font.lg, fontWeight: '800', color: colors.primary },

  notes: { fontSize: font.sm, color: colors.text, lineHeight: 21 },

  paidBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.success, borderRadius: radius.md, height: 48, marginTop: space.xl,
  },
  paidText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
  disabled: { opacity: 0.6 },

  eiStatusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  eiOfficial: { flex: 1, fontSize: font.xs, color: colors.textMuted },
  eiHint: { fontSize: font.xs, color: colors.textMuted, marginTop: space.sm },
  eiError: { fontSize: font.xs, color: colors.danger, marginTop: space.sm, lineHeight: 18 },

  eiActions: { gap: space.sm, marginTop: space.md },
  eiPrimaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.primary, borderRadius: radius.md, height: 46,
  },
  eiPrimaryText: { color: '#fff', fontSize: font.sm, fontWeight: '700' },

  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, height: 46,
    borderWidth: 1.5, borderColor: colors.border,
  },
  secondaryText: { color: colors.primary, fontSize: font.sm, fontWeight: '700' },
  pdfBtn: { marginTop: space.md },
});
