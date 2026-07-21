const Deal = require('../models/Deal');
const DealEvent = require('../models/DealEvent');
const Customer = require('../models/Customer');
const { DEAL_STAGE_PROBABILITY, OPEN_STAGES, CLOSED_STAGES } = require('../config/deals');

const DEAL_POPULATE = [
  { path: 'customer', select: 'name email company' },
  { path: 'owner', select: 'name email' },
  { path: 'lead', select: 'type' },
];

/**
 * Saklanmayan türevler — Project.progress deseni (bkz. spec §1.2). probability
 * değişince weightedValue otomatik doğru kalır, drift yok; her okumada ucuz bir
 * çarpma. Forecast özeti frontend'de bu alanlardan client-side hesaplanır
 * (getLeads deseni — sunucu aggregation P4 işi).
 */
function withComputedFields(dealDoc) {
  const obj = dealDoc.toObject ? dealDoc.toObject() : dealDoc;
  return {
    ...obj,
    weightedValue: (obj.value * obj.probability) / 100,
    isOpen: OPEN_STAGES.includes(obj.stage),
  };
}

/**
 * @route   GET /api/deals
 * @desc    Tüm fırsatlar (getLeads/getTasks deseni: per-kişi görünürlük scope'u
 *          YOK — deals.read olan herkes hepsini görür; "benim deal'lerim" ve
 *          forecast sayımları frontend'de client-side).
 */
const getDeals = async (req, res, next) => {
  try {
    const deals = await Deal.find({}).populate(DEAL_POPULATE).sort({ createdAt: -1 });
    res.json({ success: true, data: deals.map(withComputedFields) });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/deals/:id/events
 * @desc    Bir fırsatın kronolojik zaman çizelgesi (LeadEvent aynası). En yeni üstte.
 */
const getDealEvents = async (req, res, next) => {
  try {
    const exists = await Deal.exists({ _id: req.params.id });
    if (!exists) {
      return res.status(404).json({ success: false, error: 'Fırsat bulunamadı.' });
    }
    const events = await DealEvent.find({ deal: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: events });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/deals
 * @desc    Bağımsız fırsat — mevcut bir Customer'a bağlanır (Lead dönüşümü
 *          değil; o ayrı: leadController.convertLead). stage verilmezse
 *          initial_contact, probability o stage'in default'undan gelir.
 */
const createDeal = async (req, res, next) => {
  try {
    const { title, customerId, value, currency, stage, expectedCloseDate, ownerId } = req.body;

    const customer = await Customer.findById(customerId).select('_id').lean();
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Müşteri bulunamadı.' });
    }

    const dealStage = stage || 'initial_contact';
    const deal = await Deal.create({
      title,
      customer: customerId,
      value,
      currency: currency || 'TRY',
      stage: dealStage,
      probability: DEAL_STAGE_PROBABILITY[dealStage],
      expectedCloseDate: expectedCloseDate || null,
      owner: ownerId || req.user._id,
      closedAt: CLOSED_STAGES.includes(dealStage) ? new Date() : null,
    });

    await DealEvent.create({
      deal: deal._id,
      actor: req.user._id,
      actorName: req.user.name,
      action: 'created',
      toStage: dealStage,
    });

    await deal.populate(DEAL_POPULATE);
    res.status(201).json({ success: true, data: withComputedFields(deal) });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/deals/:id/stage
 * @desc    Kanban sürükle-bırak. Optimistic concurrency: istemcinin gördüğü __v
 *          (expectedVersion) uyuşmazsa 409 (Task.updateTaskDeadline deseni).
 *          Yeni stage'in default olasılığını uygular; won/lost'a geçişte
 *          closedAt=now, geri açılışta closedAt=null. lostReason yalnız lost'ta.
 */
const updateDealStage = async (req, res, next) => {
  try {
    const { stage, expectedVersion, lostReason } = req.body;
    const deal = await Deal.findById(req.params.id);
    if (!deal) {
      return res.status(404).json({ success: false, error: 'Fırsat bulunamadı.' });
    }

    if (expectedVersion !== undefined && deal.__v !== expectedVersion) {
      return res.status(409).json({
        success: false,
        error: 'Bu fırsat başka biri tarafından güncellendi. Lütfen sayfayı yenileyin.',
      });
    }

    const previousStage = deal.stage;
    deal.stage = stage;
    deal.probability = DEAL_STAGE_PROBABILITY[stage];
    deal.closedAt = CLOSED_STAGES.includes(stage) ? new Date() : null;
    // lostReason yalnız lost'a geçişte anlamlı; başka aşamaya taşınınca temizle.
    deal.lostReason = stage === 'lost' ? (lostReason || '') : '';

    try {
      await deal.save();
    } catch (saveError) {
      if (saveError.name === 'VersionError') {
        return res.status(409).json({
          success: false,
          error: 'Bu fırsat başka biri tarafından güncellendi. Lütfen sayfayı yenileyin.',
        });
      }
      throw saveError;
    }

    // won/lost'a geçiş kendi action'ıyla loglanır ki timeline'da öne çıksın.
    const action = stage === 'won' ? 'won' : stage === 'lost' ? 'lost' : 'stage_changed';
    await DealEvent.create({
      deal: deal._id,
      actor: req.user._id,
      actorName: req.user.name,
      action,
      fromStage: previousStage,
      toStage: stage,
    });

    await deal.populate(DEAL_POPULATE);
    res.json({ success: true, data: withComputedFields(deal) });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/deals/:id
 * @desc    Alan düzenle: value, probability, expectedCloseDate, title, ownerId,
 *          lostReason. value değişince value_changed event'i (from/toValue).
 *          stage burada DEĞİŞMEZ — o ayrı endpoint (drag-drop + concurrency).
 */
const updateDeal = async (req, res, next) => {
  try {
    const deal = await Deal.findById(req.params.id);
    if (!deal) {
      return res.status(404).json({ success: false, error: 'Fırsat bulunamadı.' });
    }

    const { title, value, probability, expectedCloseDate, ownerId, lostReason } = req.body;
    const previousValue = deal.value;

    if (title !== undefined) deal.title = title;
    if (value !== undefined) deal.value = value;
    if (probability !== undefined) deal.probability = probability;
    if (expectedCloseDate !== undefined) deal.expectedCloseDate = expectedCloseDate || null;
    if (ownerId !== undefined) deal.owner = ownerId;
    if (lostReason !== undefined) deal.lostReason = lostReason;

    await deal.save();

    if (value !== undefined && value !== previousValue) {
      await DealEvent.create({
        deal: deal._id,
        actor: req.user._id,
        actorName: req.user.name,
        action: 'value_changed',
        fromValue: previousValue,
        toValue: value,
      });
    }

    await deal.populate(DEAL_POPULATE);
    res.json({ success: true, data: withComputedFields(deal) });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/deals/:id/notes
 * @desc    Ekip içi not — DealEvent timeline'ının parçası (LeadEvent deseni).
 */
const addDealNote = async (req, res, next) => {
  try {
    const exists = await Deal.exists({ _id: req.params.id });
    if (!exists) {
      return res.status(404).json({ success: false, error: 'Fırsat bulunamadı.' });
    }

    const event = await DealEvent.create({
      deal: req.params.id,
      actor: req.user._id,
      actorName: req.user.name,
      action: 'note_added',
      note: req.body.note,
    });

    res.status(201).json({ success: true, data: event });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDeals,
  getDealEvents,
  createDeal,
  updateDealStage,
  updateDeal,
  addDealNote,
  // convertLead içinde de kullanılacak tekil türev — tek kaynak.
  withComputedFields,
  DEAL_POPULATE,
};
