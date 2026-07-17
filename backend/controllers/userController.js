const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const { ALL_ROLES, ROLES } = require('../config/permissions');
const auditService = require('../utils/auditService');
const { buildDeveloperTree } = require('../utils/developerTree');

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
      mustChangePassword: true,
    });

    await auditService.record({
      req,
      collectionName: 'User',
      documentId: user._id,
      action: 'create',
      after: { name: user.name, email: user.email, role: user.role, status: user.status },
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
    const before = { role: user.role, status: user.status };

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
    user.bumpTokenVersion();
    await user.save();

    await auditService.record({
      req,
      collectionName: 'User',
      documentId: user._id,
      action: 'update',
      before,
      after: { role: user.role, status: user.status },
      watchedFields: ['role', 'status'],
    });

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
    const before = { status: user.status };

    user.status = 'rejected';
    user.rejectionReason = reason || null;
    user.approvedBy = req.user._id;
    user.approvedAt = new Date();
    user.bumpTokenVersion();
    await user.save();

    await auditService.record({
      req,
      collectionName: 'User',
      documentId: user._id,
      action: 'update',
      before,
      after: { status: user.status },
      watchedFields: ['status'],
    });

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
    const before = { role: user.role };

    user.role = role;
    user.bumpTokenVersion();
    await user.save();

    await auditService.record({
      req,
      collectionName: 'User',
      documentId: user._id,
      action: 'update',
      before,
      after: { role: user.role },
      watchedFields: ['role'],
    });

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/users/:id/department
 * @desc    Departman ataması ve/veya lider bayrağını değiştirir. Rol
 *          alanına dokunmaz — department/isDepartmentLead role'den bağımsız.
 */
const updateUserDepartment = async (req, res, next) => {
  try {
    const { department, isDepartmentLead } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı.' });
    }
    const before = { department: user.department, isDepartmentLead: user.isDepartmentLead };

    if (department !== undefined) user.department = department;
    if (isDepartmentLead !== undefined) user.isDepartmentLead = isDepartmentLead;
    user.bumpTokenVersion();
    await user.save();

    await auditService.record({
      req,
      collectionName: 'User',
      documentId: user._id,
      action: 'update',
      before,
      after: { department: user.department, isDepartmentLead: user.isDepartmentLead },
      watchedFields: ['department', 'isDepartmentLead'],
    });

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

    await auditService.record({
      req,
      collectionName: 'User',
      documentId: user._id,
      action: 'delete',
      before: { name: user.name, email: user.email, role: user.role },
    });

    res.json({ success: true, message: 'Kullanıcı silindi.' });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/users/me/profile
 * @desc    Profilim sayfası — kendi kişisel bilgileri + Developer Tree (kıdem +
 *          proje bazlı katkı). Herkes kendi profilini görebilir, ekstra bir
 *          `users` kaynağı iznine bağlı değil (bkz. routes/userRoutes.js —
 *          sadece `protect`).
 */
const getMyProfile = async (req, res, next) => {
  try {
    const tree = await buildDeveloperTree(req.user);
    res.json({
      success: true,
      data: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        department: req.user.department,
        isDepartmentLead: req.user.isDepartmentLead,
        createdAt: req.user.createdAt,
        personalInfo: req.user.personalInfo,
        ...tree,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/users/me/profile
 * @desc    Telefon/LinkedIn/GitHub — yalnızca profil sahibi düzenleyebilir
 *          (bkz. tasarım kararı: süper admin bu alanları salt görüntüler).
 */
const updateMyContactInfo = async (req, res, next) => {
  try {
    const { phone, linkedin, github } = req.body;
    const user = await User.findById(req.user._id);
    const before = { ...user.personalInfo?.toObject?.() };

    if (phone !== undefined) user.personalInfo.phone = phone;
    if (linkedin !== undefined) user.personalInfo.linkedin = linkedin;
    if (github !== undefined) user.personalInfo.github = github;
    await user.save();

    await auditService.record({
      req,
      collectionName: 'User',
      documentId: user._id,
      action: 'update',
      before,
      after: user.personalInfo.toObject(),
      watchedFields: ['phone', 'linkedin', 'github'],
    });

    res.json({ success: true, data: user.personalInfo });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/users/me/avatar
 * @desc    Ham fotoğraf yükleme — AI vektör-avatar dönüştürme adımı bilerek
 *          kapsam dışı (bkz. tasarım kararı), bu tur yalnızca gerçek
 *          fotoğrafı diske kaydedip avatarUrl'i günceller. Eski dosya (varsa)
 *          diskten silinir ki /uploads/avatars sınırsız büyümesin.
 */
const uploadMyAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Bir görsel dosyası yükleyin.' });
    }

    const user = await User.findById(req.user._id);
    const previousUrl = user.personalInfo.avatarUrl;

    user.personalInfo.avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await user.save();

    if (previousUrl) {
      const previousPath = path.join(__dirname, '..', previousUrl);
      fs.unlink(previousPath, () => {}); // best-effort — eski dosya kalsa da işlevi bozmaz
    }

    res.json({ success: true, data: { avatarUrl: user.personalInfo.avatarUrl } });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/users/:id/tree
 * @desc    Çalışan Dizini panelindeki Developer Tree — süper admin herkesinkini,
 *          diğer herkes yalnızca kendisininkini görebilir.
 */
const getUserTree = async (req, res, next) => {
  try {
    const isSelf = req.params.id === req.user._id.toString();
    if (!isSelf && req.user.role !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({ success: false, error: 'Bu profili görüntüleme yetkiniz yok.' });
    }

    const user = isSelf ? req.user : await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı.' });
    }

    const tree = await buildDeveloperTree(user);
    res.json({ success: true, data: { tenureMonths: tree.tenureMonths, tenureDays: tree.tenureDays, createdAt: user.createdAt, projects: tree.projects } });
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
  updateUserDepartment,
  deleteUser,
  getMyProfile,
  updateMyContactInfo,
  uploadMyAvatar,
  getUserTree,
};
