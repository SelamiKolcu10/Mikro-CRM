const MockInvoicingProvider = require('./MockInvoicingProvider');
const FaturaportProvider = require('./FaturaportProvider');

/**
 * DI seçici — env'e göre TEK bir InvoicingProvider örneği verir. Controller
 * bunu çağırır, hangi implementasyonun geldiğini bilmez (soyutlamanın tüm amacı).
 *
 *   INVOICING_PROVIDER=mock             -> MockInvoicingProvider (sıfır network)
 *   FATURAPORT_ENV=sandbox|production   -> FaturaportProvider (ilgili base URL)
 *
 * INVOICING_PROVIDER set değilse ve FATURAPORT_ENV varsa faturaport'a düşer;
 * ikisi de yoksa güvenli varsayılan = mock.
 */
let _instance = null;

function buildProvider() {
  const name = process.env.INVOICING_PROVIDER
    || (process.env.FATURAPORT_ENV ? 'faturaport' : 'mock');

  if (name === 'mock') return new MockInvoicingProvider();

  return new FaturaportProvider({
    env: process.env.FATURAPORT_ENV || 'sandbox',
    baseUrl: process.env.FATURAPORT_BASE_URL,
    companyCode: process.env.FATURAPORT_COMPANY_CODE,
    clientId: process.env.FATURAPORT_CLIENT_ID,
    clientSecret: process.env.FATURAPORT_CLIENT_SECRET,
    invoicePrefixId: process.env.FATURAPORT_INVOICE_PREFIX_ID, // fatura serisi (uuid)
    // Opsiyonel varsayılan override'ları (yoksa provider kendi varsayılanını kullanır):
    defaultProfile: process.env.FATURAPORT_DEFAULT_PROFILE,     // örn. EARSIVFATURA
    defaultUnitId: process.env.FATURAPORT_DEFAULT_UNIT_ID ? Number(process.env.FATURAPORT_DEFAULT_UNIT_ID) : undefined,
  });
}

/** Singleton — token cache tek örnekte paylaşılsın diye. */
function getInvoicingProvider() {
  if (!_instance) _instance = buildProvider();
  return _instance;
}

module.exports = { getInvoicingProvider, buildProvider };
