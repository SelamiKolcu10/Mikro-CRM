import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';

const formatTime = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

/**
 * Tek mesaj balonu — web'deki components/chat/MessageBubble.jsx'in karşılığı.
 * `senderType: 'note'` dahili nottur: müşteriye ASLA gösterilmez (backend
 * yalnız STAFF_ROOM'a yayınlar), bu yüzden sola/sağa hizalanmaz, tam genişlik
 * ayrı bir kart olarak çizilir.
 */
export default function MessageBubble({ message, isMine, onRetry }) {
  if (message.senderType === 'note') {
    return (
      <View style={styles.noteCard}>
        <View style={styles.noteHeader}>
          <Ionicons name="lock-closed-outline" size={13} color="#B45309" />
          <Text style={styles.noteLabel}>Dahili not</Text>
          <Text style={styles.noteAuthor} numberOfLines={1}>
            {message.senderName} · {formatTime(message.createdAt)}
          </Text>
        </View>
        <Text style={styles.noteBody}>{message.body}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      <View
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
          message._pending && styles.pending,
        ]}
      >
        {!isMine && !!message.senderName && (
          <Text style={styles.sender}>{message.senderName}</Text>
        )}
        <Text style={[styles.body, isMine && styles.bodyMine]}>{message.body}</Text>

        <View style={styles.metaRow}>
          {message._failed ? (
            <TouchableOpacity style={styles.retry} onPress={() => onRetry(message)} hitSlop={6}>
              <Ionicons name="alert-circle-outline" size={13} color={colors.danger} />
              <Text style={styles.retryText}>Tekrar dene</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.time, isMine && styles.timeMine]}>
              {message._pending ? '…' : formatTime(message.createdAt)}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: space.sm },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },

  bubble: { maxWidth: '80%', paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.lg },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  bubbleTheirs: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: radius.sm,
  },
  pending: { opacity: 0.6 },

  sender: { fontSize: 11, fontWeight: '800', color: colors.primary, marginBottom: 2 },
  body: { fontSize: font.md, color: colors.text, lineHeight: 21 },
  bodyMine: { color: '#fff' },

  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 3 },
  time: { fontSize: 10, color: colors.textFaint },
  timeMine: { color: 'rgba(255,255,255,0.75)' },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  retryText: { fontSize: 11, fontWeight: '700', color: colors.danger },

  noteCard: {
    backgroundColor: colors.warnSoft,
    borderWidth: 1,
    borderColor: '#F5D9A8',
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
  },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  noteLabel: { fontSize: 11, fontWeight: '800', color: '#B45309' },
  noteAuthor: { flex: 1, fontSize: 10, color: '#B45309', textAlign: 'right' },
  noteBody: { fontSize: font.sm, color: colors.text, lineHeight: 20 },
});
