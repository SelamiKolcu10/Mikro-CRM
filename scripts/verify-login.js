/*
 * Web girişini gerçek tarayıcıda uçtan uca doğrular — "çalışıyor" demeden önce
 * kanıt üretmek için. Çalıştırma: node scripts/verify-login.js
 */
const puppeteer = require('puppeteer');

const BASE = process.env.VERIFY_BASE_URL || 'http://localhost:5173';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  try {
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });

    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 });
    await page.type('input[type="email"], input[name="email"]', 'admin@microcrm.com');
    await page.type('input[type="password"], input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Giriş başarılıysa URL login'den çıkar ve panel içeriği gelir.
    await page.waitForFunction(() => !/\/login/.test(location.pathname), { timeout: 20000 });

    const url = page.url();
    const text = await page.evaluate(() => document.body.innerText.slice(0, 200));
    console.log('✅ Giriş BAŞARILI');
    console.log('   URL:', url);
    console.log('   Sayfa:', text.replace(/\s+/g, ' ').slice(0, 120));
    if (errors.length) console.log('   ⚠ konsol hataları:', errors.slice(0, 5));
  } catch (err) {
    console.log('❌ Giriş BAŞARISIZ:', err.message);
    console.log('   URL:', page.url());
    const body = await page.evaluate(() => document.body.innerText.slice(0, 300)).catch(() => '');
    console.log('   Ekran:', body.replace(/\s+/g, ' '));
    if (errors.length) console.log('   konsol hataları:', errors.slice(0, 8));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
