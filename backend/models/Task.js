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
      enum: ['development', 'design', 'hr', 'marketing'],
      required: true,
      immutable: true,
    },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium',
    },
    deadline: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'in_review', 'done'],
      default: 'todo',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Audit/metadata amaçlı — hiçbir yetkilendirme kararında kullanılmaz
    // (bkz. spec Bölüm 2). Onay yetkisi her zaman task.department'ın GÜNCEL
    // liderlerine/super_admin'e bakılarak taskScope üzerinden hesaplanır.
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Task', taskSchema);
