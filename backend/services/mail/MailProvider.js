/**
 * Mail sağlayıcı sözleşmesi. Somut sağlayıcılar (Mock, Smtp) bunu uygular;
 * mailService hangi implementasyonun geldiğini bilmez — services/invoicing
 * altındaki InvoicingProvider deseninin aynısı.
 */
class MailProvider {
  /** Sağlayıcı adı — MailLog.provider alanına yazılır ('mock' | 'smtp'). */
  get name() {
    throw new Error('MailProvider.name uygulanmalı');
  }

  /**
   * @param {{to: string, subject: string, html: string, text: string}} message
   * @returns {Promise<{messageId: string|null, delivered: boolean}>}
   *          `delivered` false ise gerçekten gönderilmedi (mock).
   */
  // eslint-disable-next-line no-unused-vars
  async send(message) {
    throw new Error('MailProvider.send uygulanmalı');
  }
}

module.exports = MailProvider;
