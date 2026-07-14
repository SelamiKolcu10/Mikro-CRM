const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Proje adı zorunludur.'],
      unique: true,
      trim: true,
      maxlength: [100, 'Proje adı en fazla 100 karakter olabilir.'],
    },
    techStack: {
      type: [String],
      default: [],
      set: (arr) => (Array.isArray(arr) ? arr.map((s) => String(s).trim()).filter(Boolean) : arr),
    },
    // Markdown kaynak metni — render frontend'de yapılır, burada düz metin
    // olarak saklanır (bkz. spec dokümanı: react-markdown HTML'i default
    // render etmediği için XSS güvenlidir, sunucu tarafında sanitize gerekmez).
    architectureNotes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [20000, 'Mimari notlar en fazla 20000 karakter olabilir.'],
    },
    teamMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Proje bazlı lider — canManageProjects (global Dev Lead/super_admin)'den
    // BAĞIMSIZ bir ikinci yetki katmanı: bu projeye özel, teamMembers içinden
    // seçilir (controller'da doğrulanır) ve o proje üzerinde düzenleme
    // (wiki + ekip/isim/tech stack) yetkisi kazandırır — oluşturma/silme/tam
    // liste hâlâ sadece global yöneticide kalır (bkz. utils/projectScope.js
    // canEditProject, routes/projectRoutes.js requireProjectEditor).
    projectLead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Proje tartışması — departman lideri + ekip üyeleri arasında (bkz.
    // utils/projectScope.js canViewProject). Task.comments ile aynı şekil.
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        text: {
          type: String,
          required: [true, 'Yorum metni zorunludur.'],
          trim: true,
          maxlength: [1000, 'Yorum en fazla 1000 karakter olabilir.'],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Project', projectSchema);
