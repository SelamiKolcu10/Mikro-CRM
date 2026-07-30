import api from './api';

// Harcama raporu — web'deki reportService ile aynı uç.
// Kaynak yalnızca yerli OCR faturaları (invoicesv2); eski v1 koleksiyonu CRM
// satış faturalarıyla paylaşıldığı için rapordan çıkarılmıştı.
//
// Yanıt: data.overall { totalBase, totalVat, totalSpend, count },
//        data.byVendor [{ vendor, totalSpend, count }], byMonth, byVat, trend.
const reportService = {
  getSpendingSummary: (params = {}) => api.get('/reports/spending-summary', { params }),
};

export default reportService;
