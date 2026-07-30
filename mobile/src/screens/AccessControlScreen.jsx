import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import userService from '../services/userService';
import permissionOverrideService from '../services/permissionOverrideService';
import { useAuth } from '../context/AuthContext';
import {
  ACTIVE_PERMISSIONS,
  PLANNED_PERMISSIONS,
  hasStaticGrant,
  canGrantPermissions,
} from '../config/accessControl';
import { ROLE_LABELS } from '../config/users';
import { initialsOf } from '../config/projects';
import { DEPARTMENT_LABEL, DEPARTMENTS } from '../config/departments';
import { colors, radius, space, font, chartColors } from '../theme';

// Departman filtresi — Kullanıcı Yönetimi'ndeki çip satırının aynısı, artı
// departmanı atanmamış kullanıcılar için ayrı bir seçenek (aksi halde bir
// filtre seçildiği anda görünmez oluyorlar).
const DEPT_FILTERS = [
  { value: '', label: 'Tümü' },
  ...DEPARTMENTS.map((d) => ({ value: d, label: DEPARTMENT_LABEL[d] })),
  { value: 'none', label: 'Departmansız' },
];

/** Tek yetki kutucuğu — referanstaki 2'li ızgaranın hücresi. */
function PermissionTile({ label, actionLabel, checked, disabled, note, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.tile, disabled && styles.tileDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.tileText}>
        <Text style={[styles.tileLabel, disabled && styles.tileLabelDisabled]} numberOfLines={2}>
          {label}
        </Text>
        <Text style={styles.tileAction} numberOfLines={1}>{actionLabel}</Text>
        {!!note && <Text style={styles.tileNote} numberOfLines={1}>{note}</Text>}
      </View>
      <View style={[styles.box, checked && styles.boxChecked, disabled && styles.boxDisabled]}>
        {checked && <Ionicons name="checkmark" size={14} color={disabled ? colors.textFaint : '#fff'} />}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Erişim Kontrolü — web'deki AccessControlMatrix'in mobil karşılığı.
 * Web'de geniş bir tablo; mobilde her kullanıcı bir kart, yetkiler kart
 * içinde 2'li ızgara.
 *
 * Yetkiler statik rol matrisinin ÜSTÜNE eklenir, yerine geçmez: rolü zaten
 * yetkiliyse kutu işaretli ve kapalı gelir ("Rolünden geliyor"). super_admin
 * listede yok — zaten her şeye yetkili.
 */
export default function AccessControlScreen() {
  const { session } = useAuth();
  const canGrant = canGrantPermissions(session);

  const [users, setUsers] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('');

  // Yetki verirken gerekçe sorulur (backend'de zorunlu değil ama denetim
  // kaydında görünür) — web'deki rationale modalının aynısı.
  const [grantTarget, setGrantTarget] = useState(null);
  const [rationale, setRationale] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [usersRes, overridesRes] = await Promise.all([
        userService.getAll({ status: 'approved' }),
        permissionOverrideService.getAll(),
      ]);
      setUsers((usersRes.data.data || []).filter((u) => u.role !== 'super_admin'));
      setOverrides(overridesRes.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Erişim matrisi alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const findOverride = (userId, resource, action) =>
    overrides.find(
      (o) => String(o.user?._id || o.user) === String(userId) && o.resource === resource && o.action === action
    );

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    return users.filter((u) => {
      if (dept === 'none' ? !!u.department : dept && u.department !== dept) return false;
      if (!q) return true;
      return [u.name, u.email].some((f) =>
        String(f || '').toLocaleLowerCase('tr').includes(q)
      );
    });
  }, [users, query, dept]);

  const toggle = async (user, perm) => {
    const existing = findOverride(user._id, perm.resource, perm.action);
    if (existing) {
      try {
        await permissionOverrideService.revoke(existing._id);
        setOverrides((prev) => prev.filter((o) => o._id !== existing._id));
      } catch (err) {
        Alert.alert('Geri alınamadı', err.response?.data?.error || 'Yetki geri alınamadı.');
      }
      return;
    }
    setRationale('');
    setGrantTarget({ user, perm });
  };

  const confirmGrant = async () => {
    if (!grantTarget) return;
    setSaving(true);
    try {
      const { user, perm } = grantTarget;
      const res = await permissionOverrideService.grant(user._id, perm.resource, perm.action, rationale);
      setOverrides((prev) => [...prev.filter((o) => o._id !== res.data.data._id), res.data.data]);
      setGrantTarget(null);
    } catch (err) {
      Alert.alert('Verilemedi', err.response?.data?.error || 'Yetki verilemedi.');
    } finally {
      setSaving(false);
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
        <Text style={styles.h1}>Erişim Kontrolü</Text>
        <Text style={styles.h1sub}>
          Kullanıcılara varsayılan rollerinin dışında geçici yetkiler tanımlayın
        </Text>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color={colors.textFaint} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Kullanıcı ara..."
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
          {DEPT_FILTERS.map((f) => {
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
        ListEmptyComponent={<Text style={styles.empty}>Eşleşen kullanıcı yok.</Text>}
        renderItem={({ item, index }) => {
          // Rolü zaten her şeyi kapsıyorsa kart tamamen pasif görünür —
          // referanstaki soluk "Rolünden geliyor" hali.
          const allFromRole = ACTIVE_PERMISSIONS.every((p) =>
            hasStaticGrant(item.role, p.resource, p.action)
          );

          return (
            <View style={[styles.card, allFromRole && styles.cardMuted]}>
              <View style={styles.cardHead}>
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: allFromRole ? colors.border : chartColors[index % chartColors.length] },
                  ]}
                >
                  <Text style={[styles.avatarText, allFromRole && styles.avatarTextMuted]}>
                    {initialsOf(item.name)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.email} — {ROLE_LABELS[item.role] || item.role}
                    {item.department ? ` · ${DEPARTMENT_LABEL[item.department] || item.department}` : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.grid}>
                {ACTIVE_PERMISSIONS.map((perm) => {
                  const fromRole = hasStaticGrant(item.role, perm.resource, perm.action);
                  const override = findOverride(item._id, perm.resource, perm.action);
                  return (
                    <PermissionTile
                      key={`${perm.resource}-${perm.action}`}
                      label={perm.label}
                      actionLabel={perm.actionLabel}
                      checked={fromRole || !!override}
                      disabled={fromRole || !canGrant}
                      note={fromRole ? 'Rolünden geliyor' : override?.rationale}
                      onPress={() => toggle(item, perm)}
                    />
                  );
                })}
              </View>

              {/* Henüz backend'i olmayan yetkiler — kapalı ve etiketli. */}
              <View style={styles.plannedHead}>
                <Text style={styles.plannedTitle}>Planlanan Yetkiler</Text>
                <View style={styles.soonChip}>
                  <Text style={styles.soonText}>Yakında</Text>
                </View>
              </View>
              <View style={styles.grid}>
                {PLANNED_PERMISSIONS.map((perm) => (
                  <PermissionTile
                    key={perm.key}
                    label={perm.label}
                    actionLabel={perm.actionLabel}
                    checked={false}
                    disabled
                    onPress={() => {}}
                  />
                ))}
              </View>
            </View>
          );
        }}
      />

      {/* Gerekçe modalı */}
      <Modal visible={!!grantTarget} transparent animationType="fade" onRequestClose={() => setGrantTarget(null)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Yetki Ver</Text>
            <Text style={styles.modalBody}>
              {grantTarget?.user?.name} kullanıcısına{' '}
              <Text style={styles.modalStrong}>
                {grantTarget?.perm?.label} — {grantTarget?.perm?.actionLabel}
              </Text>{' '}
              yetkisi verilecek.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={rationale}
              onChangeText={setRationale}
              placeholder="Gerekçe (isteğe bağlı, denetim kaydına yazılır)"
              placeholderTextColor={colors.textFaint}
              multiline
              textAlignVertical="top"
              editable={!saving}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setGrantTarget(null)}
                disabled={saving}
              >
                <Text style={styles.cancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, saving && styles.disabled]}
                onPress={confirmGrant}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryText}>Yetkiyi Ver</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },

  head: { paddingHorizontal: space.lg, paddingTop: space.lg },
  h1: { fontSize: font.xxl, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  h1sub: { fontSize: font.sm, color: colors.primary, marginTop: space.xs, lineHeight: 19 },

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
  cardMuted: { opacity: 0.75 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  avatar: {
    width: 38, height: 38, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: font.xs, fontWeight: '800', color: '#fff' },
  avatarTextMuted: { color: colors.textMuted },
  name: { fontSize: font.md, fontWeight: '700', color: colors.text },
  meta: { fontSize: font.xs, color: colors.textMuted, marginTop: 1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.bg, borderRadius: radius.md,
    paddingHorizontal: space.sm, paddingVertical: space.sm, minHeight: 54,
  },
  tileDisabled: { opacity: 0.55 },
  tileText: { flex: 1 },
  tileLabel: { fontSize: 11, fontWeight: '800', color: colors.danger },
  tileLabelDisabled: { color: colors.textMuted },
  tileAction: { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: 1 },
  tileNote: { fontSize: 9, color: colors.textFaint, marginTop: 1 },
  box: {
    width: 22, height: 22, borderRadius: radius.sm,
    borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  boxDisabled: { backgroundColor: colors.border, borderColor: colors.border },

  plannedHead: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    marginTop: space.lg, marginBottom: space.sm,
    paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border,
  },
  plannedTitle: { fontSize: font.xs, fontWeight: '800', color: colors.textFaint, letterSpacing: 0.5 },
  soonChip: {
    backgroundColor: colors.warnSoft, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  soonText: { fontSize: 10, fontWeight: '800', color: '#B45309' },

  backdrop: { flex: 1, backgroundColor: 'rgba(20,24,35,0.45)', justifyContent: 'center', padding: space.lg },
  modalCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg,
    shadowColor: '#1B2130', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8,
  },
  modalTitle: { fontSize: font.lg, fontWeight: '800', color: colors.text },
  modalBody: { fontSize: font.sm, color: colors.textMuted, lineHeight: 20, marginTop: space.sm },
  modalStrong: { fontWeight: '800', color: colors.text },
  modalInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    padding: space.md, minHeight: 84, marginTop: space.md,
    fontSize: font.sm, color: colors.text,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.md },
  cancelBtn: {
    paddingHorizontal: space.lg, height: 44, justifyContent: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  cancelText: { fontSize: font.md, fontWeight: '600', color: colors.textMuted },
  primaryBtn: {
    minWidth: 116, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, backgroundColor: colors.primary,
  },
  primaryText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
