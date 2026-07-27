import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DrawerActions } from '@react-navigation/native';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DashboardScreen from '../screens/DashboardScreen';
import CalendarScreen from '../screens/CalendarScreen';
import TasksScreen from '../screens/TasksScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';
import TaskActivityScreen from '../screens/TaskActivityScreen';
import InvoicesScreen from '../screens/InvoicesScreen';
import SalesInvoiceDetailScreen from '../screens/SalesInvoiceDetailScreen';
import OcrInvoiceDetailScreen from '../screens/OcrInvoiceDetailScreen';
import CustomersScreen from '../screens/CustomersScreen';
import LeadsScreen from '../screens/LeadsScreen';
import DealsScreen from '../screens/DealsScreen';
import DealDetailScreen from '../screens/DealDetailScreen';
import NewDealScreen from '../screens/NewDealScreen';
import QuotesScreen from '../screens/QuotesScreen';
import QuoteDetailScreen from '../screens/QuoteDetailScreen';
import NewQuoteScreen from '../screens/NewQuoteScreen';
import CatalogScreen from '../screens/CatalogScreen';
import FeedbacksScreen from '../screens/FeedbacksScreen';
import LeadDetailScreen from '../screens/LeadDetailScreen';
import ChatScreen from '../screens/ChatScreen';
import ConversationScreen from '../screens/ConversationScreen';
import CustomerProfileScreen from '../screens/CustomerProfileScreen';
import CustomerInvoicesScreen from '../screens/CustomerInvoicesScreen';
import PlaceholderScreen from '../screens/PlaceholderScreen';
import { colors, font, space } from '../theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Hamburger for a stack's root screen — opens the outer drawer from anywhere
// in the nested navigation tree.
function HamburgerButton({ navigation }) {
  return (
    <TouchableOpacity
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
      hitSlop={10}
      style={{ paddingHorizontal: space.xs }}
    >
      <Ionicons name="menu" size={24} color={colors.text} />
    </TouchableOpacity>
  );
}

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700', fontSize: font.lg },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.bg },
};

// A stack root shows the hamburger; pushed screens get the default back arrow.
const rootOptions = (title) => ({ navigation }) => ({
  title,
  headerLeft: () => <HamburgerButton navigation={navigation} />,
});

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={rootOptions('Kontrol Paneli')} />
      {/* Empty header title — the screen shows its own large "Takvim" title. */}
      <Stack.Screen name="Calendar" component={CalendarScreen} options={rootOptions('')} />
      {/* Empty header title — the screen shows its own large "Görevler" title. */}
      <Stack.Screen name="Tasks" component={TasksScreen} options={rootOptions('')} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: 'Görev Detayı' }} />
      <Stack.Screen name="TaskActivity" component={TaskActivityScreen} options={{ title: 'Katkı Aktivitesi' }} />
      {/* Empty header title — the screen shows its own large "Faturalar" title. */}
      <Stack.Screen name="Invoices" component={InvoicesScreen} options={rootOptions('')} />
      <Stack.Screen name="SalesInvoiceDetail" component={SalesInvoiceDetailScreen} options={{ title: 'Fatura' }} />
      <Stack.Screen name="OcrInvoiceDetail" component={OcrInvoiceDetailScreen} options={{ title: 'Fatura Detayı' }} />
    </Stack.Navigator>
  );
}

function CustomersStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="CustomersHome" component={CustomersScreen} options={rootOptions('Müşteriler')} />
    </Stack.Navigator>
  );
}

function SalesStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="Deals" component={DealsScreen} options={rootOptions('Fırsatlar')} />
      <Stack.Screen name="DealDetail" component={DealDetailScreen} options={{ title: 'Fırsat Detayı' }} />
      <Stack.Screen name="NewDeal" component={NewDealScreen} options={{ title: 'Yeni Fırsat' }} />
      {/* Empty header title — the screen shows its own large "Teklifler" title. */}
      <Stack.Screen name="Quotes" component={QuotesScreen} options={rootOptions('')} />
      <Stack.Screen name="QuoteDetail" component={QuoteDetailScreen} options={{ title: 'Teklif Detayı' }} />
      <Stack.Screen name="NewQuote" component={NewQuoteScreen} options={{ title: 'Yeni Teklif' }} />
      {/* Empty header title — the screen shows its own large "Ürün Kataloğu" title. */}
      <Stack.Screen name="Catalog" component={CatalogScreen} options={rootOptions('')} />
    </Stack.Navigator>
  );
}

function FormsStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      {/* Empty header title — the screen shows its own large "Formlar" title. */}
      <Stack.Screen name="LeadsHome" component={LeadsScreen} options={rootOptions('')} />
      <Stack.Screen name="LeadDetail" component={LeadDetailScreen} options={{ title: 'Form Detayı' }} />
      {/* Empty header title — the screen shows its own large "Geri Bildirimler" title. */}
      <Stack.Screen name="Feedbacks" component={FeedbacksScreen} options={rootOptions('')} />
      {/* Empty header title — the screen shows its own large "Sohbetler" title. */}
      <Stack.Screen name="Chat" component={ChatScreen} options={rootOptions('')} />
      <Stack.Screen name="Conversation" component={ConversationScreen} options={{ title: 'Sohbet' }} />
      <Stack.Screen name="CustomerProfile" component={CustomerProfileScreen} options={{ title: 'Müşteri Profili' }} />
      <Stack.Screen name="CustomerInvoices" component={CustomerInvoicesScreen} options={{ title: 'Faturalar' }} />
    </Stack.Navigator>
  );
}

function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="SettingsHome"
        component={PlaceholderScreen}
        initialParams={{ title: 'Ayarlar' }}
        options={rootOptions('Ayarlar')}
      />
    </Stack.Navigator>
  );
}

const TAB_ICON = {
  Anasayfa: 'home',
  Müşteriler: 'people',
  Satış: 'trending-up',
  Formlar: 'file-tray',
  Ayarlar: 'settings',
};

// The bottom-tab shell. Each tab is a stack, so the bottom bar stays visible
// even when drilling into detail screens (e.g. a quote's detail).
export default function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, focused }) => (
          <Ionicons name={focused ? TAB_ICON[route.name] : `${TAB_ICON[route.name]}-outline`} size={22} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Anasayfa" component={HomeStack} />
      <Tab.Screen name="Müşteriler" component={CustomersStack} />
      <Tab.Screen name="Satış" component={SalesStack} />
      <Tab.Screen name="Formlar" component={FormsStack} />
      <Tab.Screen name="Ayarlar" component={SettingsStack} />
    </Tab.Navigator>
  );
}
