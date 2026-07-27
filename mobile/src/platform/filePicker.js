import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

/**
 * Cihazdan dosya alma sarmalayıcısı — kamera/galeri/dosya seçici API'leri tek
 * yerde izole (bkz. platform/tokenStorage.js ile aynı desen: cihaza özgü
 * API'ler iş mantığına gömülmez). Üç kaynak da AYNI normalize biçimi döner:
 *
 *   { uri, name, mimeType }[]   — iptal edilirse boş dizi
 *
 * Böylece yükleyen taraf (invoiceV2Service.upload) dosyanın nereden geldiğini
 * hiç bilmez.
 */

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

/** Bazı platformlarda mimeType/fileName boş gelir — uzantıdan tamamla. */
function normalize(asset, fallbackPrefix) {
  const uri = asset.uri;
  const ext = (uri.split('?')[0].split('.').pop() || '').toLowerCase();
  const name = asset.fileName || asset.name || `${fallbackPrefix}-${Date.now()}.${ext || 'jpg'}`;
  const mimeType = asset.mimeType || MIME_BY_EXT[ext] || 'image/jpeg';
  return { uri, name, mimeType };
}

/** Kamerayı açar, tek kare çeker. İzin verilmezse hata fırlatır. */
export async function pickFromCamera() {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Kamera izni verilmedi. Ayarlar\'dan izin verebilirsin.');
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8, // OCR için yeterli, yükleme boyutunu makul tutar
  });
  if (result.canceled) return [];
  return result.assets.map((a) => normalize(a, 'fatura'));
}

/** Galeriden bir veya birden fazla görsel seçtirir. */
export async function pickFromGallery(selectionLimit = 20) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Galeri izni verilmedi. Ayarlar\'dan izin verebilirsin.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit,
    quality: 0.8,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => normalize(a, 'fatura'));
}

/** Dosyalar uygulamasından seçtirir — PDF dahil. İzin gerektirmez. */
export async function pickDocuments(types) {
  const result = await DocumentPicker.getDocumentAsync({
    type: types,
    multiple: true,
    copyToCacheDirectory: true, // yükleme sırasında URI erişilebilir kalsın
  });
  if (result.canceled) return [];
  return (result.assets || []).map((a) => normalize(a, 'fatura'));
}
