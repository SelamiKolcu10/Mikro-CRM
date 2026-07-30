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

// Backend'deki match kurallarının aynısı — boş bırakılabilir, doluysa ilgili
// alan adının adresi olmalı.
const LINKEDIN_RE = /^$|^https?:\/\/(www\.)?linkedin\.com\/.*$/;
const GITHUB_RE = /^$|^https?:\/\/(www\.)?github\.com\/.*$/;

/**
 * Kişisel Bilgiler — yalnız iletişim alanları.
 *
 * Ad, e-posta, rol ve departman burada YOK: backend
 * updateMyContactInfo sadece phone/linkedin/github kabul ediyor, kimlik ve
 * yetki alanları yönetici tarafında değişiyor (Kullanıcı Yönetimi ekranı).
 */
export default function EditContactModal({ visible, personalInfo, onSubmit, onClose }) {
  const [phone, setPhone] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [github, setGithub] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setPhone(personalInfo?.phone || '');
    setLinkedin(personalInfo?.linkedin || '');
    setGithub(personalInfo?.github || '');
    setError('');
  }, [visible, personalInfo]);

  const submit = async () => {
    if (!LINKEDIN_RE.test(linkedin.trim())) {
      setError('LinkedIn adresi linkedin.com ile başlamalı.');
      return;
    }
    if (!GITHUB_RE.test(github.trim())) {
      setError('GitHub adresi github.com ile başlamalı.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ phone: phone.trim(), linkedin: linkedin.trim(), github: github.trim() });
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
            <Text style={styles.title}>Kişisel Bilgiler</Text>
            <TouchableOpacity onPress={onClose} disabled={saving} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <View style={styles.field}>
              <Text style={styles.label}>Telefon</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="call-outline" size={18} color={colors.textFaint} />
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={(v) => { setPhone(v); setError(''); }}
                  placeholder="05xx xxx xx xx"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="phone-pad"
                  editable={!saving}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>LinkedIn</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="logo-linkedin" size={18} color={colors.textFaint} />
                <TextInput
                  style={styles.input}
                  value={linkedin}
                  onChangeText={(v) => { setLinkedin(v); setError(''); }}
                  placeholder="https://linkedin.com/in/..."
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="none"
                  editable={!saving}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>GitHub</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="logo-github" size={18} color={colors.textFaint} />
                <TextInput
                  style={styles.input}
                  value={github}
                  onChangeText={(v) => { setGithub(v); setError(''); }}
                  placeholder="https://github.com/..."
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="none"
                  editable={!saving}
                />
              </View>
            </View>

            <Text style={styles.help}>
              Ad, e-posta, rol ve departman bu ekrandan değiştirilemez — onları
              yönetici günceller.
            </Text>

            {!!error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

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

  field: { marginBottom: space.lg },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: space.sm },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: space.md, height: 48, backgroundColor: colors.surface,
  },
  input: { flex: 1, fontSize: font.md, color: colors.text },
  help: { fontSize: font.xs, color: colors.textMuted, lineHeight: 18 },
  error: { fontSize: font.sm, color: colors.danger, marginTop: space.md },

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
  disabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
});
