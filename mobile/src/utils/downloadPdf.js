import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Dosya adında sorun çıkarabilecek karakterleri temizle (fatura numaraları
// güvenli ama teklif başlığı gibi serbest metinler buraya girebilir).
const safeName = (name) => name.replace(/[^\w.\-]+/g, '_');

/**
 * Sunucudan PDF çekip cihaza yazar ve sistemin paylaş/aç sayfasını açar.
 *
 * Web'de bu akış blob → <a download> ile tarayıcı indirmesiydi; React
 * Native'de indirilenler klasörü ya da <a> yok, o yüzden dosyayı önbelleğe
 * yazıp Sharing'e devrediyoruz (kullanıcı PDF görüntüleyiciyle açabilir,
 * paylaşabilir veya kaydedebilir).
 *
 * @param {() => Promise<{data: ArrayBuffer}>} request  arraybuffer döndüren
 *        axios çağrısı — Authorization başlığını api.js interceptor'ı ekler.
 * @param {string} filename  uzantısıyla birlikte dosya adı.
 * @returns {Promise<string>} yazılan dosyanın file:// adresi.
 */
export async function downloadAndSharePdf(request, filename) {
  const res = await request();

  const file = new File(Paths.cache, safeName(filename));
  // Aynı faturayı ikinci kez indirmek create()'i patlatmasın.
  if (file.exists) file.delete();
  file.create();
  file.write(new Uint8Array(res.data));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/pdf',
      dialogTitle: filename,
      UTI: 'com.adobe.pdf',
    });
  }

  return file.uri;
}
