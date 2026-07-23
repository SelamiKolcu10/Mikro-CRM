/**
 * Satış katmanı demo verisi — Ürün Kataloğu, Fırsatlar, Teklifler ve Satış
 * Faturaları için birkaç gerçekçi kayıt ekler. Modülleri dolu görmek/anlamak için.
 *
 * ADDITIVE — hiçbir koleksiyonu SİLMEZ. Tekrar çalıştırmaya karşı korumalı:
 *   - Katalog ürünleri isme göre find-or-create (kopya oluşmaz).
 *   - Fırsat/Teklif/Fatura faz'ları koleksiyon boşsa oluşturulur; doluysa
 *     atlanır. Yine de eklemek istersen: `node seed/seedSales.js --force`.
 *
 * Mevcut Customer ve (owner olarak) mevcut bir User kullanır — kendi kaydını
 * uydurmaz. Çalıştırma: cd backend && node seed/seedSales.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Customer = require('../models/Customer');
const CatalogProduct = require('../models/CatalogProduct');
const Deal = require('../models/Deal');
const DealEvent = require('../models/DealEvent');
const Quote = require('../models/Quote');
const QuoteEvent = require('../models/QuoteEvent');
const Invoice = require('../models/Invoice');
const Counter = require('../models/Counter');
const { DEAL_STAGE_PROBABILITY } = require('../config/deals');

const FORCE = process.argv.includes('--force');
const YEAR = new Date().getFullYear();
const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

// ---- Katalog ürünleri (find-or-create by name) ----
const CATALOG = [
  { name: 'Web Sitesi Geliştirme', description: 'Kurumsal web sitesi tasarım + geliştirme (tek seferlik proje).', sku: 'WEB-001', unitPrice: 45000, taxRate: 20, unit: 'project', category: 'Yazılım' },
  { name: 'UI/UX Tasarım Paketi', description: 'Arayüz/deneyim tasarımı, prototip dahil.', sku: 'DSGN-001', unitPrice: 28000, taxRate: 20, unit: 'project', category: 'Tasarım' },
  { name: 'Aylık Bakım & Destek', description: 'Sürüm güncelleme, izleme ve öncelikli destek.', sku: 'SUP-001', unitPrice: 3500, taxRate: 20, unit: 'month', category: 'Destek' },
  { name: 'SEO Danışmanlığı', description: 'Arama motoru optimizasyonu danışmanlık saati.', sku: 'SEO-001', unitPrice: 1200, taxRate: 20, unit: 'hour', category: 'Pazarlama' },
  { name: 'Kurumsal E-posta Lisansı', description: 'Kullanıcı başına yıllık e-posta lisansı.', sku: 'LIC-001', unitPrice: 250, taxRate: 20, unit: 'license', category: 'Lisans' },
];

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('✖ MONGO_URI tanımlı değil (.env). Çıkılıyor.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✔ MongoDB bağlandı');

  // Owner: super_admin > accountant > staff sırasıyla mevcut bir kullanıcı
  const owner =
    (await User.findOne({ role: 'super_admin' })) ||
    (await User.findOne({ role: 'accountant' })) ||
    (await User.findOne({ role: 'staff' }));
  if (!owner) {
    console.error('✖ Uygun bir kullanıcı (super_admin/accountant/staff) yok. Önce `npm run seed` çalıştır.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const customers = await Customer.find().sort({ createdAt: 1 }).limit(6);
  if (customers.length === 0) {
    console.error('✖ Sistemde müşteri yok. Önce `npm run seed` ile müşterileri oluştur.');
    await mongoose.disconnect();
    process.exit(1);
  }
  const cust = (i) => customers[i % customers.length]; // müşteri sayısı azsa döngüle
  console.log(`✔ Owner: ${owner.name} | Müşteri sayısı: ${customers.length}`);

  // ---- 1) Katalog (idempotent: isme göre) ----
  const products = {};
  for (const p of CATALOG) {
    let doc = await CatalogProduct.findOne({ name: p.name });
    if (!doc) {
      doc = await CatalogProduct.create({ ...p, currency: 'TRY', active: true });
      console.log(`  + Ürün: ${doc.name}`);
    }
    products[p.sku] = doc;
  }

  // Bir teklif kalemini katalog ürününden snapshot'la (controller ile aynı mantık)
  const line = (sku, quantity, discountRate = 0) => {
    const pr = products[sku];
    return {
      product: pr._id,
      name: pr.name,
      description: pr.description || '',
      quantity,
      unitPrice: pr.unitPrice,
      taxRate: pr.taxRate,
      discountRate,
    };
  };

  // ---- 2) Fırsatlar (koleksiyon boşsa) ----
  const dealCount = await Deal.countDocuments();
  let deals = [];
  if (dealCount === 0 || FORCE || process.argv.includes('--deals')) {
    const dealDefs = [
      { title: 'Kurumsal web platformu yenileme', ci: 0, value: 75000, stage: 'proposal', expectedCloseDate: daysFromNow(21) },
      { title: 'Yıllık bakım & destek anlaşması', ci: 1, value: 42000, stage: 'negotiation', expectedCloseDate: daysFromNow(10) },
      { title: 'E-ticaret entegrasyon projesi', ci: 2, value: 120000, stage: 'meeting', expectedCloseDate: daysFromNow(35) },
      { title: 'SEO & içerik danışmanlığı', ci: 3, value: 60000, stage: 'won', expectedCloseDate: daysFromNow(-3) },
      { title: 'Mobil uygulama ilk görüşme', ci: 4, value: 18000, stage: 'initial_contact', expectedCloseDate: daysFromNow(45) },
    ];
    for (const d of dealDefs) {
      const deal = await Deal.create({
        title: d.title,
        customer: cust(d.ci)._id,
        value: d.value,
        currency: 'TRY',
        stage: d.stage,
        probability: DEAL_STAGE_PROBABILITY[d.stage],
        expectedCloseDate: d.expectedCloseDate,
        owner: owner._id,
        closedAt: d.stage === 'won' || d.stage === 'lost' ? daysFromNow(-3) : null,
      });
      await DealEvent.create({ deal: deal._id, actor: owner._id, actorName: owner.name, action: 'created', note: 'Fırsat oluşturuldu (demo).' });
      if (d.stage === 'won') {
        await DealEvent.create({ deal: deal._id, actor: owner._id, actorName: owner.name, action: 'won', toStage: 'won', note: 'Anlaşma kazanıldı.' });
      }
      deals.push(deal);
      console.log(`  + Fırsat: ${deal.title} [${deal.stage}]`);
    }
  } else {
    console.log(`  ~ Fırsatlar atlandı (zaten ${dealCount} kayıt var; eklemek için --force).`);
    deals = await Deal.find().limit(5);
  }

  // ---- 3) Teklifler + 4) Satış Faturaları (koleksiyon boşsa) ----
  const quoteCount = await Quote.countDocuments();
  if (quoteCount === 0 || FORCE || process.argv.includes('--quotes')) {
    const dealFor = (i) => deals[i] && deals[i]._id ? deals[i]._id : null;
    const quoteDefs = [
      { ci: 0, di: 0, status: 'draft', items: [line('WEB-001', 1), line('SUP-001', 6)], notes: 'İlk taslak, revize edilebilir.' },
      { ci: 1, di: 1, status: 'sent', items: [line('SUP-001', 12, 5)], notes: '12 aylık bakım paketi.' },
      { ci: 2, di: null, status: 'accepted', items: [line('LIC-001', 25), line('SUP-001', 12)], notes: 'Onaylandı, faturaya dönüştürülecek.' },
      { ci: 3, di: 3, status: 'accepted', items: [line('DSGN-001', 1), line('WEB-001', 1)], notes: 'Tasarım + geliştirme paketi.' },
    ];

    for (const q of quoteDefs) {
      const seq = await Counter.next(`quote-${YEAR}`);
      const quoteNumber = `TKF-${YEAR}-${String(seq).padStart(4, '0')}`;
      const isSentOrAccepted = q.status === 'sent' || q.status === 'accepted';
      const isAccepted = q.status === 'accepted';

      const quote = await Quote.create({
        quoteNumber,
        customer: cust(q.ci)._id,
        deal: dealFor(q.di),
        owner: owner._id,
        status: q.status,
        currency: 'TRY',
        validUntil: daysFromNow(30),
        items: q.items,
        notes: q.notes,
        sentAt: isSentOrAccepted ? daysFromNow(-5) : null,
        respondedAt: isAccepted ? daysFromNow(-2) : null,
        publicToken: isSentOrAccepted ? `demo-${quoteNumber.toLowerCase()}` : undefined,
      });
      await QuoteEvent.create({ quote: quote._id, actor: owner._id, actorName: owner.name, type: 'created', note: 'Teklif taslağı oluşturuldu.' });
      if (isSentOrAccepted) {
        await QuoteEvent.create({ quote: quote._id, actor: owner._id, actorName: owner.name, type: 'sent', note: 'Teklif müşteriye gönderildi.' });
      }
      if (isAccepted) {
        await QuoteEvent.create({ quote: quote._id, actor: null, actorName: cust(q.ci).name, type: 'accepted', note: 'Müşteri teklifi onayladı.' });
      }
      console.log(`  + Teklif: ${quoteNumber} [${q.status}]`);

      // Onaylı teklifler → Satış Faturası (generateFromQuote ile birebir mantık)
      if (isAccepted) {
        const invSeq = await Counter.next(`invoice-${YEAR}`);
        const invoiceNumber = `FTR-${YEAR}-${String(invSeq).padStart(4, '0')}`;
        const paid = q.ci % 2 === 0; // çeşitlilik: biri ödenmiş, biri kesilmiş
        const invoice = await Invoice.create({
          invoiceNumber,
          quote: quote._id,
          customer: quote.customer,
          deal: quote.deal || null,
          owner: owner._id,
          status: paid ? 'paid' : 'issued',
          issueDate: daysFromNow(-2),
          dueDate: daysFromNow(12),
          paidAt: paid ? daysFromNow(-1) : null,
          currency: 'TRY',
          notes: quote.notes || '',
          items: quote.items.map((it) => ({
            product: it.product || null,
            name: it.name,
            description: it.description || '',
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            taxRate: it.taxRate,
            discountRate: it.discountRate || 0,
          })),
        });
        quote.invoice = invoice._id;
        await quote.save();
        await QuoteEvent.create({
          quote: quote._id,
          actor: owner._id,
          actorName: owner.name,
          type: 'invoiced',
          note: `Teklif ${invoiceNumber} faturasına dönüştürüldü.`,
          metadata: { invoiceId: invoice._id, invoiceNumber },
        });
        console.log(`    → Fatura: ${invoiceNumber} [${invoice.status}]`);
      }
    }
  } else {
    console.log(`  ~ Teklifler/Faturalar atlandı (zaten ${quoteCount} teklif var; eklemek için --force).`);
  }

  console.log('\n✔ Demo satış verisi hazır.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('✖ Hata:', err.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
