import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import leadService from '../services/leadService';
import taskService from '../services/taskService';
import SelectField from '../components/SelectField';
import ConvertLeadModal from '../components/ConvertLeadModal';
import { useAuth } from '../context/AuthContext';
import {
  STATUS_OPTIONS,
  DEPARTMENT_LABEL,
  EVENT_LABEL,
  statusMeta,
  tempMeta,
  summarizeLead,
  canWriteLead,
  assignableDepartmentsFor,
} from '../config/leads';
import { colors, radius, space, font } from '../theme';

const formatDateTime = (d) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString('tr-TR');
  } catch {
    return '';
  }
};

function Section({ label, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function StatusChip({ status, small }) {
  const st = statusMeta(status);
  return (
    <View style={[styles.badge, small && styles.badgeSmall, { backgroundColor: st.bg }]}>
      <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
    </View>
  );
}

// Zaman çizelgesi satırı — olay türüne göre metin değişir; not olayları
// içeriği bir kutuda gösterir (web LeadDetailDrawer ile aynı ayrım).
function TimelineItem({ event }) {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineDot} />
      <View style={{ flex: 1 }}>
        <View style={styles.timelineTop}>
          <Text style={styles.timelineActor}>{event.actorName}</Text>
          <Text style={styles.timelineTime}>{formatDateTime(event.createdAt)}</Text>
        </View>

        {event.action === 'status_changed' ? (
          <View style={styles.timelineStatusRow}>
            <Text style={styles.timelineText}>{EVENT_LABEL.status_changed} </Text>
            {!!event.fromStatus && (
              <>
                <StatusChip status={event.fromStatus} small />
                <Text style={styles.timelineText}> → </Text>
              </>
            )}
            <StatusChip status={event.toStatus} small />
          </View>
        ) : event.action === 'note_added' ? (
          <View style={styles.noteCard}>
            <Text style={styles.noteText}>{event.note}</Text>
          </View>
        ) : (
          <Text style={styles.timelineText}>
            {EVENT_LABEL[event.action] || event.action}
            {event.action === 'assigned' && event.note ? ` ${event.note}` : ''}
          </Text>
        )}
      </View>
    </View>
  );
}

export default function LeadDetailScreen({ route, navigation }) {
  const { session } = useAuth();
  const canWrite = canWriteLead(session?.role);
  const assignableDepartments = assignableDepartmentsFor(session);
  const canAssign = assignableDepartments.length > 0;

  // Liste ekranı tam lead nesnesini geçiriyor; sonraki güncellemeler sunucu
  // yanıtıyla bu yerel kopyayı tazeler.
  const [lead, setLead] = useState(route.params.lead);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [assignDepartment, setAssignDepartment] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [departmentUsers, setDepartmentUsers] = useState([]);
  const [showConvert, setShowConvert] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: 'Form Detayı' });
  }, [navigation]);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await leadService.getEvents(lead._id);
      setEvents(res.data.data);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [lead._id]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Departman seçilince o departmanın atanabilir üyeleri yüklenir — kişi
  // seçimi kaskad ikinci adım, boş bırakılabilir.
  useEffect(() => {
    setAssigneeId('');
    if (!assignDepartment) {
      setDepartmentUsers([]);
      return;
    }
    let cancelled = false;
    taskService
      .getAssignableUsers(assignDepartment)
      .then((res) => {
        if (!cancelled) setDepartmentUsers(res.data.data || []);
      })
      .catch(() => {
        if (!cancelled) setDepartmentUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [assignDepartment]);

  const handleStatusChange = async (status) => {
    if (status === lead.status) return;
    setBusy(true);
    try {
      const res = await leadService.updateStatus(lead._id, status);
      setLead(res.data.data);
      loadEvents();
    } catch (err) {
      Alert.alert('Güncellenemedi', err.response?.data?.error || 'Bir hata oluştu.');
    } finally {
      setBusy(false);
    }
  };

  const handleAssign = async () => {
    if (!assignDepartment) return;
    setBusy(true);
    try {
      const res = await leadService.assign(lead._id, assignDepartment, assigneeId || null);
      setLead(res.data.data);
      setAssignDepartment('');
      setAssigneeId('');
      loadEvents();
    } catch (err) {
      Alert.alert('Atanamadı', err.response?.data?.error || 'Bir hata oluştu.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddNote = async () => {
    const text = note.trim();
    if (!text) return;
    setBusy(true);
    try {
      const res = await leadService.addNote(lead._id, text);
      setEvents((prev) => [res.data.data, ...prev]);
      setNote('');
    } catch (err) {
      Alert.alert('Not eklenemedi', err.response?.data?.error || 'Bir hata oluştu.');
    } finally {
      setBusy(false);
    }
  };

  const handleConvert = async (payload) => {
    await leadService.convert(lead._id, payload);
    setShowConvert(false);
    Alert.alert('Fırsata dönüştürüldü', 'Talep bir fırsata dönüştürüldü.', [
      { text: 'Tamam', onPress: () => navigation.goBack() },
    ]);
  };

  const tm = tempMeta(lead.temperature);
  const departmentOptions = assignableDepartments.map((d) => ({
    value: d,
    label: DEPARTMENT_LABEL[d],
  }));
  const assigneeOptions = departmentUsers.map((u) => ({ value: u._id, label: u.name }));

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.name}>{lead.name}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: tm.bg }]}>
            <View style={[styles.tempDot, { backgroundColor: tm.fg }]} />
            <Text style={[styles.badgeText, { color: tm.fg }]}>
              {tm.label} · {lead.score}
            </Text>
          </View>
          <StatusChip status={lead.status} />
        </View>

        <Text style={styles.summary}>{summarizeLead(lead)}</Text>

        {/* İletişim — e-posta/telefon doğrudan cihazın uygulamasını açar.
            intern rolünde bu alanlar backend'de maskeli geliyor. */}
        <View style={styles.contactRow}>
          {!!lead.email && (
            <TouchableOpacity
              style={styles.contactChip}
              onPress={() => Linking.openURL(`mailto:${lead.email}`)}
              activeOpacity={0.7}
            >
              <Ionicons name="mail-outline" size={16} color={colors.primary} />
              <Text style={styles.contactText} numberOfLines={1}>{lead.email}</Text>
            </TouchableOpacity>
          )}
          {!!lead.phone && (
            <TouchableOpacity
              style={styles.contactChip}
              onPress={() => Linking.openURL(`tel:${lead.phone}`)}
              activeOpacity={0.7}
            >
              <Ionicons name="call-outline" size={16} color={colors.primary} />
              <Text style={styles.contactText} numberOfLines={1}>{lead.phone}</Text>
            </TouchableOpacity>
          )}
        </View>

        {!!lead.linkedCustomer && (
          <View style={styles.customerBadge}>
            <Ionicons name="checkmark-circle-outline" size={15} color={colors.success} />
            <Text style={styles.customerText}>
              Mevcut müşteri: <Text style={styles.bold}>{lead.linkedCustomer.name}</Text>
            </Text>
          </View>
        )}

        {lead.convertedDeal ? (
          <View style={styles.convertedBadge}>
            <Ionicons name="trending-up-outline" size={16} color={colors.success} />
            <Text style={styles.convertedText}>Fırsata dönüştürüldü</Text>
          </View>
        ) : (
          canWrite && (
            <TouchableOpacity
              style={styles.convertBtn}
              onPress={() => setShowConvert(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="trending-up-outline" size={18} color="#fff" />
              <Text style={styles.convertBtnText}>Fırsata Dönüştür</Text>
            </TouchableOpacity>
          )
        )}

        <Section label="Talep Metni">
          <View style={styles.messageCard}>
            <Text style={styles.messageText}>{lead.message}</Text>
          </View>
        </Section>

        <Section label="Durum">
          {canWrite ? (
            <SelectField
              value={lead.status}
              options={STATUS_OPTIONS}
              onSelect={handleStatusChange}
            />
          ) : (
            <StatusChip status={lead.status} />
          )}
        </Section>

        <Section label="Atama">
          <Text style={styles.assignInfo}>
            {lead.assignedDepartment ? (
              <>
                Departman: <Text style={styles.bold}>{DEPARTMENT_LABEL[lead.assignedDepartment]}</Text>
                {!!lead.assignedTo && (
                  <> · Atanan: <Text style={styles.bold}>{lead.assignedTo.name}</Text></>
                )}
              </>
            ) : (
              'Atanmadı'
            )}
          </Text>

          {/* super_admin her departmana, departman lideri sadece kendisininkine
              atayabilir; yetki yoksa seçici hiç gösterilmez. */}
          {canAssign && (
            <>
              <SelectField
                value={assignDepartment}
                placeholder="Departman seçin"
                options={departmentOptions}
                onSelect={setAssignDepartment}
              />
              {!!assignDepartment && (
                <SelectField
                  value={assigneeId}
                  placeholder="Kişi seçin (opsiyonel)"
                  options={assigneeOptions}
                  onSelect={setAssigneeId}
                />
              )}
              <TouchableOpacity
                style={[styles.secondaryBtn, (!assignDepartment || busy) && styles.btnDisabled]}
                onPress={handleAssign}
                disabled={!assignDepartment || busy}
                activeOpacity={0.8}
              >
                <Ionicons name="person-add-outline" size={16} color={colors.primary} />
                <Text style={styles.secondaryBtnText}>Atama Yap</Text>
              </TouchableOpacity>
            </>
          )}
        </Section>

        <Section label="Zaman Çizelgesi">
          {canWrite && (
            <>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Ekip içi not ekle..."
                placeholderTextColor={colors.textFaint}
                maxLength={1000}
                multiline
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.secondaryBtn, (!note.trim() || busy) && styles.btnDisabled]}
                onPress={handleAddNote}
                disabled={!note.trim() || busy}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryBtnText}>Not Ekle</Text>
              </TouchableOpacity>
            </>
          )}

          {eventsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: space.lg }} />
          ) : events.length === 0 ? (
            <Text style={styles.empty}>Henüz aktivite yok.</Text>
          ) : (
            <View style={styles.timeline}>
              {events.map((ev) => (
                <TimelineItem key={ev._id} event={ev} />
              ))}
            </View>
          )}
        </Section>
      </ScrollView>

      <ConvertLeadModal
        visible={showConvert}
        lead={lead}
        onConvert={handleConvert}
        onClose={() => setShowConvert(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxl },

  name: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  badgeSmall: { paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  tempDot: { width: 6, height: 6, borderRadius: radius.full },

  summary: { fontSize: font.sm, color: colors.textMuted, marginTop: space.md, lineHeight: 20 },

  contactRow: { gap: space.sm, marginTop: space.md },
  contactChip: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: space.md, height: 44,
  },
  contactText: { flex: 1, fontSize: font.sm, fontWeight: '600', color: colors.primary },

  customerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md },
  customerText: { fontSize: font.sm, color: colors.textMuted },
  bold: { fontWeight: '700', color: colors.text },

  convertBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.primary, borderRadius: radius.md, height: 48, marginTop: space.lg,
    shadowColor: colors.primary, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  convertBtnText: { color: '#fff', fontSize: font.md, fontWeight: '700' },
  convertedBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.successSoft, borderRadius: radius.md, height: 44, marginTop: space.lg,
  },
  convertedText: { color: colors.success, fontSize: font.sm, fontWeight: '700' },

  section: { marginTop: space.xl },
  sectionLabel: { fontSize: font.sm, fontWeight: '700', color: colors.text, marginBottom: space.sm },

  messageCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: space.md,
  },
  messageText: { fontSize: font.sm, color: colors.text, lineHeight: 21 },

  assignInfo: { fontSize: font.sm, color: colors.textMuted, marginBottom: space.md },

  noteInput: {
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.md, padding: space.md, height: 88,
    fontSize: font.md, color: colors.text, marginBottom: space.sm,
  },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.primarySoft, borderRadius: radius.md, height: 44,
  },
  secondaryBtnText: { color: colors.primary, fontSize: font.sm, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },

  timeline: { marginTop: space.lg, gap: space.lg },
  timelineItem: { flexDirection: 'row', gap: space.md },
  timelineDot: {
    width: 8, height: 8, borderRadius: radius.full,
    backgroundColor: colors.primary, marginTop: 6,
  },
  timelineTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  timelineActor: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  timelineTime: { fontSize: font.xs, color: colors.textFaint },
  timelineText: { fontSize: font.sm, color: colors.textMuted },
  timelineStatusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
  noteCard: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, padding: space.sm, marginTop: 4,
  },
  noteText: { fontSize: font.sm, color: colors.text, lineHeight: 20 },

  empty: { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: space.lg },
});
