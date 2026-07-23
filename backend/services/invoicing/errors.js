/**
 * Faturalama alan hataları (domain errors). Sağlayıcının ham HTTP hatalarını
 * (401/403/422/5xx) Controller/UI'nin anladığı ANLAMLI hatalara çevirir — gerçek
 * soyutlama sağlayıcının HATA DİLİNİ de gizler, yalnızca URL'leri değil. Her
 * sağlayıcı (Faturaport, Mock, ileride Paraşüt/Uyumsoft) AYNI hata tiplerini fırlatır.
 */
class InvoicingError extends Error {
  constructor(message, { code, retryable = false, cause } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code || this.constructor.name;
    // Controller retry mantığı için: yalnız geçici (5xx/network) hatalar true.
    this.retryable = retryable;
    if (cause !== undefined) this.cause = cause;
  }
}

/** Alıcı VKN/TCKN geçersiz — kalıcı, retry etme. */
class InvalidRecipientTaxNumberError extends InvoicingError {
  constructor(message = 'Alıcı VKN/TCKN geçersiz.', opts = {}) {
    super(message, { retryable: false, ...opts });
  }
}

/** Entegratör kontörü/kredisi bitti — kalıcı, retry etme (sandbox'ta çıkmaz, prod'da çıkar). */
class InsufficientCreditError extends InvoicingError {
  constructor(message = 'Entegratör kontörü/kredisi yetersiz.', opts = {}) {
    super(message, { retryable: false, ...opts });
  }
}

/** 422 — payload yanlış. ASLA otomatik retry etme; veri düzeltilmeli. */
class ValidationError extends InvoicingError {
  constructor(message = 'Fatura verisi doğrulanamadı.', opts = {}) {
    super(message, { retryable: false, ...opts });
  }
}

/** 5xx / ağ hatası — entegratör geçici erişilemez. Retry edilebilir. */
class IntegratorUnavailableError extends InvoicingError {
  constructor(message = 'Entegratör geçici olarak erişilemiyor.', opts = {}) {
    super(message, { retryable: true, ...opts });
  }
}

/** 401/403 — kimlik/token sorunu. Provider bir kez token yenileyip dener; yine olmazsa bu. */
class AuthenticationError extends InvoicingError {
  constructor(message = 'Entegratör kimlik doğrulaması başarısız.', opts = {}) {
    super(message, { retryable: false, ...opts });
  }
}

module.exports = {
  InvoicingError,
  InvalidRecipientTaxNumberError,
  InsufficientCreditError,
  ValidationError,
  IntegratorUnavailableError,
  AuthenticationError,
};
