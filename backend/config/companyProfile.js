/**
 * Statik şirket profili — teklif/fatura PDF antet bilgisi.
 * Düzenlenebilir şirket-ayarları ekranı ileride (P3b/sonra); şimdilik sabit.
 * Tasarım: docs/superpowers/specs/2026-07-22-quote-catalog-p3a-design.md §2.4
 *
 * NOT: Gerçek firma bilgilerinizi girdikten sonra burası güncellenecek.
 */
module.exports = {
  name: 'Micro CRM Teknoloji A.Ş.',
  address: 'Levent Mah. Büyükdere Cad. No:123\n34330 Beşiktaş / İstanbul',
  taxNo: '1234567890',
  taxOffice: 'Beşiktaş V.D.',
  phone: '+90 212 555 0000',
  email: 'info@microcrm.com',
  // Base64 logo placeholder — gerçek logo eklenecek.
  logoDataUri: null,
};
