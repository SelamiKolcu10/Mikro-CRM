import { View, Text, StyleSheet } from 'react-native';
import { colors, font } from '../theme';

/**
 * Yüzdelik ilerleme halkası — react-native-svg olmadan, saf View'larla.
 * (svg Expo Go'da "None of these files exist" hatası verdiği için projeden
 * çıkarılmıştı; grafikler bu yüzden View tabanlı.)
 *
 * Nasıl çalışıyor: halkanın sağ ve sol yarısı ayrı ayrı çiziliyor. Her yarı,
 * kendi yarım kutusuna kırpılan (overflow:hidden) bir yarım halka; kutunun iç
 * kenarı etrafında döndürülüyor (transformOrigin — RN 0.74+). Yarım halka
 * -180° iken kendi kutusunun dışına düşer, yani görünmez; 0°'ye doğru
 * döndükçe yay ortaya çıkar. Sağ yarı ilk %50'yi, sol yarı kalan %50'yi çizer.
 */
export default function ProgressRing({
  progress = 0,
  size = 46,
  stroke = 4,
  color = colors.primary,
  track = colors.border,
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const half = size / 2;

  const rightDeg = (Math.min(pct, 50) / 50) * 180;
  const leftDeg = (Math.max(pct - 50, 0) / 50) * 180;

  const arcBase = { width: half, height: size, borderColor: color };

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.trackRing,
          { width: size, height: size, borderRadius: half, borderWidth: stroke, borderColor: track },
        ]}
      />

      {/* Sağ yarı: %0-50 */}
      <View style={[styles.clip, { left: half, width: half, height: size }]}>
        <View
          style={[
            arcBase,
            {
              borderTopWidth: stroke,
              borderRightWidth: stroke,
              borderBottomWidth: stroke,
              borderTopRightRadius: half,
              borderBottomRightRadius: half,
              transformOrigin: 'left center',
              transform: [{ rotate: `${rightDeg - 180}deg` }],
            },
          ]}
        />
      </View>

      {/* Sol yarı: %50-100 */}
      <View style={[styles.clip, { left: 0, width: half, height: size }]}>
        <View
          style={[
            arcBase,
            {
              borderTopWidth: stroke,
              borderLeftWidth: stroke,
              borderBottomWidth: stroke,
              borderTopLeftRadius: half,
              borderBottomLeftRadius: half,
              transformOrigin: 'right center',
              transform: [{ rotate: `${leftDeg - 180}deg` }],
            },
          ]}
        />
      </View>

      <View style={[styles.label, { width: size, height: size }]}>
        <Text style={[styles.labelText, { color }]}>{pct}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trackRing: { position: 'absolute' },
  clip: { position: 'absolute', overflow: 'hidden' },
  label: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  labelText: { fontSize: font.xs, fontWeight: '800' },
});
