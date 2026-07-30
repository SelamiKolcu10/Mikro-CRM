import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';

// Backend eInvoiceController.validateRecipient aynası — sunucuya boşuna gidip
// 422 yemek yerine aynı kuralı burada da uyguluyoruz.
// VKN 10 hane (kurumsal, vergi dairesi zorunlu), TCKN 11 hane (şahıs).
const validate = ({ taxNumber, taxOffice, address }) => {
  const missing = [];
  const tax = (taxNumber || '').replace(/\s/g, '');
  if (!/^\d{10,11}$/.test(tax)) missing.push('VKN/TCKN (10-11 hane)');
  if (tax.length === 10 && !taxOffice) missing.push('Vergi Dairesi');
  if (!address) missing.push('Adres');
  return missing;
};

/**
 * Resmî e-Fatura alıcı bilgileri formu — web'deki SalesInvoiceDrawer'ın
 * `einvoice-form` bölümünün mobil karşılığı.
 *
 * Alanlar müşteri kaydından ön-doldurulur; kesim başarılı olursa backend bu
 * bilgileri müşteriye yazar, yani ikinci kesimde hazır gelirler.
 */
export default function EInvoiceModal({ visible, invoice, busy, onSubmit, onClose }) {
  const [form, setForm] = useState({
    taxNumber: '', taxOffice: '', address: '', city: '', district: '',
  });
  const [error, setError] = useState('');

  // Her açılışta müşteri + önceki kesim anlık görüntüsünden doldur.
  useEffect(() => {
    if (!visible) return;
    const c = invoice?.customer || {};
    const snap = invoice?.eInvoice?.recipientSnapshot || {};
    setForm({
      taxNumber: c.taxNumber || snap.taxNumber || '',
      taxOffice: c.taxOffice || snap.taxOffice || '',
      address: c.address || snap.address || '',
      city: c.city || snap.city || '',
      district: c.district || snap.district || '',
    });
    setError('');
  }, [visible, invoice]);

  const setField = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  };

  const submit = () => {
    const missing = validate(form);
    if (missing.length) {
      setError(`Alıcı bilgileri eksik: ${missing.join(', ')}`);
      return;
    }
    onSubmit(form);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Resmî Fatura Kes</Text>
            <TouchableOpacity onPress={onClose} disabled={busy} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <Text style={styles.hint}>
              {invoice?.invoiceNumber} faturası GİB'e gönderilecek. Alıcı vergi
              bilgileri resmî fatura için zorunludur.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>VKN / TCKN *</Text>
              <TextInput
                style={styles.input}
                value={form.taxNumber}
                onChangeText={setField('taxNumber')}
                keyboardType="number-pad"
                maxLength={11}
                placeholder="10 hane (VKN) veya 11 hane (TCKN)"
                placeholderTextColor={colors.textFaint}
                editable={!busy}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Vergi Dairesi</Text>
              <TextInput
                style={styles.input}
                value={form.taxOffice}
                onChangeText={setField('taxOffice')}
                placeholder="VKN girildiyse zorunlu"
                placeholderTextColor={colors.textFaint}
                editable={!busy}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Adres *</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={form.address}
                onChangeText={setField('address')}
                multiline
                textAlignVertical="top"
                editable={!busy}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.field, styles.half]}>
                <Text style={styles.label}>İl</Text>
                <TextInput
                  style={styles.input}
                  value={form.city}
                  onChangeText={setField('city')}
                  editable={!busy}
                />
              </View>
              <View style={[styles.field, styles.half]}>
                <Text style={styles.label}>İlçe</Text>
                <TextInput
                  style={styles.input}
                  value={form.district}
                  onChangeText={setField('district')}
                  editable={!busy}
                />
              </View>
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={busy}>
              <Text style={styles.cancelText}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, busy && styles.saveDisabled]}
              onPress={submit}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveText}>Kes ve Gönder</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,24,35,0.45)', justifyContent: 'center', padding: space.lg },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl, maxHeight: '88%', overflow: 'hidden',
    shadowColor: '#1B2130', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { flex: 1, fontSize: font.lg, fontWeight: '800', color: colors.text },

  body: { flexGrow: 0 },
  bodyContent: { padding: space.lg, paddingBottom: space.sm },
  hint: { fontSize: font.sm, color: colors.textMuted, lineHeight: 20, marginBottom: space.lg },

  field: { marginBottom: space.lg },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: space.sm },
  input: {
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: space.md, height: 48,
    fontSize: font.md, color: colors.text,
  },
  textarea: { height: 76, paddingTop: space.md },
  row: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },

  error: { fontSize: font.sm, color: colors.danger, marginBottom: space.md, lineHeight: 19 },

  footer: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm,
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  cancelBtn: {
    paddingHorizontal: space.lg, height: 44, justifyContent: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  cancelText: { fontSize: font.md, fontWeight: '600', color: colors.textMuted },
  saveBtn: {
    minWidth: 130, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, backgroundColor: colors.primary,
  },
  saveDisabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
});
