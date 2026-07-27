import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import invoiceV2Service from '../services/invoiceV2Service';
import { ocrStatusMeta } from '../config/invoices';
import { toLocalISODate } from '../utils/dayBucket';
import { formatDate } from '../utils/format';
import { colors, radius, space, font } from '../theme';

const formatTRY = (v) => `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;

const isoToDisplay = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

const displayToIso = (s) => {
  const m = s.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) {
    return null;
  }
  return toLocalISODate(d);
};

function Field({ label, value }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

/**
 * Gelen (OCR) fatura detayı — kalem detayları, KDV kırılımı ve uyuşmazlık
 * uyarısı. "Manuel Düzeltme" başlık alanlarını ve genel toplamı düzeltir;
 * kalem bazlı düzeltme telefonda kullanışsız olduğu için web panelinde kaldı.
 */
export default function OcrInvoiceDetailScreen({ route, navigation }) {
  const [invoice, setInvoice] = useState(route.params.invoice);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    navigation.setOptions({ title: 'Fatura Detayı' });
  }, [navigation]);

  const st = ocrStatusMeta(invoice.validationStatus);
  const isMismatch = invoice.validationStatus === 'mismatch';

  const startEdit = () => {
    setForm({
      vendorName: invoice.vendorName || '',
      vendorTaxNumber: invoice.vendorTaxNumber || '',
      invoiceNumber: invoice.invoiceNumber || '',
      invoiceDate: invoice.invoiceDate
        ? isoToDisplay(toLocalISODate(new Date(invoice.invoiceDate)))
        : '',
      grandTotal: String(invoice.grandTotal ?? ''),
    });
    setEditing(true);
  };

  const setField = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    const grandTotal = Number(String(form.grandTotal).replace(',', '.'));
    if (Number.isNaN(grandTotal) || grandTotal < 0) {
      Alert.alert('Geçersiz tutar', 'Genel toplam için geçerli bir sayı girin.');
      return;
    }

    let invoiceDate;
    if (form.invoiceDate.trim()) {
      invoiceDate = displayToIso(form.invoiceDate);
      if (!invoiceDate) {
        Alert.alert('Geçersiz tarih', 'Fatura tarihini GG.AA.YYYY biçiminde girin.');
        return;
      }
    }

    setSaving(true);
    try {
      const res = await invoiceV2Service.update(invoice._id, {
        vendorName: form.vendorName.trim(),
        vendorTaxNumber: form.vendorTaxNumber.trim(),
        invoiceNumber: form.invoiceNumber.trim(),
        invoiceDate: invoiceDate || null,
        grandTotal,
      });
      setInvoice(res.data.data);
      setEditing(false);
    } catch (err) {
      Alert.alert('Kaydedilemedi', err.response?.data?.error || 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Faturayı sil',
      'Bu fatura kaydı kalıcı olarak silinecek. Bu işlem geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await invoiceV2Service.delete(invoice._id);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Silinemedi', err.response?.data?.error || 'Bir hata oluştu.');
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.vendor}>{invoice.vendorName || 'Bilinmeyen satıcı'}</Text>
          <View style={[styles.chip, { backgroundColor: st.bg }]}>
            <Text style={[styles.chipText, { color: st.fg }]}>{st.label}</Text>
          </View>
        </View>

        {isMismatch && (
          <View style={styles.warnBanner}>
            <Ionicons name="warning-outline" size={18} color="#B45309" />
            <Text style={styles.warnText}>
              {invoice.validationMessage ||
                'Toplam uyuşmazlığı: hesaplanan tutar ile faturadaki tutar tutmuyor. Lütfen gözle kontrol edin.'}
            </Text>
          </View>
        )}

        {editing ? (
          <View style={styles.card}>
            <Text style={styles.editLabel}>Satıcı</Text>
            <TextInput style={styles.input} value={form.vendorName} onChangeText={setField('vendorName')} placeholderTextColor={colors.textFaint} />
            <Text style={styles.editLabel}>Vergi No</Text>
            <TextInput style={styles.input} value={form.vendorTaxNumber} onChangeText={setField('vendorTaxNumber')} keyboardType="number-pad" placeholderTextColor={colors.textFaint} />
            <Text style={styles.editLabel}>Fatura No</Text>
            <TextInput style={styles.input} value={form.invoiceNumber} onChangeText={setField('invoiceNumber')} placeholderTextColor={colors.textFaint} />
            <Text style={styles.editLabel}>Fatura Tarihi</Text>
            <TextInput style={styles.input} value={form.invoiceDate} onChangeText={setField('invoiceDate')} placeholder="GG.AA.YYYY" placeholderTextColor={colors.textFaint} keyboardType="numbers-and-punctuation" />
            <Text style={styles.editLabel}>Genel Toplam</Text>
            <TextInput style={styles.input} value={form.grandTotal} onChangeText={setField('grandTotal')} keyboardType="decimal-pad" placeholderTextColor={colors.textFaint} />

            <View style={styles.editActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)} activeOpacity={0.7}>
                <Text style={styles.cancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && styles.disabled]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveText}>Kaydet</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.fieldGrid}>
              <Field label="SATICI" value={invoice.vendorName} />
              <Field label="VERGİ NO" value={invoice.vendorTaxNumber} />
              <Field label="FATURA NO" value={invoice.invoiceNumber} />
              <Field label="FATURA TARİHİ" value={invoice.invoiceDate ? formatDate(invoice.invoiceDate) : '—'} />
            </View>
            {invoice.confidenceScore > 0 && (
              <Text style={styles.confidence}>OCR güven skoru: %{Math.round(invoice.confidenceScore)}</Text>
            )}
          </View>
        )}

        <Text style={styles.sectionLabel}>KALEM DETAYLARI</Text>
        <View style={styles.card}>
          {(invoice.lineItems || []).length === 0 ? (
            <Text style={styles.empty}>Kalem okunamadı.</Text>
          ) : (
            invoice.lineItems.map((li, idx) => (
              <View key={idx} style={[styles.item, idx > 0 && styles.itemDivider]}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {li.description || 'Açıklama yok'}
                </Text>
                <View style={styles.itemMetaRow}>
                  <Text style={styles.itemMeta}>Matrah {formatTRY(li.baseAmount)}</Text>
                  <Text style={styles.itemMeta}>%{li.vatRate}</Text>
                  <Text style={styles.itemMeta}>KDV {formatTRY(li.vatAmount)}</Text>
                  <Text style={styles.itemTotal}>{formatTRY(li.totalAmount)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionLabel}>KDV KIRILIMI</Text>
        <View style={styles.vatGrid}>
          {(invoice.vatSummary || []).map((v, idx) => (
            <View key={idx} style={styles.vatCard}>
              <View style={styles.vatRateBadge}>
                <Text style={styles.vatRateText}>%{v.vatRate}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.vatRow}>
                  <Text style={styles.vatLabel}>Matrah</Text>
                  <Text style={styles.vatValue}>{formatTRY(v.totalBase)}</Text>
                </View>
                <View style={styles.vatRow}>
                  <Text style={styles.vatLabel}>KDV Tutarı</Text>
                  <Text style={styles.vatValue}>{formatTRY(v.totalVat)}</Text>
                </View>
                <View style={[styles.vatRow, styles.vatTotalRow]}>
                  <Text style={styles.vatTotalLabel}>Toplam</Text>
                  <Text style={styles.vatTotalValue}>{formatTRY(v.totalWithVat)}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.totalsCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Toplam Matrah</Text>
            <Text style={styles.totalValue}>{formatTRY(invoice.totalBase)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Toplam KDV</Text>
            <Text style={styles.totalValue}>{formatTRY(invoice.totalVat)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandRow]}>
            <Text style={styles.grandLabel}>Genel Toplam</Text>
            <Text style={styles.grandValue}>{formatTRY(invoice.grandTotal)}</Text>
          </View>
        </View>

        {!editing && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.editBtn} onPress={startEdit} activeOpacity={0.85}>
              <Ionicons name="create-outline" size={17} color={colors.primary} />
              <Text style={styles.editBtnText}>Manuel Düzeltme</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.85}>
              <Ionicons name="trash-outline" size={17} color={colors.danger} />
              <Text style={styles.deleteBtnText}>Sil</Text>
            </TouchableOpacity>
          </View>
        )}

        {!!invoice.originalFileName && (
          <Text style={styles.fileName}>Kaynak dosya: {invoice.originalFileName}</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  vendor: { flex: 1, fontSize: font.xl, fontWeight: '800', color: colors.text, lineHeight: 26 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  chipText: { fontSize: 11, fontWeight: '800' },

  warnBanner: {
    flexDirection: 'row', gap: space.sm, alignItems: 'flex-start',
    backgroundColor: colors.warnSoft, borderRadius: radius.md, padding: space.md, marginTop: space.md,
  },
  warnText: { flex: 1, fontSize: font.sm, color: '#B45309', lineHeight: 19 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md,
    borderWidth: 1, borderColor: colors.border, marginTop: space.md,
  },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  field: { width: '50%', paddingVertical: 6, paddingRight: space.sm },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: colors.textFaint, letterSpacing: 0.4 },
  fieldValue: { fontSize: font.sm, color: colors.text, marginTop: 2 },
  confidence: { fontSize: font.xs, color: colors.textFaint, marginTop: space.sm },

  editLabel: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted, marginTop: space.sm, marginBottom: 4 },
  input: {
    backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: space.md, height: 44,
    fontSize: font.sm, color: colors.text,
  },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.md },
  cancelBtn: {
    paddingHorizontal: space.lg, height: 42, justifyContent: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  cancelText: { fontSize: font.sm, fontWeight: '600', color: colors.textMuted },
  saveBtn: {
    minWidth: 96, height: 42, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, backgroundColor: colors.primary,
  },
  saveText: { color: '#fff', fontSize: font.sm, fontWeight: '700' },
  disabled: { opacity: 0.6 },

  sectionLabel: { fontSize: font.xs, fontWeight: '800', color: colors.textFaint, letterSpacing: 0.6, marginTop: space.xl },

  item: { paddingVertical: space.sm },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  itemName: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  itemMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: 4, alignItems: 'center' },
  itemMeta: { fontSize: font.xs, color: colors.textMuted },
  itemTotal: { marginLeft: 'auto', fontSize: font.xs, fontWeight: '800', color: colors.text },

  vatGrid: { gap: space.sm, marginTop: space.md },
  vatCard: {
    flexDirection: 'row', gap: space.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md,
    borderWidth: 1, borderColor: colors.border,
  },
  vatRateBadge: {
    width: 44, height: 30, borderRadius: radius.sm, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  vatRateText: { color: '#fff', fontSize: font.sm, fontWeight: '800' },
  vatRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  vatLabel: { fontSize: font.xs, color: colors.textMuted },
  vatValue: { fontSize: font.xs, fontWeight: '700', color: colors.text },
  vatTotalRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 5 },
  vatTotalLabel: { fontSize: font.xs, fontWeight: '800', color: colors.text },
  vatTotalValue: { fontSize: font.sm, fontWeight: '800', color: colors.primary },

  totalsCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md,
    borderWidth: 1, borderColor: colors.border, marginTop: space.lg,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  totalLabel: { fontSize: font.sm, color: colors.textMuted },
  totalValue: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  grandRow: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6, paddingTop: space.sm },
  grandLabel: { fontSize: font.md, fontWeight: '800', color: colors.text },
  grandValue: { fontSize: font.lg, fontWeight: '800', color: colors.primary },

  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    height: 46, borderRadius: radius.md, backgroundColor: colors.primarySoft,
  },
  editBtnText: { color: colors.primary, fontSize: font.sm, fontWeight: '700' },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: space.lg, height: 46, borderRadius: radius.md, backgroundColor: colors.dangerSoft,
  },
  deleteBtnText: { color: colors.danger, fontSize: font.sm, fontWeight: '700' },

  empty: { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: space.md },
  fileName: { fontSize: font.xs, color: colors.textFaint, textAlign: 'center', marginTop: space.lg },
});
