const mongoose = require('mongoose');
const { DEAL_STAGES, DEAL_CURRENCIES } = require('../config/deals');

/**
 * Satış fırsatı — Lead'in ALTINDAKİ/SONRASINDAKİ katman. Lead = nitelendirme
 * ("kovalamaya değer mi?"), Deal = kapama ("ne kadar, ne zaman, kazanır mıyız?").
 * Bir deal her zaman bir Customer hesabına aittir; nitelikli bir Lead'den
 * dönüştürülerek de doğrudan da açılabilir (bkz. leadController.convertLead,
 * dealController.createDeal). Tasarım: docs/superpowers/specs/
 * 2026-07-21-deal-pipeline-design.md §1.2
 */
const dealSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Başlık zorunludur.'],
      trim: true,
      maxlength: [150, 'Başlık en fazla 150 karakter olabilir.'],
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Müşteri zorunludur.'],
    },
    // Köken izi — dönüşümle geldiyse hangi Lead'den. Doğrudan açılan deal'lerde null.
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
    },
    value: {
      type: Number,
      required: [true, 'Anlaşma tutarı zorunludur.'],
      min: [0, 'Tutar negatif olamaz.'],
    },
    currency: {
      type: String,
      enum: { values: DEAL_CURRENCIES, message: 'Geçersiz para birimi.' },
      default: 'TRY',
    },
    stage: {
      type: String,
      enum: { values: DEAL_STAGES, message: 'Geçersiz aşama.' },
      default: 'initial_contact',
    },
    // Stage'in varsayılanından gelir (bkz. config/deals.js), PATCH /:id ile
    // deal bazında override edilebilir. weightedValue türevi bunu kullanır.
    probability: {
      type: Number,
      min: [0, 'Olasılık 0-100 arasında olmalıdır.'],
      max: [100, 'Olasılık 0-100 arasında olmalıdır.'],
      default: 10,
    },
    expectedCloseDate: {
      type: Date,
      default: null,
    },
    // Sorumlu satış temsilcisi. taskScope gibi bir görünürlük scope'u YOK —
    // deals.read olan herkes hepsini görür (bkz. dealController.getDeals);
    // owner sadece hesap verebilirlik + "benim deal'lerim" client-side filtresi.
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sorumlu zorunludur.'],
    },
    // Yalnız stage='lost' iken anlamlı.
    lostReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Kayıp nedeni en fazla 500 karakter olabilir.'],
      default: '',
    },
    // won/lost'a geçişte set edilir, geri açılışta null'lanır — "bu ay kapanan"
    // sorgusunu DealEvent taramadan çözer (bkz. spec §1.2).
    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    // Kanban'da sürükle-bırak ile stage taşırken iki kişinin aynı deal'i
    // eşzamanlı taşıması durumunda son yazanın diğerini sessizce ezmesini önler
    // — eski __v ile save() çağrılırsa VersionError fırlatır, controller bunu
    // 409'a çevirir (bkz. Task.js aynı desen, dealController.updateDealStage).
    optimisticConcurrency: true,
  }
);

dealSchema.index({ stage: 1, expectedCloseDate: 1 });
dealSchema.index({ owner: 1 });
dealSchema.index({ customer: 1 });

module.exports = mongoose.model('Deal', dealSchema);
