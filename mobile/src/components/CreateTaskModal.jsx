import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SelectField from './SelectField';
import projectService from '../services/projectService';
import { useAuth } from '../context/AuthContext';
import { DEPARTMENTS, DEPARTMENT_LABEL, PRIORITIES, priorityMeta } from '../config/tasks';
import { canManageProjects } from '../config/projects';
import { toLocalISODate } from '../utils/dayBucket';
import { colors, radius, space, font } from '../theme';

const emptyForm = () => ({
  title: '',
  description: '',
  department: '',
  assignedTo: '',
  priority: 'medium',
  deadline: '',
  projectId: '',
});

// GG.AA.YYYY → 'YYYY-MM-DD'; geçersizse null (TaskDateModal ile aynı ayrıştırma).
const displayToIso = (s) => {
  const m = s.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (d.getFullYear() !== Number(yyyy) || d.getMonth() !== Number(mm) - 1 || d.getDate() !== Number(dd)) {
    return null;
  }
  return toLocalISODate(d);
};

/**
 * Görev Oluştur — web'deki CreateTaskModal.jsx'in mobil karşılığı (proje
 * bağlamlı modu hariç, o akış mobilde yok).
 *
 * Departman kuralı backend createTask ile aynı: super_admin her departmana
 * atayabilir, departman lideri yalnız kendi departmanına — o yüzden lider için
 * alan kilitli gelir. Atanabilir kişiler seçilen departmana göre
 * /tasks/assignable-users'tan çekilir.
 */
export default function CreateTaskModal({ visible, onCreate, getAssignableUsers, onClose }) {
  const { session } = useAuth();
  const isSuperAdmin = session?.role === 'super_admin';
  const showProjectField = canManageProjects(session);

  const [form, setForm] = useState(emptyForm());
  const [assignable, setAssignable] = useState([]);
  const [loadingAssignable, setLoadingAssignable] = useState(false);
  const [projects, setProjects] = useState([]);
  const [saving, setSaving] = useState(false);

  const authorizedDepartments = isSuperAdmin
    ? DEPARTMENTS
    : session?.isDepartmentLead && session?.department
      ? [session.department]
      : [];

  const loadAssignable = useCallback(
    (department) => {
      if (!department) {
        setAssignable([]);
        return;
      }
      setLoadingAssignable(true);
      getAssignableUsers(department)
        .then(setAssignable)
        .catch(() => setAssignable([]))
        .finally(() => setLoadingAssignable(false));
    },
    [getAssignableUsers]
  );

  // Modal her açıldığında formu sıfırla ve ilgili departmanın üyelerini BURADA
  // çek: departman lideri için department her açılışta aynı string olduğundan
  // aşağıdaki [form.department] effect'i ikinci açılışta hiç çalışmaz ve liste
  // boş kalırdı (web'de de aynı tuzak vardı).
  useEffect(() => {
    if (!visible) return;
    const department = isSuperAdmin ? '' : session?.department || '';
    setForm({ ...emptyForm(), department });
    loadAssignable(department);
  }, [visible, isSuperAdmin, session?.department, loadAssignable]);

  // super_admin modal açıkken departmanı değiştirirse liste tazelensin.
  useEffect(() => {
    if (!visible || !isSuperAdmin) return;
    loadAssignable(form.department);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.department]);

  // Proje listesi yalnız seçici görünürken çekilir — yetkisi olmayan zaten
  // /api/projects'e erişemez.
  useEffect(() => {
    if (!visible || !showProjectField) return;
    projectService
      .getAll()
      .then((res) => setProjects(res.data.data || []))
      .catch(() => setProjects([]));
  }, [visible, showProjectField]);

  const setField = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    const title = form.title.trim();
    if (title.length < 2) {
      Alert.alert('Eksik bilgi', 'Başlık en az 2 karakter olmalı.');
      return;
    }
    if (!form.department) {
      Alert.alert('Eksik bilgi', 'Departman seçin.');
      return;
    }
    if (!form.assignedTo) {
      Alert.alert('Eksik bilgi', 'Görevi atayacağın kişiyi seçin.');
      return;
    }

    let deadline = null;
    if (form.deadline.trim()) {
      deadline = displayToIso(form.deadline);
      if (!deadline) {
        Alert.alert('Geçersiz tarih', 'Bitiş tarihini GG.AA.YYYY biçiminde girin.');
        return;
      }
    }

    setSaving(true);
    try {
      await onCreate({
        title,
        description: form.description.trim() || undefined,
        department: form.department,
        assignedTo: form.assignedTo,
        priority: form.priority,
        deadline,
        projectId: form.projectId || undefined,
      });
      onClose();
    } catch (err) {
      Alert.alert('Oluşturulamadı', err.response?.data?.error || 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const departmentOptions = authorizedDepartments.map((d) => ({
    value: d,
    label: DEPARTMENT_LABEL[d],
  }));
  const assigneeOptions = assignable.map((u) => ({ value: u._id, label: u.name }));
  const priorityOptions = PRIORITIES.map((p) => ({ value: p, label: priorityMeta(p).label }));
  const projectOptions = [
    { value: '', label: 'Proje seçilmedi' },
    ...projects.map((p) => ({ value: p._id, label: p.name })),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Görev Oluştur</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {authorizedDepartments.length === 0 ? (
              <Text style={styles.hint}>
                Görev oluşturma yetkin yok — bu yalnızca süper admin ve departman
                liderlerine açık.
              </Text>
            ) : (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Başlık *</Text>
                  <TextInput
                    style={styles.input}
                    value={form.title}
                    onChangeText={setField('title')}
                    placeholder="Görev başlığı"
                    placeholderTextColor={colors.textFaint}
                    maxLength={150}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Açıklama</Text>
                  <TextInput
                    style={[styles.input, styles.textarea]}
                    value={form.description}
                    onChangeText={setField('description')}
                    placeholder="Kısa açıklama"
                    placeholderTextColor={colors.textFaint}
                    maxLength={2000}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                {/* Lider için tek seçenek var; SelectField yine de değeri gösterir. */}
                <SelectField
                  label="Departman *"
                  value={form.department}
                  placeholder="Departman seçin"
                  options={departmentOptions}
                  onSelect={(v) => setForm((f) => ({ ...f, department: v, assignedTo: '' }))}
                />

                <SelectField
                  label="Atanan Kişi *"
                  value={form.assignedTo}
                  placeholder={
                    !form.department
                      ? 'Önce departman seçin'
                      : loadingAssignable
                        ? 'Yükleniyor...'
                        : 'Kişi seçin'
                  }
                  options={assigneeOptions}
                  onSelect={setField('assignedTo')}
                />

                <SelectField
                  label="Öncelik"
                  value={form.priority}
                  options={priorityOptions}
                  onSelect={setField('priority')}
                />

                <View style={styles.field}>
                  <Text style={styles.label}>Bitiş Tarihi</Text>
                  <TextInput
                    style={styles.input}
                    value={form.deadline}
                    onChangeText={setField('deadline')}
                    placeholder="GG.AA.YYYY (opsiyonel)"
                    placeholderTextColor={colors.textFaint}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>

                {showProjectField && (
                  <SelectField
                    label="Proje"
                    value={form.projectId}
                    placeholder="Proje seçilmedi"
                    options={projectOptions}
                    onSelect={setField('projectId')}
                  />
                )}
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                (saving || authorizedDepartments.length === 0) && styles.saveDisabled,
              ]}
              onPress={handleSave}
              disabled={saving || authorizedDepartments.length === 0}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveText}>Kaydet</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,24,35,0.45)', justifyContent: 'center', padding: space.lg },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl, maxHeight: '88%', overflow: 'hidden',
    shadowColor: '#1B2130', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { flex: 1, fontSize: font.lg, fontWeight: '800', color: colors.text },

  body: { flexGrow: 0 },
  bodyContent: { padding: space.lg, paddingBottom: space.sm },
  hint: { fontSize: font.sm, color: colors.textMuted, lineHeight: 20, paddingVertical: space.md },

  field: { marginBottom: space.lg },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: space.sm },
  input: {
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: space.md, height: 48,
    fontSize: font.md, color: colors.text,
  },
  textarea: { height: 92, paddingTop: space.md },

  footer: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm,
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  cancelBtn: {
    paddingHorizontal: space.lg, height: 44, justifyContent: 'center',
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  cancelText: { fontSize: font.md, fontWeight: '600', color: colors.textMuted },
  saveBtn: {
    minWidth: 104, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, backgroundColor: colors.primary,
  },
  saveDisabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
});
