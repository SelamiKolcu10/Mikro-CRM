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
import SelectField from './SelectField';
import { CREATABLE_ROLE_OPTIONS } from '../config/users';
import { colors, radius, space, font } from '../theme';

/**
 * Yeni Kullanıcı Ekle — backend createUser'ın istediği üç alan: ad, e-posta,
 * rol. Parola alanı YOK; sunucu sabit bir başlangıç parolası atıyor, o yüzden
 * formda da sorulmuyor. super_admin rolü listede yok (CREATABLE_ROLES).
 */
export default function NewUserModal({ visible, onSubmit, onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName('');
    setEmail('');
    setRole('staff');
    setError('');
  }, [visible]);

  const submit = async () => {
    if (name.trim().length < 2) {
      setError('İsim en az 2 karakter olmalıdır.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Geçerli bir e-posta girin.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), email: email.trim(), role });
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
            <Text style={styles.title}>Yeni Kullanıcı Ekle</Text>
            <TouchableOpacity onPress={onClose} disabled={saving} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <View style={styles.field}>
              <Text style={styles.label}>Ad Soyad</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color={colors.textFaint} />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={(v) => { setName(v); setError(''); }}
                  placeholder="Örn: Ahmet Yılmaz"
                  placeholderTextColor={colors.textFaint}
                  editable={!saving}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>E-posta</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={colors.textFaint} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(''); }}
                  placeholder="ornek@sirket.com"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!saving}
                />
              </View>
            </View>

            <SelectField
              label="Rol"
              value={role}
              options={CREATABLE_ROLE_OPTIONS}
              onSelect={setRole}
              placeholder="Rol Seçiniz"
            />

            <View style={styles.note}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.noteText}>
                Yeni kullanıcı, yönetici tarafından belirlenen başlangıç parolasıyla
                oluşturulur ve doğrudan onaylı olarak eklenir.
              </Text>
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveDisabled]}
              onPress={submit}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.saveText}>Oluştur</Text>
                </>
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

  note: {
    flexDirection: 'row', gap: space.sm, alignItems: 'flex-start',
    backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: space.md,
    marginTop: space.sm,
  },
  noteText: { flex: 1, fontSize: font.xs, color: colors.text, lineHeight: 18 },

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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    minWidth: 116, height: 44, borderRadius: radius.md, backgroundColor: colors.primary,
  },
  saveDisabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
});
