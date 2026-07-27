import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SelectField from '../components/SelectField';
import dealService from '../services/dealService';
import { formatMoney, formatDate } from '../utils/format';
import { STAGE_LABEL, STAGE_STYLE, DEAL_STAGES } from '../config/deals';
import { colors, radius, space, font } from '../theme';

const ACTION_LABEL = {
  created: 'Fırsat oluşturuldu',
  value_changed: 'Tutar güncellendi',
  stage_changed: 'Aşama değişti',
  updated: 'Güncellendi',
  note: 'Not eklendi',
};

const toInputDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
};
const parseDate = (s) => {
  const m = s.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d.toISOString();
};

export default function DealDetailScreen({ route }) {
  const [deal, setDeal] = useState(route.params.deal);
  const [title, setTitle] = useState(deal.title);
  const [value, setValue] = useState(String(deal.value ?? ''));
  const [probability, setProbability] = useState(String(deal.probability ?? ''));
  const [closeDate, setCloseDate] = useState(toInputDate(deal.expectedCloseDate));
  const [saving, setSaving] = useState(false);

  const [events, setEvents] = useState([]);
  const [note, setNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      const res = await dealService.getEvents(deal._id);
      setEvents(res.data.data);
    } catch {
      // timeline is non-critical; ignore load errors
    }
  }, [deal._id]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const st = STAGE_STYLE[deal.stage] || STAGE_STYLE.initial_contact;

  const changeStage = async (stage) => {
    if (stage === deal.stage) return;
    try {
      const res = await dealService.updateStage(deal._id, stage);
      const updated = res.data.data;
      setDeal(updated);
      setProbability(String(updated.probability ?? ''));
      loadEvents();
    } catch (err) {
      Alert.alert('Hata', err.response?.data?.error || 'Aşama değiştirilemedi.');
    }
  };

  const handleSave = async () => {
    if (title.trim().length < 2) {
      Alert.alert('Eksik bilgi', 'Başlık en az 2 karakter olmalı.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        value: Number(value) || 0,
        probability: Math.max(0, Math.min(100, Number(probability) || 0)),
        expectedCloseDate: parseDate(closeDate),
      };
      const res = await dealService.update(deal._id, payload);
      setDeal(res.data.data);
      loadEvents();
      Alert.alert('Kaydedildi', 'Fırsat güncellendi.');
    } catch (err) {
      Alert.alert('Kaydedilemedi', err.response?.data?.error || 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    setAddingNote(true);
    try {
      await dealService.addNote(deal._id, note.trim());
      setNote('');
      loadEvents();
    } catch (err) {
      Alert.alert('Hata', err.response?.data?.error || 'Not eklenemedi.');
    } finally {
      setAddingNote(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Header card */}
        <View style={styles.headCard}>
          <View style={{ flex: 1 }}>
            <View style={[styles.stageBadge, { backgroundColor: st.bg }]}>
              <Text style={[styles.stageText, { color: st.fg }]}>{STAGE_LABEL[deal.stage] || deal.stage}</Text>
            </View>
            <Text style={styles.title} numberOfLines={2}>{deal.title}</Text>
            <Text style={styles.amount}>{formatMoney(deal.value, deal.currency)}</Text>
          </View>
          <View style={[styles.probCircle, { borderColor: st.fg }]}>
            <Text style={[styles.probText, { color: st.fg }]}>%{Math.round(deal.probability ?? 0)}</Text>
          </View>
        </View>

        {/* Editable details */}
        <Text style={styles.section}>DETAYLAR</Text>
        <View style={styles.card}>
          <SelectField
            label="Aşama"
            value={deal.stage}
            options={DEAL_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))}
            onSelect={changeStage}
          />

          <Text style={styles.label}>Başlık</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Fırsat başlığı" placeholderTextColor={colors.textFaint} />

          <View style={styles.row}>
            <View style={{ flex: 1.3, marginRight: space.sm }}>
              <Text style={styles.label}>Tutar ({deal.currency})</Text>
              <TextInput style={styles.input} value={value} onChangeText={setValue} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textFaint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Olasılık %</Text>
              <TextInput style={styles.input} value={probability} onChangeText={setProbability} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textFaint} />
            </View>
          </View>

          <Text style={styles.label}>Tahmini Kapanış</Text>
          <TextInput style={styles.input} value={closeDate} onChangeText={setCloseDate} placeholder="GG.AA.YYYY" placeholderTextColor={colors.textFaint} keyboardType="numbers-and-punctuation" />

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Kaydet</Text>}
          </TouchableOpacity>
        </View>

        {/* Timeline */}
        <Text style={styles.section}>ZAMAN ÇİZELGESİ</Text>
        <View style={styles.card}>
          <View style={styles.noteRow}>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Bir not ekle..."
              placeholderTextColor={colors.textFaint}
              multiline
            />
            <TouchableOpacity style={[styles.noteBtn, (!note.trim() || addingNote) && { opacity: 0.5 }]} onPress={handleAddNote} disabled={!note.trim() || addingNote}>
              {addingNote ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.noteBtnText}>Not Ekle</Text>}
            </TouchableOpacity>
          </View>

          {events.length === 0 ? (
            <Text style={styles.timelineEmpty}>Henüz hareket yok.</Text>
          ) : (
            events.map((ev, idx) => (
              <View key={ev._id || idx} style={styles.eventRow}>
                <View style={styles.eventDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventText}>
                    {ev.note || ACTION_LABEL[ev.action] || ev.action || 'Hareket'}
                  </Text>
                  <Text style={styles.eventMeta}>
                    {ev.actorName || 'Sistem'} · {formatDate(ev.createdAt)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: space.xl }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg },

  headCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, marginBottom: space.lg,
  },
  stageBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, marginBottom: space.sm },
  stageText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  title: { fontSize: font.lg, fontWeight: '800', color: colors.text },
  amount: { fontSize: font.xl, fontWeight: '800', color: colors.primary, marginTop: 4 },
  probCircle: { width: 64, height: 64, borderRadius: radius.full, borderWidth: 4, alignItems: 'center', justifyContent: 'center', marginLeft: space.md },
  probText: { fontSize: font.md, fontWeight: '800' },

  section: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, marginBottom: space.sm },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, marginBottom: space.lg },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: space.sm },
  input: {
    backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: space.md, height: 46, fontSize: font.md, color: colors.text, marginBottom: space.md,
  },
  row: { flexDirection: 'row' },
  saveBtn: { backgroundColor: colors.primary, borderRadius: radius.md, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: space.xs },
  saveText: { color: '#fff', fontSize: font.md, fontWeight: '700' },

  noteRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginBottom: space.md },
  noteInput: { flex: 1, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, minHeight: 44, fontSize: font.sm, color: colors.text, textAlignVertical: 'top' },
  noteBtn: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: space.md, height: 44, alignItems: 'center', justifyContent: 'center' },
  noteBtnText: { color: '#fff', fontSize: font.sm, fontWeight: '700' },
  timelineEmpty: { color: colors.textMuted, fontSize: font.sm, textAlign: 'center', paddingVertical: space.md },
  eventRow: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm },
  eventDot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.primary, marginTop: 6 },
  eventText: { fontSize: font.sm, color: colors.text, fontWeight: '600' },
  eventMeta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
});
