import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import invoiceService from '../services/invoiceService';
import { invoiceStatusMeta } from '../config/invoices';
import { formatMoney, formatDate } from '../utils/format';
import { colors, radius, space, font } from '../theme';

/**
 * Bir müşterinin satış faturaları — sohbet profilindeki "Fatura Geçmişini Gör"
 * bağlantısının hedefi. Salt-okunur liste; fatura oluşturma/düzenleme web
 * panelinde kalıyor.
 */
export default function CustomerInvoicesScreen({ route, navigation }) {
  const { customerId, customerName } = route.params;

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    navigation.setOptions({ title: customerName ? `${customerName} — Faturalar` : 'Faturalar' });
  }, [navigation, customerName]);

  const load = useCallback(async () => {
    try {
      const res = await invoiceService.getAll({ customer: customerId, limit: 50 });
      setInvoices(res.data.data.items);
      setError(null);
    } catch (err) {
      setError(
        err.response?.status === 403
          ? 'Faturaları görüntüleme yetkin yok.'
          : err.response?.data?.error || 'Faturalar yüklenemedi.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customerId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={invoices}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      renderItem={({ item }) => {
        const st = invoiceStatusMeta(item.status);
        return (
          <View style={styles.card}>
            <View style={styles.top}>
              <View style={styles.icon}>
                <Ionicons name="receipt-outline" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.number}>{item.invoiceNumber}</Text>
                <Text style={styles.date}>
                  Kesim: {formatDate(item.issueDate)}
                  {!!item.dueDate && ` · Vade: ${formatDate(item.dueDate)}`}
                </Text>
              </View>
              <View style={[styles.chip, { backgroundColor: st.bg }]}>
                <Text style={[styles.chipText, { color: st.fg }]}>{st.label}</Text>
              </View>
            </View>
            <Text style={styles.total}>{formatMoney(item.grandTotal, item.currency, 2)}</Text>
          </View>
        );
      }}
      ListEmptyComponent={<Text style={styles.empty}>Bu müşteriye ait fatura yok.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: space.xl },
  list: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#1B2130', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  icon: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  number: { fontSize: font.md, fontWeight: '800', color: colors.text },
  date: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  chipText: { fontSize: 11, fontWeight: '800' },
  total: { fontSize: font.xl, fontWeight: '800', color: colors.primary, marginTop: space.md },

  empty: { textAlign: 'center', color: colors.textMuted, marginTop: space.xl },
  errorText: { color: colors.danger, textAlign: 'center', marginBottom: space.md },
  retry: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md },
  retryText: { color: '#fff', fontWeight: '700' },
});
