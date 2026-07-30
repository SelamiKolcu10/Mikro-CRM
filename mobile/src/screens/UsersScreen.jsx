import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import userService from '../services/userService';
import NewUserModal from '../components/NewUserModal';
import { useAuth } from '../context/AuthContext';
import { canManageUsers, userStatusMeta, ROLE_LABELS, formatTenure } from '../config/users';
import { DEPARTMENT_LABEL, DEPARTMENTS } from '../config/departments';
import { initialsOf } from '../config/projects';
import { shareCsv } from '../utils/exportCsv';
import { colors, radius, space, font, chartColors } from '../theme';

const FILTERS = [
  { value: '', label: 'Tümü' },
  ...DEPARTMENTS.map((d) => ({ value: d, label: DEPARTMENT_LABEL[d] })),
];

function UserCard({ user, index, onPress }) {
  const st = userStatusMeta(user.status);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: chartColors[index % chartColors.length] }]}>
          <Text style={styles.avatarText}>{initialsOf(user.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{user.name}</Text>
          <Text style={styles.role} numberOfLines={1}>
            {ROLE_LABELS[user.role] || user.role}
            {user.isDepartmentLead ? ' · Departman Lideri' : ''}
          </Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        {!!user.department && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{DEPARTMENT_LABEL[user.department] || user.department}</Text>
          </View>
        )}
        {!!(user.projectHistory || []).length && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{user.projectHistory.length} proje</Text>
          </View>
        )}
      </View>

      <View style={styles.cardFoot}>
        <View style={styles.tenureRow}>
          <Ionicons name="time-outline" size={13} color={colors.textMuted} />
          <Text style={styles.tenure}>{formatTenure(user.createdAt)}</Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: st.color }]} />
      </View>
    </TouchableOpacity>
  );
}

/**
 * Kullanıcı Listesi — web'deki Users sayfasının mobil karşılığı.
 *
 * Okuma super_admin ve intern'e açık; intern'e e-postalar maskeli gelir
 * (backend redactForIntern) ve yönetim aksiyonları gizlenir — yazma uçlarının
 * hepsi zaten yalnız super_admin'e açık.
 */
export default function UsersScreen({ navigation }) {
  const { session } = useAuth();
  const isAdmin = canManageUsers(session);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('');
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await userService.getAll();
      setUsers(res.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Kullanıcılar alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Detayda rol/departman değişmiş olabilir — her odaklanmada tazele.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    return users.filter((u) => {
      if (dept && u.department !== dept) return false;
      if (!q) return true;
      return [u.name, u.email, DEPARTMENT_LABEL[u.department] || '']
        .some((f) => String(f || '').toLocaleLowerCase('tr').includes(q));
    });
  }, [users, query, dept]);

  const handleCreate = async (payload) => {
    try {
      const res = await userService.create(payload);
      setShowNew(false);
      load();
      // Geçici parola yalnızca bu yanıtta döner, bir daha okunamaz — kullanıcıya
      // burada göstermezsek hesap kullanılamaz hale gelir (web'deki
      // CreateUserModal ile aynı gerekçe).
      const { email, temporaryPassword } = res.data.data;
      Alert.alert(
        'Kullanıcı oluşturuldu',
        `E-posta: ${email}\nGeçici parola: ${temporaryPassword}\n\n` +
          'Bu parola bir daha gösterilmeyecek. Kullanıcıya güvenli bir kanaldan iletin; ' +
          'ilk girişinde parolasını değiştirmesi istenecek.'
      );
    } catch (err) {
      Alert.alert('Oluşturulamadı', err.response?.data?.error || 'Kullanıcı oluşturulamadı.');
    }
  };

  const handleExport = async () => {
    try {
      await shareCsv(
        ['Ad Soyad', 'E-posta', 'Rol', 'Departman', 'Durum', 'Kayıt Tarihi'],
        filtered.map((u) => [
          u.name,
          u.email,
          ROLE_LABELS[u.role] || u.role,
          DEPARTMENT_LABEL[u.department] || '',
          userStatusMeta(u.status).label,
          u.createdAt ? new Date(u.createdAt).toLocaleDateString('tr-TR') : '',
        ]),
        'kullanicilar.csv'
      );
    } catch (err) {
      Alert.alert('Dışa aktarılamadı', err.message || 'Dosya oluşturulamadı.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <Text style={styles.h1}>Kullanıcı Listesi</Text>
        <Text style={styles.h1sub}>Sistemdeki tüm kullanıcıları yönetin ve görüntüleyin.</Text>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.ghostBtn} onPress={handleExport} activeOpacity={0.85}>
            <Ionicons name="download-outline" size={16} color={colors.primary} />
            <Text style={styles.ghostText}>Dışa Aktar</Text>
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowNew(true)} activeOpacity={0.85}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.primaryText}>Yeni Kullanıcı</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color={colors.textFaint} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="İsim, e-posta veya departman ara"
            placeholderTextColor={colors.textFaint}
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={colors.textFaint} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => {
            const active = dept === f.value;
            return (
              <TouchableOpacity
                key={f.value || 'all'}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setDept(f.value)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {!!error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(u) => u._id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        renderItem={({ item, index }) => (
          <UserCard
            user={item}
            index={index}
            onPress={() => navigation.navigate('UserDetail', { user: item })}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>Eşleşen kullanıcı yok.</Text>}
      />

      {isAdmin && (
        <NewUserModal visible={showNew} onSubmit={handleCreate} onClose={() => setShowNew(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },

  head: { paddingHorizontal: space.lg, paddingTop: space.lg },
  h1: { fontSize: font.xxl, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  h1sub: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },

  actionRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: space.md, height: 40, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  ghostText: { fontSize: font.sm, fontWeight: '700', color: colors.primary },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: space.md, height: 40, borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  primaryText: { fontSize: font.sm, fontWeight: '700', color: '#fff' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: space.md, height: 46, marginTop: space.md,
  },
  searchInput: { flex: 1, fontSize: font.sm, color: colors.text },

  filterRow: { gap: space.sm, paddingVertical: space.md, paddingRight: space.lg },
  filterChip: {
    paddingHorizontal: 14, height: 32, justifyContent: 'center',
    borderRadius: radius.full, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted },
  filterTextActive: { color: '#fff' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.dangerSoft, borderRadius: radius.md,
    padding: space.md, marginHorizontal: space.lg, marginBottom: space.sm,
  },
  errorText: { flex: 1, fontSize: font.sm, color: colors.danger },

  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  empty: { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', marginTop: space.xl },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: space.md, marginBottom: space.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 42, height: 42, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: font.sm, fontWeight: '800', color: '#fff' },
  name: { fontSize: font.md, fontWeight: '800', color: colors.text },
  role: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  chip: {
    backgroundColor: colors.primarySoft, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.primary },

  cardFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: space.md, paddingTop: space.md,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  tenureRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tenure: { fontSize: font.xs, color: colors.textMuted },
  statusDot: { width: 8, height: 8, borderRadius: radius.full },
});
