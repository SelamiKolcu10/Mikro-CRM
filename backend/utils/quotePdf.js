/**
 * Teklif HTML şablonu — puppeteer'a beslenecek saf string, DOM yok.
 * Antet + müşteri bloğu + kalem tablosu + ara toplam/KDV/genel toplam + notlar.
 * Türkçe karakter için <meta charset> + web-safe font.
 * Tasarım: docs/superpowers/specs/2026-07-22-quote-catalog-p3a-design.md §2.4
 */

const CURRENCY_SYMBOL = { TRY: '₺', USD: '$', EUR: '€' };

function formatMoney(amount, currency) {
  const sym = CURRENCY_SYMBOL[currency] || currency;
  return `${sym}${Number(amount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('tr-TR');
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildQuoteHtml(quote, company) {
  const items = quote.items || [];

  const headerHtml = `
    <div class="header">
      <div class="company">
        ${company.logoDataUri ? `<img src="${company.logoDataUri}" class="logo" />` : ''}
        <h1>${escapeHtml(company.name)}</h1>
        <p>${escapeHtml(company.address).replace(/\n/g, '<br>')}</p>
        <p>VKN: ${escapeHtml(company.taxNo)} — ${escapeHtml(company.taxOffice)}</p>
        <p>${escapeHtml(company.phone)} | ${escapeHtml(company.email)}</p>
      </div>
      <div class="quote-info">
        <h2>TEKLİF</h2>
        <table class="info-table">
          <tr><td>Teklif No:</td><td><strong>${escapeHtml(quote.quoteNumber)}</strong></td></tr>
          <tr><td>Tarih:</td><td>${formatDate(quote.createdAt)}</td></tr>
          <tr><td>Geçerlilik:</td><td>${quote.validUntil ? formatDate(quote.validUntil) : 'Belirtilmemiş'}</td></tr>
          <tr><td>Revizyon:</td><td>v${quote.version || 1}</td></tr>
        </table>
      </div>
    </div>
  `;

  const customerName = quote.customer?.name || quote.customer?.company || '';
  const customerEmail = quote.customer?.email || '';
  const customerCompany = quote.customer?.company || '';

  const customerHtml = `
    <div class="customer-block">
      <h3>Sayın</h3>
      <p><strong>${escapeHtml(customerName)}</strong></p>
      ${customerCompany && customerCompany !== customerName ? `<p>${escapeHtml(customerCompany)}</p>` : ''}
      ${customerEmail ? `<p>${escapeHtml(customerEmail)}</p>` : ''}
    </div>
  `;

  const itemRows = items.map((item, i) => `
    <tr>
      <td class="center">${i + 1}</td>
      <td>${escapeHtml(item.name)}${item.description ? `<br><small>${escapeHtml(item.description)}</small>` : ''}</td>
      <td class="right">${Number(item.quantity).toLocaleString('tr-TR')}</td>
      <td class="right">${formatMoney(item.unitPrice, quote.currency)}</td>
      <td class="right">%${item.discountRate || 0}</td>
      <td class="right">%${item.taxRate}</td>
      <td class="right">${formatMoney(item.net, quote.currency)}</td>
      <td class="right">${formatMoney(item.total, quote.currency)}</td>
    </tr>
  `).join('');

  const tableHtml = `
    <table class="items-table">
      <thead>
        <tr>
          <th class="center">#</th>
          <th>Ürün / Hizmet</th>
          <th class="right">Miktar</th>
          <th class="right">Birim Fiyat</th>
          <th class="right">İndirim</th>
          <th class="right">KDV</th>
          <th class="right">Net Tutar</th>
          <th class="right">Toplam</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>
  `;

  const totalsHtml = `
    <div class="totals">
      <table class="totals-table">
        <tr><td>Ara Toplam:</td><td>${formatMoney(quote.subtotal, quote.currency)}</td></tr>
        <tr><td>KDV Toplam:</td><td>${formatMoney(quote.totalTax, quote.currency)}</td></tr>
        <tr class="grand"><td>Genel Toplam:</td><td>${formatMoney(quote.grandTotal, quote.currency)}</td></tr>
      </table>
    </div>
  `;

  const notesHtml = quote.notes ? `
    <div class="notes">
      <h3>Notlar / Şartlar</h3>
      <p>${escapeHtml(quote.notes).replace(/\n/g, '<br>')}</p>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      color: #1a1a2e;
      padding: 40px;
      line-height: 1.5;
    }
    .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 3px solid #6366f1; padding-bottom: 20px; }
    .company h1 { font-size: 20px; color: #6366f1; margin-bottom: 5px; }
    .company p { color: #555; font-size: 10px; }
    .logo { max-height: 50px; margin-bottom: 8px; }
    .quote-info { text-align: right; }
    .quote-info h2 { font-size: 24px; color: #6366f1; letter-spacing: 3px; margin-bottom: 10px; }
    .info-table td { padding: 2px 8px; font-size: 10px; }
    .info-table td:first-child { color: #888; text-align: right; }
    .customer-block { background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 25px; }
    .customer-block h3 { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .items-table th { background: #6366f1; color: white; padding: 8px 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .items-table td { padding: 8px 6px; border-bottom: 1px solid #eee; font-size: 10px; }
    .items-table tbody tr:nth-child(even) { background: #fafafa; }
    .items-table small { color: #888; }
    .right { text-align: right; }
    .center { text-align: center; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 25px; }
    .totals-table td { padding: 4px 12px; font-size: 11px; }
    .totals-table td:first-child { color: #888; text-align: right; }
    .totals-table .grand td { font-size: 14px; font-weight: bold; color: #6366f1; border-top: 2px solid #6366f1; padding-top: 8px; }
    .notes { background: #f8f9fa; padding: 15px; border-radius: 6px; margin-top: 20px; }
    .notes h3 { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .notes p { font-size: 10px; color: #555; }
  </style>
</head>
<body>
  ${headerHtml}
  ${customerHtml}
  ${tableHtml}
  ${totalsHtml}
  ${notesHtml}
</body>
</html>`;
}

module.exports = { buildQuoteHtml };
