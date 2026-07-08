/**
 * One-time bulk migration: create (or reset) a portal login for every
 * existing Customer, using their CRM email and a shared default password.
 *
 * SECURITY NOTE: '12345678' is a deliberately weak, shared default per the
 * user's explicit request (originally requested '123456'; bumped to 8 chars
 * to satisfy CustomerUser's own minlength:8 validation) — it must be changed
 * by each customer on first login. The portal has a self-service
 * password-change endpoint (PATCH /api/portal/auth/password) specifically so
 * this is viable short-term, not a permanent state.
 *
 * Usage: node scripts/bulkGrantPortalAccess.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const CustomerUser = require('../models/CustomerUser');

const DEFAULT_PASSWORD = '12345678';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const customers = await Customer.find({});
  console.log(`${customers.length} müşteri bulundu.\n`);

  let created = 0;
  let reset = 0;

  for (const customer of customers) {
    let customerUser = await CustomerUser.findOne({ customer: customer._id });

    if (customerUser) {
      customerUser.email = customer.email;
      customerUser.password = DEFAULT_PASSWORD;
      customerUser.status = 'active';
      await customerUser.save();
      reset++;
      console.log(`🔄 ${customer.email} — şifre sıfırlandı`);
    } else {
      await CustomerUser.create({
        email: customer.email,
        password: DEFAULT_PASSWORD,
        customer: customer._id,
      });
      created++;
      console.log(`✅ ${customer.email} — portal hesabı oluşturuldu`);
    }
  }

  console.log(`\nToplam: ${created} yeni hesap, ${reset} sıfırlanan hesap.`);
  console.log(`Tüm müşteriler şu şifreyle giriş yapabilir: ${DEFAULT_PASSWORD}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌ Hata:', err);
  process.exit(1);
});
