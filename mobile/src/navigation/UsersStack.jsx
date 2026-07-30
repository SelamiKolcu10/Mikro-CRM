import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DrawerActions } from '@react-navigation/native';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UsersScreen from '../screens/UsersScreen';
import UserDetailScreen from '../screens/UserDetailScreen';
import NotificationBell from '../components/NotificationBell';
import { colors, font, space } from '../theme';

const Stack = createNativeStackNavigator();

/** Kullanıcı Yönetimi — liste → profil detayı. Bkz. ProjectsStack (aynı desen). */
export default function UsersStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: font.lg },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen
        name="UsersList"
        component={UsersScreen}
        options={({ navigation }) => ({
          title: 'Kullanıcı Yönetimi',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
              hitSlop={10}
              style={{ paddingHorizontal: space.xs }}
            >
              <Ionicons name="menu" size={24} color={colors.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <NotificationBell onPress={() => navigation.navigate('Notifications')} />
          ),
        })}
      />
      <Stack.Screen name="UserDetail" component={UserDetailScreen} options={{ title: 'Kullanıcı Profili' }} />
    </Stack.Navigator>
  );
}
