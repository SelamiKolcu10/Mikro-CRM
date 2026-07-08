/**
 * Türkçe Fatura Regex Pattern Engine
 *
 * Strateji: Tesseract'tan gelen ham metni satır satır tarıyoruz.
 * Her satırı bilinen Türkçe fatura kalıplarıyla (pattern) eşleştiriyoruz.
 * Bulunan alanlardan yapılandırılmış bir fatura objesi oluşturuyoruz.
 */

const { VALID_VAT_RATES } = require('../utils/constants');

// Geçerli TR KDV oranlarının en üstü %20; bunun belirgin şekilde üzerindeki bir
// oran neredeyse kesinlikle OCR gürültüsüdür (virgül kaybı, birleşmiş rakamlar vb.)
const MAX_PLAUSIBLE_VAT_RATE = 30;

/**
 * Türkçe'ye özgü büyük harfe çevirme: standart JS `/i` case-insensitive eşleşmesi
 * "ı" (noktasız küçük i, U+0131) ile "I" (normal büyük I) veya "İ" (noktalı büyük I)
 * ile "i"yi doğru eşleştirmez ("Türkçe I problemi"). Pattern eşleştirmesini bu
 * yüzden `toLocaleUpperCase('tr-TR')` ile normalize edilmiş satır üzerinde yapıyoruz.
 */
function toTurkishUpper(str) {
  return str.toLocaleUpperCase('tr-TR');
}

// ——— Ana Alan Kalıpları — hepsi Türkçe-büyük-harf normalize edilmiş satıra karşı,
// `d` (hasIndices) bayrağıyla eşleştirilir; orijinal (doğru harfli) değer daha sonra
// aynı indekslerle ham satırdan kesilip alınır. ———
const PATTERNS = {
  // Satıcı bilgileri — "(" veya "VKN" görülünce dur, aksi halde parantez içindeki
  // vergi no gibi bilgiler de satıcı adına karışır.
  vendorName: /(?:ÜNVANI?|FİRMA|SATICI|ADI\s*SOYADI)\s*[:\-]?\s*(.+?)(?=\s*\(|\s*VKN|\s*V\.?K\.?N\.?\s*[:\-]|$)/d,
  vendorTaxNumber: /(?:VKN|V\.?K\.?N\.?|VERGİ\s*(?:NO|NUMARASI|KİMLİK))\s*[:\-]?\s*(\d{10,11})/d,
  invoiceNumber: /(?:FATURA\s*(?:NO|NUMARASI|NUM)|SERİ\s*(?:NO|SIRA)|BELGE\s*NO)\s*[:\-]?\s*([A-ZÇĞİÖŞÜ0-9\-\/]+)/d,
  invoiceDate: /(?:TARİH|DÜZENLENME\s*TARİHİ|FATURA\s*TARİH)\s*[:\-]?\s*(\d{1,2}[.\/\-]\d{1,2}[.\/\-]\d{2,4})/d,

  // Toplam değerler
  grandTotal: /(?:GENEL\s*TOPLAM|G\.?\s*TOPLAM|TOPLAM\s*TUTAR|ÖDENECEK(?:\s*TUTAR)?|NET\s*TOPLAM)\s*[:\-]?\s*[*]?([\d.,]+)\s*(?:TL|₺)?/d,
  baseAmount: /(?:MATRAH|KDV\s*HARİÇ|ARA\s*TOPLAM|TOPLAM\s*MATRAH)\s*[:\-]?\s*[*]?([\d.,]+)\s*(?:TL|₺)?/d,

  // KDV bilgileri
  kdvAmount: /(?:KDV\s*(?:TUTARI|TOPLAMI)|HESAPLANAN\s*KDV)\s*[:\-]?\s*[*]?([\d.,]+)\s*(?:TL|₺)?/d,
};

// invoiceNumber için dar kapsamlı fallback: "Fatura 16:" gibi etiketsiz ama
// rakam + ":" ile biten kalıpları yakalar. Bilinçli olarak dar tutuldu — "FATURA
// TARİH:" gibi başka alanlarla karışmaması için sadece rakam kabul eder.
const INVOICE_NUMBER_FALLBACK = /FATURA\s+(\d+)\s*[:\-]/d;

// Satır kalemi tablosu: Açıklama  Miktar  [Adet]  BirimFiyat  Matrah  %KDV  KDVTutarı  Toplam
const LINE_ITEM_PATTERN = /^(.+?)\s+(\d+(?:[.,]\d+)?)\s+(?:Adet|AD|adet)?\s*([\d.,]+)\s+([\d.,]+)\s+%?(\d{1,2})\s+([\d.,]+)\s+([\d.,]+)$/;

// Madde-işaretli çoklu kalem formatı: "Satır 1: Açıklama — Matrah: X TL | KDV: <gürültü> (Y TL)"
// KDV oranı burada genelde OCR gürültüsünden dolayı bozuk okunur (%20 yerine "420" gibi),
// bu yüzden oranı kullanmıyoruz — matrah + KDV tutarından geriye doğru hesaplayıp en yakın
// geçerli KDV oranına (%1/%10/%20) yuvarlıyoruz.
const BULLET_LINE_ITEM_PATTERN = /SATIR\s*\d+\s*:\s*(.+?)\s*[—\-]\s*MATRAH\s*[:\-]?\s*([\d.,]+)\s*TL\s*\|\s*KDV\s*[:\-]?\s*\S+\s*\(\s*([\d.,]+)\s*TL\s*\)/gd;

const HEADER_FIELDS = ['vendorName', 'vendorTaxNumber', 'invoiceNumber', 'invoiceDate', 'grandTotal', 'baseAmount', 'kdvAmount'];

/**
 * @param {string} rawText - Tesseract'tan gelen ham OCR metni
 * @returns {Object} - Yapılandırılmış fatura verisi
 */
function parseInvoiceText(rawText) {
  const text = String(rawText || '');
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const found = {};

  // 1. Header alanlarını bul — Türkçe büyük harfe çevrilmiş satırda eşleştir,
  // ama değeri orijinal (doğru harfli) satırdan aynı indekslerle kes.
  for (const line of lines) {
    const upperLine = toTurkishUpper(line);
    for (const field of HEADER_FIELDS) {
      if (found[field]) continue;
      const match = upperLine.match(PATTERNS[field]);
      if (match && match[1] && match.indices && match.indices[1]) {
        const [start, end] = match.indices[1];
        found[field] = line.slice(start, end).trim();
      }
    }

    // invoiceNumber hâlâ bulunamadıysa dar kapsamlı fallback'i dene
    if (!found.invoiceNumber) {
      const fallbackMatch = upperLine.match(INVOICE_NUMBER_FALLBACK);
      if (fallbackMatch && fallbackMatch.indices && fallbackMatch.indices[1]) {
        const [start, end] = fallbackMatch.indices[1];
        found.invoiceNumber = line.slice(start, end).trim();
      }
    }
  }

  // 2. Satır kalemlerini ayıkla — önce sıkı tablo formatını, sonra madde-işaretli
  // çoklu kalem formatını dene, ikisi de bulamazsa header verisinden tek kalem türet.
  let lineItems = extractLineItems(lines);

  if (lineItems.length === 0) {
    lineItems = extractBulletLineItems(text);
  }

  if (lineItems.length === 0) {
    const fallbackItem = buildFallbackLineItem(found);
    if (fallbackItem) lineItems = [fallbackItem];
  }

  // 3. Sayısal değerleri normalize et
  const grandTotal = toNumber(found.grandTotal);

  // 4. Confidence: Kaç alan bulundu?
  const foundCount = HEADER_FIELDS.filter((f) => found[f]).length + (lineItems.length > 0 ? 1 : 0);
  const confidenceScore = Math.round((foundCount / (HEADER_FIELDS.length + 1)) * 100);

  return normalizeInvoiceData({
    vendorName: found.vendorName || '',
    vendorTaxNumber: found.vendorTaxNumber || '',
    invoiceNumber: found.invoiceNumber || '',
    invoiceDate: found.invoiceDate || null,
    lineItems,
    grandTotal,
    confidenceScore,
  });
}

/**
 * Tablo formatındaki satır kalemlerini ayıklar.
 * Eşleşme bulunamazsa, matrah/KDV bilgisinden tek satırlık bir kalem türetir (fallback).
 */
function extractLineItems(lines) {
  const items = [];

  for (const line of lines) {
    const match = line.match(LINE_ITEM_PATTERN);
    if (!match) continue;

    const [, description, quantity, unitPrice, baseAmount, vatRate, vatAmount, totalAmount] = match;
    items.push({
      description: description.trim(),
      quantity: toNumber(quantity) || 1,
      unitPrice: toNumber(unitPrice),
      baseAmount: toNumber(baseAmount),
      vatRate: toNumber(vatRate),
      vatAmount: toNumber(vatAmount),
      totalAmount: toNumber(totalAmount),
    });
  }

  return items;
}

/**
 * Madde-işaretli çoklu kalem formatını ayıklar:
 * "Satır 1: Açıklama — Matrah: 1.000,00 TL | KDV: %20 (200,00 TL)"
 * Metnin tamamı üzerinde (satır satır değil) çalışır çünkü OCR bazen tek bir
 * kalemi iki satıra bölebiliyor (örn. tutar bir satırda, "TL" bir sonrakinde).
 */
function extractBulletLineItems(rawText) {
  const upperText = toTurkishUpper(rawText);
  const items = [];

  for (const match of upperText.matchAll(BULLET_LINE_ITEM_PATTERN)) {
    if (!match.indices) continue;

    const [, descStart, baseStart, vatStart] = [
      null,
      match.indices[1],
      match.indices[2],
      match.indices[3],
    ];
    if (!descStart || !baseStart || !vatStart) continue;

    const description = rawText.slice(descStart[0], descStart[1]).trim();
    const baseAmount = toNumber(rawText.slice(baseStart[0], baseStart[1]));
    const vatAmount = toNumber(rawText.slice(vatStart[0], vatStart[1]));

    if (baseAmount <= 0) continue;

    const rawRate = (vatAmount / baseAmount) * 100;
    let vatRate, finalVatAmount;

    if (rawRate > 0 && rawRate <= MAX_PLAUSIBLE_VAT_RATE) {
      // Makul aralıkta — OCR'ın okuduğu KDV tutarına güven, en yakın geçerli orana yuvarla.
      vatRate = snapToValidVatRate(rawRate);
      finalVatAmount = vatAmount;
    } else {
      // KDV tutarı okunamayacak kadar bozuk (ör. virgül kaybolup rakamlar birleşmiş).
      // Türkiye'de en yaygın kullanılan genel orana (%20) göre yeniden hesapla.
      vatRate = 20;
      finalVatAmount = roundToCent(baseAmount * (vatRate / 100));
    }

    items.push({
      description: description || `Kalem ${items.length + 1}`,
      quantity: 1,
      unitPrice: baseAmount,
      baseAmount,
      vatRate,
      vatAmount: finalVatAmount,
      totalAmount: roundToCent(baseAmount + finalVatAmount),
    });
  }

  return items;
}

/**
 * Tablo satırı bulunamadığında, header'da yakalanan matrah/genel toplam/KDV
 * tutarından tek satırlık bir "Matrah" kalemi türetir.
 * Öncelik: (matrah + genelToplam) > (matrah + kdvTutarı) > (genelToplam + kdvTutarı)
 * — çünkü OCR'da en sık bozulan alan KDV oranı/tutarı oluyor, matrah ve genel
 * toplam genelde daha net okunuyor.
 */
function buildFallbackLineItem(found) {
  const base = toNumber(found.baseAmount);
  const total = toNumber(found.grandTotal);
  const kdv = toNumber(found.kdvAmount);

  let baseAmount, vatAmount, totalAmount;

  if (base > 0 && total > base) {
    baseAmount = base;
    totalAmount = total;
    vatAmount = roundToCent(total - base);
  } else if (base > 0 && kdv > 0) {
    baseAmount = base;
    vatAmount = kdv;
    totalAmount = roundToCent(base + kdv);
  } else if (total > 0 && kdv > 0 && total > kdv) {
    totalAmount = total;
    vatAmount = kdv;
    baseAmount = roundToCent(total - kdv);
  } else {
    return null;
  }

  const rawRate = (vatAmount / baseAmount) * 100;
  const vatRate = snapToValidVatRate(rawRate);

  return {
    description: 'Matrah',
    quantity: 1,
    unitPrice: baseAmount,
    baseAmount,
    vatRate,
    vatAmount,
    totalAmount,
  };
}

/**
 * Hesaplanan KDV oranını en yakın geçerli TR KDV oranına (%1, %10, %20) yuvarlar.
 */
function snapToValidVatRate(rawRate) {
  return VALID_VAT_RATES.reduce((closest, rate) =>
    Math.abs(rate - rawRate) < Math.abs(closest - rawRate) ? rate : closest
  );
}

function roundToCent(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Normalize parsed invoice data — ensure all fields have correct types.
 */
function normalizeInvoiceData(data) {
  const normalized = {
    vendorName: String(data.vendorName || '').trim(),
    vendorTaxNumber: String(data.vendorTaxNumber || '').trim(),
    invoiceNumber: String(data.invoiceNumber || '').trim(),
    invoiceDate: parseDate(data.invoiceDate),
    grandTotal: toNumber(data.grandTotal),
    confidenceScore: Math.min(100, Math.max(0, toNumber(data.confidenceScore))),
    lineItems: [],
  };

  if (Array.isArray(data.lineItems)) {
    normalized.lineItems = data.lineItems.map((item, index) => ({
      description: String(item.description || `Kalem ${index + 1}`).trim(),
      quantity: toNumber(item.quantity) || 1,
      unitPrice: toNumber(item.unitPrice),
      baseAmount: toNumber(item.baseAmount),
      vatRate: toNumber(item.vatRate),
      vatAmount: toNumber(item.vatAmount),
      totalAmount: toNumber(item.totalAmount),
    }));
  }

  return normalized;
}

/**
 * Türkçe sayı formatını ("1.234,56") number'a çevirir.
 * Kural: nokta + virgül birlikteyse nokta binlik ayracı, virgül ondalık ayracıdır.
 * Sadece virgül varsa ondalık ayracıdır. Sadece nokta varsa ve son grup 2 haneli
 * değilse (kuruş değilse) binlik ayracı sayılıp kaldırılır.
 */
function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;

  let cleaned = value.replace(/[^\d.,-]/g, '');
  if (!cleaned) return 0;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    cleaned = cleaned.replace(',', '.');
  } else if (hasDot) {
    const parts = cleaned.split('.');
    const lastPart = parts[parts.length - 1];
    if (parts.length > 2 || lastPart.length !== 2) {
      cleaned = parts.join('');
    }
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * DD.MM.YYYY / DD/MM/YYYY / YYYY-MM-DD formatlarını Date'e çevirir.
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;

  const str = String(dateStr).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(str);
  }

  const match = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (match) {
    return new Date(`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`);
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

module.exports = {
  parseInvoiceText,
  normalizeInvoiceData,
  extractLineItems,
  extractBulletLineItems,
  buildFallbackLineItem,
  toNumber,
  parseDate,
};
