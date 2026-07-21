const mongoose = require('mongoose');

const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];
const DEPARTMENTS = ['development', 'design', 'hr', 'marketing'];
const ACTIONS = ['created', 'status_changed', 'deadline_changed'];

const taskActivitySchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Denormalized snapshots — heatmap tooltip renders these directly without
    // a $lookup to Task or User, keeping the aggregation pipeline lightweight.
    changedByName: { type: String, required: true },
    taskTitle: { type: String, required: true },
    // Anlık görüntü — ısı haritası bu koleksiyondan Task'a join yapmadan
    // departmana göre filtrelenebilsin diye (bkz. taskScope.js'in aynı gerekçesi).
    department: { type: String, enum: DEPARTMENTS, required: true },
    action: { type: String, enum: ACTIONS, default: 'status_changed' },
    // status_changed için dolu, deadline_changed/created için null
    fromStatus: { type: String, enum: STATUSES, default: null },
    // status_changed/created için required; deadline_changed'de kullanılmaz
    // (bkz. aşağıdaki toStatus required:false — deadline olayının "durumu" yok)
    toStatus: { type: String, enum: STATUSES, default: null },
    // Yalnızca action:'deadline_changed' — takvimde sürükle-bırak ile taşınan
    // görevin eski/yeni tarihi (audit: "kim, ne zaman, hangi tarihten hangi
    // tarihe taşıdı"). null = deadline yoktu / kaldırıldı.
    fromDeadline: { type: Date, default: null },
    toDeadline: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Compound index powering the heatmap aggregation — date range + optional
// department/user filters hit this index instead of a collection scan.
taskActivitySchema.index({ createdAt: -1, department: 1, changedBy: 1 });

module.exports = mongoose.model('TaskActivity', taskActivitySchema);
