import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import taskService from '../services/taskService';
import { STATUS, ACTIVITY_ACTION, MONTHS, statusMeta } from '../config/tasks';
import { toLocalISODate } from '../utils/dayBucket';
import { colors, radius, space, font } from '../theme';

const CELL = 15;
const GAP = 3;
const ROW_LABEL_W = 26;
// Satırlar haftanın günü (0=Pazar), sütunlar hafta — web TaskHeatmap ile aynı
// düzen. Yer darlığı yüzünden yalnız Pzt/Çar/Cum etiketlenir.
const ROW_LABELS = { 1: 'Pzt', 3: 'Çar', 5: 'Cum' };

/**
 * Son 364 günden bu yılın 31 Aralık'ına kadar ISO gün listesi (web sürümüyle
 * aynı aralık). Bugünden sonrası henüz boş; ızgaranın yıl sonuna kadar
 * uzaması takvimi bütün gösteriyor ve ileri/geri kaydırmaya izin veriyor.
 *
 * Not: bu yüzden tablo tek ekrana sığmaz — açılışta BUGÜNÜN sütununa
 * kaydırıyoruz (bkz. aşağıdaki scrollTo), yoksa kullanıcı bir yıl öncesinin
 * ya da geleceğin boş haftalarına bakıyor.
 */
function buildDateRange() {
  const days = [];
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 364);
  const end = new Date(today.getFullYear(), 11, 31);
  const d = new Date(start);
  while (d <= end) {
    days.push(toLocalISODate(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/** Düz gün listesinden 7×N hafta ızgarası + ay etiketleri. */
function buildWeekGrid(dates) {
  const weeks = [];
  let current = new Array(7).fill(null);
  const startDay = new Date(`${dates[0]}T00:00:00`).getDay();
  for (let i = 0; i < startDay; i += 1) current[i] = null;

  dates.forEach((dateStr) => {
    const dow = new Date(`${dateStr}T00:00:00`).getDay();
    current[dow] = dateStr;
    if (dow === 6) {
      weeks.push(current);
      current = new Array(7).fill(null);
    }
  });
  if (current.some((d) => d !== null)) weeks.push(current);

  const monthLabels = [];
  let lastMonth = -1;
  weeks.forEach((week, col) => {
    const first = week.find((d) => d !== null);
    if (!first) return;
    const m = new Date(`${first}T00:00:00`).getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ month: m, col });
      lastMonth = m;
    }
  });

  return { weeks, monthLabels };
}

// 0 = aktivite yok (nötr gri), 1-4 giderek koyulaşan mavi. Basamaklar
// bilerek ayrık: küçük karelerde yakın tonlar telefonda ayırt edilemiyor.
const LEVEL_COLORS = ['#E4E8F0', '#B9C8FB', '#7C93F2', '#4A61E6', '#22369E'];
const intensityLevel = (count) => {
  if (!count) return 0;
  if (count >= 7) return 4;
  if (count >= 5) return 3;
  if (count >= 3) return 2;
  return 1;
};

const prettyDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

export default function TaskActivityScreen({ route, navigation }) {
  const { department, assigneeId } = route.params || {};

  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(() => toLocalISODate(new Date()));
  const gridRef = useRef(null);
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    navigation.setOptions({ title: 'Katkı Aktivitesi' });
  }, [navigation]);

  const load = useCallback(async () => {
    try {
      const params = {};
      if (department) params.department = department;
      if (assigneeId) params.userId = assigneeId;
      const res = await taskService.getActivityHeatmap(params);
      setData(res.data.data || {});
      setError(null);
    } catch (err) {
      setError(
        err.response?.status === 403
          ? 'Bu verileri görüntüleme yetkin yok.'
          : err.response?.data?.error || 'Aktivite yüklenemedi.'
      );
    } finally {
      setLoading(false);
    }
  }, [department, assigneeId]);

  useEffect(() => {
    load();
  }, [load]);

  const { weeks, monthLabels, dateSet } = useMemo(() => {
    const dates = buildDateRange();
    return { ...buildWeekGrid(dates), dateSet: new Set(dates) };
  }, []);

  const todayISO = toLocalISODate(new Date());
  const todayCol = useMemo(
    () => weeks.findIndex((w) => w.includes(todayISO)),
    [weeks, todayISO]
  );

  // Açılışta bugünün sütununu sağ kenara yakın konumla: soldaki bir yıllık
  // geçmiş ve sağdaki yıl sonuna kadar olan boşluk ikisi de kaydırılabilir
  // kalsın. Genişliği onLayout'tan alıyoruz — cihaz genişliği sabit değil.
  useEffect(() => {
    if (!gridWidth || todayCol < 0) return;
    const x = ROW_LABEL_W + (todayCol + 1) * (CELL + GAP) - gridWidth + space.lg;
    gridRef.current?.scrollTo({ x: Math.max(0, x), animated: false });
  }, [gridWidth, todayCol]);

  const entry = data[selected];
  // Toplam yalnız ÇİZİLEN günlerden hesaplanır — başlıkta "176 katkı" yazıp
  // haritada hiçbir şey görünmemesi bu yüzden olabiliyordu.
  const total = useMemo(
    () =>
      Object.entries(data).reduce(
        (sum, [date, e]) => (dateSet.has(date) ? sum + (e.total || 0) : sum),
        0
      ),
    [data, dateSet]
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
        <TouchableOpacity style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Katkı Aktivitesi</Text>
      <Text style={styles.subtitle}>
        {total > 0
          ? `Son bir yılda ${total} katkı`
          : 'Son bir yılda kayıtlı aktivite yok'}
      </Text>

      <View style={styles.card}>
        {/* Yıl sonuna kadar uzanan ızgara — iki yöne de kaydırılabilir,
            kaydırma çubuğu nereye bakıldığını göstersin diye açık. */}
        <ScrollView
          ref={gridRef}
          horizontal
          showsHorizontalScrollIndicator
          onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
        >
          <View>
            {/* Ay etiketleri — her ayın ilk haftasının sütununa hizalı */}
            <View style={[styles.monthRow, { marginLeft: ROW_LABEL_W }]}>
              {monthLabels.map((ml, i) => {
                const nextCol = monthLabels[i + 1]?.col ?? weeks.length;
                const width = (nextCol - ml.col) * (CELL + GAP);
                return (
                  <Text key={`${ml.month}-${ml.col}`} style={[styles.monthLabel, { width }]}>
                    {MONTHS[ml.month].slice(0, 3)}
                  </Text>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row' }}>
              {/* Gün etiketleri */}
              <View style={{ width: ROW_LABEL_W }}>
                {Array.from({ length: 7 }, (_, row) => (
                  <View key={row} style={{ height: CELL + GAP, justifyContent: 'center' }}>
                    <Text style={styles.rowLabel}>{ROW_LABELS[row] || ''}</Text>
                  </View>
                ))}
              </View>

              {/* Haftalar (sütun) × günler (satır) */}
              <View style={{ flexDirection: 'row' }}>
                {weeks.map((week, col) => (
                  <View key={col} style={{ marginRight: GAP }}>
                    {week.map((dateStr, row) => {
                      if (!dateStr) {
                        return <View key={row} style={{ width: CELL, height: CELL, marginBottom: GAP }} />;
                      }
                      const count = data[dateStr]?.total || 0;
                      const isSelected = dateStr === selected;
                      return (
                        <TouchableOpacity
                          key={row}
                          onPress={() => setSelected(dateStr)}
                          style={[
                            styles.cell,
                            { backgroundColor: LEVEL_COLORS[intensityLevel(count)] },
                            count === 0 && styles.cellEmpty,
                            isSelected && styles.cellSelected,
                          ]}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Yoğunluk göstergesi + kaydırdıktan sonra bugüne dönüş */}
        <View style={styles.legend}>
          <TouchableOpacity
            style={styles.todayBtn}
            onPress={() => {
              setSelected(todayISO);
              const x = ROW_LABEL_W + (todayCol + 1) * (CELL + GAP) - gridWidth + space.lg;
              gridRef.current?.scrollTo({ x: Math.max(0, x), animated: true });
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.todayText}>Bugüne dön</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <Text style={styles.legendText}>Az</Text>
          {LEVEL_COLORS.map((c) => (
            <View key={c} style={[styles.legendCell, { backgroundColor: c }]} />
          ))}
          <Text style={styles.legendText}>Çok</Text>
        </View>
      </View>

      {/* Seçili günün detayı */}
      <View style={styles.daySection}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayCount}>{entry?.total || 0} katkı</Text>
          <Text style={styles.dayDate}>{prettyDate(selected)}</Text>
        </View>

        {!entry || entry.details.length === 0 ? (
          <Text style={styles.empty}>Bu gün aktivite yok.</Text>
        ) : (
          <View style={styles.detailList}>
            {entry.details.map((item, idx) => (
              <View key={`${selected}-${idx}`} style={styles.detailRow}>
                <Text style={styles.detailTime}>{item.time}</Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.detailTop}>
                    <Text style={styles.detailUser} numberOfLines={1}>{item.user}</Text>
                    <Text style={styles.detailAction}>
                      {ACTIVITY_ACTION[item.action] || item.action}
                    </Text>
                  </View>

                  {item.action === 'status_changed' && (
                    <View style={styles.statusRow}>
                      {!!item.from && (
                        <>
                          <View style={[styles.miniChip, { backgroundColor: statusMeta(item.from).bg }]}>
                            <Text style={[styles.miniChipText, { color: statusMeta(item.from).fg }]}>
                              {STATUS[item.from]?.label || item.from}
                            </Text>
                          </View>
                          <Text style={styles.arrow}> → </Text>
                        </>
                      )}
                      <View style={[styles.miniChip, { backgroundColor: statusMeta(item.to).bg }]}>
                        <Text style={[styles.miniChipText, { color: statusMeta(item.to).fg }]}>
                          {STATUS[item.to]?.label || item.to}
                        </Text>
                      </View>
                    </View>
                  )}

                  <Text style={styles.detailTask} numberOfLines={2}>{item.task}</Text>
                </View>
              </View>
            ))}
            {entry.total > entry.details.length && (
              <Text style={styles.more}>ve daha fazlası...</Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: space.xl },
  content: { padding: space.lg, paddingBottom: space.xxl },

  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  subtitle: { fontSize: font.sm, color: colors.textMuted, marginTop: 2, marginBottom: space.lg },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md,
    borderWidth: 1, borderColor: colors.border,
  },
  monthRow: { flexDirection: 'row', marginBottom: 4 },
  monthLabel: { fontSize: 10, fontWeight: '700', color: colors.textFaint },
  rowLabel: { fontSize: 9, color: colors.textFaint },
  cell: { width: CELL, height: CELL, borderRadius: 3, marginBottom: GAP },
  // Boş günler hafif bir çerçeveyle çiziliyor ki ızgara "ızgara" gibi okunsun
  // ve dolu kareler arka planda kaybolmasın.
  cellEmpty: { borderWidth: 1, borderColor: '#D5DAE6' },
  cellSelected: { borderWidth: 2, borderColor: colors.text },

  legend: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: space.md },
  todayBtn: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.primarySoft },
  todayText: { fontSize: font.xs, fontWeight: '700', color: colors.primary },
  legendText: { fontSize: 10, color: colors.textFaint, marginHorizontal: 3 },
  legendCell: { width: 10, height: 10, borderRadius: 2 },

  daySection: { marginTop: space.xl },
  dayHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  dayCount: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  dayDate: { fontSize: font.sm, color: colors.textMuted },

  detailList: { marginTop: space.md, gap: space.md },
  detailRow: {
    flexDirection: 'row', gap: space.md,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md,
    borderWidth: 1, borderColor: colors.border,
  },
  detailTime: { fontSize: font.xs, fontWeight: '700', color: colors.textFaint, width: 38 },
  detailTop: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  detailUser: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  detailAction: { fontSize: font.sm, color: colors.textMuted },
  statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 4 },
  miniChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  miniChipText: { fontSize: 10, fontWeight: '800' },
  arrow: { fontSize: font.sm, color: colors.textMuted },
  detailTask: { fontSize: font.sm, color: colors.text, marginTop: 4 },
  more: { fontSize: font.xs, color: colors.textFaint, textAlign: 'center' },

  empty: { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: space.lg },
  errorText: { color: colors.danger, textAlign: 'center', marginBottom: space.md },
  retry: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md },
  retryText: { color: '#fff', fontWeight: '700' },
});
