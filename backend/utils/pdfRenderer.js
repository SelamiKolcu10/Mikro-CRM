/**
 * Puppeteer singleton browser — lazy launch, tüm isteklerde tek instance
 * yeniden kullanılır; istek başına yeni page. İstek başına Chromium başlatmak
 * PAHALI — singleton şart.
 * Tasarım: docs/superpowers/specs/2026-07-22-quote-catalog-p3a-design.md §2.4
 */

let browserInstance = null;

/**
 * Tarayıcı hâlâ bağlı mı?
 *
 * DİKKAT: Puppeteer v23'te `browser.isConnected()` METODU kaldırıldı, yerine
 * `browser.connected` PROPERTY'si geldi (bu depoda puppeteer ^25). Eski metot
 * çağrısı "isConnected is not a function" ile patlıyordu ve hata yalnız İKİNCİ
 * istekte görünüyordu: ilk çağrıda browserInstance null olduğu için bu satır
 * hiç çalışmıyor, doğrudan launch ediliyor. Yani sunucu açılışından sonraki
 * ilk PDF çalışıp sonraki tüm PDF'ler 500 veriyordu (web + mobil, teklif +
 * fatura). Sürüm yükseldiğinde tekrar kırılmasın diye ikisi de destekleniyor.
 */
function isBrowserAlive(browser) {
  if (!browser) return false;
  if (typeof browser.connected === 'boolean') return browser.connected;
  return typeof browser.isConnected === 'function' ? browser.isConnected() : false;
}

async function getBrowser() {
  if (isBrowserAlive(browserInstance)) {
    return browserInstance;
  }

  const puppeteer = require('puppeteer');
  browserInstance = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  // Tarayıcı beklenmedik kapanırsa referansı temizle ki lazy-restart çalışsın.
  browserInstance.on('disconnected', () => {
    browserInstance = null;
  });

  return browserInstance;
}

/**
 * HTML string'ini A4 PDF Buffer'a dönüştürür.
 * @param {string} html - tam HTML belgesi
 * @returns {Promise<Buffer>} PDF verisi
 */
async function renderHtmlToPdf(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

module.exports = { renderHtmlToPdf };
