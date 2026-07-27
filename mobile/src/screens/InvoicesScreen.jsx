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
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pickFromCamera, pickFromGallery, pickDocuments } from '../platform/filePicker';
import invoiceService from '../services/invoiceService';
import invoiceV2Service from '../services/invoiceV2Service';
import { useAuth } from '../context/AuthContext';
import {
  SALES_STATUS_FILTERS,
  OCR_STATUS_FILTERS,
  OCR_ACCEPTED_TYPES,
  OCR_MAX_FILES,
  invoiceStatusMeta,
  ocrStatusMeta,
  canReadInvoices,
} from '../config/invoices';
import { formatMoney, formatDate } from '../utils/format';
import { colors, radius, space, font } from '../theme';

const formatTRY = (v) => `₺${Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;

function ChipRow({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={o.value || 'all'}
            style={[styles.filterChip, active && styles.filterChipActive]}
            onPress={() => onChange(o.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function StatTile({ icon, tint, label, value, caption }) {
  return (
    <View style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={17} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.tileValue} numberOfLines={1}>{value}</Text>
        {!!caption && <Text style={styles.tileCaption} numberOfLines={1}>{caption}</Text>}
      </View>
    </View>
  );
}

function SalesRow({ item, onPress, onMarkPaid }) {
  const st = invoiceStatusMeta(item.status);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardTop}>
        <View style={styles.icon}>
          <Ionicons name="receipt-outline" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.number}>{item.invoiceNumber}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {item.customer?.name || item.customer?.company || '—'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.amount}>{formatMoney(item.grandTotal, item.currency, 2)}</Text>
          <View style={[styles.chip, { backgroundColor: st.bg, marginTop: 4 }]}>
            <Text style={[styles.chipText, { color: st.fg }]}>{st.label}</Text>
          </View>
        </View>
      </View>

      <View style={styles.metaRow}>
        {!!item.quote?.quoteNumber && (
          <Text style={styles.meta}>Teklif: {item.quote.quoteNumber}</Text>
        )}
        <Text style={styles.meta}>{formatDate(item.issueDate)}</Text>
        {!!item.dueDate && <Text style={styles.meta}>Vade: {formatDate(item.dueDate)}</Text>}
      </View>

      {item.status === 'issued' && (
        <TouchableOpacity style={styles.paidBtn} onPress={onMarkPaid} activeOpacity={0.85}>
          <Ionicons name="checkmark-circle-outline" size={15} color="#fff" />
          <Text style={styles.paidText}>Ödendi olarak işaretle</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function OcrRow({ item, onPress }) {
  const st = ocrStatusMeta(item.validationStatus);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardTop}>
        <View style={styles.icon}>
          <Ionicons name="document-attach-outline" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.number} numberOfLines={1}>{item.vendorName || 'Bilinmeyen satıcı'}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {formatDate(item.invoiceDate)}
            {!!item.invoiceNumber && ` · #${item.invoiceNumber}`}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.amount}>{formatTRY(item.grandTotal)}</Text>
          <View style={[styles.chip, { backgroundColor: st.bg, marginTop: 4 }]}>
            <Text style={[styles.chipText, { color: st.fg }]}>{st.label}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function InvoicesScreen({ navigation }) {
  const { session } = useAuth();
  const allowed = canReadInvoices(session?.role);

  const [tab, setTab] = useState('sales');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Satış faturaları (ana backend)
  const [sales, setSales] = useState([]);
  const [salesStatus, setSalesStatus] = useState('');
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesError, setSalesError] = useState(null);

  // Gelen faturalar (OCR mikroservisi)
  const [ocr, setOcr] = useState([]);
  const [ocrStats, setOcrStats] = useState(null);
  const [ocrStatus, setOcrStatus] = useState('');
  const [ocrLoading, setOcrLoading] = useState(true);
  const [ocrError, setOcrError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const loadSales = useCallback(async () => {
    try {
      const res = await invoiceService.getAll({ status: salesStatus || undefined, limit: 50 });
      setSales(res.data.data.items);
      setSalesError(null);
    } catch (err) {
      setSalesError(
        err.response?.status === 403
          ? 'Faturaları görüntüleme yetkin yok.'
          : err.response?.data?.error || 'Satış faturaları yüklenemedi.'
      );
    } finally {
      setSalesLoading(false);
    }
  }, [salesStatus]);

  const loadOcr = useCallback(async () => {
    try {
      const [listRes, statsRes] = await Promise.all([
        invoiceV2Service.getAll({ status: ocrStatus || undefined }),
        invoiceV2Service.getStats(),
      ]);
      setOcr(listRes.data.data);
      setOcrStats(statsRes.data.data);
      setOcrError(null);
    } catch (err) {
      // Mikroservis ayrı bir süreç — çalışmıyorsa bunu açıkça söyle, sessizce
      // boş liste gösterip "hiç fatura yok" izlenimi verme.
      setOcrError(
        err.response
          ? err.response.data?.error || 'Gelen faturalar yüklenemedi.'
          : 'OCR servisine ulaşılamıyor (port 5002). Servis çalışıyor mu?'
      );
    } finally {
      setOcrLoading(false);
    }
  }, [ocrStatus]);

  useEffect(() => {
    if (!allowed) return;
    if (tab === 'sales') loadSales();
    else loadOcr();
  }, [allowed, tab, loadSales, loadOcr]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await (tab === 'sales' ? loadSales() : loadOcr());
    setRefreshing(false);
  }, [tab, loadSales, loadOcr]);

  const handleMarkPaid = (inv) => {
    Alert.alert(
      'Ödendi olarak işaretle',
      `${inv.invoiceNumber} faturası "Ödendi" olarak işaretlenecek.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'İşaretle',
          onPress: async () => {
            try {
              await invoiceService.updateStatus(inv._id, 'paid');
              loadSales();
            } catch (err) {
              Alert.alert('Güncellenemedi', err.response?.data?.error || 'Bir hata oluştu.');
            }
          },
        },
      ]
    );
  };

  // Kamera / galeri / dosyalar — üçü de aynı normalize biçimi döndüğü için
  // yükleme yolu tek (bkz. platform/filePicker.js).
  const handlePick = async (source) => {
    setPickerOpen(false);
    let picked = [];
    try {
      if (source === 'camera') picked = await pickFromCamera();
      else if (source === 'gallery') picked = await pickFromGallery(OCR_MAX_FILES);
      else picked = await pickDocuments(OCR_ACCEPTED_TYPES);
    } catch (err) {
      Alert.alert('Seçilemedi', err.message || 'Dosya alınamadı.');
      return;
    }
    if (picked.length === 0) return;
    await uploadFiles(picked.slice(0, OCR_MAX_FILES));
  };

  const uploadFiles = async (files) => {
    setUploading(true);
    try {
      if (files.length === 1) {
        await invoiceV2Service.upload(files[0]);
        Alert.alert('İşlem tamamlandı', 'Fatura işlendi.');
      } else {
        const res = await invoiceV2Service.bulkUpload(files);
        const s = res.data.summary || {};
        Alert.alert(
          'İşlem tamamlandı',
          `${s.verified || 0} doğrulandı · ${s.mismatch || 0} uyuşmazlık · ${s.errors || 0} hata`
        );
      }
      await loadOcr();
    } catch (err) {
      Alert.alert(
        'Yüklenemedi',
        err.response?.data?.error || err.message || 'Bir hata oluştu.'
      );
    } finally {
      setUploading(false);
    }
  };

  // Arama yereldir: satış tarafında fatura no/müşteri, OCR tarafında satıcı/no.
  const data = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    const list = tab === 'sales' ? sales : ocr;
    if (!q) return list;
    return list.filter((i) =>
      (tab === 'sales'
        ? [i.invoiceNumber, i.customer?.name, i.customer?.company]
        : [i.vendorName, i.invoiceNumber, i.originalFileName]
      )
        .filter(Boolean)
        .some((f) => String(f).toLocaleLowerCase('tr').includes(q))
    );
  }, [tab, sales, ocr, search]);

  const loading = tab === 'sales' ? salesLoading : ocrLoading;
  const error = tab === 'sales' ? salesError : ocrError;

  const header = (
    <View>
      <Text style={styles.title}>Faturalar</Text>
      <Text style={styles.subtitle}>Akıllı fatura işleme ve KDV ayrıştırma.</Text>

      <View style={styles.tabs}>
        {[
          { key: 'sales', label: 'Satış Faturaları' },
          { key: 'ocr', label: 'Gelen Faturalar' },
        ].map((tb) => {
          const active = tab === tb.key;
          return (
            <TouchableOpacity
              key={tb.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(tb.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tb.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'ocr' && (
        <>
          {!!ocrStats && (
            <View style={styles.statGrid}>
              <StatTile
                icon="document-text-outline"
                tint="#6366F1"
                label="İşlenen Fatura"
                value={String(ocrStats.counts?.total || 0)}
              />
              <StatTile
                icon="checkmark-circle-outline"
                tint={colors.success}
                label="Doğrulanan"
                value={String(ocrStats.counts?.verified || 0)}
                caption={`%${ocrStats.accuracy || 0} doğruluk`}
              />
              <StatTile
                icon="warning-outline"
                tint={colors.warm}
                label="Uyuşmazlık"
                value={String(ocrStats.counts?.mismatch || 0)}
                caption={`${ocrStats.counts?.pending || 0} beklemede`}
              />
              <StatTile
                icon="bar-chart-outline"
                tint="#0EA5E9"
                label="Toplam KDV"
                value={formatTRY(ocrStats.financials?.totalVat)}
                caption={`%${ocrStats.avgConfidence || 0} ort. güven`}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.uploadBox, uploading && styles.uploadBusy]}
            onPress={() => setPickerOpen(true)}
            disabled={uploading}
            activeOpacity={0.8}
          >
            {uploading ? (
              <>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.uploadHint}>İşleniyor... (OCR biraz sürebilir)</Text>
              </>
            ) : (
              <>
                <View style={styles.uploadIcon}>
                  <Ionicons name="camera-outline" size={26} color={colors.primary} />
                </View>
                <Text style={styles.uploadTitle}>Fatura çek veya telefondan seç</Text>
                <Text style={styles.uploadHint}>
                  JPEG, PNG, WebP veya PDF — tek seferde en fazla {OCR_MAX_FILES} dosya
                </Text>
              </>
            )}
          </TouchableOpacity>
        </>
      )}

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={tab === 'sales' ? 'Fatura no veya müşteri ara...' : 'Satıcı veya fatura no ara...'}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        )}
      </View>

      <ChipRow
        options={tab === 'sales' ? SALES_STATUS_FILTERS : OCR_STATUS_FILTERS}
        value={tab === 'sales' ? salesStatus : ocrStatus}
        onChange={tab === 'sales' ? setSalesStatus : setOcrStatus}
      />
    </View>
  );

  if (!allowed) {
    return (
      <View style={styles.centered}>
        <Ionicons name="lock-closed-outline" size={28} color={colors.textFaint} />
        <Text style={styles.deniedText}>
          Faturalar yalnızca süper admin ve muhasebe rollerine açık.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={loading || error ? [] : data}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) =>
          tab === 'sales' ? (
            <SalesRow
              item={item}
              onPress={() => navigation.navigate('SalesInvoiceDetail', { invoice: item })}
              onMarkPaid={() => handleMarkPaid(item)}
            />
          ) : (
            <OcrRow
              item={item}
              onPress={() => navigation.navigate('OcrInvoiceDetail', { invoice: item })}
            />
          )
        }
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: space.xl }} />
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.retry}
                onPress={tab === 'sales' ? loadSales : loadOcr}
              >
                <Text style={styles.retryText}>Tekrar dene</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.empty}>
              {tab === 'sales'
                ? 'Satış faturası yok. Onaylanmış bir teklifi faturaya dönüştürebilirsin.'
                : 'Henüz işlenmiş fatura yok. Yukarıdan bir fatura yükleyerek başla.'}
            </Text>
          )
        }
      />

      {/* Kaynak seçimi — kamera / galeri / dosyalar */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Fatura ekle</Text>

            {[
              { key: 'camera', icon: 'camera-outline', label: 'Fotoğraf Çek', hint: 'Faturayı kamerayla çek' },
              { key: 'gallery', icon: 'images-outline', label: 'Galeriden Seç', hint: 'Birden fazla görsel seçebilirsin' },
              { key: 'files', icon: 'document-outline', label: 'Dosyalardan Seç', hint: 'PDF ve görsel dosyaları' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={styles.sheetRow}
                onPress={() => handlePick(opt.key)}
                activeOpacity={0.7}
              >
                <View style={styles.sheetIcon}>
                  <Ionicons name={opt.icon} size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetLabel}>{opt.label}</Text>
                  <Text style={styles.sheetHint}>{opt.hint}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, backgroundColor: colors.bg, padding: space.xl },
  deniedText: { fontSize: font.md, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  list: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },

  title: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: font.md, color: colors.textMuted, marginTop: 2 },

  tabs: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, marginBottom: space.md },
  tab: {
    flex: 1, height: 42, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: font.sm, fontWeight: '700', color: colors.textMuted },
  tabTextActive: { color: '#fff' },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  tile: {
    flexGrow: 1, flexBasis: '46%', flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md,
    borderWidth: 1, borderColor: colors.border,
  },
  tileIcon: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 10, fontWeight: '700', color: colors.textFaint, letterSpacing: 0.3 },
  tileValue: { fontSize: font.lg, fontWeight: '800', color: colors.text, marginTop: 1 },
  tileCaption: { fontSize: 10, color: colors.textFaint },

  uploadBox: {
    alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.borderStrong, borderStyle: 'dashed',
    paddingVertical: space.xl, marginBottom: space.md,
  },
  uploadBusy: { borderStyle: 'solid', borderColor: colors.primary },
  uploadIcon: {
    width: 52, height: 52, borderRadius: radius.full, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  uploadTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  uploadHint: { fontSize: font.xs, color: colors.textMuted, textAlign: 'center', paddingHorizontal: space.lg },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: space.md, height: 48, marginBottom: space.md,
  },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },

  chipRow: { gap: space.sm, paddingBottom: space.sm, paddingRight: space.lg },
  filterChip: {
    paddingHorizontal: space.md, height: 34, justifyContent: 'center',
    borderRadius: radius.full, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  filterChipText: { fontSize: font.sm, fontWeight: '600', color: colors.textMuted },
  filterChipTextActive: { color: colors.primary },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#1B2130', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  icon: {
    width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  number: { fontSize: font.md, fontWeight: '800', color: colors.text },
  sub: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  amount: { fontSize: font.md, fontWeight: '800', color: colors.primary },
  chip: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: radius.full },
  chipText: { fontSize: 10, fontWeight: '800' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.sm },
  meta: { fontSize: font.xs, color: colors.textFaint },

  paidBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.success, borderRadius: radius.sm, height: 36, marginTop: space.md,
  },
  paidText: { color: '#fff', fontSize: font.xs, fontWeight: '700' },

  backdrop: { flex: 1, backgroundColor: 'rgba(20,24,35,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: space.lg, paddingBottom: space.xxl,
  },
  grabber: { width: 40, height: 4, borderRadius: radius.full, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: space.md },
  sheetTitle: { fontSize: font.lg, fontWeight: '800', color: colors.text, marginBottom: space.sm },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14 },
  sheetIcon: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetLabel: { fontSize: font.md, fontWeight: '700', color: colors.text },
  sheetHint: { fontSize: font.xs, color: colors.textMuted, marginTop: 1 },

  empty: { textAlign: 'center', color: colors.textMuted, marginTop: space.xl, lineHeight: 21, paddingHorizontal: space.md },
  errorBox: { alignItems: 'center', marginTop: space.xl, gap: space.md },
  errorText: { color: colors.danger, textAlign: 'center', lineHeight: 21 },
  retry: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md },
  retryText: { color: '#fff', fontWeight: '700' },
});
