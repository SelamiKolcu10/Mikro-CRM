/**
 * Lead modülü sabitleri — tek kaynak, hem model şeması hem validators hem
 * scoring util'i buradan okur (bkz. config/permissions.js'teki DEPARTMENTS/
 * TASK_PRIORITIES deseni — burada tek dosyada toplanıp modelin KENDİ ayrı bir
 * kopyasını tutmasının önüne geçildi, çünkü bütçe/zaman skorlama kurallarıyla
 * birebir eşleşmek zorunda ve iki yerde tutmak drift riski taşır).
 */
const LEAD_TYPES = ['quote', 'idea', 'question'];
const BUDGET_RANGES = ['<50k', '50k-150k', '150k-500k', '500k+', 'belirtilmemis'];
const TIMEFRAMES = ['hemen', '1_ay_icinde', '1_3_ay', 'belirsiz'];
const LEAD_STATUSES = ['new', 'in_review', 'contacted', 'quoted', 'won', 'lost'];
const LEAD_TEMPERATURES = ['hot', 'warm', 'cold'];

module.exports = { LEAD_TYPES, BUDGET_RANGES, TIMEFRAMES, LEAD_STATUSES, LEAD_TEMPERATURES };
