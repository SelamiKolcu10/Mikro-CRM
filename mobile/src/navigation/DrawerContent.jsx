import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { NAV_GROUPS, ROLE_LABELS } from '../config/navigation';
import { colors, radius, space, font } from '../theme';

// Menu items that live inside the bottom-tab "Home" screen → which tab AND
// which screen inside that tab's stack to open.
//
// `screen` her öğede zorunlu: yalnız sekme adı verilirse React Navigation o
// sekmenin EN SON açık ekranını geri getirir. Bir sekmede birden fazla menü
// öğesi olduğunda (Formlar/Geri Bildirimler/Sohbet aynı sekmede) bu, "Formlar"a
// basınca Sohbet'in açılması demek — hedef ekranı her zaman açıkça veriyoruz.
const TAB_OF = {
  Dashboard: { tab: 'Anasayfa', screen: 'Dashboard' },
  Calendar: { tab: 'Anasayfa', screen: 'Calendar' },
  Tasks: { tab: 'Anasayfa', screen: 'Tasks' },
  Invoices: { tab: 'Anasayfa', screen: 'Invoices' },
  Customers: { tab: 'Müşteriler', screen: 'CustomersHome' },
  Deals: { tab: 'Satış', screen: 'Deals' },
  Quotes: { tab: 'Satış', screen: 'Quotes' },
  Catalog: { tab: 'Satış', screen: 'Catalog' },
  Leads: { tab: 'Formlar', screen: 'LeadsHome' },
  Feedbacks: { tab: 'Formlar', screen: 'Feedbacks' },
  Chat: { tab: 'Formlar', screen: 'Chat' },
};

function goToItem(navigation, item) {
  const t = TAB_OF[item.name];
  if (!t) {
    navigation.navigate(item.name);
  } else {
    navigation.navigate(
      'Home',
      t.screen ? { screen: t.tab, params: { screen: t.screen } } : { screen: t.tab }
    );
  }
  // Drawer kendiliğinden yalnızca AKTİF DRAWER ROTASI değiştiğinde kapanır.
  // Sekme içindeki öğelerde hedef hep aynı drawer rotası ('Home') olduğu için
  // rota değişmez ve menü açık kalırdı; aynısı zaten açık olan bir ekrana
  // yeniden basıldığında da geçerli. Bu yüzden her seçimde elle kapatıyoruz.
  navigation.closeDrawer();
}

// Custom drawer body — the native equivalent of the web Sidebar: brand header,
// role-filtered grouped menu, profile + logout footer. Reads the same NAV_GROUPS
// config so a new item/role only ever changes config/navigation.js.
export default function DrawerContent(props) {
  const { session, logout } = useAuth();
  const role = session?.role;
  const activeName = props.state.routeNames[props.state.index];

  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(role)) }))
    .filter((g) => g.items.length > 0);

  const initials = (session?.name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={styles.flex}>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.scroll}>
        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>μ</Text>
          </View>
          <Text style={styles.brandName}>Micro CRM</Text>
        </View>

        {/* Grouped, role-filtered items */}
        {groups.map((group) => (
          <View key={group.section} style={styles.group}>
            {!!group.label && <Text style={styles.sectionLabel}>{group.label}</Text>}
            {group.items.map((item) => {
              // Tab items route into the "Home" tabs so the bottom bar stays
              // visible; the rest are their own drawer screens.
              const active =
                item.name === activeName || (activeName === 'Home' && item.name === 'Dashboard');
              return (
                <TouchableOpacity
                  key={item.name}
                  style={[styles.item, active && styles.itemActive]}
                  onPress={() => goToItem(props.navigation, item)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={active ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.itemText, active && styles.itemTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </DrawerContentScrollView>

      {/* Footer: profile + logout */}
      <View style={styles.footer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.profileText}>
          <Text style={styles.profileName} numberOfLines={1}>
            {session?.name || 'Kullanıcı'}
          </Text>
          <Text style={styles.profileRole} numberOfLines={1}>
            {ROLE_LABELS[role] || role || ''}
          </Text>
        </View>
        <TouchableOpacity onPress={logout} hitSlop={8} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  scroll: { paddingTop: space.sm },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
    marginBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  brandName: { fontSize: font.lg, fontWeight: '800', color: colors.text },
  group: { marginBottom: space.md },
  sectionLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: space.lg,
    marginBottom: space.xs,
    marginTop: space.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 11,
    paddingHorizontal: space.lg,
    marginHorizontal: space.sm,
    borderRadius: radius.md,
  },
  itemActive: { backgroundColor: colors.primarySoft },
  itemText: { fontSize: font.md, color: colors.textMuted, fontWeight: '500' },
  itemTextActive: { color: colors.primary, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: font.md },
  profileText: { flex: 1 },
  profileName: { fontSize: font.md, fontWeight: '700', color: colors.text },
  profileRole: { fontSize: font.sm, color: colors.textMuted },
  logoutBtn: { padding: space.xs },
});
