import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTasks } from '../hooks/useTasks';
import { useAuth } from '../context/AuthContext';
import CreateTaskModal from '../components/CreateTaskModal';
import {
  STATUSES,
  STATUS,
  DEPARTMENTS,
  DEPARTMENT_LABEL,
  DONE_VISIBLE_DAYS,
  priorityMeta,
  statusMeta,
  applyTaskFilters,
  canCreateTask,
  hasFullDepartmentAccess,
  avatarColor,
  avatarInitials,
} from '../config/tasks';
import { formatDate } from '../utils/format';
import { colors, radius, space, font } from '../theme';

/** Tamamlanan görev panoda 7 gün durur, sonra Geçmiş sekmesine düşer. */
function isVisibleOnBoard(task) {
  if (task.status !== 'done') return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DONE_VISIBLE_DAYS);
  return new Date(task.updatedAt) >= cutoff;
}

function TaskCard({ task, onPress }) {
  const pr = priorityMeta(task.priority);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardTags}>
        <View style={[styles.chip, { backgroundColor: pr.bg }]}>
          <Text style={[styles.chipText, { color: pr.fg }]}>{pr.label}</Text>
        </View>
        <View style={styles.deptChip}>
          <Text style={styles.deptChipText}>
            {DEPARTMENT_LABEL[task.department] || task.department}
          </Text>
        </View>
        {!!task.projectId?.name && (
          <View style={styles.projectChip}>
            <Text style={styles.projectChipText} numberOfLines={1}>{task.projectId.name}</Text>
          </View>
        )}
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>{task.title}</Text>
      {!!task.description && (
        <Text style={styles.cardDesc} numberOfLines={1}>{task.description}</Text>
      )}

      <View style={styles.cardFooter}>
        <View style={[styles.avatar, { backgroundColor: avatarColor(task.assignedTo?._id) }]}>
          <Text style={styles.avatarText}>{avatarInitials(task.assignedTo?.name)}</Text>
        </View>
        <Text style={styles.assignee} numberOfLines={1}>{task.assignedTo?.name || '—'}</Text>
        {!!task.deadline && <Text style={styles.deadline}>{formatDate(task.deadline)}</Text>}
      </View>
    </TouchableOpacity>
  );
}

// Yatay kaydırılan tek seçimli filtre şeridi.
function ChipRow({ options, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={String(o.value)}
            style={[styles.filterChip, active && styles.filterChipActive]}
            onPress={() => onChange(o.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default function TasksScreen({ navigation }) {
  const { session } = useAuth();
  const {
    tasks,
    loading,
    error,
    refresh,
    createTask,
    getAssignableUsers,
  } = useTasks();

  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('board');
  const [filters, setFilters] = useState({ department: '', assigneeId: '', onlyMine: false });
  const [modalOpen, setModalOpen] = useState(false);

  const canCreate = canCreateTask(session);
  const showDepartmentFilter = hasFullDepartmentAccess(session);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Detay ekranında durum değiştirilmiş olabilir — geri dönüşte pano tazelenir.
  // (Durum güncellemesi orada yapılıyor; navigation param'ıyla fonksiyon
  // geçirmek React Navigation'da serileştirilemez uyarısı çıkarıyor.)
  useEffect(() => {
    const unsub = navigation.addListener('focus', refresh);
    return unsub;
  }, [navigation, refresh]);

  const filtered = useMemo(
    () => applyTaskFilters(tasks, filters, session?._id),
    [tasks, filters, session?._id]
  );

  // Atanan seçenekleri, seçili departmandaki görevlerde geçen kişilerden
  // türetilir — ayrı bir kullanıcı listesi isteğine gerek yok.
  const assigneeOptions = useMemo(() => {
    const relevant = filters.department
      ? tasks.filter((t) => t.department === filters.department)
      : tasks;
    const map = new Map();
    relevant.forEach((t) => {
      const a = t.assignedTo;
      if (a?._id && !map.has(a._id)) map.set(a._id, a);
    });
    return [
      { value: '', label: 'Tüm Kişiler' },
      ...Array.from(map.values()).map((a) => ({ value: a._id, label: a.name })),
    ];
  }, [tasks, filters.department]);

  const departmentOptions = useMemo(
    () => [
      { value: '', label: 'Tüm Departmanlar' },
      ...DEPARTMENTS.map((d) => ({ value: d, label: DEPARTMENT_LABEL[d] })),
    ],
    []
  );

  // Pano: durum başlıkları + kartlar tek düz listede (FlatList performansı).
  const boardRows = useMemo(() => {
    const visible = filtered.filter(isVisibleOnBoard);
    const rows = [];
    for (const status of STATUSES) {
      const list = visible.filter((t) => t.status === status);
      rows.push({ kind: 'section', key: `s-${status}`, status, count: list.length });
      list.forEach((task) => rows.push({ kind: 'task', key: task._id, task }));
    }
    return rows;
  }, [filtered]);

  const historyRows = useMemo(
    () =>
      filtered
        .filter((t) => t.status === 'done')
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .map((task) => ({ kind: 'task', key: task._id, task })),
    [filtered]
  );

  const rows = tab === 'board' ? boardRows : historyRows;

  const header = (
    <View>
      <Text style={styles.title}>Görevler</Text>
      <Text style={styles.subtitle}>Departmanınıza ait görevleri takip edin.</Text>

      {/* İki sekme içeriği yerinde değiştirir; "Katkı Haritası" ise ayrı bir
          ekrana gider — bu yüzden aynı satırda ama bilerek farklı görünümde
          (mavi zemin + ok), sekme sanılmasın. Üçü sığmazsa yatay kayar. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {[
          { key: 'board', label: 'Aktif Pano' },
          { key: 'history', label: 'Görev Geçmişi' },
        ].map((tb) => {
          const active = tab === tb.key;
          return (
            <TouchableOpacity
              key={tb.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(tb.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tb.label}</Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={styles.mapBtn}
          onPress={() =>
            navigation.navigate('TaskActivity', {
              department: filters.department,
              assigneeId: filters.assigneeId,
            })
          }
          activeOpacity={0.8}
        >
          <Ionicons name="grid" size={15} color={colors.primary} />
          <Text style={styles.mapBtnText}>Katkı Haritası</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.primary} />
        </TouchableOpacity>
      </ScrollView>

      {showDepartmentFilter && (
        <ChipRow
          options={departmentOptions}
          value={filters.department}
          onChange={(v) => setFilters((f) => ({ ...f, department: v, assigneeId: '' }))}
        />
      )}
      <ChipRow
        options={assigneeOptions}
        value={filters.assigneeId}
        onChange={(v) => setFilters((f) => ({ ...f, assigneeId: v }))}
      />

      <TouchableOpacity
        style={styles.checkRow}
        onPress={() => setFilters((f) => ({ ...f, onlyMine: !f.onlyMine }))}
        activeOpacity={0.7}
      >
        <Ionicons
          name={filters.onlyMine ? 'checkbox' : 'square-outline'}
          size={20}
          color={filters.onlyMine ? colors.primary : colors.textFaint}
        />
        <Text style={[styles.checkText, filters.onlyMine && styles.checkTextActive]}>
          Sadece Benim Görevlerim
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={refresh}>
          <Text style={styles.retryText}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => {
          if (item.kind === 'section') {
            const st = statusMeta(item.status);
            return (
              <View style={styles.sectionRow}>
                <View style={[styles.statusDot, { backgroundColor: st.fg }]} />
                <Text style={styles.sectionLabel}>{STATUS[item.status].label}</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{item.count}</Text>
                </View>
              </View>
            );
          }
          return (
            <TaskCard
              task={item.task}
              onPress={() => navigation.navigate('TaskDetail', { task: item.task })}
            />
          );
        }}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {tab === 'board' ? 'Bu filtrede görev yok.' : 'Tamamlanmış görev yok.'}
          </Text>
        }
      />

      {canCreate && (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.createBtn} onPress={() => setModalOpen(true)} activeOpacity={0.85}>
            <Ionicons name="add" size={19} color="#fff" />
            <Text style={styles.createText}>Görev Oluştur</Text>
          </TouchableOpacity>
        </View>
      )}

      <CreateTaskModal
        visible={modalOpen}
        onCreate={createTask}
        getAssignableUsers={getAssignableUsers}
        onClose={() => setModalOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: space.xl },
  list: { padding: space.lg, gap: space.sm, paddingBottom: space.xxl },

  title: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: font.md, color: colors.textMuted, marginTop: 2 },

  tabs: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, marginBottom: space.md, paddingRight: space.lg },
  mapBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: space.md, height: 40,
    borderRadius: radius.md, backgroundColor: colors.primarySoft,
    borderWidth: 1, borderColor: colors.primary,
  },
  mapBtnText: { fontSize: font.sm, fontWeight: '700', color: colors.primary },
  tab: {
    paddingHorizontal: space.md, height: 40, justifyContent: 'center',
    borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: font.sm, fontWeight: '700', color: colors.textMuted },
  tabTextActive: { color: '#fff' },

  chipRow: { gap: space.sm, paddingBottom: space.sm, paddingRight: space.lg },
  filterChip: {
    paddingHorizontal: space.md, height: 34, justifyContent: 'center',
    borderRadius: radius.full, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  filterChipText: { fontSize: font.sm, fontWeight: '600', color: colors.textMuted },
  filterChipTextActive: { color: colors.primary },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  checkText: { fontSize: font.sm, fontWeight: '600', color: colors.textMuted },
  checkTextActive: { color: colors.primary },

  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg, marginBottom: space.xs },
  statusDot: { width: 8, height: 8, borderRadius: radius.full },
  sectionLabel: { flex: 1, fontSize: font.md, fontWeight: '800', color: colors.text },
  countBadge: {
    minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: radius.full,
    backgroundColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center',
  },
  countText: { fontSize: 11, fontWeight: '800', color: colors.text },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#1B2130', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  cardTags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: radius.full },
  chipText: { fontSize: 10, fontWeight: '800' },
  deptChip: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: radius.full, backgroundColor: '#EEF1F4' },
  deptChipText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  projectChip: { maxWidth: 120, paddingHorizontal: 9, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.primarySoft },
  projectChipText: { fontSize: 10, fontWeight: '700', color: colors.primary },

  cardTitle: { fontSize: font.md, fontWeight: '800', color: colors.text, marginTop: space.sm, lineHeight: 20 },
  cardDesc: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },

  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  avatar: { width: 24, height: 24, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  assignee: { flex: 1, fontSize: font.xs, fontWeight: '600', color: colors.textMuted },
  deadline: { fontSize: font.xs, color: colors.textFaint },

  bottomBar: {
    padding: space.md, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.primary, borderRadius: radius.md, height: 48,
    shadowColor: colors.primary, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  createText: { color: '#fff', fontSize: font.md, fontWeight: '700' },

  empty: { textAlign: 'center', color: colors.textMuted, marginTop: space.xl },
  errorText: { color: colors.danger, textAlign: 'center', marginBottom: space.md },
  retry: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md },
  retryText: { color: '#fff', fontWeight: '700' },
});
