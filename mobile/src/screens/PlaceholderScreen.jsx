import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';

// Stand-in for menu items that exist in the nav but aren't built yet. Keeps the
// whole drawer navigable so we can fill screens in one by one. The title comes
// from the drawer item's label (passed via initialParams / route name).
export default function PlaceholderScreen({ route }) {
  const title = route?.params?.title || route?.name || 'Ekran';
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="construct-outline" size={40} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Bu ekran yakında eklenecek.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: space.xl,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  title: { fontSize: font.xl, fontWeight: '800', color: colors.text, marginBottom: space.xs },
  subtitle: { fontSize: font.md, color: colors.textMuted },
});
