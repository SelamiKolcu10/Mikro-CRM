import { useState, useCallback } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import projectService from '../services/projectService';
import ProgressRing from '../components/ProgressRing';
import ProjectFormModal from '../components/ProjectFormModal';
import { useAuth } from '../context/AuthContext';
import { canManageProjects, initialsOf } from '../config/projects';
import { colors, radius, space, font, chartColors } from '../theme';

const AVATAR_LIMIT = 3; // fazlası "+N" olarak toplanır

function ProjectCard({ project, onPress }) {
  const members = project.teamMembers || [];
  const shown = members.slice(0, AVATAR_LIMIT);
  const overflow = members.length - shown.length;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={2}>{project.name}</Text>
        <ProgressRing progress={project.progress || 0} />
      </View>

      {!!(project.techStack || []).length && (
        <View style={styles.chipRow}>
          {project.techStack.map((tech, i) => (
            <View key={`${tech}-${i}`} style={styles.chip}>
              <Text style={styles.chipText}>{tech}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.cardFoot}>
        <View style={styles.avatarRow}>
          {shown.map((m, i) => (
            <View
              key={m._id || i}
              style={[
                styles.avatar,
                { backgroundColor: chartColors[i % chartColors.length], marginLeft: i === 0 ? 0 : -8 },
              ]}
            >
              <Text style={styles.avatarText}>{initialsOf(m.name)}</Text>
            </View>
          ))}
          {overflow > 0 && (
            <View style={[styles.avatar, styles.avatarMore]}>
              <Text style={styles.avatarMoreText}>+{overflow}</Text>
            </View>
          )}
        </View>

        <Text style={styles.taskCount}>
          {project.doneCount ?? 0}/{project.taskCount ?? 0} Görev
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Proje Portföyü — web'deki Projects.jsx'in mobil karşılığı.
 *
 * Yönetici (super_admin / development lideri) tam listeyi görür ve proje
 * oluşturabilir; diğer ekip üyeleri yalnız içinde oldukları projeleri görür
 * (/projects/mine) ve oluşturma butonu gizlenir — backend zaten 403 verir,
 * burada butonu göstermemek sadece boşuna denemeyi engelliyor.
 */
export default function ProjectsScreen({ navigation }) {
  const { session } = useAuth();
  const isManager = canManageProjects(session);

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = isManager ? await projectService.getAll() : await projectService.getMine();
      setProjects(res.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Projeler alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isManager]);

  // Detaydan geri dönüldüğünde ilerleme/ekip değişmiş olabilir — her
  // odaklanmada tazele.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleCreate = async (payload) => {
    try {
      const res = await projectService.create(payload);
      setShowForm(false);
      setProjects((list) => [res.data.data, ...list]);
    } catch (err) {
      Alert.alert('Oluşturulamadı', err.response?.data?.error || 'Proje oluşturulamadı.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.h1}>Proje Portföyü</Text>
          <Text style={styles.h1sub}>Projeleri, tech stack'i ve mimari notları yönetin</Text>
        </View>
        {isManager && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)} activeOpacity={0.85}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {!!error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={projects}
        keyExtractor={(p) => p._id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            onPress={() => navigation.navigate('ProjectDetail', { project: item })}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {isManager ? 'Henüz proje yok. Sağ üstteki + ile oluşturabilirsiniz.' : 'Dahil olduğunuz bir proje yok.'}
          </Text>
        }
      />

      {isManager && (
        <ProjectFormModal
          visible={showForm}
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space.md,
    paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.md,
  },
  headerText: { flex: 1 },
  h1: { fontSize: font.xxl, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  h1sub: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  addBtn: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.dangerSoft, borderRadius: radius.md,
    padding: space.md, marginHorizontal: space.lg, marginBottom: space.md,
  },
  errorText: { flex: 1, fontSize: font.sm, color: colors.danger },

  list: { padding: space.lg, paddingTop: 0, paddingBottom: space.xxl },
  empty: { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', marginTop: space.xxl },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: space.md, marginBottom: space.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  cardTitle: { flex: 1, fontSize: font.lg, fontWeight: '800', color: colors.text },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  chip: {
    backgroundColor: colors.primarySoft, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.primary },

  cardFoot: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: space.md, paddingTop: space.md,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 28, height: 28, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.surface,
  },
  avatarText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  avatarMore: { backgroundColor: colors.bg, marginLeft: -8 },
  avatarMoreText: { fontSize: 10, fontWeight: '800', color: colors.textMuted },

  taskCount: { fontSize: font.xs, fontWeight: '600', color: colors.textMuted },
});
