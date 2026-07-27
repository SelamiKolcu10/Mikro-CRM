import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTasks } from '../hooks/useTasks';
import { useAuth } from '../context/AuthContext';
import TaskDateModal from '../components/TaskDateModal';
import {
  MONTHS,
  WEEKDAYS,
  PRIORITY_ORDER,
  DEPARTMENT_LABEL,
  priorityMeta,
  statusMeta,
  canApproveTask,
} from '../config/tasks';
import { toLocalISODate, dayBucketOf, withNewDay } from '../utils/dayBucket';
import { colors, radius, space, font } from '../theme';

const DOTS_PER_DAY = 3;

/** Pazartesi başlangıçlı, her zaman 6 hafta (42 hücre) — ay değiştikçe ızgara
 *  yüksekliği sıçramasın diye (web CalendarView ile aynı kural). */
function buildMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function groupTasksByDay(tasks) {
  const byDay = new Map();
  const undated = [];
  for (const task of tasks) {
    const key = dayBucketOf(task.deadline);
    if (!key) {
      undated.push(task);
      continue;
    }
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(task);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));
  }
  return { byDay, undated };
}

const timeOf = (deadline) => {
  if (!deadline) return null;
  try {
    return new Date(deadline).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
};

function TaskCard({ task, canMove, onPress }) {
  const pr = priorityMeta(task.priority);
  const st = statusMeta(task.status);
  const isDone = task.status === 'done';
  const overdue = !isDone && task.deadline && dayBucketOf(task.deadline) < toLocalISODate(new Date());
  const time = timeOf(task.deadline);

  return (
    <TouchableOpacity
      style={styles.taskCard}
      onPress={onPress}
      activeOpacity={canMove ? 0.7 : 1}
      disabled={!canMove}
    >
      <View style={[styles.taskIcon, { backgroundColor: pr.bg }]}>
        <Ionicons
          name={isDone ? 'checkmark-done-outline' : 'document-text-outline'}
          size={18}
          color={pr.fg}
        />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.taskTop}>
          <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]} numberOfLines={2}>
            {task.title}
          </Text>
          <View style={[styles.badge, { backgroundColor: pr.bg }]}>
            <Text style={[styles.badgeText, { color: pr.fg }]}>{pr.label}</Text>
          </View>
        </View>

        {!!task.description && (
          <Text style={styles.taskDesc} numberOfLines={1}>{task.description}</Text>
        )}

        <View style={styles.taskMeta}>
          {!!time && (
            <View style={styles.metaItem}>
              <Ionicons
                name="time-outline"
                size={13}
                color={overdue ? colors.danger : colors.textMuted}
              />
              <Text style={[styles.metaText, overdue && styles.metaOverdue]}>{time}</Text>
            </View>
          )}
          <View style={[styles.statusChip, { backgroundColor: st.bg }]}>
            <Text style={[styles.statusText, { color: st.fg }]}>{st.label}</Text>
          </View>
          {!!task.department && (
            <Text style={styles.deptText}>{DEPARTMENT_LABEL[task.department] || task.department}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function CalendarScreen() {
  const { session } = useAuth();
  const { tasks, loading, error, refresh, updateTaskDeadline } = useTasks();

  const [refreshing, setRefreshing] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState(() => toLocalISODate(new Date()));
  const [showUndated, setShowUndated] = useState(false);
  const [picker, setPicker] = useState(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const gridDays = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const { byDay, undated } = useMemo(() => groupTasksByDay(tasks), [tasks]);
  const todayISO = toLocalISODate(new Date());

  const selectedTasks = byDay.get(selectedDay) || [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const goToMonth = (delta) =>
    setCursor((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + delta);
      return next;
    });

  const goToToday = () => {
    const d = new Date();
    setSelectedDay(toLocalISODate(d));
    d.setDate(1);
    setCursor(d);
  };

  // Tarih taşıma — hook iyimser günceller, hata olursa geri alır ve fırlatır.
  const handleSaveDate = async (taskId, dayISO) => {
    const task = tasks.find((t) => t._id === taskId);
    if (!task) return;
    const nextDeadline = dayISO ? withNewDay(task.deadline, dayISO).toISOString() : null;
    try {
      await updateTaskDeadline(taskId, nextDeadline);
      setPicker(null);
      if (dayISO) setSelectedDay(dayISO);
    } catch (err) {
      Alert.alert(
        'Taşınamadı',
        err.response?.status === 409
          ? 'Bu görev başka biri tarafından güncellenmiş. Sayfayı yenileyip tekrar dene.'
          : err.response?.data?.error || 'Bir hata oluştu.'
      );
    }
  };

  const selectedLabel = (() => {
    const [y, m, d] = selectedDay.split('-').map(Number);
    return `${d} ${MONTHS[m - 1].toLocaleUpperCase('tr')} ${y}`;
  })();

  const header = (
    <View>
      <Text style={styles.title}>Takvim</Text>
      <Text style={styles.subtitle}>Görev teslim tarihlerini gör ve planla.</Text>

      {/* Ay kartı */}
      <View style={styles.monthCard}>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => goToMonth(-1)} hitSlop={10} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
          <TouchableOpacity onPress={() => goToMonth(1)} hitSlop={10} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAYS.map((w) => (
            <Text key={w} style={styles.weekday}>{w}</Text>
          ))}
        </View>

        <View style={styles.grid}>
          {gridDays.map((d) => {
            const dayISO = toLocalISODate(d);
            const inMonth = d.getMonth() === month;
            const dayTasks = byDay.get(dayISO) || [];
            const isToday = dayISO === todayISO;
            const isSelected = dayISO === selectedDay;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;

            return (
              <TouchableOpacity
                key={dayISO}
                style={styles.cell}
                onPress={() => setSelectedDay(dayISO)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.dayCircle,
                    isToday && !isSelected && styles.dayToday,
                    isSelected && styles.daySelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      !inMonth && styles.dayOutside,
                      inMonth && isWeekend && styles.dayWeekend,
                      isSelected && styles.dayNumberSelected,
                    ]}
                  >
                    {d.getDate()}
                  </Text>
                </View>

                {/* Öncelik noktaları — o günde iş olduğunun sinyali */}
                <View style={styles.dots}>
                  {dayTasks.slice(0, DOTS_PER_DAY).map((t) => (
                    <View
                      key={t._id}
                      style={[styles.dot, { backgroundColor: priorityMeta(t.priority).dot }]}
                    />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.todayBtn} onPress={goToToday} activeOpacity={0.8}>
          <Text style={styles.todayText}>Bugüne dön</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>{selectedLabel} GÖREVLERİ</Text>
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      <TouchableOpacity
        style={[styles.undatedToggle, showUndated && styles.undatedToggleOpen]}
        onPress={() => setShowUndated((v) => !v)}
        activeOpacity={0.7}
      >
        <Ionicons
          name="file-tray-outline"
          size={18}
          color={showUndated ? colors.primary : colors.textMuted}
        />
        <Text style={[styles.undatedLabel, showUndated && styles.undatedLabelOpen]}>
          Tarihsiz Görevler
        </Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{undated.length}</Text>
        </View>
        <Ionicons
          name={showUndated ? 'chevron-down' : 'chevron-forward'}
          size={18}
          color={showUndated ? colors.primary : colors.textFaint}
        />
      </TouchableOpacity>

      {showUndated && (
        <View style={styles.undatedBody}>
          {undated.length === 0 ? (
            <Text style={styles.empty}>Tarihsiz görev yok.</Text>
          ) : (
            undated.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                canMove={canApproveTask(session, task)}
                onPress={() => setPicker(task)}
              />
            ))
          )}
        </View>
      )}
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
        data={selectedTasks}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            canMove={canApproveTask(session, item)}
            onPress={() => setPicker(item)}
          />
        )}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Bu günde görev yok.</Text>}
      />

      <TaskDateModal
        visible={!!picker}
        task={picker}
        selectedDayISO={selectedDay}
        onSave={handleSaveDate}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: space.xl },
  list: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },

  title: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: font.md, color: colors.textMuted, marginTop: 2, marginBottom: space.lg },

  monthCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#1B2130', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.sm },
  navBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  monthLabel: { fontSize: font.lg, fontWeight: '800', color: colors.text },

  weekRow: { flexDirection: 'row', marginTop: space.md, marginBottom: space.xs },
  weekday: {
    width: `${100 / 7}%`, textAlign: 'center',
    fontSize: font.xs, fontWeight: '700', color: colors.textFaint,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 },
  dayCircle: { width: 34, height: 34, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  dayToday: { borderWidth: 1.5, borderColor: colors.primary },
  daySelected: { backgroundColor: colors.primary },
  dayNumber: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  dayNumberSelected: { color: '#fff', fontWeight: '800' },
  dayOutside: { color: colors.textFaint, fontWeight: '400' },
  dayWeekend: { color: colors.danger },

  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: radius.full },

  todayBtn: { alignSelf: 'center', marginTop: space.sm, paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.primarySoft },
  todayText: { fontSize: font.xs, fontWeight: '700', color: colors.primary },

  sectionLabel: {
    fontSize: font.xs, fontWeight: '800', color: colors.textFaint,
    letterSpacing: 0.6, marginTop: space.xl, marginBottom: space.xs,
  },

  taskCard: {
    flexDirection: 'row', gap: space.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#1B2130', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  taskIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  taskTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  taskTitle: { flex: 1, fontSize: font.md, fontWeight: '800', color: colors.text, lineHeight: 20 },
  taskTitleDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  taskDesc: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  taskMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: font.xs, color: colors.textMuted, fontWeight: '600' },
  metaOverdue: { color: colors.danger },
  badge: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: radius.full },
  badgeText: { fontSize: 10, fontWeight: '800' },
  statusChip: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: radius.full },
  statusText: { fontSize: 10, fontWeight: '800' },
  deptText: { fontSize: font.xs, color: colors.textFaint },

  footer: { marginTop: space.lg, gap: space.sm },
  undatedToggle: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: space.md, height: 50,
  },
  undatedToggleOpen: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  undatedLabel: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.textMuted },
  undatedLabelOpen: { color: colors.primary },
  countBadge: {
    minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: radius.full,
    backgroundColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center',
  },
  countText: { fontSize: 11, fontWeight: '800', color: colors.text },
  undatedBody: { gap: space.sm },

  empty: { textAlign: 'center', color: colors.textMuted, paddingVertical: space.lg },
  errorText: { color: colors.danger, textAlign: 'center', marginBottom: space.md },
  retry: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md },
  retryText: { color: '#fff', fontWeight: '700' },
});
