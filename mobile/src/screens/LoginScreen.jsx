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
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import useKeyboardOpen from '../utils/useKeyboardOpen';
import { colors, radius, space, font } from '../theme';

export default function LoginScreen() {
  const { login } = useAuth();
  // Ortalama yalnız klavye kapalıyken — açıkken form zıplamasın.
  const keyboardOpen = useKeyboardOpen();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null); // 'email' | 'password' | null
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Eksik bilgi', 'E-posta ve şifre gerekli.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      // Session set → RootNavigator swaps to the app. No manual navigation.
    } catch (err) {
      Alert.alert('Giriş başarısız', err.response?.data?.error || 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Placeholder for elements the current backend doesn't support yet
  // (OAuth, password reset, self sign-up). Kept in the UI for the intended
  // design; wired to a friendly notice until the backend gains these.
  const notYet = () =>
    Alert.alert('Yakında', 'Bu özellik henüz aktif değil.');

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={keyboardOpen ? styles.scroll : styles.scrollCentered}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={styles.logoBox}>
          <Ionicons name="grid" size={26} color="#fff" />
        </View>
        <Text style={styles.brand}>Micro CRM</Text>
        <Text style={styles.subtitle}>
          Tekrar hoş geldiniz. Panele erişmek için bilgilerinizi girin.
        </Text>

        {/* Email */}
        <Text style={styles.label}>E-posta</Text>
        <View style={[styles.inputWrap, focused === 'email' && styles.inputWrapFocused]}>
          <Ionicons name="mail-outline" size={18} color={colors.textFaint} style={styles.leftIcon} />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="ornek@sirket.com"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onFocus={() => setFocused('email')}
            onBlur={() => setFocused(null)}
          />
        </View>

        {/* Password */}
        <Text style={styles.label}>Şifre</Text>
        <View style={[styles.inputWrap, focused === 'password' && styles.inputWrapFocused]}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textFaint} style={styles.leftIcon} />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textFaint}
            secureTextEntry={!showPassword}
            onFocus={() => setFocused('password')}
            onBlur={() => setFocused(null)}
          />
          <TouchableOpacity onPress={() => setShowPassword((s) => !s)} hitSlop={10}>
            <Ionicons
              name={showPassword ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.forgot} onPress={notYet} hitSlop={6}>
          <Text style={styles.forgotText}>Şifremi unuttum?</Text>
        </TouchableOpacity>

        {/* Sign in */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.88}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.buttonText}>Giriş Yap</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>veya şununla devam et</Text>
          <View style={styles.line} />
        </View>

        {/* Social */}
        <View style={styles.social}>
          <TouchableOpacity style={styles.socialBtn} onPress={notYet} activeOpacity={0.8}>
            <FontAwesome name="google" size={16} color="#DB4437" />
            <Text style={styles.socialText}>Google</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialBtn} onPress={notYet} activeOpacity={0.8}>
            <FontAwesome name="facebook" size={16} color="#1877F2" />
            <Text style={styles.socialText}>Facebook</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Hesabınız yok mu? </Text>
          <TouchableOpacity onPress={notYet} hitSlop={6}>
            <Text style={styles.footerLink}>Kayıt olun</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  // DİKKAT: iki ayrı, SABİT stil nesnesi — `[a, b && c]` gibi satır içi dizi
  // KULLANMA. Dizi her render'da yeni kimlik alır, ScrollView içeriğini
  // yeniden kurar ve odaktaki TextInput'un odağı düşer; onFocus→setFocused
  // zaten render tetiklediği için bu focus↔blur döngüsüne dönüşüyor (imleç
  // anında kayboluyordu). Ölçüldü: sabit referansla döngü yok.
  scroll: {
    flexGrow: 1,
    paddingHorizontal: space.xl,
    paddingVertical: space.xxl,
  },
  // Klavye KAPALIYKEN kullanılır — dikey ortalama. Klavye açıkken yukarıdaki
  // ortalamasız sürüme geçilir, yoksa kap kısaldıkça içerik yeniden ortalanıp
  // form zıplar (bkz. utils/useKeyboardOpen.js).
  scrollCentered: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.xxl,
  },
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
  // bu focus↔blur döngüsüne dönüşüp imleci anında kaybettiriyordu (ölçüldü:
  // 750 ms içinde FOCUS→BLUR→FOCUS→BLUR, sonra klavye kapanıyor).
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
  forgot: { alignSelf: 'flex-end', marginTop: -space.sm, marginBottom: space.lg },
  forgotText: { fontSize: font.sm, fontWeight: '600', color: colors.primary },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 54,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: '#fff', fontSize: font.lg, fontWeight: '700' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: space.xl,
    gap: space.md,
  },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: font.xs, color: colors.textMuted },
  social: { flexDirection: 'row', gap: space.md },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: 50,
  },
  socialText: { fontSize: font.md, fontWeight: '600', color: colors.text },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: space.xxl,
  },
  footerText: { fontSize: font.md, color: colors.textMuted },
  footerLink: { fontSize: font.md, fontWeight: '700', color: colors.primary },
});
