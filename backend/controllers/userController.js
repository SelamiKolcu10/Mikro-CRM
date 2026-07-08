const crypto = require('crypto');
const User = require('../models/User');
const { ALL_ROLES, ROLES } = require('../config/permissions');

// createUser deliberately excludes super_admin: minting a brand-new highest-
// privilege account in one shot is a bigger blast radius than promoting an
// existing, already-reviewed account via updateUserRole.
const CREATABLE_ROLES = ALL_ROLES.filter((r) => r !== ROLES.SUPER_ADMIN);

/**
 * @route   POST /api/users
 * @desc    Super admin creates a staff account directly — no public
 *          registration exists. A temporary password is generated and
 *          returned once; the admin relays it to the new hire out-of-band.
 *          Created accounts are 'approved' immediately (the admin creating
 *          them IS the approval).
 */
const createUser = async (req, res, next) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'İsim ve e-posta zorunludur.' });
    }

    if (!CREATABLE_ROLES.includes(role)) {
      return res.status(400).json({ success: false, error: 'Geçersiz rol.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Bu e-posta ile kayıtlı bir kullanıcı zaten var.' });
    }

    const temporaryPassword = crypto.randomBytes(9).toString('base64url'); // 12-char, URL-safe

    const user = await User.create({
      name,
      email,
      password: temporaryPassword,
      role,
      status: 'approved',
      approvedBy: req.user._id,
      approvedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        temporaryPassword,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/users
 * @desc    List all users, optionally filtered by status
 */
const getAllUsers = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const users = await User.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/users/pending
 * @desc    Shortcut for users awaiting approval
 */
const getPendingUsers = async (req, res, next) => {
  try {
    const users = await User.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/users/:id
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı.' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/users/:id/approve
 * @desc    Approve a pending user, optionally finalizing their role
 */
const approveUser = async (req, res, next) => {
  try {
    const { role } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı.' });
    }

    if (role) {
      if (!ALL_ROLES.includes(role)) {
        return res.status(400).json({ success: false, error: 'Geçersiz rol.' });
      }
      user.role = role;
    }

    user.status = 'approved';
    user.approvedBy = req.user._id;
    user.approvedAt = new Date();
    user.rejectionReason = null;
    await user.save();

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/users/:id/reject
 */
const rejectUser = async (req, res, next) => {
  try {
    const { reason } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı.' });
    }

    user.status = 'rejected';
    user.rejectionReason = reason || null;
    user.approvedBy = req.user._id;
    user.approvedAt = new Date();
    await user.save();

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/users/:id/role
 */
const updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;

    if (!ALL_ROLES.includes(role)) {
      return res.status(400).json({ success: false, error: 'Geçersiz rol.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı.' });
    }

    user.role = role;
    await user.save();

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/users/:id
 */
const deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: 'Kendi hesabınızı silemezsiniz.' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı.' });
    }

    res.json({ success: true, message: 'Kullanıcı silindi.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createUser,
  getAllUsers,
  getPendingUsers,
  getUserById,
  approveUser,
  rejectUser,
  updateUserRole,
  deleteUser,
};
