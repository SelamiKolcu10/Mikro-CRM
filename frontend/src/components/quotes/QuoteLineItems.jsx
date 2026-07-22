import { HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi';
import { DEFAULT_TAX_RATE, CURRENCY_SYMBOL } from '../../config/catalog';
import { computeLine } from '../../utils/quoteTotals';

/**
 * Satır kalemi editörü — katalogdan seç (fiyat/KDV otomatik dolar) veya
 * serbest satır. Miktar/fiyat/indirim/KDV düzenlenebilir.
 */
const QuoteLineItems = ({ items, setItems, products, currency, t, lang }) => {
  const sym = CURRENCY_SYMBOL[currency] || currency;

  const updateItem = (index, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addFreeItem = () => {
    setItems((prev) => [
      ...prev,
      { name: '', description: '', quantity: 1, unitPrice: 0, taxRate: DEFAULT_TAX_RATE, discountRate: 0, productId: null },
    ]);
  };

  const addFromCatalog = (productId) => {
    const product = products.find((p) => p._id === productId);
    if (!product) return;
    setItems((prev) => [
      ...prev,
      {
        name: product.name,
        description: product.description || '',
        quantity: 1,
        unitPrice: product.unitPrice,
        taxRate: product.taxRate,
        discountRate: 0,
        productId: product._id,
      },
    ]);
  };

  const formatMoney = (val) =>
    `${sym}${Number(val || 0).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', { minimumFractionDigits: 2 })}`;

  return (
    <div className="quote-line-items">
      <div className="quote-line-header">
        <span className="form-label">{t('quotes.items')}</span>
        <div className="quote-line-actions">
          {products.length > 0 && (
            <select
              className="form-select form-select-sm"
              value=""
              onChange={(e) => { if (e.target.value) addFromCatalog(e.target.value); }}
            >
              <option value="">{t('quotes.addFromCatalog')}</option>
              {products.filter((p) => p.active).map((p) => (
                <option key={p._id} value={p._id}>{p.name} — {sym}{p.unitPrice}</option>
              ))}
            </select>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={addFreeItem}>
            <HiOutlinePlus /> {t('quotes.freeItem')}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="task-comment-empty">{t('quotes.noItems')}</p>
      ) : (
        <div className="quote-line-table-wrap">
          <table className="quote-line-table">
            <thead>
              <tr>
                <th>{t('quotes.itemName')}</th>
                <th className="right">{t('quotes.qty')}</th>
                <th className="right">{t('quotes.price')}</th>
                <th className="right">{t('quotes.discount')}</th>
                <th className="right">{t('quotes.taxRate')}</th>
                <th className="right">{t('quotes.lineTotal')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const line = computeLine(item);
                return (
                  <tr key={i}>
                    <td>
                      <input
                        className="form-input form-input-sm"
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(i, 'name', e.target.value)}
                        placeholder={t('quotes.itemNamePlaceholder')}
                        maxLength={150}
                      />
                    </td>
                    <td className="right">
                      <input
                        className="form-input form-input-sm quote-num-input"
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))}
                      />
                    </td>
                    <td className="right">
                      <input
                        className="form-input form-input-sm quote-num-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))}
                      />
                    </td>
                    <td className="right">
                      <input
                        className="form-input form-input-sm quote-num-input--sm"
                        type="number"
                        min="0"
                        max="100"
                        value={item.discountRate}
                        onChange={(e) => updateItem(i, 'discountRate', Number(e.target.value))}
                      />
                      <span className="quote-percent">%</span>
                    </td>
                    <td className="right">
                      <input
                        className="form-input form-input-sm quote-num-input--sm"
                        type="number"
                        min="0"
                        max="100"
                        value={item.taxRate}
                        onChange={(e) => updateItem(i, 'taxRate', Number(e.target.value))}
                      />
                      <span className="quote-percent">%</span>
                    </td>
                    <td className="right quote-line-total">{formatMoney(line.total)}</td>
                    <td>
                      <button type="button" className="btn-icon btn-icon--danger" onClick={() => removeItem(i)} title={t('common.delete')}>
                        <HiOutlineTrash />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default QuoteLineItems;
