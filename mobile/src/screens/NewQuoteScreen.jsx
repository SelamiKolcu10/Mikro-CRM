import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import customerService from '../services/customerService';
import quoteService from '../services/quoteService';
import CatalogPickerModal from '../components/CatalogPickerModal';
import { CATALOG_CURRENCIES, DEFAULT_TAX_RATE } from '../config/catalog';
import { computeLine, computeTotals } from '../utils/quoteTotals';
import { formatMoney } from '../utils/format';
import { colors, radius, space, font } from '../theme';

const CURRENCIES = CATALOG_CURRENCIES;

// Sayısal alanlar TextInput'ta string tutulur, kaydederken Number'a çevrilir.
// `productId` doluysa satır bir katalog ürününe bağlıdır: backend adı/açıklamayı
// üründen snapshot'lar, ama validator yine de name+unitPrice bekliyor.
const emptyItem = () => ({
  name: '',
  quantity: '1',
  unitPrice: '',
  discountRate: '0',
  taxRate: String(DEFAULT_TAX_RATE),
  productId: null,
});

// Lightweight dropdown — a tappable field that opens a modal list. Avoids a
// native picker dependency (keeps Expo Go happy).
function SelectField({ label, value, placeholder, options, onSelect }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.selectBox} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={[styles.selectText, !selected && styles.selectPlaceholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(o) => String(o.value)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => {
                    onSelect(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, item.value === value && styles.optionTextActive]}>
                    {item.label}
                  </Text>
                  {item.value === value && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.optionEmpty}>Seçenek yok.</Text>}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function NumField({ label, value, onChangeText, flex = 1 }) {
  return (
    <View style={{ flex }}>
      <Text style={styles.smallLabel}>{label}</Text>
      <TextInput
        style={styles.numInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.textFaint}
      />
    </View>
  );
}

export default function NewQuoteScreen({ navigation }) {
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [validUntil, setValidUntil] = useState(''); // GG.AA.YYYY (optional)
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([emptyItem()]);

  useEffect(() => {
    (async () => {
      try {
        const res = await customerService.getAll({ limit: 100, sort: 'name' });
        setCustomers(res.data.data);
      } catch {
        Alert.alert('Hata', 'Müşteriler yüklenemedi.');
      } finally {
        setLoadingCustomers(false);
      }
    })();
  }, []);

  const setItem = useCallback((idx, patch) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }, []);
  const addItem = useCallback(() => setItems((prev) => [...prev, emptyItem()]), []);
  const removeItem = useCallback((idx) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }, []);

  // Katalogdan gelen satır — web'deki addFromCatalog ile aynı davranış: ürünün
  // fiyat/KDV'si ön doldurulur ama düzenlenebilir kalır (teklife özel indirim
  // ya da fiyat verilebilsin). Boş duran ilk satır varsa onu doldurur, yoksa
  // yeni satır ekler; aksi halde form hep boş bir satırla açıldığı için
  // katalogdan ekleyen kullanıcı arada boş kalem bırakıyordu.
  const addFromCatalog = useCallback((product) => {
    const line = {
      name: product.name,
      quantity: '1',
      unitPrice: String(product.unitPrice ?? ''),
      discountRate: '0',
      taxRate: String(product.taxRate ?? DEFAULT_TAX_RATE),
      productId: product._id,
    };
    setItems((prev) => {
      const blankIdx = prev.findIndex((it) => !it.name.trim() && !it.productId);
      if (blankIdx === -1) return [...prev, line];
      return prev.map((it, i) => (i === blankIdx ? line : it));
    });
  }, []);

  const totals = computeTotals(items);

  const parseDate = (s) => {
    // GG.AA.YYYY → ISO; empty/invalid → null
    const m = s.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (!m) return null;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const handleSave = async () => {
    if (!customerId) {
      Alert.alert('Eksik bilgi', 'Lütfen bir müşteri seçin.');
      return;
    }
    const cleanItems = items
      .filter((it) => it.name.trim() && Number(it.quantity) > 0)
      .map((it) => ({
        name: it.name.trim(),
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice) || 0,
        discountRate: Number(it.discountRate) || 0,
        taxRate: Number(it.taxRate) || 0,
        // Yalnız katalog satırlarında gönderilir; backend ürünü bulup adı ve
        // açıklamayı snapshot'lar. Serbest satırda alan hiç bulunmamalı —
        // validator boş stringi geçersiz ObjectId sayıyor.
        ...(it.productId ? { productId: it.productId } : {}),
      }));
    if (cleanItems.length === 0) {
      Alert.alert('Eksik bilgi', 'En az bir geçerli kalem ekleyin (ad ve miktar).');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customerId,
        currency,
        notes: notes.trim(),
        items: cleanItems,
      };
      const iso = parseDate(validUntil);
      if (iso) payload.validUntil = iso;

      const res = await quoteService.create(payload);
      const created = res.data.data;
      // Replace so "back" returns to the Quotes list, not the empty form.
      navigation.replace('QuoteDetail', { id: created._id });
    } catch (err) {
      Alert.alert('Kaydedilemedi', err.response?.data?.error || 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingCustomers) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SelectField
          label="Müşteri *"
          value={customerId}
          placeholder="Müşteri seçin"
          options={customers.map((c) => ({ value: c._id, label: c.company ? `${c.name} · ${c.company}` : c.name }))}
          onSelect={setCustomerId}
        />

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: space.sm }}>
            <SelectField
              label="Para Birimi"
              value={currency}
              placeholder="TRY"
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              onSelect={setCurrency}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Geçerlilik</Text>
            <TextInput
              style={styles.input}
              value={validUntil}
              onChangeText={setValidUntil}
              placeholder="GG.AA.YYYY"
              placeholderTextColor={colors.textFaint}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        {/* Line items */}
        <View style={styles.itemsHeader}>
          <Text style={styles.sectionTitle}>KALEMLER</Text>
          <View style={styles.itemsActions}>
            <TouchableOpacity style={styles.smallBtnGhost} onPress={() => setPickerOpen(true)}>
              <Ionicons name="cube-outline" size={14} color={colors.primary} />
              <Text style={styles.smallBtnGhostText}>Katalogdan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallBtn} onPress={addItem}>
              <Ionicons name="add" size={14} color="#fff" />
              <Text style={styles.smallBtnText}>Serbest Satır</Text>
            </TouchableOpacity>
          </View>
        </View>

        {items.map((it, idx) => {
          const line = computeLine(it);
          return (
            <View key={idx} style={styles.itemCard}>
              {!!it.productId && (
                <View style={styles.catalogTag}>
                  <Ionicons name="cube" size={11} color={colors.primary} />
                  <Text style={styles.catalogTagText}>Katalog ürünü</Text>
                </View>
              )}
              <View style={styles.itemTop}>
                <TextInput
                  style={styles.itemName}
                  value={it.name}
                  onChangeText={(v) => setItem(idx, { name: v })}
                  placeholder="Ürün / hizmet adı"
                  placeholderTextColor={colors.textFaint}
                />
                {items.length > 1 && (
                  <TouchableOpacity onPress={() => removeItem(idx)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.itemNums}>
                <NumField label="Miktar" value={it.quantity} onChangeText={(v) => setItem(idx, { quantity: v })} />
                <NumField label="Birim Fiyat" value={it.unitPrice} onChangeText={(v) => setItem(idx, { unitPrice: v })} flex={1.3} />
              </View>
              <View style={styles.itemNums}>
                <NumField label="İndirim %" value={it.discountRate} onChangeText={(v) => setItem(idx, { discountRate: v })} />
                <NumField label="KDV %" value={it.taxRate} onChangeText={(v) => setItem(idx, { taxRate: v })} />
                <View style={{ flex: 1.3, justifyContent: 'flex-end' }}>
                  <Text style={styles.smallLabel}>Toplam</Text>
                  <Text style={styles.lineTotal}>{formatMoney(line.total, currency)}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {/* Totals */}
        <View style={styles.totalsCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Ara Toplam</Text>
            <Text style={styles.totalValue}>{formatMoney(totals.subtotal, currency)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>KDV Toplam</Text>
            <Text style={styles.totalValue}>{formatMoney(totals.totalTax, currency)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandRow]}>
            <Text style={styles.grandLabel}>Genel Toplam</Text>
            <Text style={styles.grandValue}>{formatMoney(totals.grandTotal, currency)}</Text>
          </View>
        </View>

        <Text style={styles.label}>Notlar / Şartlar</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Teklife eklenecek notlar..."
          placeholderTextColor={colors.textFaint}
          multiline
        />

        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()} disabled={saving}>
            <Text style={styles.cancelText}>İptal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Taslak Kaydet</Text>}
          </TouchableOpacity>
        </View>

        <View style={{ height: space.xl }} />
      </ScrollView>

      <CatalogPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={addFromCatalog}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },

  field: { marginBottom: space.lg },
  row: { flexDirection: 'row' },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: space.sm },
  input: {
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: space.md, height: 48, fontSize: font.md, color: colors.text,
  },
  selectBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: space.md, height: 48,
  },
  selectText: { flex: 1, fontSize: font.md, color: colors.text },
  selectPlaceholder: { color: colors.textFaint },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.lg, maxHeight: '70%' },
  modalTitle: { fontSize: font.lg, fontWeight: '800', color: colors.text, marginBottom: space.md },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  optionText: { fontSize: font.md, color: colors.text },
  optionTextActive: { color: colors.primary, fontWeight: '700' },
  optionEmpty: { color: colors.textMuted, textAlign: 'center', paddingVertical: space.lg },

  sectionTitle: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  itemsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  itemsActions: { flexDirection: 'row', gap: space.sm },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm },
  smallBtnText: { color: '#fff', fontSize: font.xs, fontWeight: '700' },
  smallBtnGhost: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm },
  smallBtnGhostText: { color: colors.primary, fontSize: font.xs, fontWeight: '700' },

  itemCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, marginBottom: space.md },
  catalogTag: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, marginBottom: space.sm },
  catalogTagText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  itemName: { flex: 1, fontSize: font.md, fontWeight: '600', color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 4 },
  itemNums: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  smallLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted, marginBottom: 3 },
  numInput: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: space.sm, height: 40, fontSize: font.sm, color: colors.text },
  lineTotal: { fontSize: font.md, fontWeight: '800', color: colors.text, height: 40, lineHeight: 40 },

  totalsCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, marginTop: space.sm, marginBottom: space.lg },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.xs },
  totalLabel: { fontSize: font.sm, color: colors.textMuted },
  totalValue: { fontSize: font.sm, color: colors.text, fontWeight: '600' },
  grandRow: { marginTop: space.sm, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  grandLabel: { fontSize: font.md, fontWeight: '800', color: colors.text },
  grandValue: { fontSize: font.lg, fontWeight: '800', color: colors.primary },

  notesInput: {
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    padding: space.md, minHeight: 90, fontSize: font.md, color: colors.text, textAlignVertical: 'top',
  },

  actions: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  cancelBtn: { flex: 1, height: 50, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  cancelText: { fontSize: font.md, fontWeight: '700', color: colors.textMuted },
  saveBtn: { flex: 1.6, height: 50, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: font.md, fontWeight: '700', color: '#fff' },
});
