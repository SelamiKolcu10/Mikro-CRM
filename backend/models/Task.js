const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Başlık zorunludur.'],
      trim: true,
      maxlength: [150, 'Başlık en fazla 150 karakter olabilir.'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Açıklama en fazla 2000 karakter olabilir.'],
      default: '',
    },
    // Oluşturulunca sabitlenir — reassignment/transfer akışı bu modülde yok
    // (bkz. docs/superpowers/specs/2026-07-12-task-management-design.md).
    department: {
      type: String,
      enum: { values: ['development', 'design', 'hr', 'marketing'], message: 'Geçersiz departman.' },
      required: [true, 'Departman zorunludur.'],
      immutable: true,
    },
    priority: {
      type: String,
      enum: { values: ['critical', 'high', 'medium', 'low'], message: 'Geçersiz öncelik.' },
      default: 'medium',
    },
    deadline: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: { values: ['todo', 'in_progress', 'in_review', 'done'], message: 'Geçersiz durum.' },
      default: 'todo',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Atanan kullanıcı zorunludur.'],
    },
    // Audit/metadata amaçlı — hiçbir yetkilendirme kararında kullanılmaz
    // (bkz. spec Bölüm 2). Onay yetkisi her zaman task.department'ın GÜNCEL
    // liderlerine/super_admin'e bakılarak taskScope üzerinden hesaplanır.
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Atayan kullanıcı zorunludur.'],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Task', taskSchema);
