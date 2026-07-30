import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';
import { notificationMeta, timeAgo } from '../config/notifications';
import { colors, radius, space, font } from '../theme';

/**
 * Bildirimler listesi. Bir bildirime dokunmak onu okundu işaretler ve —
 * türünün mobilde karşılığı varsa — ilgili ekrana götürür.
 *
 * Backend `link` alanında web yolunu tutuyor; onu ayrıştırmak yerine türden
 * hedefe eşliyoruz (bkz. config/notifications.js). Karşılığı olmayan türler
 * (ör. çekmecede duran Onay Kuyruğu) yalnız okundu işaretlenir.
 */
export default function NotificationsScreen({ navigation }) {
  const { items, unreadCount, loading, refresh, markRead, markAllRead } = useNotifications();

  const open = (item) => {
    if (!item.isRead) markRead(item._id);
    const meta = notificationMeta(item.type);
    if (meta.tab && meta.screen) {
      navigation.navigate('Home', { screen: meta.tab, params: { screen: meta.screen } });
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Bildirimler</Text>
          <Text style={styles.h1sub}>
            {unreadCount > 0 ? `${unreadCount} okunmamış bildirim` : 'Tümü okundu'}
          </Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.readAllBtn} onPress={markAllRead} activeOpacity={0.85}>
            <Ionicons name="checkmark-done" size={15} color={colors.primary} />
            <Text style={styles.readAllText}>Tümünü okundu yap</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && items.length === 0 ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: space.xl }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={32} color={colors.textFaint} />
              <Text style={styles.emptyText}>Henüz bildirim yok.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const meta = notificationMeta(item.type);
            return (
              <TouchableOpacity
                style={[styles.card, !item.isRead && styles.cardUnread]}
                onPress={() => open(item)}
                activeOpacity={0.85}
              >
                <View style={[styles.icon, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon} size={18} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, !item.isRead && styles.titleUnread]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {!item.isRead && <View style={styles.dot} />}
                  </View>
                  <Text style={styles.message}>{item.message}</Text>
                  <Text style={styles.time}>
                    {meta.label} · {timeAgo(item.createdAt)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  head: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space.md,
    paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.md,
  },
  h1: { fontSize: font.xxl, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  h1sub: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  readAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: space.md, height: 34, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  readAllText: { fontSize: font.xs, fontWeight: '700', color: colors.primary },

  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  empty: { alignItems: 'center', gap: space.sm, marginTop: space.xxl },
  emptyText: { fontSize: font.sm, color: colors.textMuted },

  card: {
    flexDirection: 'row', gap: space.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: space.md, marginBottom: space.sm,
  },
  cardUnread: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  icon: {
    width: 36, height: 36, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, fontSize: font.sm, fontWeight: '700', color: colors.text },
  titleUnread: { fontWeight: '800' },
  dot: { width: 7, height: 7, borderRadius: radius.full, backgroundColor: colors.primary },
  message: { fontSize: font.sm, color: colors.textMuted, lineHeight: 19, marginTop: 2 },
  time: { fontSize: font.xs, color: colors.textFaint, marginTop: 4 },
});
