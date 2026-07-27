import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';
import DrawerContent from './src/navigation/DrawerContent';
import HomeTabs from './src/navigation/HomeTabs';
import LoginScreen from './src/screens/LoginScreen';
import PlaceholderScreen from './src/screens/PlaceholderScreen';
import { visibleItems } from './src/config/navigation';
import { colors, font } from './src/theme';

const Drawer = createDrawerNavigator();
const AuthStack = createNativeStackNavigator();

// Menu items that live inside the bottom-tab "Home" screen (so they keep the
// bottom bar) rather than as their own drawer screens. DrawerContent routes
// these menu taps to the matching tab/stack screen.
const TAB_ITEMS = ['Dashboard', 'Calendar', 'Tasks', 'Invoices', 'Customers', 'Deals', 'Quotes', 'Catalog', 'Leads', 'Feedbacks', 'Chat'];

function AppDrawer() {
  const { session } = useAuth();
  // Tab items live inside the bottom-tab "Home" screen, so they are NOT
  // separate drawer screens; DrawerContent routes those menu taps to the tab.
  // Everything else is its own (placeholder) drawer screen for now.
  const drawerScreens = visibleItems(session?.role).filter(
    (i) => !TAB_ITEMS.includes(i.name)
  );

  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: font.lg },
        headerShadowVisible: false,
        drawerType: 'front',
        sceneContainerStyle: { backgroundColor: colors.bg },
      }}
    >
      {/* The tabs (and their stacks) render their own headers with a hamburger,
          so the drawer's own header is hidden for this screen. */}
      <Drawer.Screen name="Home" component={HomeTabs} options={{ headerShown: false }} />
      {drawerScreens.map((item) => (
        <Drawer.Screen
          key={item.name}
          name={item.name}
          component={PlaceholderScreen}
          initialParams={{ title: item.label }}
          options={{ title: item.label }}
        />
      ))}
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
              içinde olmalı ki oturum açılıp kapandıkça bağlantı kurulup düşsün. */}
          <SocketProvider>
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
            <StatusBar style="auto" />
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
