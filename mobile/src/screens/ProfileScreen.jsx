import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import userService from '../services/userService';
import authService from '../services/authService';
import EditContactModal from '../components/EditContactModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import ProgressRing from '../components/ProgressRing';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS, formatMonths } from '../config/users';
import { initialsOf } from '../config/projects';
import { DEPARTMENT_LABEL } from '../config/departments';
import { FILES_URL } from '../config/apiUrls';
import { colors, radius, space, font } from '../theme';

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, title, subtitle, onPress, danger }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>{title}</Text>
        {!!subtitle && <Text style={styles.rowSub} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {!!onPress && <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />}
    </TouchableOpacity>
  );
}

/**
 * Profilim — oturum sahibinin kendi kaydı.
 *
 * Veri /users/me/profile'dan gelir ve "developer tree"yi taşır: şirketteki
 * süre + katkı verilen her proje için ne zamandır içinde olduğu, kaç görevi
 * bitirdiği ve projenin toplam bitmiş görev sayısı (bkz.
 * backend/utils/developerTree.js). Bunlar okuma anında hesaplanır.
 */
export default function ProfileScreen() {
  const { session, logout } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const [showContact, setShowContact] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await userService.getMyProfile();
      setProfile(res.data.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Profil alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('İzin gerekli', 'Fotoğraf seçebilmek için galeri erişimine izin verin.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const form = new FormData();
      form.append('avatar', {
        uri: asset.uri,
        name: asset.fileName || 'avatar.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
      const res = await userService.uploadAvatar(form);
      setProfile((p) => ({
        ...p,
        personalInfo: { ...(p?.personalInfo || {}), avatarUrl: res.data.data.avatarUrl },
      }));
    } catch (err) {
      // Sunucu 2 MB sınırı ve tür kontrolü uyguluyor — mesajı olduğu gibi göster.
      Alert.alert('Yüklenemedi', err.response?.data?.error || 'Fotoğraf yüklenemedi.');
    } finally {
      setUploading(false);
    }
  };

  const saveContact = async (payload) => {
    try {
      await userService.updateMyProfile(payload);
      setShowContact(false);
      load();
    } catch (err) {
      Alert.alert('Kaydedilemedi', err.response?.data?.error || 'Bilgiler güncellenemedi.');
    }
  };

  const changePassword = async (current, next) => {
    try {
      await authService.changePassword(current, next);
      setShowPassword(false);
      Alert.alert('Şifre değişti', 'Yeni şifrenizle giriş yapabilirsiniz.');
    } catch (err) {
      Alert.alert('Değiştirilemedi', err.response?.data?.error || 'Şifre değiştirilemedi.');
    }
  };

  const confirmLogout = () => {
    Alert.alert('Çıkış yap', 'Oturumunuz kapatılacak.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: logout },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const info = profile?.personalInfo || {};
  const projects = profile?.projects || [];
  const activeTotal = projects.reduce((s, p) => s + (p.active?.length || 0), 0);
  const doneTotal = projects.reduce((s, p) => s + (p.done?.length || 0), 0);
  const avatarUri = info.avatarUrl ? `${FILES_URL}${info.avatarUrl}` : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {!!error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Kimlik */}
      <View style={styles.card}>
        <View style={styles.identity}>
          <TouchableOpacity onPress={pickAvatar} disabled={uploading} activeOpacity={0.8}>
            <View style={styles.avatar}>
              {uploading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{initialsOf(profile?.name)}</Text>
              )}
            </View>
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{profile?.name}</Text>
            <Text style={styles.role} numberOfLines={1}>
              {ROLE_LABELS[profile?.role] || profile?.role}
              {profile?.department ? ` · ${DEPARTMENT_LABEL[profile.department] || profile.department}` : ''}
            </Text>
            {!!profile?.isDepartmentLead && (
              <View style={styles.leadChip}>
                <Text style={styles.leadChipText}>Departman Lideri</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.statRow}>
          <Stat value={String(projects.length)} label="Proje" />
          <View style={styles.statDivider} />
          <Stat value={String(activeTotal)} label="Aktif Görev" />
          <View style={styles.statDivider} />
          <Stat value={String(doneTotal)} label="Tamamlanan" />
        </View>
      </View>

      <View style={styles.tileRow}>
        <View style={styles.tile}>
          <View style={styles.tileIcon}>
            <Ionicons name="business-outline" size={16} color={colors.primary} />
          </View>
          <Text style={styles.tileLabel}>ŞİRKETTE</Text>
          <Text style={styles.tileValue}>{formatMonths(profile?.tenureMonths)}</Text>
        </View>
        <View style={styles.tile}>
          <View style={styles.tileIcon}>
            <Ionicons name="folder-open-outline" size={16} color={colors.primary} />
          </View>
          <Text style={styles.tileLabel}>KATKI VERİLEN PROJE</Text>
          <Text style={styles.tileValue}>{projects.length} proje</Text>
        </View>
      </View>

      {/* Katkı sağlanan projeler */}
      <Text style={styles.sectionLabel}>KATKI SAĞLANAN PROJELER</Text>
      {projects.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.empty}>Henüz bir projeye dahil değilsiniz.</Text>
        </View>
      ) : (
        projects.map((p) => {
          const open = expanded === String(p.projectId);
          // Kişisel katkı oranı: projede biten görevlerin kaçı bu kişiye ait.
          const share = p.totalDone > 0 ? Math.round((p.userDone / p.totalDone) * 100) : 0;
          return (
            <TouchableOpacity
              key={String(p.projectId)}
              style={styles.card}
              onPress={() => setExpanded(open ? null : String(p.projectId))}
              activeOpacity={0.85}
            >
              <View style={styles.projectTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.projectName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.projectSince}>
                    {p.sinceDays} gündür katkı sağlıyor{p.isLead ? ' · Lider' : ''}
                  </Text>
                </View>
                <ProgressRing progress={share} size={40} stroke={3} />
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textFaint} />
              </View>

              {open && (
                <View style={styles.projectDetail}>
                  <Text style={styles.projectNote}>
                    Projede tamamlanan {p.totalDone} görevin {p.userDone} tanesi bu kişiye ait.
                  </Text>
                  <View style={styles.countRow}>
                    <View style={styles.countBox}>
                      <Text style={styles.countLabel}>AKTİF GÖREVLER</Text>
                      <Text style={styles.countValue}>{p.active?.length || 0}</Text>
                    </View>
                    <View style={styles.countBox}>
                      <Text style={styles.countLabel}>TAMAMLANAN GÖREVLER</Text>
                      <Text style={styles.countValue}>{p.done?.length || 0}</Text>
                    </View>
                  </View>
                  {(p.active || []).map((t) => (
                    <Text key={t._id} style={styles.taskLine} numberOfLines={1}>• {t.title}</Text>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })
      )}

      {/* Hesap */}
      <Text style={styles.sectionLabel}>HESAP</Text>
      <View style={styles.card}>
        <InfoRow icon="person-outline" title="Ad Soyad" subtitle={profile?.name} />
        <View style={styles.divider} />
        <InfoRow icon="mail-outline" title="E-posta" subtitle={profile?.email} />
        <View style={styles.divider} />
        <InfoRow
          icon="call-outline"
          title="İletişim Bilgileri"
          subtitle={info.phone || 'Telefon, LinkedIn, GitHub'}
          onPress={() => setShowContact(true)}
        />
      </View>

      {/* Güvenlik */}
      <Text style={styles.sectionLabel}>GÜVENLİK</Text>
      <View style={styles.card}>
        <InfoRow
          icon="lock-closed-outline"
          title="Şifre Değiştir"
          subtitle="En az 8 karakter, harf ve rakam"
          onPress={() => setShowPassword(true)}
        />
        <View style={styles.divider} />
        <InfoRow icon="log-out-outline" title="Çıkış Yap" onPress={confirmLogout} danger />
      </View>

      <EditContactModal
        visible={showContact}
        personalInfo={info}
        onSubmit={saveContact}
        onClose={() => setShowContact(false)}
      />
      <ChangePasswordModal
        visible={showPassword}
        onSubmit={changePassword}
        onClose={() => setShowPassword(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.dangerSoft, borderRadius: radius.md,
    padding: space.md, marginBottom: space.md,
  },
  errorText: { flex: 1, fontSize: font.sm, color: colors.danger },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: space.md, marginBottom: space.md,
  },

  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 66, height: 66, borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: font.xl, fontWeight: '800', color: colors.primary },
  avatarBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 22, height: 22, borderRadius: radius.full,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.surface,
  },
  name: { fontSize: font.lg, fontWeight: '800', color: colors.text },
  role: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  leadChip: {
    alignSelf: 'flex-start', marginTop: space.sm,
    backgroundColor: colors.primarySoft, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  leadChipText: { fontSize: 10, fontWeight: '800', color: colors.primary },

  statRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: space.lg, paddingTop: space.md,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },
  statValue: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },

  tileRow: { flexDirection: 'row', gap: space.md, marginBottom: space.md },
  tile: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: space.md,
  },
  tileIcon: {
    width: 30, height: 30, borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: space.sm,
  },
  tileLabel: { fontSize: 10, fontWeight: '800', color: colors.textFaint, letterSpacing: 0.4 },
  tileValue: { fontSize: font.md, fontWeight: '800', color: colors.text, marginTop: 3 },

  sectionLabel: {
    fontSize: font.xs, fontWeight: '800', color: colors.textFaint,
    letterSpacing: 0.6, marginTop: space.sm, marginBottom: space.sm,
  },
  empty: { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: space.md },

  projectTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  projectName: { fontSize: font.md, fontWeight: '700', color: colors.text },
  projectSince: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  projectDetail: { marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  projectNote: { fontSize: font.sm, color: colors.textMuted, lineHeight: 19 },
  countRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  countBox: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, padding: space.sm },
  countLabel: { fontSize: 9, fontWeight: '800', color: colors.textFaint, letterSpacing: 0.3 },
  countValue: { fontSize: font.lg, fontWeight: '800', color: colors.text, marginTop: 2 },
  taskLine: { fontSize: font.xs, color: colors.textMuted, marginTop: space.sm },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  rowIcon: {
    width: 34, height: 34, borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  rowIconDanger: { backgroundColor: colors.dangerSoft },
  rowTitle: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  rowTitleDanger: { color: colors.danger },
  rowSub: { fontSize: font.xs, color: colors.textMuted, marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
});
