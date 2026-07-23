/**
 * Concurrency-safe Bearer token cache. Token'ı bellekte tutar ve süresi
 * DOLMADAN ~60sn önce yeniler (tam expiry anında değil). Eş zamanlı istekler
 * aynı anda birden fazla refresh tetiklemesin diye single-flight (in-flight
 * promise) kilidi kullanır — Node tek-thread olsa da overlapping async çağrılar
 * yarış yaratır; bu desen onu engeller.
 */
class TokenCache {
  /**
   * @param {() => Promise<{ token: string, expiresInSeconds: number }>} fetchToken
   * @param {{ skewSeconds?: number }} [opts]
   */
  constructor(fetchToken, { skewSeconds = 60 } = {}) {
    this._fetchToken = fetchToken;
    this._skewMs = skewSeconds * 1000;
    this._token = null;
    this._expiresAt = 0;
    this._inFlight = null; // devam eden refresh promise (mutex)
  }

  _isValid() {
    return Boolean(this._token) && Date.now() < this._expiresAt - this._skewMs;
  }

  /** Geçerli token'ı döner; gerekirse (tek uçuşla) yeniler. */
  async getToken() {
    if (this._isValid()) return this._token;
    // Başka bir çağrı zaten yeniliyorsa onun sonucunu bekle — çift refresh yok.
    if (this._inFlight) return this._inFlight;
    this._inFlight = this._refresh().finally(() => { this._inFlight = null; });
    return this._inFlight;
  }

  async _refresh() {
    const { token, expiresInSeconds } = await this._fetchToken();
    this._token = token;
    this._expiresAt = Date.now() + expiresInSeconds * 1000;
    return token;
  }

  /** 401 sonrası zorla yenile (provider bir kez çağırır, sonra isteği tekrar dener). */
  async forceRefresh() {
    this._token = null;
    this._expiresAt = 0;
    return this.getToken();
  }
}

module.exports = TokenCache;
