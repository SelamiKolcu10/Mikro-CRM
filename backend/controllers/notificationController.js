const Notification = require('../models/Notification');

/**
 * @route   GET /api/notifications
 * @desc    Oturum sahibinin bildirimleri — yeniden eskiye, sayfalı.
 *          `unreadCount` her istekte döner: çan rozeti için ayrı bir uca
 *          gitmeye gerek kalmasın.
 *          ?unreadOnly=true ile yalnız okunmamışlar.
 *
 * Yetki: kimseye özel izin gerekmez, herkes YALNIZ kendi bildirimlerini görür
 * (filtre daima req.user._id ile kurulur — istemciden recipient alınmaz).
 */
const getMyNotifications = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);

    const filter = { recipient: req.user._id };
    if (req.query.unreadOnly === 'true') filter.isRead = false;

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .populate('actor', 'name email')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);

    res.json({
      success: true,
      data: items,
      unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Tek bildirimi okundu işaretle. Filtreye recipient de girer —
 *          böylece başkasının bildirimini okundu yapmak 404 döner, sahiplik
 *          kontrolü için ayrı bir sorguya gerek kalmaz.
 */
const markRead = async (req, res, next) => {
  try {
    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Bildirim bulunamadı.' });
    }
    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
    res.json({ success: true, data: updated, unreadCount });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Hepsini okundu işaretle.
 */
const markAllRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.json({ success: true, data: { modified: result.modifiedCount }, unreadCount: 0 });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMyNotifications, markRead, markAllRead };
