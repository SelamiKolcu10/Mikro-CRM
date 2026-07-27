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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import catalogService from '../services/catalogService';
import CatalogFormModal from '../components/CatalogFormModal';
import { useAuth } from '../context/AuthContext';
import { UNIT_LABEL, canWriteCatalog } from '../config/catalog';
import { quoteStatus } from '../config/quotes';
import { formatMoney, formatDate } from '../utils/format';
import { colors, radius, space, font } from '../theme';

// Ürün kartı — ad + kategori chip'i, açıklama, ve altta fiyat/birim satırı.
// Yazma yetkisi yoksa "Düzenle" hiç render edilmez.
function ProductCard({ item, canWrite, onEdit }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.pName} numberOfLines={2}>{item.name}</Text>
        {!!item.category && (
          <View style={styles.categoryChip}>
            <Text style={styles.categoryText} numberOfLines={1}>{item.category}</Text>
          </View>
        )}
      </View>

      {!!item.description && (
        <Text style={styles.pDesc} numberOfLines={2}>{item.description}</Text>
      )}

      <View style={styles.divider} />

      <View style={styles.priceRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.priceLabel}>Fiyat / Birim</Text>
          <Text style={styles.priceValue}>
            {formatMoney(item.unitPrice, item.currency, 2)}
            <Text style={styles.priceUnit}> / {UNIT_LABEL[item.unit] || item.unit}</Text>
          </Text>
        </View>
        {canWrite && (
          <TouchableOpacity style={styles.editBtn} onPress={onEdit} activeOpacity={0.7}>
            <Text style={styles.editText}>Düzenle</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// Açılır-kapanır bölüm başlığı (Arşivlenen Ürünler / Geçmiş Satışlar).
function PanelToggle({ icon, label, open, onPress }) {
  return (
    <TouchableOpacity style={[styles.panelToggle, open && styles.panelToggleOpen]} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={18} color={open ? colors.primary : colors.textMuted} />
      <Text style={[styles.panelLabel, open && styles.panelLabelOpen]}>{label}</Text>
      <Ionicons
        name={open ? 'chevron-down' : 'chevron-forward'}
        size={18}
        color={open ? colors.primary : colors.textFaint}
      />
    </TouchableOpacity>
  );
}

export default function CatalogScreen({ navigation }) {
  const { session } = useAuth();
  const canWrite = canWriteCatalog(session?.role);

  const [products, setProducts] = useState([]);
  const [archived, setArchived] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const [showArchived, setShowArchived] = useState(false);
  const [showSales, setShowSales] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await catalogService.getAll();
      setProducts(res.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Ürünler yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadArchived = useCallback(async () => {
    try {
      const res = await catalogService.getArchived();
      setArchived(res.data.data);
    } catch {
      setArchived([]);
    }
  }, []);

  const loadSales = useCallback(async () => {
    try {
      const res = await catalogService.getSalesSummary();
      setSales(res.data.data);
    } catch {
      setSales([]);
    }
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  // Paneller yalnızca açıldıklarında veri çeker (web'deki davranışın aynısı).
  useEffect(() => {
    if (showArchived) loadArchived();
  }, [showArchived, loadArchived]);

  useEffect(() => {
    if (showSales) loadSales();
  }, [showSales, loadSales]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
    if (showArchived) loadArchived();
    if (showSales) loadSales();
  }, [load, loadArchived, loadSales, showArchived, showSales]);

  // Arama sunucu tarafında da destekleniyor ama liste küçük olduğu için
  // yerelde filtreliyoruz — her tuşta anlık sonuç.
  const data = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.description, p.sku, p.category]
        .filter(Boolean)
        .some((f) => f.toLocaleLowerCase('tr').includes(q))
    );
  }, [products, search]);

  const openNew = () => {
    setEditProduct(null);
    setFormOpen(true);
  };

  const openEdit = (product) => {
    setEditProduct(product);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditProduct(null);
  };

  const handleSave = async (payload) => {
    if (editProduct) {
      const res = await catalogService.update(editProduct._id, payload);
      setProducts((prev) => prev.map((p) => (p._id === editProduct._id ? res.data.data : p)));
    } else {
      const res = await catalogService.create(payload);
      setProducts((prev) => [res.data.data, ...prev]);
    }
    closeForm();
  };

  const handleArchive = async (id) => {
    try {
      await catalogService.archive(id);
      setProducts((prev) => prev.filter((p) => p._id !== id));
      closeForm();
      if (showArchived) loadArchived();
    } catch (err) {
      Alert.alert('Arşivlenemedi', err.response?.data?.error || 'Bir hata oluştu.');
    }
  };

  const header = (
    <View>
      <Text style={styles.title}>Ürün Kataloğu</Text>
      <Text style={styles.subtitle}>Standart ürün ve hizmetlerinizi yönetin.</Text>

      {canWrite && (
        <TouchableOpacity style={styles.newBtn} activeOpacity={0.85} onPress={openNew}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.newBtnText}>Yeni Ürün</Text>
        </TouchableOpacity>
      )}

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Ürün, kategori veya stok kodu ara..."
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
        />
      </View>
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      {/* ---- Arşivlenen Ürünler ---- */}
      <PanelToggle
        icon="archive-outline"
        label="Arşivlenen Ürünler"
        open={showArchived}
        onPress={() => setShowArchived((v) => !v)}
      />
      {showArchived && (
        <View style={styles.panelBody}>
          {archived.length === 0 ? (
            <Text style={styles.panelEmpty}>Arşivlenmiş ürün yok.</Text>
          ) : (
            archived.map((p) => (
              <View key={p._id} style={styles.archivedRow}>
                <View style={styles.cardTop}>
                  <Text style={styles.archivedName} numberOfLines={2}>{p.name}</Text>
                  <View style={styles.archivedBadge}>
                    <Text style={styles.archivedBadgeText}>Arşiv</Text>
                  </View>
                </View>
                {!!p.description && (
                  <Text style={styles.pDesc} numberOfLines={2}>{p.description}</Text>
                )}
                <Text style={styles.archivedPrice}>
                  {formatMoney(p.unitPrice, p.currency, 2)} / {UNIT_LABEL[p.unit] || p.unit}
                </Text>
              </View>
            ))
          )}
        </View>
      )}

      {/* ---- Geçmiş Satışlar ---- */}
      <PanelToggle
        icon="cart-outline"
        label="Geçmiş Satışlar"
        open={showSales}
        onPress={() => setShowSales((v) => !v)}
      />
      {showSales && (
        <View style={styles.panelBody}>
          {sales.length === 0 ? (
            <Text style={styles.panelEmpty}>Henüz satış geçmişi yok.</Text>
          ) : (
            sales.map((s, idx) => {
              const st = quoteStatus(s.status);
              return (
                <View key={`${s.quoteId}-${idx}`} style={styles.saleRow}>
                  <View style={styles.saleTop}>
                    <Text style={styles.saleQuote}>{s.quoteNumber}</Text>
                    <View style={[styles.statusChip, { backgroundColor: st.bg }]}>
                      <Text style={[styles.statusText, { color: st.fg }]}>{st.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.saleProduct} numberOfLines={1}>{s.productName}</Text>
                  <Text style={styles.saleMeta} numberOfLines={1}>
                    {s.customerName} · {s.quantity} adet · {formatDate(s.date)}
                  </Text>
                  <Text style={styles.saleTotal}>{formatMoney(s.total, s.currency, 2)}</Text>
                </View>
              );
            })
          )}
        </View>
      )}
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
          <ProductCard item={item} canWrite={canWrite} onEdit={() => openEdit(item)} />
        )}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {search ? 'Aramanla eşleşen ürün yok.' : 'Henüz ürün yok. Kataloğa ürün ekleyerek başlayın.'}
          </Text>
        }
      />

      <CatalogFormModal
        visible={formOpen}
        product={editProduct}
        onSave={handleSave}
        onArchive={handleArchive}
        onClose={closeForm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: space.xl },
  list: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },

  title: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: font.md, color: colors.textMuted, marginTop: 2, marginBottom: space.lg },

  newBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.primary, borderRadius: radius.md, height: 50, marginBottom: space.md,
    shadowColor: colors.primary, shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  newBtnText: { color: '#fff', fontSize: font.md, fontWeight: '700' },

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
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  pName: { flex: 1, fontSize: font.lg, fontWeight: '800', color: colors.text },
  categoryChip: {
    maxWidth: 120, paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: radius.full, backgroundColor: colors.primarySoft,
  },
  categoryText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  pDesc: { fontSize: font.sm, color: colors.textMuted, marginTop: space.xs, lineHeight: 19 },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: space.md },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  priceLabel: { fontSize: font.xs, fontWeight: '600', color: colors.textFaint, letterSpacing: 0.3 },
  priceValue: { fontSize: font.lg, fontWeight: '800', color: colors.text, marginTop: 2 },
  priceUnit: { fontSize: font.sm, fontWeight: '600', color: colors.textMuted },
  editBtn: {
    paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
  },
  editText: { fontSize: font.sm, fontWeight: '700', color: colors.primary },

  footer: { marginTop: space.md, gap: space.sm },
  panelToggle: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: space.md, height: 50,
  },
  panelToggleOpen: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  panelLabel: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.textMuted },
  panelLabelOpen: { color: colors.primary },
  panelBody: { gap: space.sm, paddingBottom: space.xs },
  panelEmpty: { fontSize: font.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: space.lg },

  archivedRow: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md,
    borderWidth: 1, borderColor: colors.border, opacity: 0.82,
  },
  archivedName: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.textMuted },
  archivedBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: '#EEF1F4' },
  archivedBadgeText: { fontSize: 10, fontWeight: '800', color: colors.textMuted },
  archivedPrice: { fontSize: font.sm, fontWeight: '700', color: colors.textMuted, marginTop: space.sm },

  saleRow: {
    backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md,
    borderWidth: 1, borderColor: colors.border,
  },
  saleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  saleQuote: { fontSize: font.xs, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.3 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full },
  statusText: { fontSize: 11, fontWeight: '800' },
  saleProduct: { fontSize: font.md, fontWeight: '700', color: colors.text, marginTop: 4 },
  saleMeta: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  saleTotal: { fontSize: font.md, fontWeight: '800', color: colors.primary, marginTop: space.sm },

  empty: { textAlign: 'center', color: colors.textMuted, marginTop: space.xl, paddingHorizontal: space.lg, lineHeight: 21 },
  errorText: { color: colors.danger, textAlign: 'center', marginBottom: space.md },
  retry: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.md },
  retryText: { color: '#fff', fontWeight: '700' },
});
