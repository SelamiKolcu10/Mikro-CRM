const nodemailer = require('nodemailer');
const MailProvider = require('./MailProvider');

/**
 * Gerçek SMTP gönderimi (nodemailer).
 *
 * Gmail için: SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_SECURE=true,
 * SMTP_USER=<adres>, SMTP_PASS=<uygulama şifresi>. Normal hesap şifresi
 * çalışmaz — Google "uygulama şifresi" (app password) üretilmesi gerekiyor,
 * bu da hesapta iki adımlı doğrulama açık olmasını gerektirir.
 *
 * Taşıyıcı (transporter) tembel kurulur: sağlayıcı seçilse bile ilk mail
 * gönderilene kadar bağlantı açılmaz.
 */
class SmtpMailProvider extends MailProvider {
  constructor({ host, port, secure, user, pass, from }) {
    super();
    this.config = { host, port, secure, user, pass };
    this.from = from || user;
    this._transporter = null;
  }

  get name() {
    return 'smtp';
  }

  transporter() {
    if (!this._transporter) {
      const { host, port, secure, user, pass } = this.config;
      if (!host || !user || !pass) {
        throw new Error('SMTP ayarları eksik (SMTP_HOST, SMTP_USER, SMTP_PASS).');
      }
      this._transporter = nodemailer.createTransport({
        host,
        port: Number(port) || 465,
        secure: secure !== 'false' && secure !== false,
        auth: { user, pass },
      });
    }
    return this._transporter;
  }

  async send({ to, subject, html, text }) {
    const info = await this.transporter().sendMail({
      from: this.from,
      to,
      subject,
      html,
      text,
    });
    return { messageId: info?.messageId || null, delivered: true };
  }
}

module.exports = SmtpMailProvider;
