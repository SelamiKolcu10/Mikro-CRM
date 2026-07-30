const MailLog = require('../models/MailLog');
const { getMailProvider } = require('../services/mail');
const { isEnabled } = require('../services/mailService');

/**
 * @route   GET /api/mail-logs
 * @desc    Giden e-posta kayıtları — "Mail Gönderimleri" ekranının kaynağı.
 *          Yanıt ayrıca `config` taşır: sistemin şu an gerçekten mail atıp
 *          atmadığı arayüzde açıkça yazılabilsin (mock modda kullanıcı
 *          "gönderildi" sanmasın).
 *          ?status= ile filtre, sayfalı.
 */
const getMailLogs = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 100);

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.kind) filter.kind = req.query.kind;

    const [items, total, statusAgg] = await Promise.all([
      MailLog.find(filter)
        .populate('recipientUser', 'name email')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      MailLog.countDocuments(filter),
      MailLog.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const statusCounts = statusAgg.reduce((a, r) => ({ ...a, [r._id]: r.count }), {});

    res.json({
      success: true,
      data: items,
      statusCounts,
      config: {
        // false ise hiçbir mail denenmiyor (bayrak kapalı)
        enabled: isEnabled(),
        // 'mock' ise denenip kaydediliyor ama GERÇEKTEN GÖNDERİLMİYOR
        provider: getMailProvider().name,
      },
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/mail-logs/:id
 * @desc    Tek kaydın tamamı — gövde (html) listede kısaltıldığı için.
 */
const getMailLog = async (req, res, next) => {
  try {
    const log = await MailLog.findById(req.params.id).populate('recipientUser', 'name email').lean();
    if (!log) return res.status(404).json({ success: false, error: 'Kayıt bulunamadı.' });
    res.json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMailLogs, getMailLog };
