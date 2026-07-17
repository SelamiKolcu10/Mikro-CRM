/**
 * One-time backfill: gives every existing user a realistic `hireDate` so the
 * Çalışan Dizini / Profilim "kıdem" (tenure) display shows varied, believable
 * spans (ör. "1 yıl 3 ay") instead of "0 ay" for everyone — this dev DB's
 * `createdAt` values are all within the last few days (seed/test data), which
 * is a fine account-creation timestamp but a meaningless "started at the
 * company" date. hireDate is a separate field precisely so createdAt (a real
 * audit timestamp) never needs to be rewritten.
 *
 * Idempotent: users that already have hireDate set are left untouched.
 * Usage: node scripts/backfillHireDates.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

// Kıdem çeşitliliği için elle seçilmiş bir "kadro" — en kıdemliden en yeniye.
// Kullanıcı say fazlaysa listenin sonu tekrarlanır (modulo), az ise baştan bir kısmı kullanılmaz.
const TENURE_LADDER_MONTHS = [41, 35, 29, 25, 22, 18, 15, 13, 10, 8, 6, 5, 4, 3, 2, 1, 5];

function monthsAgo(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  // Ayın günü sabit kalsın diye küçük bir rastgelelik ekle (hepsi ayın aynı
  // gününde işe başlamış gibi görünmesin).
  d.setDate(Math.max(1, Math.min(28, d.getDate() - Math.floor(Math.random() * 10))));
  return d;
}

async function backfill() {
  await mongoose.connect(process.env.MONGO_URI);

  const users = await User.find({ hireDate: null }).sort({ createdAt: 1 });
  if (users.length === 0) {
    console.log('Tüm kullanıcıların zaten hireDate\'i var — yapılacak bir şey yok.');
    await mongoose.disconnect();
    return;
  }

  for (let i = 0; i < users.length; i++) {
    const months = TENURE_LADDER_MONTHS[i % TENURE_LADDER_MONTHS.length];
    const hireDate = monthsAgo(months);
    users[i].hireDate = hireDate;
    await users[i].save({ validateModifiedOnly: true });
    console.log(`${users[i].name.padEnd(20)} → ${hireDate.toISOString().slice(0, 10)} (~${months} ay)`);
  }

  console.log(`\n${users.length} kullanıcı güncellendi.`);
  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error('Backfill başarısız:', err);
  process.exit(1);
});
