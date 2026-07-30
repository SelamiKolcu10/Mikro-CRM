const MailProvider = require('./MailProvider');

/**
 * Mock sağlayıcı — HİÇBİR ŞEY GÖNDERMEZ, sıfır network.
 *
 * Varsayılan sağlayıcı bilinçli olarak bu: SMTP kimlik bilgisi girilmeden
 * sistem çalışsın, tetikleyiciler ve şablonlar gerçek posta kutusu
 * kirletmeden doğrulanabilsin. Ne gönderilecekse MailLog'a `status: 'mocked'`
 * ile yazılır ve "Mail Gönderimleri" ekranında görünür.
 *
 * Gerçek gönderime geçmek için tek yapılacak: .env'de MAIL_PROVIDER=smtp
 * (ve SMTP_* değerleri). Kod değişikliği gerekmez.
 */
class MockMailProvider extends MailProvider {
  get name() {
    return 'mock';
  }

  async send() {
    // Gerçek bir mesaj kimliği taklit edilmiyor — kaydın gerçek gönderimle
    // karıştırılmaması için messageId null bırakılıyor.
    return { messageId: null, delivered: false };
  }
}

module.exports = MockMailProvider;
