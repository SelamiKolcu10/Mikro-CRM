import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';
import { colors, radius, space, font } from '../theme';

/**
 * Başlık çubuğundaki bildirim çanı + okunmamış rozeti.
 * Her sekme stack'inin kökünde headerRight olarak kullanılır.
 */
export default function NotificationBell({ onPress }) {
  const { unreadCount } = useNotifications();

  return (
    <TouchableOpacity onPress={onPress} hitSlop={10} style={styles.btn} activeOpacity={0.7}>
      <Ionicons name="notifications-outline" size={23} color={colors.text} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { paddingHorizontal: space.xs, paddingVertical: 2 },
  badge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 17, height: 17, borderRadius: radius.full,
    backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: colors.surface,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
