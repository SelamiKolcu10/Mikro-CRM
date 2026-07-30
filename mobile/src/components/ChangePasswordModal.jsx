import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';

// backend/validators/authValidators.js ile aynı kural.
const isValid = (p) => p.length >= 8 && /[a-zA-Z]/.test(p) && /[0-9]/.test(p);

export default function ChangePasswordModal({ visible, onSubmit, onClose }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setCurrent('');
    setNext('');
    setRepeat('');
    setShow(false);
    setError('');
  }, [visible]);

  const submit = async () => {
    if (!current) {
      setError('Mevcut şifrenizi girin.');
      return;
    }
    if (!isValid(next)) {
      setError('Yeni şifre en az 8 karakter olmalı, en az bir harf ve bir rakam içermeli.');
      return;
    }
    if (next !== repeat) {
      setError('Yeni şifreler eşleşmiyor.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(current, next);
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
            <Text style={styles.title}>Şifre Değiştir</Text>
            <TouchableOpacity onPress={onClose} disabled={saving} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textFaint} />
              <TextInput
                style={styles.input}
                value={current}
                onChangeText={(v) => { setCurrent(v); setError(''); }}
                placeholder="Mevcut şifre"
                placeholderTextColor={colors.textFaint}
                secureTextEntry={!show}
                autoCapitalize="none"
                editable={!saving}
              />
            </View>

            <View style={styles.inputWrap}>
              <Ionicons name="key-outline" size={18} color={colors.textFaint} />
              <TextInput
                style={styles.input}
                value={next}
                onChangeText={(v) => { setNext(v); setError(''); }}
                placeholder="Yeni şifre"
                placeholderTextColor={colors.textFaint}
                secureTextEntry={!show}
                autoCapitalize="none"
                editable={!saving}
              />
            </View>

            <View style={styles.inputWrap}>
              <Ionicons name="key-outline" size={18} color={colors.textFaint} />
              <TextInput
                style={styles.input}
                value={repeat}
                onChangeText={(v) => { setRepeat(v); setError(''); }}
                placeholder="Yeni şifre (tekrar)"
                placeholderTextColor={colors.textFaint}
                secureTextEntry={!show}
                autoCapitalize="none"
                editable={!saving}
              />
              <TouchableOpacity onPress={() => setShow((s) => !s)} hitSlop={8}>
                <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.rule}>En az 8 karakter, en az bir harf ve bir rakam.</Text>
            {!!error && <Text style={styles.error}>{error}</Text>}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelText}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.disabled]}
              onPress={submit}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveText}>Değiştir</Text>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { flex: 1, fontSize: font.lg, fontWeight: '800', color: colors.text },

  body: { padding: space.lg, gap: space.md },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: space.md, height: 48,
  },
  input: { flex: 1, fontSize: font.md, color: colors.text },
  rule: { fontSize: font.xs, color: colors.textMuted },
  error: { fontSize: font.sm, color: colors.danger, lineHeight: 19 },

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
    minWidth: 110, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, backgroundColor: colors.primary,
  },
  disabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
});
