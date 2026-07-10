const CustomerUser = require('../models/CustomerUser');
const Customer = require('../models/Customer');
const auditService = require('../utils/auditService');

// Login and "who am I" for the portal now live in the unified
// authController.js (single POST /api/auth/login, GET /api/auth/me for both
// account types) — this file keeps only the portal-specific self-service
// actions that a logged-in customer performs.

/**
 * @route   PATCH /api/portal/profile
 * @desc    Customer self-service update of their own contact info. `email`
 *          drives portal login, so if it changes we keep CustomerUser.email
 *          in sync with the underlying Customer record.
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, email } = req.body;

    const customer = await Customer.findById(req.customerId);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Müşteri kaydı bulunamadı.' });
    }
    const before = { name: customer.name, email: customer.email };

    if (name !== undefined) customer.name = name;

    if (email !== undefined && email !== customer.email) {
      const emailTaken = await Customer.findOne({ email, _id: { $ne: customer._id } });
      if (emailTaken) {
        return res.status(400).json({ success: false, error: 'Bu e-posta başka bir kayıtta kullanılıyor.' });
      }
      customer.email = email;
    }

    await customer.save();

    // Keep the login identity in sync with the CRM contact email.
    if (email !== undefined) {
      await CustomerUser.findByIdAndUpdate(req.customerUser._id, { email: customer.email });
    }

    await auditService.record({
      req,
      collectionName: 'Customer',
      documentId: customer._id,
      action: 'update',
      before,
      after: { name: customer.name, email: customer.email },
      watchedFields: ['name', 'email'],
    });

    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/portal/auth/password
 * @desc    Requires the current password even though the request is already
 *          authenticated — a defense-in-depth check in case a token leaks.
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Mevcut ve yeni şifre gereklidir.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'Yeni şifre en az 8 karakter olmalıdır.' });
    }

    const customerUser = await CustomerUser.findById(req.customerUser._id).select('+password');

    if (!(await customerUser.matchPassword(currentPassword))) {
      return res.status(401).json({ success: false, error: 'Mevcut şifre yanlış.' });
    }

    customerUser.password = newPassword;
    await customerUser.save();

    // Value is never logged (auditService masks any field literally named
    // "password") — only the fact that it changed, and who did it.
    await auditService.record({
      req,
      collectionName: 'CustomerUser',
      documentId: customerUser._id,
      action: 'update',
      before: { password: 'old' },
      after: { password: 'new' },
      watchedFields: ['password'],
    });

    res.json({ success: true, message: 'Şifreniz güncellendi.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { updateProfile, changePassword };
