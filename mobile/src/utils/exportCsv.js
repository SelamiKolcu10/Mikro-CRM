import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Alanı CSV için güvenli hale getir: tırnak/virgül/satır sonu içeriyorsa
// tırnak içine al, içteki tırnakları ikile.
const cell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /["\n,;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Ekranda zaten yüklü olan veriyi CSV yapıp sistemin paylaş sayfasına verir.
 *
 * Sunucuya gitmez — bu liste için backend'de dışa aktarma ucu yok, veri de
 * halihazırda elimizde. Excel'in Türkçe yerelde virgülü ayraç saymaması için
 * noktalı virgül kullanılıyor ve dosya BOM ile başlıyor (aksi halde Türkçe
 * karakterler bozuk görünür).
 *
 * @param {string[]} headers  sütun başlıkları
 * @param {Array<Array<*>>} rows  satırlar
 * @param {string} filename  .csv uzantılı dosya adı
 */
export async function shareCsv(headers, rows, filename) {
  const body = [headers, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');

  const file = new File(Paths.cache, filename.replace(/[^\w.\-]+/g, '_'));
  if (file.exists) file.delete();
  file.create();
  file.write(`﻿${body}`);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      dialogTitle: filename,
      UTI: 'public.comma-separated-values-text',
    });
  }

  return file.uri;
}
