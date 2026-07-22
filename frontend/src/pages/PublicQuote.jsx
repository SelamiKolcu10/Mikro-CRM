import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { HiOutlineDocumentDownload, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineExclamationCircle } from 'react-icons/hi';
import api from '../services/api';
import toast from 'react-hot-toast';

/**
 * Müşteri Dış Teklif Onay/Ret Sayfası (/q/:token).
 * Giriş gerektirmez. Antetli tasarım, PDF indirme, Kabul Et ve Reddet butonları.
 */
const PublicQuote = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchQuote = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/public/quotes/${token}`);
      setData(res.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Teklif yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchQuote();
  }, [token]);

  const handleAccept = async () => {
    if (!window.confirm('Teklifi onaylamak istediğinize emin misiniz?')) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/public/quotes/${token}/accept`);
      toast.success(res.data.message || 'Teklif onaylandı.');
      fetchQuote();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Teklif onaylanırken hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post(`/public/quotes/${token}/reject`, { reason: rejectionReason });
      toast.success(res.data.message || 'Geri bildiriminiz kaydedildi.');
      setShowRejectModal(false);
      fetchQuote();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const res = await api.get(`/quotes/${data.quote._id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${data.quote.quoteNumber}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('PDF indirilemedi.');
    }
  };

  if (loading) return <div className="public-quote-loading"><div className="spinner" /><p>Teklif yükleniyor...</p></div>;
  if (error) return <div className="public-quote-error"><HiOutlineExclamationCircle /><h2>Hata</h2><p>{error}</p></div>;

  const { quote, company } = data;
  const currencySymbol = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' }[quote.currency] || quote.currency;

  const formatMoney = (val) =>
    `${currencySymbol}${Number(val || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '-';

  return (
    <div className="public-quote-wrap">
      <div className="public-quote-container">
        {/* Antet / Şirket Bilgileri */}
        <header className="public-quote-header">
          <div className="public-company-brand">
            <h1>{company.name}</h1>
            <p>{company.address} • {company.phone} • {company.email}</p>
          </div>
          <div className="public-quote-title-block">
            <h2>TEKLİF</h2>
            <span className="public-quote-no">{quote.quoteNumber}</span>
          </div>
        </header>

        {/* Durum Bildirimleri */}
        {quote.status === 'accepted' && (
          <div className="public-alert public-alert--success">
            <HiOutlineCheckCircle />
            <div>
              <strong>Bu teklif onaylanmıştır.</strong>
              <p>Onay tarihi: {formatDate(quote.respondedAt)}</p>
            </div>
          </div>
        )}
        {quote.status === 'rejected' && (
          <div className="public-alert public-alert--danger">
            <HiOutlineXCircle />
            <div>
              <strong>Bu teklif reddedilmiştir.</strong>
              {quote.rejectionReason && <p>Neden: {quote.rejectionReason}</p>}
            </div>
          </div>
        )}
        {quote.status === 'expired' && (
          <div className="public-alert public-alert--warning">
            <HiOutlineExclamationCircle />
            <div>
              <strong>Bu teklifin geçerlilik süresi dolmuştur.</strong>
            </div>
          </div>
        )}

        {/* Müşteri ve Teklif Meta Bilgileri */}
        <div className="public-quote-meta-grid">
          <div className="public-meta-card">
            <h3>Sayın / Firma:</h3>
            <p className="public-customer-name"><strong>{quote.customer?.name}</strong></p>
            {quote.customer?.company && <p>{quote.customer.company}</p>}
            {quote.customer?.email && <p>{quote.customer.email}</p>}
          </div>
          <div className="public-meta-card public-meta-card--right">
            <div className="meta-row"><span>Teklif Tarihi:</span> <strong>{formatDate(quote.createdAt)}</strong></div>
            <div className="meta-row"><span>Son Geçerlilik:</span> <strong>{formatDate(quote.validUntil)}</strong></div>
            <div className="meta-row"><span>Hazırlayan:</span> <span>{quote.owner?.name}</span></div>
          </div>
        </div>

        {/* Kalemler Tablosu */}
        <div className="public-table-wrap">
          <table className="public-quote-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Ürün / Hizmet Açıklaması</th>
                <th className="right">Miktar</th>
                <th className="right">Birim Fiyat</th>
                <th className="right">İndirim</th>
                <th className="right">KDV</th>
                <th className="right">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item, idx) => (
                <tr key={item._id || idx}>
                  <td>{idx + 1}</td>
                  <td>
                    <strong>{item.name}</strong>
                    {item.description && <div className="public-item-desc">{item.description}</div>}
                  </td>
                  <td className="right">{item.quantity}</td>
                  <td className="right">{formatMoney(item.unitPrice)}</td>
                  <td className="right">{item.discountRate ? `%${item.discountRate}` : '-'}</td>
                  <td className="right">%{item.taxRate}</td>
                  <td className="right"><strong>{formatMoney(item.total)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Toplamlar ve Notlar */}
        <div className="public-quote-bottom">
          <div className="public-notes">
            {quote.notes && (
              <>
                <h3>Şartlar & Notlar</h3>
                <p>{quote.notes}</p>
              </>
            )}
          </div>
          <div className="public-totals">
            <div className="total-row"><span>Ara Toplam:</span> <span>{formatMoney(quote.subtotal)}</span></div>
            <div className="total-row"><span>KDV Toplam:</span> <span>{formatMoney(quote.totalTax)}</span></div>
            <div className="total-row total-row--grand"><span>GENEL TOPLAM:</span> <span>{formatMoney(quote.grandTotal)}</span></div>
          </div>
        </div>

        {/* Aksiyon Butonları */}
        <div className="public-actions">
          <button type="button" className="btn btn-secondary" onClick={handleDownloadPdf}>
            <HiOutlineDocumentDownload /> PDF İndir
          </button>

          {quote.status === 'sent' && (
            <div className="public-response-buttons">
              <button type="button" className="btn btn-danger" onClick={() => setShowRejectModal(true)} disabled={submitting}>
                <HiOutlineXCircle /> Reddet
              </button>
              <button type="button" className="btn btn-success" onClick={handleAccept} disabled={submitting}>
                <HiOutlineCheckCircle /> Teklifi Onayla
              </button>
            </div>
          )}
        </div>

        <footer className="public-footer">
          <p>{company.name} • {company.taxOffice} V.D. - {company.taxNumber} • Mersis: {company.mersisNo}</p>
        </footer>
      </div>

      {/* Reddet Modal */}
      {showRejectModal && (
        <div className="drawer-backdrop" onClick={() => setShowRejectModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Teklifi Reddet</h2>
            </div>
            <form onSubmit={handleRejectSubmit} className="modal-body">
              <label className="form-group">
                <span className="form-label">Reddetme Nedeni (Opsiyonel)</span>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Görüş, bütçe uyumsuzluğu veya revize talebinizi belirtebilirsiniz..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  maxLength={1000}
                />
              </label>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>
                  Vazgeç
                </button>
                <button type="submit" className="btn btn-danger" disabled={submitting}>
                  Reddi Onayla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicQuote;
