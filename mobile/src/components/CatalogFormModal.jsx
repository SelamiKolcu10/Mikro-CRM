import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SelectField from './SelectField';
import { CURRENCY_OPTIONS, UNIT_OPTIONS, DEFAULT_TAX_RATE } from '../config/catalog';
import { colors, radius, space, font } from '../theme';

// Yeni Ürün / Ürün Düzenle modalı — web'deki CatalogForm.jsx'in mobil karşılığı.
// `product` doluysa düzenleme, boşsa oluşturma modunda çalışır. Kaydetme ve
// arşivleme işini parent yapar (onSave / onArchive), modal sadece formu tutar.
const emptyForm = () => ({
  name: '',
  description: '',
  unitPrice: '',
  currency: 'TRY',
  taxRate: String(DEFAULT_TAX_RATE),
  unit: 'piece',
  sku: '',
  category: '',
});

export default function CatalogFormModal({ visible, product, onSave, onArchive, onClose }) {
  const isEdit = !!product;
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // Modal her açıldığında formu tazele: düzenlemede ürünün değerleri, yeni
  // kayıtta boş form (önceki düzenlemenin artığı kalmasın).
  useEffect(() => {
    if (!visible) return;
    setForm(
      product
        ? {
            name: product.name || '',
            description: product.description || '',
            unitPrice: product.unitPrice != null ? String(product.unitPrice) : '',
            currency: product.currency || 'TRY',
            taxRate: String(product.taxRate ?? DEFAULT_TAX_RATE),
            unit: product.unit || 'piece',
            sku: product.sku || '',
            category: product.category || '',
          }
        : emptyForm()
    );
  }, [visible, product]);

  const setField = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      Alert.alert('Eksik bilgi', 'Ürün adı zorunludur.');
      return;
    }
    // Virgüllü girişi de kabul et (₺1.200,50 yazma alışkanlığı).
    const price = Number(String(form.unitPrice).replace(',', '.'));
    if (form.unitPrice === '' || Number.isNaN(price) || price < 0) {
      Alert.alert('Eksik bilgi', 'Geçerli bir birim fiyat girin.');
      return;
    }
    const taxRate = Number(String(form.taxRate).replace(',', '.'));
    if (Number.isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      Alert.alert('Geçersiz değer', 'KDV oranı 0-100 arasında olmalıdır.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name,
        description: form.description.trim(),
        unitPrice: price,
        currency: form.currency,
        taxRate,
        unit: form.unit,
        sku: form.sku.trim(),
        category: form.category.trim(),
      });
    } catch (err) {
      Alert.alert('Kaydedilemedi', err.response?.data?.error || 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  // Arşivleme geri alınabilir ama yine de veri kaybı gibi hissettiren bir
  // işlem — her zaman onay sor.
  const handleArchive = () => {
    Alert.alert(
      'Ürünü arşivle',
      `"${product.name}" katalogdan kaldırılacak. Mevcut teklifler etkilenmez ve ürün "Arşivlenen Ürünler" bölümünde kalır.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Arşivle', style: 'destructive', onPress: () => onArchive(product._id) },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{isEdit ? 'Ürün Düzenle' : 'Yeni Ürün'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.field}>
              <Text style={styles.label}>Ürün Adı *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={setField('name')}
                placeholder="Örn. Kurumsal E-posta Lisansı"
                placeholderTextColor={colors.textFaint}
                maxLength={150}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Açıklama</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={form.description}
                onChangeText={setField('description')}
                placeholder="Kısa açıklama"
                placeholderTextColor={colors.textFaint}
                maxLength={1000}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Birim Fiyat *</Text>
              <TextInput
                style={styles.input}
                value={form.unitPrice}
                onChangeText={setField('unitPrice')}
                placeholder="0"
                placeholderTextColor={colors.textFaint}
                keyboardType="decimal-pad"
              />
            </View>

            <SelectField
              label="Para Birimi"
              value={form.currency}
              options={CURRENCY_OPTIONS}
              onSelect={setField('currency')}
            />

            <View style={styles.field}>
              <Text style={styles.label}>KDV Oranı (%)</Text>
              <TextInput
                style={styles.input}
                value={form.taxRate}
                onChangeText={setField('taxRate')}
                placeholder={String(DEFAULT_TAX_RATE)}
                placeholderTextColor={colors.textFaint}
                keyboardType="decimal-pad"
              />
            </View>

            <SelectField
              label="Birim"
              value={form.unit}
              options={UNIT_OPTIONS}
              onSelect={setField('unit')}
            />

            <View style={styles.field}>
              <Text style={styles.label}>Stok Kodu</Text>
              <TextInput
                style={styles.input}
                value={form.sku}
                onChangeText={setField('sku')}
                placeholder="Opsiyonel"
                placeholderTextColor={colors.textFaint}
                maxLength={50}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Kategori</Text>
              <TextInput
                style={styles.input}
                value={form.category}
                onChangeText={setField('category')}
                placeholder="Örn. Lisans"
                placeholderTextColor={colors.textFaint}
                maxLength={100}
              />
            </View>

            {isEdit && (
              <TouchableOpacity style={styles.archiveBtn} onPress={handleArchive} activeOpacity={0.7}>
                <Ionicons name="archive-outline" size={17} color={colors.danger} />
                <Text style={styles.archiveText}>Ürünü Arşivle</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveText}>{isEdit ? 'Kaydet' : 'Oluştur'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,24,35,0.45)',
    justifyContent: 'center',
    padding: space.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    maxHeight: '86%',
    overflow: 'hidden',
    shadowColor: '#1B2130',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: font.lg, fontWeight: '800', color: colors.text },

  body: { flexGrow: 0 },
  bodyContent: { padding: space.lg, paddingBottom: space.sm },

  field: { marginBottom: space.lg },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: space.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: 48,
    fontSize: font.md,
    color: colors.text,
  },
  textarea: { height: 92, paddingTop: space.md },

  archiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    height: 46,
    marginBottom: space.sm,
  },
  archiveText: { color: colors.danger, fontSize: font.sm, fontWeight: '700' },

  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelBtn: {
    paddingHorizontal: space.lg,
    height: 44,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: { fontSize: font.md, fontWeight: '600', color: colors.textMuted },
  saveBtn: {
    minWidth: 104,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
});
