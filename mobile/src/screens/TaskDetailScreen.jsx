import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import taskService from '../services/taskService';
import { useTaskComments } from '../hooks/useTaskComments';
import { useAuth } from '../context/AuthContext';
import {
  STATUSES,
  STATUS,
  DEPARTMENT_LABEL,
  priorityMeta,
  statusMeta,
  canActOnTask,
  canApproveTask,
  canCommentOnTask,
  avatarColor,
  avatarInitials,
} from '../config/tasks';
import { formatDate } from '../utils/format';
import { colors, radius, space, font } from '../theme';

const formatDateTime = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString('tr-TR');
  } catch {
    return '';
  }
};

function Avatar({ user, size = 28 }) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, backgroundColor: avatarColor(user?._id) },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>
        {avatarInitials(user?.name)}
      </Text>
    </View>
  );
}

export default function TaskDetailScreen({ route, navigation }) {
  const { session } = useAuth();
  const [task, setTask] = useState(route.params.task);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const { comments, loading: loadingComments, addComment } = useTaskComments(task._id);

  const canAct = canActOnTask(session, task);
  const canApprove = canApproveTask(session, task);
  const canComment = canCommentOnTask(session);

  useEffect(() => {
    navigation.setOptions({ title: 'Görev Detayı' });
  }, [navigation]);

  // "Tamamlandı"ya taşımak onay yetkisi ister; diğer geçişler için görevde
  // aksiyon alabilmek yeterli (backend updateTaskStatus ile aynı kural).
  const availableStatuses = STATUSES.filter((s) => {
    if (s === task.status) return false;
    return s === 'done' ? canApprove : canAct;
  });

  const handleStatusChange = async (status) => {
    setBusy(true);
    try {
      const res = await taskService.updateStatus(task._id, status);
      setTask(res.data.data);
    } catch (err) {
      Alert.alert('Güncellenemedi', err.response?.data?.error || 'Bir hata oluştu.');
    } finally {
      setBusy(false);
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await addComment(trimmed);
      setText('');
    } catch (err) {
      Alert.alert('Gönderilemedi', err.response?.data?.error || 'Bir hata oluştu.');
    } finally {
      setSending(false);
    }
  };

  const pr = priorityMeta(task.priority);
  const st = statusMeta(task.status);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{task.title}</Text>

        <View style={styles.tagRow}>
          <View style={[styles.chip, { backgroundColor: pr.bg }]}>
            <Text style={[styles.chipText, { color: pr.fg }]}>{pr.label}</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: st.bg }]}>
            <Text style={[styles.chipText, { color: st.fg }]}>{st.label}</Text>
          </View>
          <View style={styles.deptChip}>
            <Text style={styles.deptChipText}>
              {DEPARTMENT_LABEL[task.department] || task.department}
            </Text>
          </View>
          {!!task.projectId?.name && (
            <View style={styles.projectChip}>
              <Text style={styles.projectChipText}>{task.projectId.name}</Text>
            </View>
          )}
        </View>

        <View style={styles.assigneeRow}>
          <Avatar user={task.assignedTo} />
          <Text style={styles.assigneeName}>{task.assignedTo?.name || '—'}</Text>
          {!!task.deadline && (
            <View style={styles.deadlineRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
              <Text style={styles.deadline}>{formatDate(task.deadline)}</Text>
            </View>
          )}
        </View>

        {!!task.description && (
          <View style={styles.descCard}>
            <Text style={styles.descText}>{task.description}</Text>
          </View>
        )}

        {availableStatuses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ŞU DURUMA TAŞI</Text>
            <View style={styles.statusBtnRow}>
              {availableStatuses.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusBtn, busy && styles.disabled]}
                  onPress={() => handleStatusChange(s)}
                  disabled={busy}
                  activeOpacity={0.8}
                >
                  <Text style={styles.statusBtnText}>{STATUS[s].label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AKTİVİTE VE YORUMLAR</Text>
          {loadingComments ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: space.md }} />
          ) : comments.length === 0 ? (
            <Text style={styles.empty}>Henüz yorum yok.</Text>
          ) : (
            <View style={styles.commentList}>
              {comments.map((c) => (
                <View key={c._id} style={styles.commentItem}>
                  <Avatar user={c.user} size={30} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.commentMeta}>
                      <Text style={styles.commentAuthor}>{c.user?.name || '—'}</Text>
                      <Text style={styles.commentTime}>{formatDateTime(c.createdAt)}</Text>
                    </View>
                    <Text style={styles.commentText}>{c.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Yorum yazma intern'e kapalı (backend addTaskComment ile aynı kural) */}
      {canComment && (
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Bir yorum yazın..."
            placeholderTextColor={colors.textFaint}
            maxLength={1000}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.disabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={17} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xl },

  title: { fontSize: font.xl, fontWeight: '800', color: colors.text, lineHeight: 27 },

  tagRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: space.md },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  chipText: { fontSize: 11, fontWeight: '800' },
  deptChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, backgroundColor: '#EEF1F4' },
  deptChipText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  projectChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.primarySoft },
  projectChipText: { fontSize: 11, fontWeight: '700', color: colors.primary },

  assigneeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  avatar: { borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  assigneeName: { flex: 1, fontSize: font.sm, fontWeight: '700', color: colors.text },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deadline: { fontSize: font.xs, color: colors.textMuted },

  descCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: space.md, marginTop: space.md,
  },
  descText: { fontSize: font.sm, color: colors.text, lineHeight: 21 },

  section: { marginTop: space.xl },
  sectionLabel: { fontSize: font.xs, fontWeight: '800', color: colors.textFaint, letterSpacing: 0.6, marginBottom: space.sm },

  statusBtnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  statusBtn: {
    paddingHorizontal: space.md, height: 40, justifyContent: 'center',
    borderRadius: radius.md, backgroundColor: colors.primarySoft,
  },
  statusBtnText: { fontSize: font.sm, fontWeight: '700', color: colors.primary },
  disabled: { opacity: 0.5 },

  commentList: { gap: space.md },
  commentItem: { flexDirection: 'row', gap: space.sm },
  commentMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  commentAuthor: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  commentTime: { fontSize: font.xs, color: colors.textFaint },
  commentText: { fontSize: font.sm, color: colors.textMuted, lineHeight: 20, marginTop: 2 },
  empty: { fontSize: font.sm, color: colors.textMuted, paddingVertical: space.md },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: space.sm,
    paddingHorizontal: space.md, paddingVertical: space.sm,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 110,
    paddingHorizontal: space.md, paddingTop: 10, paddingBottom: 10,
    borderRadius: radius.lg, backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border,
    fontSize: font.md, color: colors.text,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary,
  },
});
