import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import chatService from '../services/chatService';
import { useSocket } from '../context/SocketContext';
import {
  PLAN_LABEL,
  PLAN_FILTERS,
  SLA_STYLE,
  getInitials,
  getAvatarColor,
  relativeTime,
} from '../config/chat';
import { getSlaState, formatSlaDuration } from '../utils/sla';
import { colors, radius, space, font } from '../theme';

// Gerçek aktivitesi olanlar önce (en yeni yanıt en üstte), hiç mesajlaşılmamış
// müşteriler alfabetik olarak sonra — backend'in kendi sıralamasının aynısı.
const compareConversations = (a, b) => {
  if (a.lastMessageAt && b.lastMessageAt) return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
  if (a.lastMessageAt) return -1;
  if (b.lastMessageAt) return 1;
  return (a.customer?.name || '').localeCompare(b.customer?.name || '', 'tr');
};

// Okunmamış yanıt en güçlü "bir şey oldu" sinyali — SLA şiddetini bile geçer.
const SLA_SORT_RANK = { breached: 0, critical: 0, warning: 1, ok: 2 };
const priorityRank = (c, now) =>
  (c.unreadByInternal > 0 ? -1 : SLA_SORT_RANK[getSlaState(c, now).state]);

function ConversationRow({ item, onPress }) {
  const sla = getSlaState(item);
  const slaStyle = SLA_STYLE[sla.state];
  const name = item.customer?.name || '—';

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.customer?._id) }]}>
        <Text style={styles.avatarText}>{getInitials(item.customer?.company || name)}</Text>
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
          <Text style={styles.rowTime}>{relativeTime(item.lastMessageAt)}</Text>
        </View>

        <View style={styles.rowMid}>
          <View style={styles.planBadge}>
            <Text style={styles.planText}>
              {(PLAN_LABEL[item.customer?.plan] || item.customer?.plan || '').toUpperCase()}
            </Text>
          </View>
          {!!slaStyle && (
            <View style={[styles.slaChip, { backgroundColor: slaStyle.bg }]}>
              <Text style={[styles.slaText, { color: slaStyle.fg }]}>
                {slaStyle.label} · {formatSlaDuration(sla.minutesRemaining)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.rowBottom}>
          <Text style={styles.preview} numberOfLines={1}>
            {item.lastMessagePreview || 'Henüz mesaj yok'}
          </Text>
          {item.unreadByInternal > 0 && (
            <View style={styles.unread}>
              <Text style={styles.unreadText}>{item.unreadByInternal}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ChatScreen({ navigation }) {
  const { socket, connected } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [slaFilter, setSlaFilter] = useState(false);
  const [tick, setTick] = useState(0); // SLA geri sayımını canlı tutan 30sn'lik tık

  const load = useCallback(async () => {
    try {
      const res = await chatService.getConversations();
      setConversations(res.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Sohbetler yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // Açık olmayan sohbetler de canlı güncellensin (önizleme, sıralama, rozet).
  useEffect(() => {
    if (!socket) return undefined;
    const handleUpdated = ({ conversationId, lastMessageAt, lastMessagePreview }) => {
      setConversations((prev) =>
        prev
          .map((c) =>
            c._id === conversationId
              ? {
                  ...c,
                  lastMessageAt,
                  lastMessagePreview,
                  unreadByInternal: c.unreadByInternal + 1,
                }
              : c
          )
          .sort(compareConversations)
      );
    };
    socket.on('conversation:updated', handleUpdated);
    return () => socket.off('conversation:updated', handleUpdated);
  }, [socket]);

  // SLA aşımı tek seferlik bir olay — satırı yerinde güncelle ve bir uyarı ver.
  useEffect(() => {
    if (!socket) return undefined;
    const handleEscalated = ({ conversationId, customerName }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c._id === conversationId
            ? { ...c, status: 'escalated', escalatedAt: new Date().toISOString(), assignedTo: null }
            : c
        )
      );
      Alert.alert('SLA aşıldı', `${customerName} yanıt bekliyor.`);
    };
    socket.on('conversation:escalated', handleEscalated);
    return () => socket.off('conversation:escalated', handleEscalated);
  }, [socket]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const data = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    const now = Date.now();
    return conversations
      .filter((c) => {
        if (planFilter && c.customer?.plan !== planFilter) return false;
        if (slaFilter && getSlaState(c, now).state === 'ok') return false;
        if (!q) return true;
        return [c.customer?.name, c.customer?.company]
          .filter(Boolean)
          .some((f) => f.toLocaleLowerCase('tr').includes(q));
      })
      .sort((a, b) => {
        const diff = priorityRank(a, now) - priorityRank(b, now);
        return diff !== 0 ? diff : compareConversations(a, b);
      });
    // tick bilerek bağımlılıkta: 30sn'de bir SLA sıralaması/rozetleri tazelensin
  }, [conversations, search, planFilter, slaFilter, tick]);

  // Henüz sohbeti olmayan müşteriye dokunulduğunda thread lazily oluşturulur
  // (web ChatDashboard.handleSelectCustomer ile aynı davranış).
  const openConversation = async (row) => {
    let conversation = row;
    if (!row._id) {
      try {
        const res = await chatService.startConversation(row.customer._id);
        conversation = { ...row, _id: res.data.data._id, assignedTo: res.data.data.assignedTo };
        setConversations((prev) =>
          prev.map((c) => (c.customer?._id === row.customer._id ? conversation : c))
        );
      } catch (err) {
        Alert.alert('Açılamadı', err.response?.data?.error || 'Sohbet başlatılamadı.');
        return;
      }
    }
    // Açılan sohbetin rozetini anında sıfırla (markRead isteği ekranda atılır).
    setConversations((prev) =>
      prev.map((c) => (c._id === conversation._id ? { ...c, unreadByInternal: 0 } : c))
    );
    navigation.navigate('Conversation', { conversation });
  };

  const header = (
    <View>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Sohbetler</Text>
          <Text style={styles.subtitle}>Müşterilerle canlı yazışma.</Text>
        </View>
        <View style={styles.connWrap}>
          <View style={[styles.connDot, { backgroundColor: connected ? colors.success : colors.textFaint }]} />
          <Text style={styles.connText}>{connected ? 'Bağlı' : 'Bağlanıyor'}</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Müşteri veya şirket ara..."
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {PLAN_FILTERS.map((p) => {
          const active = p.value === planFilter;
          return (
            <TouchableOpacity
              key={p.value || 'all'}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setPlanFilter(p.value)}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.chip, slaFilter && styles.chipDanger]}
          onPress={() => setSlaFilter((v) => !v)}
          activeOpacity={0.8}
        >
          <Text style={[styles.chipText, slaFilter && styles.chipTextActive]}>SLA riski</Text>
        </TouchableOpacity>
      </ScrollView>
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
        <TouchableOpacity style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.customer?._id}
        renderItem={({ item }) => (
          <ConversationRow item={item} onPress={() => openConversation(item)} />
        )}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Bu filtrede sohbet yok.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: space.xl },
  list: { padding: space.lg, gap: space.sm, paddingBottom: space.xxl },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: font.md, color: colors.textMuted, marginTop: 2 },
  connWrap: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  connDot: { width: 8, height: 8, borderRadius: radius.full },
  connText: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: space.md, height: 48, marginTop: space.lg, marginBottom: space.md,
  },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },

  chipRow: { gap: space.sm, paddingBottom: space.md, paddingRight: space.lg },
  chip: {
    paddingHorizontal: space.md, height: 36, justifyContent: 'center',
    borderRadius: radius.full, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDanger: { backgroundColor: colors.danger, borderColor: colors.danger },
  chipText: { fontSize: font.sm, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: '#fff' },

  row: {
    flexDirection: 'row', gap: space.md, alignItems: 'flex-start',
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md,
    borderWidth: 1, borderColor: colors.border,
  },
  avatar: { width: 46, height: 46, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: font.sm, fontWeight: '800' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowName: { flex: 1, fontSize: font.md, fontWeight: '800', color: colors.text },
  rowTime: { fontSize: font.xs, color: colors.textFaint },
  rowMid: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  planBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.primarySoft },
  planText: { fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.3 },
  slaChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  slaText: { fontSize: 10, fontWeight: '800' },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 4 },
  preview: { flex: 1, fontSize: font.sm, color: colors.textMuted },
  unread: {
    minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: radius.full,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  empty: { textAlign: 'center', color: colors.textMuted, marginTop: space.xl },
  errorText: { color: colors.danger, textAlign: 'center', marginBottom: space.md },
  retry: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md },
  retryText: { color: '#fff', fontWeight: '700' },
});
