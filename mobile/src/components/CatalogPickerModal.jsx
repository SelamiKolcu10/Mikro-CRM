import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import catalogService from '../services/catalogService';
import { UNIT_LABEL } from '../config/catalog';
import { formatMoney } from '../utils/format';
import { colors, radius, space, font } from '../theme';

/**
 * Katalogdan ürün seçme sayfası — teklif kalemi eklerken açılır.
 *
 * Web'de bu bir <select> (QuoteLineItems.jsx "Katalogdan Ekle"); mobilde arama
 * kutulu bir alt sayfa, çünkü liste uzadıkça tek satırlık seçim kullanışsız.
 * Seçilen ürünün fiyat/KDV'si çağırana verilir, satırı çağıran ekler.
 *
 * Ürünler `catalogService.getAll()` ile çekilir — lookupCache arkasında
 * olduğu için Katalog ekranı zaten açılmışsa ağa yeni istek gitmez.
 * Arama istemci tarafında: liste küçük ve önbellekte, her tuşta istek atmanın
 * anlamı yok (CatalogScreen de aynı şekilde filtreliyor).
 */
export default function CatalogPickerModal({ visible, onClose, onSelect }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await catalogService.getAll();
        if (cancelled) return;
        setProducts(res.data.data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.error || 'Ürünler yüklenemedi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Sayfa her açıldığında aramayı sıfırla — önceki seçimden kalan filtreyle
  // açılırsa "ürün yok" gibi görünüyor.
  useEffect(() => {
    if (visible) setSearch('');
  }, [visible]);

  const data = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.description, p.sku, p.category]
        .filter(Boolean)
        .some((f) => f.toLocaleLowerCase('tr').includes(q)),
    );
  }, [products, search]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Katalogdan Ekle</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

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

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : (
            <FlatList
              data={data}
              keyExtractor={(p) => p._id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                >
                  <View style={styles.rowBody}>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {[item.category, item.sku].filter(Boolean).join(' · ') || 'Kategorisiz'}
                    </Text>
                  </View>
                  <View style={styles.priceCol}>
                    <Text style={styles.price}>{formatMoney(item.unitPrice, item.currency, 2)}</Text>
                    <Text style={styles.unit}>
                      /{UNIT_LABEL[item.unit] || item.unit} · KDV %{item.taxRate}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {search ? 'Aramayla eşleşen ürün yok.' : 'Katalogda aktif ürün yok.'}
                </Text>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space.lg,
    height: '75%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  title: { fontSize: font.lg, fontWeight: '800', color: colors.text },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: 44,
    marginBottom: space.sm,
  },
  searchInput: { flex: 1, fontSize: font.md, color: colors.text },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger, textAlign: 'center' },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: space.xl },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowBody: { flex: 1 },
  name: { fontSize: font.md, fontWeight: '600', color: colors.text },
  meta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  priceCol: { alignItems: 'flex-end' },
  price: { fontSize: font.md, fontWeight: '800', color: colors.text },
  unit: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
});
