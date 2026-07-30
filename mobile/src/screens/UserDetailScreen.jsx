import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import userService from '../services/userService';
import SelectField from '../components/SelectField';
import { useAuth } from '../context/AuthContext';
import {
  canManageUsers,
  userStatusMeta,
  ROLE_LABELS,
  ROLE_OPTIONS,
  DEPARTMENT_SELECT_OPTIONS,
  formatTenure,
} from '../config/users';
import { initialsOf } from '../config/projects';
import { colors, radius, space, font } from '../theme';

function StatRow({ icon, label, value }) {
  return (
    <View style={styles.statRow}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

/**
 * Kullanıcı Profili — görüntüleme + yönetim kontrolleri.
 *
 * Rol ve departman ayrı uçlarla güncelleniyor (PATCH /:id/role ve
 * /:id/department), ikisi de yalnız super_admin'e açık; intern bu ekranı
 * görebilir ama kontroller gizlenir. Kendi hesabını silme/rol değiştirme
 * kazası olmasın diye oturum sahibinde aksiyonlar kapatılıyor.
 */
export default function UserDetailScreen({ route, navigation }) {
  const { session } = useAuth();
  const isAdmin = canManageUsers(session);

  const [user, setUser] = useState(route.params.user);
  const [busy, setBusy] = useState('');

  const isSelf = String(session?._id) === String(user._id);
  const canEdit = isAdmin && !isSelf;

  useEffect(() => {
    navigation.setOptions({ title: 'Kullanıcı Profili' });
  }, [navigation]);

  const st = userStatusMeta(user.status);

  const changeRole = async (role) => {
    if (role === user.role) return;
    setBusy('role');
    try {
      const res = await userService.updateRole(user._id, role);
      setUser(res.data.data);
    } catch (err) {
      Alert.alert('Güncellenemedi', err.response?.data?.error || 'Rol değiştirilemedi.');
    } finally {
      setBusy('');
    }
  };

  const changeDepartment = async (department) => {
    if ((department || null) === (user.department || null)) return;
    setBusy('dept');
    try {
      const res = await userService.updateDepartment(user._id, department || null);
      setUser(res.data.data);
    } catch (err) {
      Alert.alert('Güncellenemedi', err.response?.data?.error || 'Departman değiştirilemedi.');
    } finally {
      setBusy('');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Kullanıcıyı sil',
      `${user.name} kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            setBusy('delete');
            try {
              await userService.remove(user._id);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Silinemedi', err.response?.data?.error || 'Kullanıcı silinemedi.');
            } finally {
              setBusy('');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsOf(user.name)}</Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.role}>
          {ROLE_LABELS[user.role] || user.role}
          {user.isDepartmentLead ? ' · Departman Lideri' : ''}
        </Text>
        <View style={styles.emailRow}>
          <Ionicons name="mail-outline" size={14} color={colors.primary} />
          <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: `${st.color}1A` }]}>
          <View style={[styles.statusDot, { backgroundColor: st.color }]} />
          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>YÖNETİM KONTROLLERİ</Text>
      <View style={styles.card}>
        {canEdit ? (
          <>
            <SelectField
              label="Departman"
              value={user.department || ''}
              options={DEPARTMENT_SELECT_OPTIONS}
              onSelect={changeDepartment}
              placeholder="Departman yok"
            />
            {busy === 'dept' && <ActivityIndicator size="small" color={colors.primary} />}

            <SelectField
              label="Rol"
              value={user.role}
              options={ROLE_OPTIONS}
              onSelect={changeRole}
              placeholder="Rol seçiniz"
            />
            {busy === 'role' && <ActivityIndicator size="small" color={colors.primary} />}
          </>
        ) : (
          <Text style={styles.readOnly}>
            {isSelf
              ? 'Kendi rolünüzü ve departmanınızı bu ekrandan değiştiremezsiniz.'
              : 'Bu kullanıcıyı düzenleme yetkiniz yok.'}
          </Text>
        )}

        <StatRow icon="time-outline" label="Şirkette Süre" value={formatTenure(user.createdAt)} />
        <StatRow
          icon="folder-open-outline"
          label="Katkı Verilen Proje"
          value={String((user.projectHistory || []).length)}
        />

        {canEdit && (
          <TouchableOpacity
            style={[styles.deleteBtn, busy === 'delete' && styles.disabled]}
            onPress={handleDelete}
            disabled={!!busy}
            activeOpacity={0.85}
          >
            {busy === 'delete' ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={styles.deleteText}>Kullanıcıyı Sil</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },

  profileCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', padding: space.lg,
  },
  avatar: {
    width: 84, height: 84, borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: font.xxl, fontWeight: '800', color: colors.primary },
  name: { fontSize: font.xl, fontWeight: '800', color: colors.text, marginTop: space.md },
  role: { fontSize: font.sm, color: colors.primary, fontWeight: '600', marginTop: 2 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: space.sm },
  email: { fontSize: font.xs, color: colors.textMuted },

  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.full, marginTop: space.md,
  },
  statusDot: { width: 7, height: 7, borderRadius: radius.full },
  statusText: { fontSize: 11, fontWeight: '800' },

  sectionLabel: {
    fontSize: font.xs, fontWeight: '800', color: colors.textFaint,
    letterSpacing: 0.6, marginTop: space.xl, marginBottom: space.sm,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: space.md,
  },
  readOnly: { fontSize: font.sm, color: colors.textMuted, lineHeight: 20, marginBottom: space.md },

  statRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.bg, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.md, marginTop: space.sm,
  },
  statIcon: {
    width: 28, height: 28, borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  statLabel: { flex: 1, fontSize: font.sm, fontWeight: '600', color: colors.text },
  statValue: { fontSize: font.md, fontWeight: '800', color: colors.text },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    height: 46, borderRadius: radius.md, marginTop: space.lg,
    backgroundColor: colors.dangerSoft,
  },
  deleteText: { fontSize: font.sm, fontWeight: '700', color: colors.danger },
  disabled: { opacity: 0.6 },
});
