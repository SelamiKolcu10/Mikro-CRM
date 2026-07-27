import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import chatService from '../services/chatService';
import { useConversation } from '../hooks/useConversation';
import { useAuth } from '../context/AuthContext';
import MessageBubble from '../components/chat/MessageBubble';
import MessageInput from '../components/chat/MessageInput';
import { PLAN_LABEL, SLA_STYLE, computeAvgResponseMinutes, canWriteChat } from '../config/chat';
import { getSlaState, formatSlaDuration } from '../utils/sla';
import { colors, radius, space, font } from '../theme';

export default function ConversationScreen({ route, navigation }) {
  const { session } = useAuth();
  const canWrite = canWriteChat(session?.role);

  // Liste ekranı satırın tamamını geçiriyor (müşteri + sohbet meta verisi).
  const [conversation] = useState(route.params.conversation);
  const conversationId = conversation?._id || null;
  const customer = conversation?.customer;

  const listRef = useRef(null);

  const { messages, loading, connected, send, retry } = useConversation({
    conversationId,
    viewerType: 'internal',
    fetchMessages: useCallback(() => chatService.getMessages(conversationId), [conversationId]),
    sendMessage: useCallback(
      (body, clientId) => chatService.sendMessage(conversationId, body, clientId),
      [conversationId]
    ),
    markRead: useCallback(() => chatService.markRead(conversationId), [conversationId]),
  });

  const avgResponseMinutes = useMemo(() => computeAvgResponseMinutes(messages), [messages]);
  const sla = getSlaState(conversation);
  const slaStyle = SLA_STYLE[sla.state];

  // Başlıkta müşteri adı; sağdaki düğme profil ekranına götürür.
  useEffect(() => {
    navigation.setOptions({
      title: customer?.name || 'Sohbet',
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('CustomerProfile', { conversation, avgResponseMinutes })}
          hitSlop={10}
        >
          <Ionicons name="person-circle-outline" size={26} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, customer, conversation, avgResponseMinutes]);

  // Dahili not — ekranda görünmesi backend'in STAFF_ROOM'a yaydığı mevcut
  // 'message:new' olayı üzerinden gelir, ayrıca listeye eklemeye gerek yok.
  const handleAddNote = async (body) => {
    try {
      await chatService.addNote(conversationId, body);
    } catch (err) {
      Alert.alert('Not eklenemedi', err.response?.data?.error || 'Bir hata oluştu.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Üst şerit — bağlantı durumu, plan ve ortalama yanıt süresi */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topLeft}
          onPress={() => navigation.navigate('CustomerProfile', { conversation, avgResponseMinutes })}
          activeOpacity={0.7}
        >
          <View style={[styles.connDot, { backgroundColor: connected ? colors.success : colors.textFaint }]} />
          <Text style={styles.topName} numberOfLines={1}>{customer?.name}</Text>
          <View style={styles.planBadge}>
            <Text style={styles.planText}>
              {(PLAN_LABEL[customer?.plan] || customer?.plan || '').toUpperCase()}
            </Text>
          </View>
        </TouchableOpacity>

        {slaStyle ? (
          <View style={[styles.slaChip, { backgroundColor: slaStyle.bg }]}>
            <Text style={[styles.slaText, { color: slaStyle.fg }]}>
              {slaStyle.label} · {formatSlaDuration(sla.minutesRemaining)}
            </Text>
          </View>
        ) : (
          <Text style={styles.avgText}>
            Ort. yanıt: {avgResponseMinutes !== null ? `${avgResponseMinutes}dk` : '—'}
          </Text>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m._id)}
          renderItem={({ item }) => (
            <MessageBubble message={item} isMine={item.senderType === 'internal'} onRetry={retry} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={<Text style={styles.empty}>Henüz mesaj yok.</Text>}
        />
      )}

      {/* intern rolü sohbeti okur ama asla mesaj gönderemez (backend de reddeder) */}
      {canWrite ? (
        <MessageInput onSend={send} onSendNote={handleAddNote} disabled={!conversationId} />
      ) : (
        <View style={styles.readOnly}>
          <Ionicons name="eye-outline" size={15} color={colors.textMuted} />
          <Text style={styles.readOnlyText}>Bu sohbette yalnızca görüntüleme yetkin var.</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: space.md, paddingBottom: space.lg },

  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: space.md, paddingVertical: space.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  topLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  connDot: { width: 8, height: 8, borderRadius: radius.full },
  topName: { flexShrink: 1, fontSize: font.sm, fontWeight: '800', color: colors.text },
  planBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.primarySoft },
  planText: { fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.3 },
  slaChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full },
  slaText: { fontSize: 10, fontWeight: '800' },
  avgText: { fontSize: font.xs, color: colors.textFaint },

  empty: { textAlign: 'center', color: colors.textMuted, marginTop: space.xl },

  readOnly: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    paddingVertical: space.md, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  readOnlyText: { fontSize: font.sm, color: colors.textMuted },
});
