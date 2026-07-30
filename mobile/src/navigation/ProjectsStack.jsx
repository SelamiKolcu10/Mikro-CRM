import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DrawerActions } from '@react-navigation/native';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ProjectsScreen from '../screens/ProjectsScreen';
import ProjectDetailScreen from '../screens/ProjectDetailScreen';
import NotificationBell from '../components/NotificationBell';
import { colors, font, space } from '../theme';

const Stack = createNativeStackNavigator();

/**
 * Projeler çekmece öğesi bir stack — liste → detay gezinmesi için. Sekmelerin
 * (HomeTabs) aksine alt bar taşımaz; kökte hamburger, detayda geri oku çıkar.
 * Bu yüzden App.js bu çekmece ekranının kendi başlığını gizler.
 */
export default function ProjectsStack() {
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
        name="ProjectsList"
        component={ProjectsScreen}
        options={({ navigation }) => ({
          title: 'Projeler',
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
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} options={{ title: 'Proje' }} />
    </Stack.Navigator>
  );
}
