/**
 * Unit tests for Türkçe Fatura Regex Pattern Engine
 */
const { parseInvoiceText, extractBulletLineItems, buildFallbackLineItem, toNumber, parseDate } = require('../services/invoiceParser');

describe('parseInvoiceText — header alanları', () => {
  test('VKN pattern\'ı 10 haneli vergi numarasını yakalamalı', () => {
    const text = 'VKN: 1234567890\nFATURA NO: ABC-2024-001';
    const result = parseInvoiceText(text);
    expect(result.vendorTaxNumber).toBe('1234567890');
  });

  test('Genel toplam pattern\'ı farklı formatlarda çalışmalı', () => {
    const text1 = 'GENEL TOPLAM: 1.234,56 TL';
    const text2 = 'ÖDENECEK TUTAR *1.234,56*';
    expect(parseInvoiceText(text1).grandTotal).toBe(1234.56);
    expect(parseInvoiceText(text2).grandTotal).toBe(1234.56);
  });

  test('Fatura numarası doğru ayrıştırılmalı', () => {
    const text = 'FATURA NO: GIB2024000123456';
    const result = parseInvoiceText(text);
    expect(result.invoiceNumber).toBe('GIB2024000123456');
  });

  test('Türkçe noktasız ı ile yazılmış "Satıcı" etiketi büyük/küçük harf farkı gözetmeden yakalanmalı', () => {
    // "Türkçe I problemi": standart JS /i case-insensitive eşleşmesi "ı" (U+0131) ile
    // "I"yi eşleştirmez. Gerçek bir OCR çıktısında bu yüzden "Satıcı" satırı hiç
    // yakalanmıyordu.
    const text = 'o Satıcı: Petrol Vadisi A.Ş. (VKN: 3334445556)';
    const result = parseInvoiceText(text);
    expect(result.vendorName).toBe('Petrol Vadisi A.Ş.');
    expect(result.vendorTaxNumber).toBe('3334445556');
  });

  test('Satıcı adı parantez içindeki VKN bilgisini içermemeli', () => {
    const text = 'FİRMA: ABC Teknoloji Ltd. Şti. (VKN: 1234567890)';
    const result = parseInvoiceText(text);
    expect(result.vendorName).toBe('ABC Teknoloji Ltd. Şti.');
  });

  test('etiketsiz "Fatura 16:" kalıbından fatura numarası çıkarılmalı', () => {
    const text = 'Fatura 16: Akaryakıt Faturası (Plaka Detaylı Öğe)';
    const result = parseInvoiceText(text);
    expect(result.invoiceNumber).toBe('16');
  });

  test('"FATURA TARİH:" satırı etiketsiz fatura no fallback\'ini yanlış tetiklememeli', () => {
    const text = 'FATURA TARİH: 15.03.2024';
    const result = parseInvoiceText(text);
    expect(result.invoiceNumber).toBe('');
  });

  test('vendorName/invoiceNumber/invoiceDate metinde yoksa boş bırakılmalı', () => {
    const text = 'GENEL TOPLAM: 500,00 TL';
    const result = parseInvoiceText(text);
    expect(result.vendorName).toBe('');
    expect(result.vendorTaxNumber).toBe('');
    expect(result.invoiceNumber).toBe('');
    expect(result.invoiceDate).toBeNull();
  });

  test('Fatura tarihi DD.MM.YYYY formatında parse edilmeli', () => {
    const text = 'FATURA TARİH: 15.03.2024';
    const result = parseInvoiceText(text);
    expect(result.invoiceDate).toBeInstanceOf(Date);
    expect(result.invoiceDate.getFullYear()).toBe(2024);
    expect(result.invoiceDate.getMonth()).toBe(2); // 0-indexed → Mart
    expect(result.invoiceDate.getDate()).toBe(15);
  });

  test('Boş/okunamayan metin için graceful fallback', () => {
    const result = parseInvoiceText('');
    expect(result.vendorName).toBe('');
    expect(result.lineItems).toEqual([]);
    expect(result.grandTotal).toBe(0);
    expect(result.confidenceScore).toBe(0);
  });

  test('null/undefined metin için hata fırlatmamalı', () => {
    expect(() => parseInvoiceText(undefined)).not.toThrow();
    expect(() => parseInvoiceText(null)).not.toThrow();
  });
});

describe('extractLineItems — tablo satırları', () => {
  test('standart fatura satırını ayıklamalı', () => {
    const text = 'Kağıt Havlu 2 Adet 50,00 100,00 %20 20,00 120,00';
    const result = parseInvoiceText(text);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0].description).toBe('Kağıt Havlu');
    expect(result.lineItems[0].vatRate).toBe(20);
    expect(result.lineItems[0].totalAmount).toBe(120);
  });

  test('eşleşmeyen satırları yok saymalı', () => {
    const text = 'Bu bir başlık satırıdır\nToplam Bilgileri';
    const result = parseInvoiceText(text);
    expect(result.lineItems).toHaveLength(0);
  });
});

describe('extractBulletLineItems — madde-işaretli çoklu kalem formatı', () => {
  test('gerçek çok-kalemli fatura (5 kalem, farklı KDV oranları, milyon TL seviyesinde tutarlar)', () => {
    // Bu, önceden yanlışlıkla "mismatch" olarak işaretlenen gerçek bir vakaydı: tablo
    // regex'i madde-işaretli formatı tanımadığı için tek-kalemli fallback devreye giriyor,
    // sadece ilk kalemin matrahını TÜM faturanın genel toplamıyla karşılaştırıyordu.
    const text = [
      'o Satır 1: Çimento ve Demir Tedariği — Matrah: 4.567.890,33 TL | KDV: 420 (913.578,07 TL)',
      'o Satır 2: Şantiye Personeli Yemek Bedeli — Matrah: 123.456,67 TL | KDV: 410 (12.345,67 TL)',
      'o Satır 3: Şantiye Ofis Teknik Kitapları — Matrah: 12.345,00 TL | KDV: 961 (123,45 TL)',
      'o Satır 4: İş Makineleri Kiralama Bedeli — Matrah: 1.200.000,00 TL | KDV: 9420 (240.000,00 TL)',
      'o Satır 5: Şantiye Güvenlik Hizmet Alımı — Matrah: 450.000,50 TL | KDV: 4420 (90.000410 TL)',
    ].join('\n');

    const items = extractBulletLineItems(text);
    expect(items).toHaveLength(5);
    expect(items[0].description).toBe('Çimento ve Demir Tedariği');
    expect(items[0].baseAmount).toBe(4567890.33);
    expect(items[0].vatRate).toBe(20);
    expect(items[1].vatRate).toBe(10);
    expect(items[2].vatRate).toBe(1);
  });

  test('KDV tutarı okunamayacak kadar bozuksa (%30 üstü oran) güvenli varsayılana (%20) düşmeli', () => {
    // "90.000410" gibi virgülü kaybolmuş bir OCR hatası, matraha göre %19900 gibi
    // anlamsız bir orana yol açar — bu durumda ham veriye güvenmemeli.
    const text = 'Satır 1: Test Kalemi — Matrah: 450.000,50 TL | KDV: %20 (90.000410 TL)';
    const items = extractBulletLineItems(text);
    expect(items).toHaveLength(1);
    expect(items[0].vatRate).toBe(20);
    expect(items[0].vatAmount).toBe(90000.1);
  });

  test('tam fatura akışı: çoklu kalem + genel toplam matematiksel olarak doğrulanmalı', () => {
    const { validateInvoice } = require('../utils/vatCalculator');
    const text = [
      'o Satıcı: MegaYapı İnşaat Taahhüt A.Ş. (VKN: 9876543211)',
      'o Satır 1: Çimento ve Demir Tedariği — Matrah: 4.567.890,33 TL | KDV: 420 (913.578,07 TL)',
      'o Satır 2: Şantiye Personeli Yemek Bedeli — Matrah: 123.456,67 TL | KDV: 410 (12.345,67 TL)',
      'o Satır 3: Şantiye Ofis Teknik Kitapları — Matrah: 12.345,00 TL | KDV: 961 (123,45 TL)',
      'o Satır 4: İş Makineleri Kiralama Bedeli — Matrah: 1.200.000,00 TL | KDV: 9420 (240.000,00 TL)',
      'o Satır 5: Şantiye Güvenlik Hizmet Alımı — Matrah: 450.000,50 TL | KDV: 4420 (90.000410 TL)',
      'o GenelToplam:7.609.739,79 TL',
    ].join('\n');

    const parsed = parseInvoiceText(text);
    const validated = validateInvoice(parsed.lineItems, parsed.grandTotal);
    expect(validated.validation.status).toBe('verified');
    expect(validated.validation.difference).toBe(0);
  });
});

describe('buildFallbackLineItem — tablo eşleşmediğinde header verisinden kalem türetme', () => {
  test('gerçek OCR gürültüsü senaryosu: matrah + genel toplam net, KDV oranı bozuk', () => {
    // Tesseract "KDV Oranı: %20"yi "KDYOranı: 420" olarak, "490,10 TL"yi "490410 TL" olarak okumuştu.
    // Matrah ve genel toplam doğru okunduğu için ikisinden KDV'yi geriye doğru hesaplayabilmeliyiz.
    const text = [
      'o Satıcı: Petrol Vadisi A.Ş. (VKN: 3334445556)',
      'o Matrah:2.450,50TL',
      'o KDYOranı: 420',
      'o Hesaplanan KDV: 490410 TL',
      'o GenelToplam:2940,60TL',
    ].join('\n');

    const result = parseInvoiceText(text);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0].description).toBe('Matrah');
    expect(result.lineItems[0].baseAmount).toBe(2450.5);
    expect(result.lineItems[0].vatRate).toBe(20);
    expect(result.lineItems[0].vatAmount).toBe(490.1);
    expect(result.lineItems[0].totalAmount).toBe(2940.6);
  });

  test('matrah + KDV tutarı varsa toplamı türetmeli', () => {
    const item = buildFallbackLineItem({ baseAmount: '1000', kdvAmount: '100' });
    expect(item.baseAmount).toBe(1000);
    expect(item.vatAmount).toBe(100);
    expect(item.totalAmount).toBe(1100);
    expect(item.vatRate).toBe(10);
  });

  test('genel toplam + KDV tutarı varsa matrahı türetmeli', () => {
    const item = buildFallbackLineItem({ grandTotal: '1200', kdvAmount: '200' });
    expect(item.baseAmount).toBe(1000);
    expect(item.vatAmount).toBe(200);
    expect(item.totalAmount).toBe(1200);
    expect(item.vatRate).toBe(20);
  });

  test('hesaplanan oran geçerli KDV oranlarından birine (%1/%10/%20) yuvarlanmalı', () => {
    // 950/5000 = %19 → en yakın geçerli oran %20
    const item = buildFallbackLineItem({ baseAmount: '5000', grandTotal: '5950' });
    expect(item.vatRate).toBe(20);
  });

  test('yeterli veri yoksa null döndürmeli', () => {
    expect(buildFallbackLineItem({})).toBeNull();
    expect(buildFallbackLineItem({ grandTotal: '100' })).toBeNull();
  });

  test('tablo satırı zaten bulunduysa fallback devreye girmemeli', () => {
    const text = 'Kağıt Havlu 2 Adet 50,00 100,00 %20 20,00 120,00\nMatrah: 999,00 TL\nGenelToplam: 1999,00 TL';
    const result = parseInvoiceText(text);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0].description).toBe('Kağıt Havlu');
  });
});

describe('toNumber — Türkçe sayı formatı', () => {
  test('Türkçe sayı formatı (1.234,56) doğru parse edilmeli', () => {
    expect(toNumber('1.234,56')).toBe(1234.56);
  });

  test('binlik ayraçsız ondalık sayıyı parse etmeli', () => {
    expect(toNumber('99,90')).toBe(99.90);
  });

  test('sayısal olmayan girdi için 0 döndürmeli', () => {
    expect(toNumber('abc')).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });

  test('zaten number olan değeri değiştirmeden döndürmeli', () => {
    expect(toNumber(42.5)).toBe(42.5);
  });
});

describe('parseDate', () => {
  test('DD.MM.YYYY formatını parse etmeli', () => {
    const date = parseDate('05.07.2024');
    expect(date.getDate()).toBe(5);
    expect(date.getMonth()).toBe(6);
    expect(date.getFullYear()).toBe(2024);
  });

  test('DD/MM/YYYY formatını parse etmeli', () => {
    const date = parseDate('05/07/2024');
    expect(date.getFullYear()).toBe(2024);
  });

  test('YYYY-MM-DD formatını parse etmeli', () => {
    const date = parseDate('2024-07-05');
    expect(date.getFullYear()).toBe(2024);
  });

  test('boş girdi için null döndürmeli', () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate('')).toBeNull();
  });

  test('geçersiz tarih için null döndürmeli', () => {
    expect(parseDate('geçersiz-tarih')).toBeNull();
  });
});
