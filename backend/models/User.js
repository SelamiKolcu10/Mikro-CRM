const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default in queries
    },
    role: {
      type: String,
      enum: ['super_admin', 'accountant', 'staff', 'support', 'intern'],
      default: 'staff',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    // Account-level brute-force lockout — complements the IP-based rate
    // limiter, which alone doesn't stop an attacker rotating IPs against one
    // known email.
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    // Set true for accounts created by an admin with a temporary password —
    // forces a change on first login before any other route becomes usable
    // (enforced in middleware/authMiddleware.js). Customer portal accounts
    // deliberately do not have this field (see FAZ 2 decision).
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    // Embedded in every issued JWT. Bumped whenever role/status changes (see
    // userController.js) so already-issued tokens stop being trusted
    // immediately — closes the "demoted user keeps old privileges until
    // their 7-day token expires" gap, especially on invoice-ocr-service/v2
    // which verify tokens without a live DB role lookup.
    tokenVersion: {
      type: Number,
      default: 0,
    },
    // Task modülü için — role'den bağımsız, opsiyonel. Rol "ne yapabilirsin"
    // sorusuna cevap verir, department/isDepartmentLead "hangi ekipte ve ne
    // yetkiyle" sorusuna. Bir kullanıcı aynı anda role:'staff' VE
    // isDepartmentLead:true olabilir.
    department: {
      type: String,
      enum: ['development', 'design', 'hr', 'marketing'],
      default: null,
    },
    isDepartmentLead: {
      type: Boolean,
      default: false,
    },
    // Şirket kıdemi BURADAN hesaplanır — createdAt (hesap kaydı zamanı) değil.
    // İkisi kasıtlı olarak ayrı: bir hesap bugün açılmış olsa bile kişi
    // şirkette daha önceden çalışıyor olabilir (ör. göç/manuel kayıt).
    // Null ise (yeni, normal akışla oluşturulan hesaplar) tenure hesaplaması
    // createdAt'a düşer — bkz. utils/developerTree.js.
    hireDate: {
      type: Date,
      default: null,
    },
    // Çalışan Dizini / Profilim modülü — yalnızca profil sahibi tarafından
    // düzenlenir (bkz. userController.updateMyContactInfo), süper admin salt
    // görüntüler. avatarUrl bu turda ham yüklenen fotoğrafın yoludur; AI
    // vektör-avatar dönüştürme adımı kapsam dışı bırakıldı (sonraki iterasyon).
    personalInfo: {
      phone: { type: String, trim: true, default: '' },
      linkedin: {
        type: String,
        trim: true,
        default: '',
        match: [/^$|^https?:\/\/(www\.)?linkedin\.com\/.*$/, 'Geçerli bir LinkedIn adresi giriniz.'],
      },
      github: {
        type: String,
        trim: true,
        default: '',
        match: [/^$|^https?:\/\/(www\.)?github\.com\/.*$/, 'Geçerli bir GitHub adresi giriniz.'],
      },
      avatarUrl: { type: String, default: '' },
    },
    // Bir projenin teamMembers'ına eklendiği an itibarıyla push edilir (bkz.
    // projectController createProject/updateProject) — proje bazlı kıdem
    // ("X aydır katkı sağlıyor") buradan hesaplanır. Üyelikten çıkarılınca
    // silinmez (geçmiş kaydı korunur); "hâlâ ekipte mi" sorusu her zaman
    // Project.teamMembers'ın GÜNCEL haline bakılarak ayrıca doğrulanır.
    projectHistory: [
      {
        project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Lider olmak departman gerektirir — department:null + isDepartmentLead:true
// geçersiz bir durumdur (taskScope bu durumda ne yapacağını bilemez).
userSchema.pre('validate', function (next) {
  if (this.isDepartmentLead && !this.department) {
    this.invalidate('department', 'Departman lideri olabilmek için bir departman seçilmelidir.');
  }
  next();
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 dakika

userSchema.methods.registerFailedLogin = async function () {
  this.failedLoginAttempts += 1;
  if (this.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    this.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
    this.failedLoginAttempts = 0;
  }
  await this.save();
};

userSchema.methods.registerSuccessfulLogin = async function () {
  if (this.failedLoginAttempts > 0 || this.lockUntil) {
    this.failedLoginAttempts = 0;
    this.lockUntil = null;
    await this.save();
  }
};

// Invalidates every token issued before this call — call whenever role or
// status changes. Does not save(); callers already have other fields to
// persist in the same write, see userController.js.
userSchema.methods.bumpTokenVersion = function () {
  this.tokenVersion = (this.tokenVersion || 0) + 1;
};

module.exports = mongoose.model('User', userSchema);
