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
import { TYPE_OPTIONS, STATUS_OPTIONS, PLAN_LABEL } from '../config/feedbacks';
import { colors, radius, space, font } from '../theme';

// Geri Bildirim Ekle / Düzenle modalı — web Feedbacks.jsx'teki modalın mobil
// karşılığı. Alan seti moda göre değişir (web ile aynı kural):
//   • Ekle    → Başlık, Açıklama, Tür, Müşteri
//   • Düzenle → Başlık, Açıklama, Tür, Durum (müşteri değiştirilemez)
// Öncelik ve gelir etkisi formda yok: backend müşterinin MRR'ından otomatik
// hesaplıyor (feedbackController.executeCreateFeedback).
const emptyForm = () => ({ title: '', description: '', type: 'bug', customer: '', status: 'open' });

export default function FeedbackFormModal({
  visible,
  feedback,
  customers = [],
  // Kart üzerindeki hızlı ekle kısayolu, aynı müşteri için yeni bildirim
  // açarken müşteriyi önceden seçili getirir.
  initialCustomerId = '',
  onSave,
  onClose,
}) {
  const isEdit = !!feedback;
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setForm(
      feedback
        ? {
            title: feedback.title || '',
            description: feedback.description || '',
            type: feedback.type || 'bug',
            customer: feedback.customer?._id || '',
            status: feedback.status || 'open',
          }
        : { ...emptyForm(), customer: initialCustomerId }
    );
  }, [visible, feedback, initialCustomerId]);

  const setField = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  // "Ada — PLAN ($120/ay)" — web'deki müşteri seçici ile aynı bilgi yoğunluğu,
  // öncelik MRR'dan hesaplandığı için tutar seçim anında görünür olmalı.
  const customerOptions = customers.map((c) => ({
    value: c._id,
    label: `${c.name} — ${(PLAN_LABEL[c.plan] || c.plan || '').toUpperCase()} ($${c.mrr || 0}/ay)`,
  }));

  const handleSave = async () => {
    const title = form.title.trim();
    if (!title) {
      Alert.alert('Eksik bilgi', 'Başlık zorunludur.');
      return;
    }
    if (!isEdit && !form.customer) {
      Alert.alert('Eksik bilgi', 'Lütfen bir müşteri seçin — öncelik ve gelir etkisi buna göre hesaplanır.');
      return;
    }

    setSaving(true);
    try {
      await onSave(
        isEdit
          ? {
              title,
              description: form.description.trim(),
              type: form.type,
              status: form.status,
            }
          : {
              title,
              description: form.description.trim(),
              type: form.type,
              customer: form.customer,
            }
      );
    } catch (err) {
      Alert.alert('Kaydedilemedi', err.response?.data?.error || 'Bir hata oluştu.');
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
            <Text style={styles.title}>
              {isEdit ? 'Geri Bildirim Düzenle' : 'Geri Bildirim Ekle'}
            </Text>
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
              <Text style={styles.label}>Başlık *</Text>
              <TextInput
                style={styles.input}
                value={form.title}
                onChangeText={setField('title')}
                placeholder="Geri bildirim başlığını girin"
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
                placeholder="Detaylı bir açıklama yazın"
                placeholderTextColor={colors.textFaint}
                maxLength={2000}
                multiline
                textAlignVertical="top"
              />
            </View>

            <SelectField
              label="Tür *"
              value={form.type}
              options={TYPE_OPTIONS}
              onSelect={setField('type')}
            />

            {isEdit ? (
              <SelectField
                label="Durum"
                value={form.status}
                options={STATUS_OPTIONS}
                onSelect={setField('status')}
              />
            ) : (
              <>
                <SelectField
                  label="Müşteri *"
                  value={form.customer}
                  placeholder="Müşteri seçin"
                  options={customerOptions}
                  onSelect={setField('customer')}
                />
                <Text style={styles.hint}>
                  Öncelik ve gelir etkisi, seçilen müşterinin MRR'ına göre otomatik hesaplanır.
                </Text>
              </>
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
                <Text style={styles.saveText}>{isEdit ? 'Güncelle' : 'Oluştur'}</Text>
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
  textarea: { height: 100, paddingTop: space.md },
  hint: { fontSize: font.xs, color: colors.textMuted, marginTop: -space.sm, marginBottom: space.sm, lineHeight: 17 },

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
