import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { toLocalISODate } from '../utils/dayBucket';
import { colors, radius, space, font } from '../theme';

const isoToDisplay = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

// GG.AA.YYYY → 'YYYY-MM-DD'; geçersizse null. Gerçek bir takvim günü mü diye
// de kontrol eder (31.02.2026 gibi girdiler elenir).
const displayToIso = (s) => {
  const m = s.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (
    d.getFullYear() !== Number(yyyy) ||
    d.getMonth() !== Number(mm) - 1 ||
    d.getDate() !== Number(dd)
  ) {
    return null;
  }
  return toLocalISODate(d);
};

/**
 * Görevin tarihini değiştirme sayfası. Web'de bu iş sürükle-bırakla yapılıyor;
 * dokunmatikte sürükleme kaydırma jestiyle çakıştığı için mobilde göreve
 * dokunup buradan taşıyoruz. Takvimde seçili gün tek dokunuşluk kısayol
 * olarak sunulur, farklı bir gün için elle tarih girilebilir.
 */
export default function TaskDateModal({ visible, task, selectedDayISO, onSave, onClose }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setValue(task?.deadline ? isoToDisplay(toLocalISODate(new Date(task.deadline))) : '');
  }, [visible, task]);

  if (!task) return null;

  const run = async (dayISO) => {
    setSaving(true);
    try {
      await onSave(task._id, dayISO);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!value.trim()) {
      Alert.alert('Eksik bilgi', 'Bir tarih girin ya da "Tarihi Kaldır" seçin.');
      return;
    }
    const iso = displayToIso(value);
    if (!iso) {
      Alert.alert('Geçersiz tarih', 'Tarihi GG.AA.YYYY biçiminde girin (örn. 30.07.2026).');
      return;
    }
    run(iso);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>{task.title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {!!selectedDayISO && (
              <TouchableOpacity
                style={styles.quickBtn}
                onPress={() => run(selectedDayISO)}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Ionicons name="calendar-outline" size={17} color="#fff" />
                <Text style={styles.quickText}>
                  Seçili güne taşı ({isoToDisplay(selectedDayISO)})
                </Text>
              </TouchableOpacity>
            )}

            <Text style={styles.label}>Başka bir tarih</Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              placeholder="GG.AA.YYYY"
              placeholderTextColor={colors.textFaint}
              keyboardType="numbers-and-punctuation"
            />

            {!!task.deadline && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => run(null)}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                <Text style={styles.clearText}>Tarihi Kaldır</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveText}>Kaydet</Text>
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
    backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden',
    shadowColor: '#1B2130', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space.sm,
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { flex: 1, fontSize: font.md, fontWeight: '800', color: colors.text, lineHeight: 21 },

  body: { padding: space.lg, gap: space.md },
  quickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.primary, borderRadius: radius.md, height: 46,
  },
  quickText: { color: '#fff', fontSize: font.sm, fontWeight: '700' },

  label: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  input: {
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: space.md, height: 48,
    fontSize: font.md, color: colors.text,
  },
  clearBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40 },
  clearText: { color: colors.danger, fontSize: font.sm, fontWeight: '700' },

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
    minWidth: 104, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, backgroundColor: colors.primary,
  },
  saveDisabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
});
