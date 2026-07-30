const MockMailProvider = require('./MockMailProvider');
const SmtpMailProvider = require('./SmtpMailProvider');

/**
 * DI seçici — env'e göre TEK bir MailProvider örneği verir.
 * services/invoicing/index.js ile aynı desen.
 *
 *   MAIL_PROVIDER=mock  (varsayılan) -> MockMailProvider, hiçbir şey gönderilmez
 *   MAIL_PROVIDER=smtp               -> SmtpMailProvider, gerçek gönderim
 *
 * Güvenli varsayılan bilinçli olarak mock: env'de hiçbir şey ayarlanmamışsa
 * sistem kimseye mail atmaz.
 */
let _instance = null;

function buildProvider() {
  const name = (process.env.MAIL_PROVIDER || 'mock').toLowerCase();

  if (name === 'smtp') {
    return new SmtpMailProvider({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.MAIL_FROM,
    });
  }

  return new MockMailProvider();
}

function getMailProvider() {
  if (!_instance) _instance = buildProvider();
  return _instance;
}

// Testler/betikler sağlayıcıyı değiştirdikten sonra önbelleği sıfırlayabilsin.
function resetMailProvider() {
  _instance = null;
}

module.exports = { getMailProvider, resetMailProvider };
