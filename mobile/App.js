import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';
import { NotificationProvider } from './src/context/NotificationContext';
import DrawerContent from './src/navigation/DrawerContent';
import HomeTabs from './src/navigation/HomeTabs';
import LoginScreen from './src/screens/LoginScreen';
import PlaceholderScreen from './src/screens/PlaceholderScreen';
import SpendingScreen from './src/screens/SpendingScreen';
import ProjectsStack from './src/navigation/ProjectsStack';
import UsersStack from './src/navigation/UsersStack';
import AccessControlScreen from './src/screens/AccessControlScreen';
import ApprovalsScreen from './src/screens/ApprovalsScreen';
import AuditLogScreen from './src/screens/AuditLogScreen';
import MailLogsScreen from './src/screens/MailLogsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import NotificationBell from './src/components/NotificationBell';
import { visibleItems } from './src/config/navigation';
import { colors, font } from './src/theme';

const Drawer = createDrawerNavigator();
const AuthStack = createNativeStackNavigator();

// Menu items that live inside the bottom-tab "Home" screen (so they keep the
// bottom bar) rather than as their own drawer screens. DrawerContent routes
// these menu taps to the matching tab/stack screen.
const TAB_ITEMS = ['Dashboard', 'Calendar', 'Tasks', 'Invoices', 'Customers', 'Deals', 'Quotes', 'Catalog', 'Leads', 'Feedbacks', 'Chat'];

// Drawer menü öğelerinin gerçek ekranları. Burada karşılığı olmayan her öğe
// PlaceholderScreen ("Yakında") gösterir — modüller yapıldıkça buraya eklenir.
// `ownHeader`: ekran kendi navigator'ını (ve başlığını) getiriyorsa çekmecenin
// başlığı gizlenir, yoksa iki başlık üst üste biner.
const DRAWER_SCREENS = {
  Spending: { component: SpendingScreen },
  Projects: { component: ProjectsStack, ownHeader: true },
  Users: { component: UsersStack, ownHeader: true },
  AccessControl: { component: AccessControlScreen },
  Approvals: { component: ApprovalsScreen },
  AuditLog: { component: AuditLogScreen },
  MailLogs: { component: MailLogsScreen },
};

function AppDrawer() {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  // Tab items live inside the bottom-tab "Home" screen, so they are NOT
  // separate drawer screens; DrawerContent routes those menu taps to the tab.
  // Everything else is its own drawer screen (DRAWER_SCREENS'te karşılığı
  // varsa gerçek ekran, yoksa placeholder).
  const drawerScreens = visibleItems(session?.role).filter(
    (i) => !TAB_ITEMS.includes(i.name)
  );

  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={({ navigation, route }) => ({
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: font.lg },
        headerShadowVisible: false,
        drawerType: 'front',
        sceneContainerStyle: {
          backgroundColor: colors.bg,
          // Android edge-to-edge: içerik gezinme çubuğunun ALTINA uzuyor.
          // Sekmeli ekran ('Home') bu payı kendi tab bar'ında veriyor, iki kez
          // saymamak için orada 0 bırakılıyor; diğer çekmece ekranları ise
          // doğrudan ekran kenarına dayandığı için payı burada alıyor.
          paddingBottom: route.name === 'Home' ? 0 : insets.bottom,
        },
        // Çan her çekmece ekranında görünür; bildirim ekranının kendisinde
        // gereksiz olduğu için orada gizli. Kendi navigator'ını taşıyan
        // ekranlar (ownHeader) çanı kendi stack başlığında gösterir.
        headerRight:
          route.name === 'Notifications'
            ? undefined
            : () => <NotificationBell onPress={() => navigation.navigate('Notifications')} />,
      })}
    >
      {/* The tabs (and their stacks) render their own headers with a hamburger,
          so the drawer's own header is hidden for this screen. */}
      <Drawer.Screen name="Home" component={HomeTabs} options={{ headerShown: false }} />
      {/* Menüde görünmez — başlıktaki çandan açılır. 'Home' ile kardeş olması
          şart: bildirime dokunulduğunda navigate('Home', {screen, params}) ile
          ilgili sekmeye geçiyor. */}
      <Drawer.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Bildirimler' }}
      />
      {drawerScreens.map((item) => {
        const entry = DRAWER_SCREENS[item.name];
        return (
          <Drawer.Screen
            key={item.name}
            name={item.name}
            component={entry?.component || PlaceholderScreen}
            initialParams={{ title: item.label }}
            options={{ title: item.label, headerShown: !entry?.ownHeader }}
          />
        );
      })}
    </Drawer.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

function RootNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return isAuthenticated ? <AppDrawer /> : <AuthNavigator />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <AuthProvider>
          {/* Canlı sohbet soketi oturuma bağlı — SocketProvider AuthProvider'ın
              içinde olmalı ki oturum açılıp kapandıkça bağlantı kurulup düşsün.
              NotificationProvider da soketi dinlediği için onun İÇİNDE. */}
          <SocketProvider>
            <NotificationProvider>
              <NavigationContainer>
                <RootNavigator />
              </NavigationContainer>
              <StatusBar style="auto" />
            </NotificationProvider>
          </SocketProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
});
