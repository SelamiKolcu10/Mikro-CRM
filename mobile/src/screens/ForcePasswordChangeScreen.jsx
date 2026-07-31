import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import useKeyboardOpen from '../utils/useKeyboardOpen';
import { colors, radius, space, font } from '../theme';

// Backend ile BİREBİR aynı kural (bkz. backend/validators/authValidators.js
// changePasswordValidators). Burada tekrar etmemizin tek sebebi kullanıcıya
// sunucuya gitmeden anında geri bildirim vermek — asıl doğrulama backend'de.
const RULES = [
  { key: 'len', label: 'En az 8 karakter', test: (v) => v.length >= 8 },
  { key: 'alpha', label: 'En az bir harf', test: (v) => /[a-zA-Z]/.test(v) },
  { key: 'digit', label: 'En az bir rakam', test: (v) => /[0-9]/.test(v) },
];

/**
 * Zorunlu ilk-giriş parola değiştirme kapısı — web'deki PasswordGate'in mobil
 * karşılığı. Yönetici bir hesap oluşturduğunda tek kullanımlık rastgele bir
 * parola veriliyor ve `mustChangePassword` işaretleniyor; bu ekran temizlenene
 * kadar RootNavigator uygulamanın geri kalanını hiç mount etmiyor.
 *
 * Neden mount etmiyoruz: bu bayrak açıkken `protect` arkasındaki her istek 403
 * döner, yani sekmeler açılsa bile her ekran boş/hatalı görünürdü.
 *
 * PATCH /api/auth/change-password bilerek `protect` değil `identify` arkasında
 * duruyor — tam da bu yüzden erişilebilir kalıyor.
 */
export default function ForcePasswordChangeScreen() {
  const { changePassword, logout, session } = useAuth();
  // Ortalama yalnız klavye kapalıyken — açıkken form zıplamasın.
  const keyboardOpen = useKeyboardOpen();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState({});
  const [focused, setFocused] = useState(null);
  const [saving, setSaving] = useState(false);

  const toggle = (field) => setVisible((v) => ({ ...v, [field]: !v[field] }));

  const passed = RULES.filter((r) => r.test(next));
  const rulesOk = passed.length === RULES.length;
  const matches = next.length > 0 && next === confirm;
  const canSubmit = current.length > 0 && rulesOk && matches && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await changePassword(current, next);
      // Bayrak temizlendi → RootNavigator uygulamayı mount eder. Manuel
      // gezinme yok (LoginScreen ile aynı desen).
    } catch (err) {
      Alert.alert('Değiştirilemedi', err.response?.data?.error || 'Parola değiştirilemedi.');
    } finally {
      setSaving(false);
    }
  };

  // Parolasını değiştiremeyen biri (ör. geçici parolayı yanlış not almış)
  // uygulamada mahsur kalmamalı — bu ekrandaki tek çıkış yolu.
  const confirmLogout = () => {
    Alert.alert('Çıkış yap', 'Oturumunuz kapatılacak.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: logout },
    ]);
  };

  const field = (key, label, value, onChange, placeholder, icon) => (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, focused === key && styles.inputWrapFocused]}>
        <Ionicons name={icon} size={18} color={colors.textFaint} style={styles.leftIcon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          secureTextEntry={!visible[key]}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setFocused(key)}
          onBlur={() => setFocused(null)}
        />
        <TouchableOpacity onPress={() => toggle(key)} hitSlop={10}>
          <Ionicons
            name={visible[key] ? 'eye-outline' : 'eye-off-outline'}
            size={18}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, !keyboardOpen && styles.scrollCentered]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoBox}>
          <Ionicons name="lock-closed" size={26} color="#fff" />
        </View>
        <Text style={styles.brand}>Parolanızı Belirleyin</Text>
        <Text style={styles.subtitle}>
          {session?.name ? `${session.name}, geçici` : 'Geçici'} bir parolayla giriş yaptınız.
          Devam etmek için kendi parolanızı oluşturun.
        </Text>

        {field('current', 'Geçici parola', current, setCurrent, '••••••••', 'lock-closed-outline')}
        {field('next', 'Yeni parola', next, setNext, '••••••••', 'key-outline')}

        {/* Kurallar yalnız yazmaya başlayınca görünür — boş formu kırmızı
            uyarılarla karşılamak gereksiz gürültü. */}
        {next.length > 0 && (
          <View style={styles.rules}>
            {RULES.map((r) => {
              const ok = r.test(next);
              return (
                <View key={r.key} style={styles.ruleRow}>
                  <Ionicons
                    name={ok ? 'checkmark-circle' : 'ellipse-outline'}
                    size={15}
                    color={ok ? colors.success : colors.textFaint}
                  />
                  <Text style={[styles.ruleText, ok && styles.ruleTextOk]}>{r.label}</Text>
                </View>
              );
            })}
          </View>
        )}

        {field('confirm', 'Yeni parola (tekrar)', confirm, setConfirm, '••••••••', 'key-outline')}

        {confirm.length > 0 && !matches && (
          <Text style={styles.mismatch}>Parolalar eşleşmiyor.</Text>
        )}

        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.88}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.buttonText}>Kaydet ve Devam</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logout} onPress={confirmLogout} hitSlop={6}>
          <Text style={styles.logoutText}>Çıkış yap</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: space.xl,
    paddingVertical: space.xxl,
  },
  // Dikey ortalama BİLEREK ayrı — bkz. LoginScreen'deki aynı not ve
  // utils/useKeyboardOpen.js.
  scrollCentered: { justifyContent: 'center' },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: space.lg,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  brand: {
    fontSize: font.xxl,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: font.md,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: space.sm,
    marginBottom: space.xxl,
    paddingHorizontal: space.sm,
  },
  label: {
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: space.sm,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: 52,
    marginBottom: space.lg,
  },
  // DİKKAT: buraya gölge/elevation EKLEME. Odaklanınca TextInput'u saran
  // View'a gölge eklemek Android'de native katmanı yeniden kurduruyor ve
  // input'un odağı düşüyor; onFocus→setFocused zaten render tetiklediği için
  // bu focus↔blur döngüsüne dönüşüp imleci anında kaybettiriyordu.
  // RN 0.76+'da `shadow*` propları artık Android'de de işleniyor, yani
  // "iOS'a özel, zararsız" değiller. Odak göstergesi kenarlık rengi.
  inputWrapFocused: {
    borderColor: colors.primary,
    backgroundColor: '#fff',
  },
  leftIcon: { marginRight: space.sm },
  input: {
    flex: 1,
    fontSize: font.md,
    color: colors.text,
    height: '100%',
  },
  rules: {
    marginTop: -space.sm,
    marginBottom: space.lg,
    gap: space.xs,
  },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ruleText: { fontSize: font.sm, color: colors.textMuted },
  ruleTextOk: { color: colors.success },
  mismatch: {
    fontSize: font.sm,
    color: colors.danger,
    marginTop: -space.sm,
    marginBottom: space.lg,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 54,
    marginTop: space.sm,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.5, shadowOpacity: 0, elevation: 0 },
  buttonText: { color: '#fff', fontSize: font.lg, fontWeight: '700' },
  logout: { alignSelf: 'center', marginTop: space.xl },
  logoutText: { fontSize: font.md, fontWeight: '600', color: colors.textMuted },
});
