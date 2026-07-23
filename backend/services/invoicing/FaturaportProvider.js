const InvoicingProvider = require('./InvoicingProvider');
const TokenCache = require('./tokenCache');
const { computeLine } = require('../../utils/quoteTotals');
const {
  AuthenticationError,
  ValidationError,
  InsufficientCreditError,
  InvalidRecipientTaxNumberError,
  IntegratorUnavailableError,
} = require('./errors');

/**
 * FaturaportProvider — Faturaport API V3'e özel TEK dosya. Auth, endpoint'ler,
 * CRM→UBL payload şekillendirme ve hata eşleme yalnız burada. Başka sağlayıcıya
 * geçince sadece bu dosya değişir.
 *
 * Swagger V3 gerçekleri (docs/swagger.json'dan):
 *  - Auth:   POST /api/Invoice/getapitoken  { company_code, client_id, client_secret } -> data.accessToken (JWT)
 *  - Kesim:  POST /api/Invoice/add-invoice  (CreateInvoiceRequestDTO) -> { success, message, data:<base64 PDF>, invoiceId:<uuid/ETTN> }
 *  - Durum:  GET  /api/Invoice/get-outgoing-invoice-list -> datas[]{ invoiceId, invoiceNumber, outgoingStatus, ... }
 *  - VKN:    POST /api/Invoice/check-customer-einvoice-info/{taxnumber}
 *  - Token TTL cevapta YOK -> JWT `exp` claim'inden çıkarılır.
 *  - İdempotency alanı YOK -> lokal (CRM tarafı) çözülür, buraya taşınmaz.
 *  - Webhook YOK -> ISSUED onayı get-outgoing-invoice-list POLL ile (Stage 3).
 */
const BASE = '/api/Invoice';

// KDV yüzdesi -> Faturaport TaxRateType enum (swagger: KDV_0, KDV_1, KDV_10, KDV_20)
const TAX_RATE_TYPE = { 0: 'KDV_0', 1: 'KDV_1', 10: 'KDV_10', 20: 'KDV_20' };

// Türkçe outgoingStatus -> normalize durum (bilinen değerler; gerçek sandbox'ta
// görülünce genişletilecek — bilinmeyen "işleniyor/kuyruk" = SENDING).
const OUTGOING_STATUS = {
  'İşleniyor': 'SENDING',
  'Kuyrukta': 'SENDING',
  'Gönderiliyor': 'SENDING',
  'Başarılı': 'ISSUED',
  'Onaylandı': 'ISSUED',
  'Tamamlandı': 'ISSUED',
  'Hata': 'FAILED',
  'Reddedildi': 'FAILED',
  'İptal': 'FAILED',
};

class FaturaportProvider extends InvoicingProvider {
  /**
   * @param {{ baseUrl?, companyCode?, clientId?, clientSecret?, invoicePrefixId?, env?,
   *           defaultProfile?, defaultInvoiceType?, defaultOutputType?, defaultUnitId? }} config
   */
  constructor(config = {}) {
    super();
    // undefined config alanları varsayılanları EZMESİN diye önce temizle.
    const clean = Object.fromEntries(Object.entries(config).filter(([, v]) => v !== undefined));
    this._cfg = {
      defaultProfile: 'EARSIVFATURA',   // alıcı e-fatura mükellefi ise TEMELFATURA/TICARIFATURA seçilir
      defaultInvoiceType: 'Satis',
      defaultOutputType: 'Pdf',
      defaultUnitId: 1,                 // TODO(faturaport): /units listesinden doğrula (Adet)
      ...clean,
    };
    this._tokens = new TokenCache(() => this._fetchToken(), { skewSeconds: 60 });
  }

  // ---------- Auth ----------
  async _fetchToken() {
    const data = await this._request('POST', `${BASE}/getapitoken`, {
      company_code: this._cfg.companyCode,
      client_id: this._cfg.clientId,
      client_secret: this._cfg.clientSecret,
    }, { noAuth: true });

    const token = data?.data?.accessToken;
    if (!token) throw new AuthenticationError('Faturaport token cevabında accessToken yok.', { cause: data });

    // TTL cevapta yok -> JWT exp'inden. Çözülemezse temkinli varsayılan (~55 dk).
    const expSeconds = jwtSecondsUntilExp(token) ?? 3300;
    return { token, expiresInSeconds: expSeconds };
  }

  // ---------- OUTBOUND: kesim ----------
  async issueInvoice(payload) {
    const body = this._toFaturaportPayload(payload);
    const raw = await this._request('POST', `${BASE}/add-invoice`, body);

    // İş hatası 200 + success:false olarak da gelebilir.
    if (raw && raw.success === false) throw this._mapBusinessError(raw);
    if (!raw || !raw.invoiceId) throw new ValidationError('Faturaport beklenen invoiceId dönmedi.', { cause: raw });

    // ÖNEMLİ: senkron cevap GİB kabulü DEĞİL. status=SENDING; ISSUED poll ile
    // (get-outgoing-invoice-list) kesinleşir. invoiceNumber de orada oluşur.
    return {
      providerInvoiceId: raw.invoiceId, // ETTN/UUID
      invoiceNumber: null,              // resmî no henüz yok — poll'da dolar
      pdfBase64: raw.data || null,      // add-invoice cevabı base64 PDF taşır
      pdfUrl: null,
      status: 'SENDING',
      raw,
    };
  }

  // ---------- Durum (poll — webhook yok) ----------
  async getInvoiceStatus(providerInvoiceId) {
    const rec = await this._findOutgoing(providerInvoiceId);
    if (!rec) return 'SENDING'; // listeye henüz düşmediyse hâlâ işleniyor say
    return OUTGOING_STATUS[(rec.outgoingStatus || '').trim()] || 'SENDING';
  }

  /** Poll'da resmî fatura no + durumu birlikte döner (Stage 3 state machine için). */
  async getInvoiceRecord(providerInvoiceId) {
    const rec = await this._findOutgoing(providerInvoiceId);
    if (!rec) return null;
    return {
      providerInvoiceId,
      invoiceNumber: rec.invoiceNumber || null,
      status: OUTGOING_STATUS[(rec.outgoingStatus || '').trim()] || 'SENDING',
      raw: rec,
    };
  }

  async _findOutgoing(providerInvoiceId) {
    const data = await this._request('GET', `${BASE}/get-outgoing-invoice-list?Search=${encodeURIComponent(providerInvoiceId)}&PageSize=50`);
    const list = data?.datas || [];
    return list.find((d) => d.invoiceId === providerInvoiceId) || null;
  }

  /** Alıcı e-Fatura mükellefi mi? (e-Arşiv vs e-Fatura + posta kutusu seçimi için) */
  async checkRecipient(taxNumber) {
    return this._request('POST', `${BASE}/check-customer-einvoice-info/${encodeURIComponent(taxNumber)}`, {});
  }

  async cancelInvoice(providerInvoiceId, reason) {
    // Faturaport V3 API'sinde iptal ucu YOK (11 endpoint arasında). İptal
    // panelden/başka akışla; endpoint netleşince burada implemente edilecek.
    void providerInvoiceId; void reason;
    throw new IntegratorUnavailableError('Faturaport V3 API iptal ucu sunmuyor (panel/başka akış gerekli).');
  }

  handleWebhook(rawPayload) {
    // Faturaport webhook sunmuyor — onay POLL ile (getInvoiceRecord). Bu metot
    // sözleşme gereği var; ileride webhook'lu bir sağlayıcı için.
    void rawPayload;
    throw new IntegratorUnavailableError('Faturaport webhook sunmuyor; durum poll ile alınır.');
  }

  // ---------- CRM -> Faturaport (CreateInvoiceRequestDTO) ----------
  _toFaturaportPayload(payload) {
    if (!this._cfg.invoicePrefixId) {
      throw new ValidationError('FATURAPORT_INVOICE_PREFIX_ID (fatura serisi) tanımlı değil.');
    }

    let subTotal = 0;
    let totalTax = 0;
    const lineItems = (payload.lineItems || []).map((li) => {
      const taxRateType = TAX_RATE_TYPE[li.vatRate];
      if (!taxRateType) {
        throw new ValidationError(`Desteklenmeyen KDV oranı: ${li.vatRate} (yalnız 0/1/10/20).`);
      }
      // Toplamlar istemci-taraflı -> mevcut CRM formülüyle hesapla (computeLine).
      const { net, tax, total } = computeLine({
        quantity: li.quantity, unitPrice: li.unitPrice, taxRate: li.vatRate, discountRate: li.discountRate || 0,
      });
      const gross = (li.quantity || 0) * (li.unitPrice || 0);
      subTotal += net;
      totalTax += tax;
      return {
        product: { productName: li.name, price: li.unitPrice },
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        unitId: this._cfg.defaultUnitId,
        taxRateType,
        taxAmount: round2(tax),
        isDiscountPercent: true,
        discountValue: li.discountRate || 0,       // yüzde
        discountAmount: round2(gross - net),        // tutar
        subTotal: round2(gross),                    // indirim öncesi brüt
        subTotalIncludingDiscount: round2(net),     // indirim sonrası (vergi hariç)
        total: round2(total),                       // vergi dahil satır toplamı
        lineDescription: li.description || '',
      };
    });

    return {
      invoiceOutputType: this._cfg.defaultOutputType,
      invoiceTypeId: this._cfg.defaultInvoiceType,
      invoiceProfileId: payload.invoiceProfile || this._cfg.defaultProfile,
      invoicePrefixId: this._cfg.invoicePrefixId,
      invoiceDate: (payload.invoiceDate ? new Date(payload.invoiceDate) : new Date()).toISOString(),
      isTaxIncludedInPrice: false, // birim fiyatlar vergi hariç
      currencyType: payload.currency || 'TRY',
      company: {
        companyName: payload.recipient.name,
        taxNumber: payload.recipient.taxNumber,     // VKN/TCKN
        taxOffice: payload.recipient.taxOffice || '',
        address: payload.recipient.address || '',
        country: payload.recipient.country || 'Türkiye',
        city: payload.recipient.city || '',
        district: payload.recipient.district || '',
      },
      subTotalAmount: round2(subTotal),  // vergi hariç toplam
      totalTax: round2(totalTax),
      totalAmount: round2(subTotal + totalTax), // vergi dahil toplam
      description: payload.notes || '',
      lineItems,
    };
  }

  // ---------- HTTP + hata eşleme ----------
  async _request(method, path, body, { noAuth = false, _retried = false } = {}) {
    if (!this._cfg.baseUrl) throw new IntegratorUnavailableError('FATURAPORT_BASE_URL tanımlı değil.');

    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (!noAuth) headers.Authorization = `Bearer ${await this._tokens.getToken()}`;

    let res;
    try {
      res = await fetch(`${this._cfg.baseUrl}${path}`, {
        method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (netErr) {
      throw new IntegratorUnavailableError('Faturaport ağ hatası.', { cause: netErr });
    }

    // 401 -> token'ı zorla yenile + BİR kez tekrar dene.
    if (res.status === 401 && !noAuth && !_retried) {
      await this._tokens.forceRefresh();
      return this._request(method, path, body, { noAuth, _retried: true });
    }

    const text = await res.text();
    const data = text ? safeJson(text) : {};
    if (!res.ok) throw this._mapHttpError(res.status, data);
    return data;
  }

  /** HTTP hata (ProblemDetails: { title, detail, status }) -> domain hata. */
  _mapHttpError(status, data) {
    const msg = data?.detail || data?.title || data?.message;
    if (status === 401 || status === 403) return new AuthenticationError(msg, { cause: data });
    if (status === 422 || status === 400) return this._classifyMessage(msg, data);
    if (status >= 500) return new IntegratorUnavailableError(msg, { cause: data });
    return new ValidationError(msg || `Beklenmeyen hata (HTTP ${status}).`, { cause: data });
  }

  /** 200 + success:false iş hatası -> domain hata. */
  _mapBusinessError(raw) {
    return this._classifyMessage(raw?.message, raw);
  }

  /**
   * Mesaj metninden domain hatasına en-iyi eşleme. Swagger hata KODLARINI
   * enumere etmiyor; gerçek sandbox hatalarını görünce burası kodla sıkılaşır.
   * TODO(faturaport): kod bazlı ayrıştır (kontör / geçersiz VKN).
   */
  _classifyMessage(msg = '', cause) {
    const m = (msg || '').toLocaleLowerCase('tr');
    if (/kont(ö|o)r|kredi|bakiye/.test(m)) return new InsufficientCreditError(msg, { cause });
    if (/vkn|tckn|vergi\s*(no|numaras)|mükellef/.test(m)) return new InvalidRecipientTaxNumberError(msg, { cause });
    return new ValidationError(msg || 'Fatura verisi doğrulanamadı.', { cause });
  }
}

// ---- yardımcılar ----
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function safeJson(text) { try { return JSON.parse(text); } catch { return { raw: text }; } }

/** JWT payload'ından exp okuyup "şu andan itibaren kaç saniye" döner (yoksa null). */
function jwtSecondsUntilExp(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString('utf8'));
    if (!payload.exp) return null;
    const secs = payload.exp - Math.floor(Date.now() / 1000);
    return secs > 0 ? secs : null;
  } catch { return null; }
}

module.exports = FaturaportProvider;
