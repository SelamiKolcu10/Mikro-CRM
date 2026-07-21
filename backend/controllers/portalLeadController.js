const Lead = require('../models/Lead');

/**
 * @route   GET /api/portal/leads
 * @desc    Giriş yapmış müşterinin KENDİ başvuruları (Lead). `linkedCustomer`
 *          her zaman token'daki müşteriden alınır (req.customerId) — asla
 *          query/body'den — böylece bir müşteri başkasının başvurularını
 *          numaralandıramaz (IDOR guard, portalFeedbackController ile aynı
 *          desen). İç alanlar (score/temperature/ip/userAgent/assignedTo)
 *          bilerek dışarı verilmez; müşteri kendi başvurusunun sadece durumunu
 *          ve içeriğini görür.
 */
const getMyLeads = async (req, res, next) => {
  try {
    const leads = await Lead.find({ linkedCustomer: req.customerId })
      .select('type status message budgetRange timeframe createdAt')
      .sort('-createdAt');
    res.json({ success: true, data: leads });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMyLeads };
