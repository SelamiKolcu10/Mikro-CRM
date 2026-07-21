/**
 * P2 (Müşteri Aktivite Timeline) görsel doğrulaması — Customers sayfasında
 * bir satıra tıklayıp drawer'ın gerçekten açıldığını, timeline'ın render
 * olduğunu ve log-activity formunun çalıştığını tarayıcıda kanıtlar.
 * Ad-hoc çalıştırılır: `node scripts/verify-customer-timeline.js`
 * (backend :5000 ve frontend :5173 önceden ayakta olmalı).
 */
const puppeteer = require('puppeteer');
const path = require('path');

const FRONTEND_URL = 'http://localhost:5173';
// Doğrulama ekran görüntüleri geçici çıktıdır — repo'ya değil, oturumun
// scratchpad dizinine yazılır (yoksa cwd altına verify-shots/ düşer).
const SHOT_DIR = process.env.SHOT_DIR || path.join(__dirname, 'verify-shots');
const fs = require('fs');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

async function login(page, email, password) {
  await page.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle0' });
  await page.type('input[name="email"]', email);
  await page.type('input[type="password"]', password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('button[type="submit"]'),
  ]);
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--window-size=1400,1000'] });
  const errors = [];

  try {
    // Her rol kendi izole browser context'inde — localStorage token'ı origin
    // bazında paylaşılır, aynı context'te ikinci sayfa açmak admin oturumunu
    // görürdü (login ekranına hiç düşmezdi).
    const adminContext = await browser.createBrowserContext();
    // --- 1) Admin: drawer açılışı + timeline render + log activity ---
    const page = await adminContext.newPage();
    page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`);
    });

    await login(page, 'admin@microcrm.com', 'admin123');
    await page.goto(`${FRONTEND_URL}/customers`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('table tbody tr.is-clickable-row', { timeout: 10000 });

    // Ahmet Yılmaz satırını bul (deal'leri olan müşteri — RBAC testinde de kullanılacak)
    const rows = await page.$$('table tbody tr.is-clickable-row');
    let targetRow = rows[0];
    for (const row of rows) {
      const text = await row.evaluate((el) => el.textContent);
      if (text.includes('Ahmet')) { targetRow = row; break; }
    }
    await targetRow.click();

    await page.waitForSelector('.customer-detail-drawer', { timeout: 10000 });
    await page.waitForFunction(() => !document.querySelector('.customer-detail-drawer .loading-spinner'), { timeout: 10000 });
    await page.waitForSelector('.customer-timeline', { timeout: 10000 });
    await page.screenshot({ path: path.join(SHOT_DIR, '1-admin-drawer-open.png'), fullPage: false });

    const dealChipCount = await page.$$eval('.customer-timeline--deal, .customer-timeline--deal-won, .customer-timeline--deal-lost', (els) => els.length);
    console.log(`[admin] görünen deal timeline öğesi sayısı: ${dealChipCount} (>0 beklenir)`);

    // Log activity: not ekle
    await page.click('.log-activity-type-btn'); // ilk buton = 'note'
    await page.type('.log-activity-form textarea', 'Puppeteer doğrulama notu');
    await Promise.all([
      page.waitForFunction(
        () => document.querySelector('.customer-timeline')?.textContent.includes('Puppeteer doğrulama notu'),
        { timeout: 10000 }
      ),
      page.click('.log-activity-form button[type="submit"]'),
    ]);
    await page.waitForFunction(() => document.querySelector('.log-activity-form textarea')?.value === '', { timeout: 10000 });
    await page.screenshot({ path: path.join(SHOT_DIR, '2-admin-note-logged.png'), fullPage: false });
    console.log('[admin] not eklendi ve timeline\'da göründü: OK');

    await page.close();
    await adminContext.close();

    // --- 2) Intern: aynı müşteri, deal öğeleri GÖRÜNMEMELİ ---
    const internContext = await browser.createBrowserContext();
    const internPage = await internContext.newPage();
    internPage.on('pageerror', (e) => errors.push(`[intern pageerror] ${e.message}`));
    await login(internPage, 'selo10@gmail.com', 'selami10');
    await internPage.goto(`${FRONTEND_URL}/customers`, { waitUntil: 'networkidle0' });
    await internPage.waitForSelector('table tbody tr.is-clickable-row', { timeout: 10000 });

    const internRows = await internPage.$$('table tbody tr.is-clickable-row');
    let internTarget = internRows[0];
    for (const row of internRows) {
      const text = await row.evaluate((el) => el.textContent);
      if (text.includes('Ahmet')) { internTarget = row; break; }
    }
    await internTarget.click();
    await internPage.waitForSelector('.customer-detail-drawer', { timeout: 10000 });
    await internPage.waitForFunction(() => !document.querySelector('.customer-detail-drawer .loading-spinner'), { timeout: 10000 });
    await internPage.waitForSelector('.customer-timeline', { timeout: 10000 });
    await internPage.screenshot({ path: path.join(SHOT_DIR, '3-intern-drawer-no-deals.png'), fullPage: false });

    const internDealCount = await internPage.$$eval('.customer-timeline--deal, .customer-timeline--deal-won, .customer-timeline--deal-lost', (els) => els.length);
    const internHasLogForm = await internPage.$('.log-activity-form');
    console.log(`[intern] görünen deal timeline öğesi sayısı: ${internDealCount} (0 beklenir)`);
    console.log(`[intern] log-activity formu görünüyor mu: ${!!internHasLogForm} (false beklenir — customers.write yok)`);

    await internPage.close();
    await internContext.close();

    console.log('\n--- Konsol/sayfa hataları ---');
    console.log(errors.length ? errors.join('\n') : '(yok)');
  } finally {
    await browser.close();
  }
})();
