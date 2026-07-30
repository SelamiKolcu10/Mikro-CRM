import { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MONTHS, WEEKDAYS } from '../config/tasks';
import { toLocalISODate } from '../utils/dayBucket';
import { colors, radius, space, font } from '../theme';

// CalendarScreen'deki ızgarayla aynı kurulum: Pazartesi başlangıçlı, sabit 6
// hafta (42 hücre) — ay değişince ızgara yüksekliği zıplamasın diye.
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

const sameDay = (a, b) => !!a && !!b && toLocalISODate(a) === toLocalISODate(b);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const fmt = (d) => (d ? d.toLocaleDateString('tr-TR') : '—');

/**
 * Tarih aralığı seçici.
 *
 * Akış: ilk dokunuş başlangıcı belirler (varsa bitişi temizler), ikinci
 * dokunuş bitişi. İkinci gün başlangıçtan önceyse aralığı ters kurmak yerine
 * yeni başlangıç sayılır — kullanıcı genelde "yanlış günü seçtim, baştan
 * alayım" demek ister.
 *
 * Tek gün seçip Uygula'ya basmak da geçerlidir: o zaman aralık o günün
 * tamamıdır (bitiş = başlangıç).
 */
export default function DateRangePickerModal({ visible, from, to, onApply, onClose }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setStart(from ? startOfDay(from) : null);
    setEnd(to ? startOfDay(to) : null);
    setCursor(from ? new Date(from) : new Date());
  }, [visible, from, to]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const days = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const today = startOfDay(new Date());

  const shiftMonth = (delta) => setCursor(new Date(year, month + delta, 1));

  const pick = (day) => {
    const d = startOfDay(day);
    if (!start || (start && end)) {
      setStart(d);
      setEnd(null);
      return;
    }
    if (d < start) {
      setStart(d);
      return;
    }
    setEnd(d);
  };

  const apply = () => {
    if (!start) {
      onApply({ from: null, to: null });
      return;
    }
    onApply({ from: start, to: end || start });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={10} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={10} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={styles.weekday}>{w}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {days.map((d, i) => {
              const inMonth = d.getMonth() === month;
              const isStart = sameDay(d, start);
              const isEnd = sameDay(d, end);
              const inRange = start && end && d > start && d < end;
              const isToday = sameDay(d, today);
              const edge = isStart || isEnd;

              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.cell, inRange && styles.cellInRange]}
                  onPress={() => pick(d)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.day, edge && styles.dayEdge, isToday && !edge && styles.dayToday]}>
                    <Text
                      style={[
                        styles.dayText,
                        !inMonth && styles.dayTextOut,
                        edge && styles.dayTextEdge,
                        isToday && !edge && styles.dayTextToday,
                      ]}
                    >
                      {d.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.selection}>
            {start ? `${fmt(start)} — ${end ? fmt(end) : 'bitiş seçin'}` : 'Başlangıç günü seçin'}
          </Text>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={() => { setStart(null); setEnd(null); }}
            >
              <Text style={styles.ghostText}>Temizle</Text>
            </TouchableOpacity>
            <View style={styles.footerRight}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={apply} activeOpacity={0.85}>
                <Text style={styles.applyText}>Uygula</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(20,24,35,0.45)',
    justifyContent: 'center', padding: space.lg,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.md,
    shadowColor: '#1B2130', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.xs, paddingBottom: space.md,
  },
  navBtn: {
    width: 34, height: 34, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg,
  },
  monthLabel: { fontSize: font.md, fontWeight: '800', color: colors.text },

  weekRow: { flexDirection: 'row', paddingBottom: space.xs },
  weekday: {
    width: `${100 / 7}%`, textAlign: 'center',
    fontSize: 11, fontWeight: '700', color: colors.textFaint,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`, aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  cellInRange: { backgroundColor: colors.primarySoft },
  day: {
    width: 34, height: 34, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  dayEdge: { backgroundColor: colors.primary },
  dayToday: { borderWidth: 1.5, borderColor: colors.primary },
  dayText: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  dayTextOut: { color: colors.textFaint, fontWeight: '400' },
  dayTextEdge: { color: '#fff', fontWeight: '800' },
  dayTextToday: { color: colors.primary, fontWeight: '800' },

  selection: {
    fontSize: font.xs, color: colors.textMuted, textAlign: 'center',
    marginTop: space.md, marginBottom: space.sm,
  },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border,
  },
  footerRight: { flexDirection: 'row', gap: space.sm },
  ghostBtn: { paddingHorizontal: space.sm, height: 42, justifyContent: 'center' },
  ghostText: { fontSize: font.sm, fontWeight: '700', color: colors.textMuted },
  cancelBtn: {
    paddingHorizontal: space.md, height: 42, justifyContent: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  cancelText: { fontSize: font.sm, fontWeight: '600', color: colors.textMuted },
  applyBtn: {
    minWidth: 92, height: 42, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, backgroundColor: colors.primary,
  },
  applyText: { color: '#fff', fontSize: font.sm, fontWeight: '700' },
});
