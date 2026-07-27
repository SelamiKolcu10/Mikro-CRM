import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import feedbackService from '../services/feedbackService';
import customerService from '../services/customerService';
import FeedbackFormModal from '../components/FeedbackFormModal';
import { useAuth } from '../context/AuthContext';
import {
  ACTIVE_STATUSES,
  RESOLVED_STATUSES,
  STATUS_OPTIONS,
  TYPE_FILTERS,
  STATUS_FILTERS,
  PRIORITY_FILTERS,
  PLAN_LABEL,
  typeMeta,
  statusMeta,
  priorityMeta,
  canWriteFeedback,
  canUpdateFeedbackStatus,
} from '../config/feedbacks';
import { colors, radius, space, font } from '../theme';

// Gelir etkisi USD cinsinden tutuluyor (web paneliyle aynı gösterim).
const impact = (v) => `$${Number(v || 0).toLocaleString('tr-TR')}/ay`;

function Chip({ meta, small }) {
  return (
    <View style={[styles.chip, small && styles.chipSmall, { backgroundColor: meta.bg }]}>
      <Text style={[styles.chipText, small && styles.chipTextSmall, { color: meta.fg }]}>
        {meta.label}
      </Text>
    </View>
  );
}

// Seçenek listesini alttan açılan sayfada gösteren ortak seçici. Hem üstteki
// filtre chip'leri hem de kart üzerindeki durum kutusu bunu kullanır.
function PickerSheet({ visible, title, value, options, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>{title}</Text>
          {options.map((o) => {
            const active = o.value === value;
            return (
              <TouchableOpacity
                key={String(o.value)}
                style={styles.sheetRow}
                onPress={() => {
                  onSelect(o.value);
                  onClose();
                }}
              >
                <Text style={[styles.sheetRowText, active && styles.sheetRowTextActive]}>
                  {o.label}
                </Text>
                {active && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function FilterChip({ options, value, onChange, title }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) || options[0];
  const isSet = !!value;
  return (
    <>
      <TouchableOpacity
        style={[styles.filterChip, isSet && styles.filterChipActive]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.filterChipText, isSet && styles.filterChipTextActive]} numberOfLines={1}>
          {selected.label}
        </Text>
        <Ionicons name="chevron-down" size={14} color={isSet ? colors.primary : colors.textMuted} />
      </TouchableOpacity>
      <PickerSheet
        visible={open}
        title={title}
        value={value}
        options={options}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function FeedbackCard({ item, canWrite, canSetStatus, onStatusPress, onQuickAdd, onEdit, onDelete }) {
  const st = statusMeta(item.status);
  return (
    <View style={styles.card}>
      <Text style={styles.fTitle}>{item.title}</Text>
      {!!item.description && (
        <Text style={styles.fDesc} numberOfLines={2}>{item.description}</Text>
      )}

      {!!item.customer && (
        <View style={styles.customerRow}>
          <Text style={styles.customerName} numberOfLines={1}>{item.customer.name}</Text>
          {!!item.customer.plan && (
            <View style={styles.planBadge}>
              <Text style={styles.planText}>
                {(PLAN_LABEL[item.customer.plan] || item.customer.plan).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Tür</Text>
        <Chip meta={typeMeta(item.type)} small />
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Öncelik</Text>
        <Chip meta={priorityMeta(item.priority)} small />
      </View>

      {/* Durum kutusu — yetkisi olmayan rollerde salt-okunur görünür. */}
      <TouchableOpacity
        style={[styles.statusBox, !canSetStatus && styles.statusBoxDisabled]}
        onPress={onStatusPress}
        disabled={!canSetStatus}
        activeOpacity={0.7}
      >
        <View style={[styles.statusDot, { backgroundColor: st.fg }]} />
        <Text style={styles.statusBoxText}>{st.label}</Text>
        {canSetStatus && <Ionicons name="chevron-down" size={16} color={colors.textMuted} />}
      </TouchableOpacity>

      <View style={styles.impactRow}>
        <Text style={styles.metaLabel}>ETKİ</Text>
        <Text style={styles.impactValue}>{impact(item.revenueImpact)}</Text>
      </View>

      {canWrite && (
        <View style={styles.actions}>
          {!!item.customer && (
            <TouchableOpacity style={styles.actionBtn} onPress={onQuickAdd} hitSlop={6}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionBtn} onPress={onEdit} hitSlop={6}>
            <Ionicons name="pencil-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onDelete} hitSlop={6}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function FeedbacksScreen({ navigation, route }) {
  const { session } = useAuth();
  const canWrite = canWriteFeedback(session?.role);
  const canSetStatus = canUpdateFeedbackStatus(session?.role);

  const [feedbacks, setFeedbacks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [tab, setTab] = useState('active');
  const [filters, setFilters] = useState({ type: '', status: '', priority: '' });
  // Sohbet profilindeki "Bu Müşterinin Taleplerini Gör" bağlantısından
  // gelindiğinde liste tek müşteriye daraltılır (web'deki ?customer= deep
  // link'inin karşılığı); üstteki rozetten temizlenebilir.
  const [customerFilter, setCustomerFilter] = useState({
    id: route.params?.customerId || '',
    name: route.params?.customerName || '',
  });
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState(''); // debounce edilmiş arama

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [prefillCustomer, setPrefillCustomer] = useState('');
  const [statusTarget, setStatusTarget] = useState(null); // durum sayfası açık olan kayıt

  // Arama her tuşta istek atmasın — mobil bağlantıda gereksiz trafik.
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const params = { limit: 100, sort: '-revenueImpact' };
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (query) params.search = query;
      if (customerFilter.id) params.customer = customerFilter.id;
      const res = await feedbackService.getAll(params);
      setFeedbacks(res.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Geri bildirimler yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, query, customerFilter.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Ekran zaten açıkken başka bir müşteri için tekrar yönlendirilirse
  // (navigation.navigate aynı ekranı yeniden monte etmez) filtreyi güncelle.
  useEffect(() => {
    setCustomerFilter({
      id: route.params?.customerId || '',
      name: route.params?.customerName || '',
    });
  }, [route.params?.customerId, route.params?.customerName]);

  // Müşteri listesi yalnızca form için gerekli; sessizce yüklenir.
  useEffect(() => {
    (async () => {
      try {
        const res = await customerService.getAll({ limit: 200 });
        setCustomers(res.data.data);
      } catch {
        setCustomers([]);
      }
    })();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  // Sekme ayrımı listenin kendisinde: "Aktif" açık + devam edenler,
  // "Çözülenler" çözüldü + kapatıldı (web Feedbacks.jsx ile aynı).
  const data = useMemo(() => {
    const allowed = tab === 'active' ? ACTIVE_STATUSES : RESOLVED_STATUSES;
    return feedbacks.filter((f) => allowed.includes(f.status));
  }, [feedbacks, tab]);

  const openCreate = (customerId = '') => {
    setEditing(null);
    setPrefillCustomer(typeof customerId === 'string' ? customerId : '');
    setFormOpen(true);
  };

  const openEdit = (fb) => {
    setEditing(fb);
    setPrefillCustomer('');
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setPrefillCustomer('');
  };

  // Onay kuyruğuna düşen istekler (`pending: true`) kaydı hemen değiştirmez —
  // kullanıcıya bunu açıkça söyle, aksi halde "kaydolmadı" gibi görünür.
  const notePending = () =>
    Alert.alert('Onaya gönderildi', 'İsteğin yöneticinin onayına düştü, onaylandığında uygulanacak.');

  const handleSave = async (payload) => {
    const res = editing
      ? await feedbackService.update(editing._id, payload)
      : await feedbackService.create(payload);
    closeForm();
    if (res.data.pending) notePending();
    else load();
  };

  const handleStatusChange = async (id, status) => {
    try {
      const res = await feedbackService.update(id, { status });
      if (res.data.pending) notePending();
      else load();
    } catch (err) {
      Alert.alert('Güncellenemedi', err.response?.data?.error || 'Bir hata oluştu.');
    }
  };

  // Geri bildirim silme kalıcıdır (soft-delete yok) — her zaman onay sor.
  const handleDelete = (fb) => {
    Alert.alert(
      'Geri bildirimi sil',
      `"${fb.title}" kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await feedbackService.delete(fb._id);
              if (res.data.pending) notePending();
              else load();
            } catch (err) {
              Alert.alert('Silinemedi', err.response?.data?.error || 'Bir hata oluştu.');
            }
          },
        },
      ]
    );
  };

  const header = (
    <View>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Geri Bildirimler</Text>
          <Text style={styles.subtitle}>Gelir etkisine göre sıralanmış geri bildirimler.</Text>
        </View>
        {canWrite && (
          <TouchableOpacity style={styles.addBtn} onPress={() => openCreate()} activeOpacity={0.85}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {!!customerFilter.id && (
        <View style={styles.customerFilterRow}>
          <Ionicons name="person-outline" size={14} color={colors.primary} />
          <Text style={styles.customerFilterText} numberOfLines={1}>
            {customerFilter.name || 'Seçili müşteri'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setCustomerFilter({ id: '', name: '' });
              navigation.setParams({ customerId: undefined, customerName: undefined });
            }}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={17} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.tabs}>
        {[
          { key: 'active', label: 'Aktif Bildirimler' },
          { key: 'resolved', label: 'Çözülenler' },
        ].map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(t.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.filterRow}>
        <FilterChip
          title="Türe göre filtrele"
          options={TYPE_FILTERS}
          value={filters.type}
          onChange={(v) => setFilters((f) => ({ ...f, type: v }))}
        />
        <FilterChip
          title="Duruma göre filtrele"
          options={STATUS_FILTERS}
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
        />
        <FilterChip
          title="Önceliğe göre filtrele"
          options={PRIORITY_FILTERS}
          value={filters.priority}
          onChange={(v) => setFilters((f) => ({ ...f, priority: v }))}
        />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Başlık veya açıklamada ara..."
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
        />
        {!!search && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

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
    <View style={styles.screen}>
      <FlatList
        data={data}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <FeedbackCard
            item={item}
            canWrite={canWrite}
            canSetStatus={canSetStatus}
            onStatusPress={() => setStatusTarget(item)}
            onQuickAdd={() => openCreate(item.customer?._id)}
            onEdit={() => openEdit(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {tab === 'active' ? 'Aktif geri bildirim yok.' : 'Çözülmüş geri bildirim yok.'}
          </Text>
        }
      />

      <PickerSheet
        visible={!!statusTarget}
        title="Durumu değiştir"
        value={statusTarget?.status}
        options={STATUS_OPTIONS}
        onSelect={(v) => handleStatusChange(statusTarget._id, v)}
        onClose={() => setStatusTarget(null)}
      />

      <FeedbackFormModal
        visible={formOpen}
        feedback={editing}
        customers={customers}
        initialCustomerId={prefillCustomer}
        onSave={handleSave}
        onClose={closeForm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: space.xl },
  list: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: font.md, color: colors.textMuted, marginTop: 2 },
  addBtn: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
    shadowColor: colors.primary, shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4,
  },

  customerFilterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginTop: space.md,
    paddingHorizontal: space.md, height: 34, borderRadius: radius.full,
    backgroundColor: colors.primarySoft, maxWidth: '100%',
  },
  customerFilterText: { flexShrink: 1, fontSize: font.sm, fontWeight: '700', color: colors.primary },

  tabs: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, marginBottom: space.md },
  tab: {
    paddingHorizontal: space.md, height: 40, justifyContent: 'center',
    borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: font.sm, fontWeight: '700', color: colors.textMuted },
  tabTextActive: { color: '#fff' },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: space.md, height: 36, borderRadius: radius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  filterChipText: { fontSize: font.sm, fontWeight: '600', color: colors.textMuted, maxWidth: 130 },
  filterChipTextActive: { color: colors.primary },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: space.md, height: 48, marginBottom: space.sm,
  },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#1B2130', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  fTitle: { fontSize: font.lg, fontWeight: '800', color: colors.text, lineHeight: 23 },
  fDesc: { fontSize: font.sm, color: colors.textMuted, marginTop: space.xs, lineHeight: 19 },

  customerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  customerName: { flex: 1, fontSize: font.sm, fontWeight: '700', color: colors.text },
  planBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.primarySoft },
  planText: { fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.3 },

  metaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: space.md,
  },
  metaLabel: { fontSize: font.xs, fontWeight: '700', color: colors.textFaint, letterSpacing: 0.4 },

  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  chipSmall: { paddingHorizontal: 9, paddingVertical: 2 },
  chipText: { fontSize: 11, fontWeight: '800' },
  chipTextSmall: { fontSize: 11 },

  statusBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    marginTop: space.md, height: 44, paddingHorizontal: space.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  statusBoxDisabled: { opacity: 0.7 },
  statusDot: { width: 8, height: 8, borderRadius: radius.full },
  statusBoxText: { flex: 1, fontSize: font.sm, fontWeight: '600', color: colors.text },

  impactRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: space.md,
  },
  impactValue: { fontSize: font.lg, fontWeight: '800', color: colors.primary },

  actions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: space.xs,
    marginTop: space.md, paddingTop: space.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  actionBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },

  backdrop: { flex: 1, backgroundColor: 'rgba(20,24,35,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: space.lg, paddingBottom: space.xxl,
  },
  grabber: { width: 40, height: 4, borderRadius: radius.full, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: space.md },
  sheetTitle: { fontSize: font.lg, fontWeight: '800', color: colors.text, marginBottom: space.sm },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetRowText: { fontSize: font.md, color: colors.text },
  sheetRowTextActive: { color: colors.primary, fontWeight: '700' },

  empty: { textAlign: 'center', color: colors.textMuted, marginTop: space.xl },
  errorText: { color: colors.danger, textAlign: 'center', marginBottom: space.md },
  retry: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md },
  retryText: { color: '#fff', fontWeight: '700' },
});
