const mongoose = require('mongoose');

const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];
const DEPARTMENTS = ['development', 'design', 'hr', 'marketing'];

const taskActivitySchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Anlık görüntü — ısı haritası bu koleksiyondan Task'a join yapmadan
    // departmana göre filtrelenebilsin diye (bkz. taskScope.js'in aynı gerekçesi).
    department: { type: String, enum: DEPARTMENTS, required: true },
    fromStatus: { type: String, enum: STATUSES, required: true },
    toStatus: { type: String, enum: STATUSES, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('TaskActivity', taskActivitySchema);
