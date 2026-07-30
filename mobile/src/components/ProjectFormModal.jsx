import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SelectField from './SelectField';
import projectService from '../services/projectService';
import { loadStatusMeta } from '../config/projects';
import { DEPARTMENT_LABEL } from '../config/departments';
import { colors, radius, space, font } from '../theme';

const idOf = (v) => String(v?._id || v || '');

/**
 * Proje Oluştur / Düzenle.
 *
 * Ekip üyeleri çoklu seçim: liste /projects/eligible-members'tan gelir ve
 * TÜM departmanları kapsar (proje ekibi, projeyi kimin yönetebildiğinden
 * bağımsız — bkz. backend getEligibleMembers). Her satırda backend'in
 * hesapladığı iş yükü rozeti var, böylece yoğun kişiye yükleme yapılmaz.
 *
 * Proje lideri ekibin içinden seçilir (backend de bunu doğruluyor), o yüzden
 * seçenek listesi seçili üyelere bağlı; ekipten çıkarılan kişi liderse lider
 * alanı sıfırlanır.
 */
export default function ProjectFormModal({ visible, project, onSubmit, onClose }) {
  const editing = !!project;

  const [name, setName] = useState('');
  const [techInput, setTechInput] = useState('');
  const [selected, setSelected] = useState([]); // seçili üye id'leri
  const [lead, setLead] = useState('');

  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Her açılışta formu (düzenlemede mevcut projeden) doldur ve üyeleri çek.
  useEffect(() => {
    if (!visible) return;
    setName(project?.name || '');
    setTechInput((project?.techStack || []).join(', '));
    setSelected((project?.teamMembers || []).map(idOf));
    setLead(project?.projectLead ? idOf(project.projectLead) : '');
    setError('');

    setLoadingMembers(true);
    projectService
      .getEligibleMembers()
      .then((res) => setMembers(res.data.data || []))
      .catch((err) => setError(err.response?.data?.error || 'Ekip listesi alınamadı.'))
      .finally(() => setLoadingMembers(false));
  }, [visible, project]);

  const toggleMember = (id) => {
    setSelected((list) => {
      const next = list.includes(id) ? list.filter((m) => m !== id) : [...list, id];
      // Ekipten çıkarılan kişi lider olarak seçiliyse lideri boşalt.
      if (!next.includes(lead)) setLead('');
      return next;
    });
    setError('');
  };

  const leadOptions = [
    { value: '', label: 'Lider seçilmedi' },
    ...members
      .filter((m) => selected.includes(idOf(m)))
      .map((m) => ({ value: idOf(m), label: m.name })),
  ];

  const submit = async () => {
    if (!name.trim()) {
      setError('Proje adı zorunludur.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        techStack: techInput.split(',').map((t) => t.trim()).filter(Boolean),
        teamMembers: selected,
        projectLead: lead || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{editing ? 'Projeyi Düzenle' : 'Proje Oluştur'}</Text>
            <TouchableOpacity onPress={onClose} disabled={saving} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <View style={styles.field}>
              <Text style={styles.label}>Proje Adı *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={(v) => { setName(v); setError(''); }}
                editable={!saving}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Teknolojiler</Text>
              <TextInput
                style={styles.input}
                value={techInput}
                onChangeText={setTechInput}
                placeholder="React, Node.js, Python (virgülle ayırın)"
                placeholderTextColor={colors.textFaint}
                editable={!saving}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Ekip Üyeleri</Text>
              {loadingMembers ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: space.md }} />
              ) : (
                <View style={styles.memberBox}>
                  {members.map((m) => {
                    const id = idOf(m);
                    const checked = selected.includes(id);
                    const load = loadStatusMeta(m.loadStatus);
                    return (
                      <TouchableOpacity
                        key={id}
                        style={styles.memberRow}
                        onPress={() => toggleMember(id)}
                        disabled={saving}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={checked ? 'checkbox' : 'square-outline'}
                          size={20}
                          color={checked ? colors.primary : colors.textFaint}
                        />
                        <Text style={styles.memberName} numberOfLines={1}>{m.name}</Text>
                        <View style={[styles.loadDot, { backgroundColor: load.color }]} />
                        <Text style={styles.memberLoad}>
                          Yoğunluk: {Number(m.workloadScore || 0).toFixed(1)}
                        </Text>
                        {!!m.department && (
                          <Text style={styles.memberDept} numberOfLines={1}>
                            {DEPARTMENT_LABEL[m.department] || m.department}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  {members.length === 0 && (
                    <Text style={styles.emptyMembers}>Atanabilir personel bulunamadı.</Text>
                  )}
                </View>
              )}
            </View>

            <View style={styles.field}>
              <SelectField
                label="Proje Lideri"
                value={lead}
                options={leadOptions}
                onSelect={setLead}
                placeholder="Lider seçilmedi"
              />
              <Text style={styles.help}>
                Proje lideri, ekipten biri olmalı ve bu projede düzenleme yetkisi kazanır
                (mimari notlar, ekip).
              </Text>
            </View>

            {!!error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveDisabled]}
              onPress={submit}
              disabled={saving}
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

  field: { marginBottom: space.lg },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: space.sm },
  input: {
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: space.md, height: 48,
    fontSize: font.md, color: colors.text,
  },
  help: { fontSize: font.xs, color: colors.textMuted, marginTop: space.sm, lineHeight: 17 },

  memberBox: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    maxHeight: 200, overflow: 'hidden',
  },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: space.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  memberName: { flex: 1, fontSize: font.sm, fontWeight: '600', color: colors.text },
  loadDot: { width: 7, height: 7, borderRadius: radius.full },
  memberLoad: { fontSize: 11, color: colors.textMuted },
  memberDept: { fontSize: 11, color: colors.textFaint, maxWidth: 70 },
  emptyMembers: { fontSize: font.sm, color: colors.textMuted, padding: space.md },

  error: { fontSize: font.sm, color: colors.danger, marginBottom: space.md },

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
