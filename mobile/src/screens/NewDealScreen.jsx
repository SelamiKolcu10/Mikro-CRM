import { useState, useEffect } from 'react';
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
import customerService from '../services/customerService';
import dealService from '../services/dealService';
import { colors, radius, space, font } from '../theme';

const CURRENCIES = ['TRY', 'USD', 'EUR'];
const parseDate = (s) => {
  const m = s.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d.toISOString();
};

export default function NewDealScreen({ navigation }) {
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [closeDate, setCloseDate] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await customerService.getAll({ limit: 100, sort: 'name' });
        setCustomers(res.data.data);
      } catch {
        Alert.alert('Hata', 'Müşteriler yüklenemedi.');
      } finally {
        setLoadingCustomers(false);
      }
    })();
  }, []);

  const handleCreate = async () => {
    if (title.trim().length < 2) {
      Alert.alert('Eksik bilgi', 'Başlık en az 2 karakter olmalı.');
      return;
    }
    if (!customerId) {
      Alert.alert('Eksik bilgi', 'Lütfen bir müşteri seçin.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        customerId,
        value: Number(value) || 0,
        currency,
      };
      const iso = parseDate(closeDate);
      if (iso) payload.expectedCloseDate = iso;

      const res = await dealService.create(payload);
      navigation.replace('DealDetail', { deal: res.data.data });
    } catch (err) {
      Alert.alert('Oluşturulamadı', err.response?.data?.error || 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingCustomers) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Başlık *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Fırsat adını girin"
          placeholderTextColor={colors.textFaint}
        />

        <SelectField
          label="Müşteri *"
          value={customerId}
          placeholder="Müşteri seçin"
          options={customers.map((c) => ({ value: c._id, label: c.company ? `${c.name} · ${c.company}` : c.name }))}
          onSelect={setCustomerId}
        />

        <View style={styles.row}>
          <View style={{ flex: 1.4, marginRight: space.sm }}>
            <Text style={styles.label}>Tutar</Text>
            <TextInput style={styles.input} value={value} onChangeText={setValue} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textFaint} />
          </View>
          <View style={{ flex: 1 }}>
            <SelectField
              label="Para Birimi"
              value={currency}
              placeholder="TRY"
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              onSelect={setCurrency}
            />
          </View>
        </View>

        <Text style={styles.label}>Tahmini Kapanış</Text>
        <TextInput
          style={styles.input}
          value={closeDate}
          onChangeText={setCloseDate}
          placeholder="GG.AA.YYYY"
          placeholderTextColor={colors.textFaint}
          keyboardType="numbers-and-punctuation"
        />

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.infoText}>
            İpucu: Fırsat tutarı projeksiyon raporlarında anında yansıtılır.
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()} disabled={saving}>
            <Text style={styles.cancelText}>İptal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.createBtn, saving && { opacity: 0.6 }]} onPress={handleCreate} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.createText}>Oluştur</Text>}
          </TouchableOpacity>
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },

  label: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: space.sm },
  input: {
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: space.md, height: 48, fontSize: font.md, color: colors.text, marginBottom: space.lg,
  },
  row: { flexDirection: 'row' },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space.sm,
    backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: space.md, marginTop: space.xs, marginBottom: space.lg,
  },
  infoText: { flex: 1, fontSize: font.sm, color: colors.primary, lineHeight: 18 },

  actions: { flexDirection: 'row', gap: space.md },
  cancelBtn: { flex: 1, height: 50, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  cancelText: { fontSize: font.md, fontWeight: '700', color: colors.textMuted },
  createBtn: { flex: 1.6, height: 50, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  createText: { fontSize: font.md, fontWeight: '700', color: '#fff' },
});
