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
import { colors, radius, space, font } from '../theme';

const CURRENCY_OPTIONS = ['TRY', 'USD', 'EUR'].map((c) => ({ value: c, label: c }));

// budgetRange → önerilen başlangıç tutarı (yalnız ön-doldurma; gerçek tutarı
// kullanıcı girer). Web ConvertLeadModal.jsx ile aynı eşikler.
const BUDGET_SUGGESTION = {
  '<50k': 25000,
  '50k-150k': 100000,
  '150k-500k': 325000,
  '500k+': 500000,
};

// GG.AA.YYYY → ISO; boş/geçersiz → null (NewQuoteScreen ile aynı ayrıştırma).
const parseDate = (s) => {
  const m = s.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/**
 * Lead → Fırsat dönüştürme modalı. Backend tek aksiyonla Customer'ı (yoksa)
 * oluşturup Deal açıyor; bu modal yalnız tutar/başlık/tarihi topluyor —
 * müşteri seçimi yok, lead'den türetiliyor.
 */
export default function ConvertLeadModal({ visible, lead, onConvert, onClose }) {
  const [form, setForm] = useState({ title: '', value: '', currency: 'TRY', expectedCloseDate: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !lead) return;
    setForm({
      title: `${lead.company || lead.name} — Fırsat`,
      value: BUDGET_SUGGESTION[lead.budgetRange] != null ? String(BUDGET_SUGGESTION[lead.budgetRange]) : '',
      currency: 'TRY',
      expectedCloseDate: '',
    });
  }, [visible, lead]);

  const setField = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const handleConvert = async () => {
    const value = Number(String(form.value).replace(',', '.'));
    if (form.value === '' || Number.isNaN(value) || value < 0) {
      Alert.alert('Eksik bilgi', 'Geçerli bir fırsat tutarı girin.');
      return;
    }

    setSaving(true);
    try {
      const payload = { value, currency: form.currency };
      if (form.title.trim()) payload.title = form.title.trim();
      const iso = parseDate(form.expectedCloseDate);
      if (iso) payload.expectedCloseDate = iso;
      await onConvert(payload);
    } catch (err) {
      Alert.alert('Dönüştürülemedi', err.response?.data?.error || 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Fırsata Dönüştür</Text>
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
            <Text style={styles.hint}>
              Talep bir fırsata dönüşecek; müşteri kaydı yoksa otomatik oluşturulur.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Fırsat Başlığı</Text>
              <TextInput
                style={styles.input}
                value={form.title}
                onChangeText={setField('title')}
                placeholder="Fırsat başlığı"
                placeholderTextColor={colors.textFaint}
                maxLength={150}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Tutar *</Text>
              <TextInput
                style={styles.input}
                value={form.value}
                onChangeText={setField('value')}
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
              <Text style={styles.label}>Tahmini Kapanış</Text>
              <TextInput
                style={styles.input}
                value={form.expectedCloseDate}
                onChangeText={setField('expectedCloseDate')}
                placeholder="GG.AA.YYYY (opsiyonel)"
                placeholderTextColor={colors.textFaint}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleConvert}
              activeOpacity={0.85}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveText}>Dönüştür</Text>
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
  title: { flex: 1, fontSize: font.lg, fontWeight: '800', color: colors.text },

  body: { flexGrow: 0 },
  bodyContent: { padding: space.lg, paddingBottom: space.sm },
  hint: { fontSize: font.sm, color: colors.textMuted, marginBottom: space.lg, lineHeight: 19 },

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
    minWidth: 116,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
});
