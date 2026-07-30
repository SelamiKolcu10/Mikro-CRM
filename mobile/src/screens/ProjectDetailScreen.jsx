import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import projectService from '../services/projectService';
import ProjectFormModal from '../components/ProjectFormModal';
import ProgressRing from '../components/ProgressRing';
import { useAuth } from '../context/AuthContext';
import { canManageProjects, canEditProject, canCommentOnProject, initialsOf } from '../config/projects';
import { statusMeta } from '../config/tasks';
import { DEPARTMENT_LABEL } from '../config/departments';
import { formatDate } from '../utils/format';
import { colors, radius, space, font, chartColors } from '../theme';

const TABS = [
  { key: 'notes', label: 'Mimari Notlar', icon: 'document-text-outline' },
  { key: 'team', label: 'Ekip', icon: 'people-outline' },
  { key: 'tasks', label: 'Görevler', icon: 'checkbox-outline' },
  { key: 'chat', label: 'Sohbet', icon: 'chatbox-ellipses-outline' },
];

const timeOf = (d) => {
  try {
    return new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

/**
 * Proje detayı — referanstaki "Proje Detayı" ve "Proje Odası" ekranlarının
 * tek ekranda sekmelenmiş hali.
 *
 * Veri yolu yetkiye göre ayrışıyor: yönetici projeyi /:id ile tazeleyebilir,
 * ekip üyesi o uca erişemez (403) — onun için listeden gelen route params
 * kullanılır. Görevler ve yorumlar her iki rol için de açık
 * (requireProjectViewer).
 */
export default function ProjectDetailScreen({ route, navigation }) {
  const { session } = useAuth();
  const [project, setProject] = useState(route.params.project);
  const isManager = canManageProjects(session);
  const canEdit = canEditProject(session, project);
  const canComment = canCommentOnProject(session);

  const [tab, setTab] = useState('notes');
  const [showForm, setShowForm] = useState(false);

  const [notesDraft, setNotesDraft] = useState(project.architectureNotes || '');
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const [tasks, setTasks] = useState([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);

  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const listRef = useRef(null);

  useEffect(() => {
    navigation.setOptions({ title: project.name || 'Proje' });
  }, [navigation, project.name]);

  // Sekmeler ilk açıldıklarında yüklenir — detay açılır açılmaz üç istek
  // birden atmanın anlamı yok.
  const loadTasks = useCallback(async () => {
    try {
      const res = await projectService.getTasks(project._id);
      setTasks(res.data.data || []);
    } catch {
      setTasks([]);
    } finally {
      setTasksLoaded(true);
    }
  }, [project._id]);

  const loadComments = useCallback(async () => {
    try {
      const res = await projectService.getComments(project._id);
      setComments(res.data.data || []);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoaded(true);
    }
  }, [project._id]);

  useEffect(() => {
    if (tab === 'tasks' && !tasksLoaded) loadTasks();
    if (tab === 'chat' && !commentsLoaded) loadComments();
  }, [tab, tasksLoaded, commentsLoaded, loadTasks, loadComments]);

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      const res = await projectService.update(project._id, { architectureNotes: notesDraft });
      setProject(res.data.data);
      setEditingNotes(false);
    } catch (err) {
      Alert.alert('Kaydedilemedi', err.response?.data?.error || 'Mimari notlar kaydedilemedi.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleEdit = async (payload) => {
    try {
      const res = await projectService.update(project._id, payload);
      setProject(res.data.data);
      setShowForm(false);
    } catch (err) {
      Alert.alert('Kaydedilemedi', err.response?.data?.error || 'Proje güncellenemedi.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Projeyi sil',
      `"${project.name}" kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await projectService.remove(project._id);
              navigation.goBack();
            } catch (err) {
              Alert.alert('Silinemedi', err.response?.data?.error || 'Proje silinemedi.');
            }
          },
        },
      ]
    );
  };

  const sendComment = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await projectService.addComment(project._id, text);
      setComments((list) => [...list, res.data.data]);
      setDraft('');
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      Alert.alert('Gönderilemedi', err.response?.data?.error || 'Yorum gönderilemedi.');
    } finally {
      setSending(false);
    }
  };

  const members = project.teamMembers || [];

  return (
    <View style={styles.screen}>
      {/* Başlık + yönetim aksiyonları */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={2}>{project.name}</Text>
          <Text style={styles.subtitle}>
            {project.doneCount ?? 0}/{project.taskCount ?? 0} görev tamamlandı
          </Text>
        </View>
        <ProgressRing progress={project.progress || 0} size={52} />
        {canEdit && (
          <TouchableOpacity onPress={() => setShowForm(true)} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="pencil-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        {isManager && (
          <TouchableOpacity onPress={handleDelete} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>

      {/* Sekmeler */}
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.7}
            >
              <Ionicons name={t.icon} size={15} color={active ? colors.primary : colors.textMuted} />
              <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* --- Mimari Notlar --- */}
      {tab === 'notes' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mimari Wiki</Text>
            {canEdit && !editingNotes && (
              <TouchableOpacity
                style={styles.smallBtn}
                onPress={() => { setNotesDraft(project.architectureNotes || ''); setEditingNotes(true); }}
                activeOpacity={0.85}
              >
                <Ionicons name="pencil-outline" size={14} color={colors.primary} />
                <Text style={styles.smallBtnText}>Düzenle</Text>
              </TouchableOpacity>
            )}
          </View>

          {editingNotes ? (
            <>
              <TextInput
                style={styles.notesInput}
                value={notesDraft}
                onChangeText={setNotesDraft}
                multiline
                textAlignVertical="top"
                placeholder="Markdown yazabilirsiniz…"
                placeholderTextColor={colors.textFaint}
                editable={!savingNotes}
              />
              <View style={styles.notesActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setEditingNotes(false)}
                  disabled={savingNotes}
                >
                  <Text style={styles.cancelText}>Vazgeç</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, savingNotes && styles.disabled]}
                  onPress={saveNotes}
                  disabled={savingNotes}
                  activeOpacity={0.85}
                >
                  {savingNotes ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.primaryText}>Kaydet</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.card}>
              {project.architectureNotes ? (
                // Markdown kaynağı olduğu gibi gösteriliyor — mobilde henüz
                // render edici yok (webde react-markdown var).
                <Text style={styles.notesText}>{project.architectureNotes}</Text>
              ) : (
                <Text style={styles.empty}>Henüz mimari not yazılmamış.</Text>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* --- Ekip --- */}
      {tab === 'team' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {!!(project.techStack || []).length && (
            <>
              <Text style={styles.sectionTitle}>Teknolojiler</Text>
              <View style={styles.chipRow}>
                {project.techStack.map((t, i) => (
                  <View key={`${t}-${i}`} style={styles.chip}>
                    <Text style={styles.chipText}>{t}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={[styles.sectionTitle, { marginTop: space.lg }]}>Ekip Üyeleri</Text>
          <View style={styles.card}>
            {members.length === 0 ? (
              <Text style={styles.empty}>Ekip üyesi atanmamış.</Text>
            ) : (
              members.map((m, i) => {
                const isLead = String(project.projectLead?._id || project.projectLead || '') === String(m._id);
                return (
                  <View key={m._id || i} style={[styles.memberRow, i > 0 && styles.divider]}>
                    <View style={[styles.avatar, { backgroundColor: chartColors[i % chartColors.length] }]}>
                      <Text style={styles.avatarText}>{initialsOf(m.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName} numberOfLines={1}>{m.name}</Text>
                      {!!m.department && (
                        <Text style={styles.memberMeta}>
                          {DEPARTMENT_LABEL[m.department] || m.department}
                        </Text>
                      )}
                    </View>
                    {isLead && (
                      <View style={styles.leadChip}>
                        <Text style={styles.leadChipText}>Lider</Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      {/* --- Görevler --- */}
      {tab === 'tasks' && (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {!tasksLoaded ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: space.xl }} />
          ) : (
            <View style={styles.card}>
              {tasks.length === 0 ? (
                <Text style={styles.empty}>Bu projeye bağlı görev yok.</Text>
              ) : (
                tasks.map((t, i) => {
                  const st = statusMeta(t.status);
                  return (
                    <View key={t._id || i} style={[styles.taskRow, i > 0 && styles.divider]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.taskTitle} numberOfLines={2}>{t.title}</Text>
                        <Text style={styles.memberMeta}>
                          {t.assignedTo?.name || 'Atanmamış'}
                          {t.deadline ? ` · ${formatDate(t.deadline)}` : ''}
                        </Text>
                      </View>
                      <View style={[styles.statusChip, { backgroundColor: st.bg }]}>
                        <Text style={[styles.statusChipText, { color: st.fg }]}>{st.label}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* --- Sohbet (proje tartışması) --- */}
      {tab === 'chat' && (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={90}
        >
          {!commentsLoaded ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: space.xl }} />
          ) : (
            <FlatList
              ref={listRef}
              data={comments}
              keyExtractor={(c, i) => c._id || String(i)}
              contentContainerStyle={styles.chatContent}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              ListHeaderComponent={
                <Text style={styles.roomTag}>
                  #{String(project.name || '').toLowerCase().replace(/\s+/g, '-')}
                </Text>
              }
              ListEmptyComponent={<Text style={styles.empty}>Henüz mesaj yok.</Text>}
              renderItem={({ item }) => {
                const mine = String(item.user?._id || item.user) === String(session?._id);
                return (
                  <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                      {!mine && (
                        <Text style={styles.bubbleAuthor}>{item.user?.name || 'Bilinmeyen'}</Text>
                      )}
                      <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.text}</Text>
                      <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                        {timeOf(item.createdAt)}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
          )}

          {canComment ? (
            <View style={styles.composer}>
              <TextInput
                style={styles.composerInput}
                value={draft}
                onChangeText={setDraft}
                placeholder="Bir yorum yazın..."
                placeholderTextColor={colors.textFaint}
                multiline
                editable={!sending}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!draft.trim() || sending) && styles.disabled]}
                onPress={sendComment}
                disabled={!draft.trim() || sending}
                activeOpacity={0.85}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.readOnly}>Yorum yazma yetkiniz yok.</Text>
          )}
        </KeyboardAvoidingView>
      )}

      {canEdit && (
        <ProjectFormModal
          visible={showForm}
          project={project}
          onSubmit={handleEdit}
          onClose={() => setShowForm(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md,
    backgroundColor: colors.surface,
  },
  headerText: { flex: 1 },
  title: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  iconBtn: { padding: 4 },

  tabBar: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: space.md, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  tabTextActive: { color: colors.primary },

  body: { flex: 1 },
  bodyContent: { padding: space.lg, paddingBottom: space.xxl },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: space.md,
  },
  sectionTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },

  smallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: space.md, height: 32, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  smallBtnText: { fontSize: font.xs, fontWeight: '700', color: colors.primary },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: space.md,
  },
  empty: { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: space.lg },

  notesText: { fontSize: font.sm, color: colors.text, lineHeight: 22 },
  notesInput: {
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, padding: space.md, minHeight: 240,
    fontSize: font.sm, color: colors.text, lineHeight: 21,
  },
  notesActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.md },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  chip: {
    backgroundColor: colors.primarySoft, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.primary },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  avatar: {
    width: 34, height: 34, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  memberName: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  memberMeta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  leadChip: {
    backgroundColor: colors.primarySoft, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  leadChipText: { fontSize: 10, fontWeight: '800', color: colors.primary },

  taskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.md },
  taskTitle: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  statusChipText: { fontSize: 10, fontWeight: '800' },

  chatContent: { padding: space.lg, flexGrow: 1 },
  roomTag: {
    fontSize: font.xs, color: colors.textMuted, marginBottom: space.md,
    paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  bubbleRow: { flexDirection: 'row', marginBottom: space.md },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.sm },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: radius.sm },
  bubbleOther: {
    backgroundColor: colors.surface, borderBottomLeftRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  bubbleAuthor: { fontSize: font.xs, fontWeight: '800', color: colors.primary, marginBottom: 2 },
  bubbleText: { fontSize: font.sm, color: colors.text, lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  bubbleTime: { fontSize: 10, color: colors.textFaint, marginTop: 4, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.75)' },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: space.sm,
    padding: space.md, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  composerInput: {
    flex: 1, maxHeight: 110, minHeight: 44,
    backgroundColor: colors.bg, borderRadius: radius.lg,
    paddingHorizontal: space.md, paddingTop: 12, paddingBottom: 12,
    fontSize: font.sm, color: colors.text,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  readOnly: {
    fontSize: font.xs, color: colors.textMuted, textAlign: 'center',
    paddingVertical: space.md, backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },

  cancelBtn: {
    paddingHorizontal: space.lg, height: 44, justifyContent: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  cancelText: { fontSize: font.md, fontWeight: '600', color: colors.textMuted },
  primaryBtn: {
    minWidth: 104, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, backgroundColor: colors.primary,
  },
  primaryText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
