const Lead = require('../models/Lead');
const LeadEvent = require('../models/LeadEvent');
const Customer = require('../models/Customer');
const Deal = require('../models/Deal');
const DealEvent = require('../models/DealEvent');
const { scoreLead, isCorporateEmail } = require('../utils/leadScoring');
const { DEAL_STAGE_PROBABILITY } = require('../config/deals');
const { withComputedFields: withDealComputedFields, DEAL_POPULATE } = require('./dealController');

const ANONYMOUS_ACTOR_NAME = 'Web Formu';

const LEAD_POPULATE = [
  { path: 'assignedTo', select: 'name email' },
  { path: 'linkedCustomer', select: 'name email' },
];

// Panelde "kurumsal e-posta" rozetini göstermek için — DB'de saklanmıyor,
// her yanıtta lead.email'den türetilir (bkz. utils/leadScoring.js — tek
// kaynak, frontend'de aynı domain listesini tekrar tanımlamak yerine).
function withComputedFields(leadDoc) {
  const obj = leadDoc.toObject ? leadDoc.toObject() : leadDoc;
  return { ...obj, isCorporateEmail: isCorporateEmail(obj.email) };
}

/**
 * Gizli honeypot alanı doluysa (yalnızca bot'lar doldurur — form CSS ile
 * ekran dışına gizler) sessizce başarı döner, HİÇBİR ŞEY kaydetmez. Bot'a
 * gerçek bir gönderiyle aynı yanıt şeklini verir ki honeypot'un varlığını
 * yanıt farkından anlayıp adapte olamasın (bkz. spec §3).
 */
const checkHoneypot = (req, res, next) => {
  if (req.body.website) {
    return res.status(201).json({ success: true, data: { received: true } });
  }
  next();
};

/**
 * @route   POST /api/leads
 * @desc    Public talep formu ingestion — uygulamadaki ilk auth'suz yazma
 *          endpoint'i. Skorlama + Customer eşleştirme + LeadEvent(created)
 *          hepsi burada, tek transaction'a gerek yok (Lead ana kayıt,
 *          LeadEvent ikincil — LeadEvent yazımı başarısız olsa bile Lead
 *          kaybolmamalı, TaskActivity'deki ile aynı gevşek tutarlılık).
 */
const createLead = async (req, res, next) => {
  try {
    const { type, name, email, phone, company, message, kvkkConsent } = req.body;
    // budgetRange/timeframe yalnızca type='quote' iken anlamlı — formun
    // göndermemesi gereken alanlar manipüle edilmiş bir istekle gelirse bile
    // sunucu sessizce görmezden gelir (validasyon zaten enum dışını reddetti,
    // burada sadece "yanlış tip için doluysa" durumunu temizliyoruz).
    const budgetRange = type === 'quote' ? req.body.budgetRange || null : null;
    const timeframe = type === 'quote' ? req.body.timeframe || null : null;

    const { score, temperature } = scoreLead({ type, budgetRange, timeframe, email });

    const existingCustomer = await Customer.findOne({ email }).select('_id').lean();

    const lead = await Lead.create({
      type,
      name,
      email,
      phone: phone || '',
      company: company || '',
      budgetRange,
      timeframe,
      message,
      score,
      temperature,
      linkedCustomer: existingCustomer?._id || null,
      source: req.get('referer') || '',
      ip: req.ip,
      userAgent: req.get('user-agent') || null,
      // kvkkConsent === true zaten validators'ta garanti edildi.
      kvkkConsentAt: new Date(),
    });

    await LeadEvent.create({
      lead: lead._id,
      actor: null,
      actorName: ANONYMOUS_ACTOR_NAME,
      action: 'created',
      toStatus: 'new',
    });

    // İnce yanıt — skor/temperature/id gibi iç bilgiyi public'e sızdırma,
    // sadece "alındı" (bkz. spec §3).
    res.status(201).json({ success: true, data: { received: true } });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/leads
 * @desc    Tüm lead'ler (Task/getTasks ile aynı desen: departman/kişi bazlı
 *          bir scope yok, `leads.read` yetkisi olan herkes hepsini görür —
 *          liste/sekme sayımları frontend'de client-side hesaplanır, bkz.
 *          hooks/useLeads.js).
 */
const getLeads = async (req, res, next) => {
  try {
    const leads = await Lead.find({}).populate(LEAD_POPULATE).sort({ createdAt: -1 });
    res.json({ success: true, data: leads.map(withComputedFields) });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/leads/:id/events
 * @desc    Bir lead'in kronolojik zaman çizelgesi (bkz. LeadEvent — TaskActivity
 *          aynası). En yeni en üstte.
 */
const getLeadEvents = async (req, res, next) => {
  try {
    const exists = await Lead.exists({ _id: req.params.id });
    if (!exists) {
      return res.status(404).json({ success: false, error: 'Talep bulunamadı.' });
    }
    const events = await LeadEvent.find({ lead: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: events });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/leads/:id/status
 */
const updateLeadStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Talep bulunamadı.' });
    }

    const previousStatus = lead.status;
    lead.status = status;
    await lead.save();
    await LeadEvent.create({
      lead: lead._id,
      actor: req.user._id,
      actorName: req.user.name,
      action: 'status_changed',
      fromStatus: previousStatus,
      toStatus: status,
    });
    await lead.populate(LEAD_POPULATE);

    res.json({ success: true, data: withComputedFields(lead) });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/leads/:id/notes
 * @desc    Ekip içi not — ayrı bir koleksiyona çıkarılmadı, LeadEvent
 *          zaman çizelgesinin bir parçası (bkz. spec §1 not, models/LeadEvent.js).
 */
const addLeadNote = async (req, res, next) => {
  try {
    const lead = await Lead.exists({ _id: req.params.id });
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Talep bulunamadı.' });
    }

    const event = await LeadEvent.create({
      lead: req.params.id,
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

/**
 * @route   PATCH /api/leads/:id/assign
 * @desc    Admin (super_admin) bir lead'i belirtilen kullanıcıya atar.
 *          Body: { assigneeId } — atanacak kullanıcının _id'si.
 */
const assignLead = async (req, res, next) => {
  try {
    const { assigneeId } = req.body;
    if (!assigneeId) {
      return res.status(400).json({ success: false, error: 'assigneeId gereklidir.' });
    }

    const User = require('../models/User');
    const assignee = await User.findById(assigneeId);
    if (!assignee) {
      return res.status(404).json({ success: false, error: 'Kullanıcı bulunamadı.' });
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Talep bulunamadı.' });
    }

    lead.assignedTo = assignee._id;
    await lead.save();
    await LeadEvent.create({
      lead: lead._id,
      actor: req.user._id,
      actorName: req.user.name,
      action: 'assigned',
      note: `→ ${assignee.name}`,
    });
    await lead.populate(LEAD_POPULATE);

    res.json({ success: true, data: withComputedFields(lead) });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/leads/:id/convert
 * @desc    Nitelikli lead'i Deal'e dönüştür — TEK aksiyonla hem (yoksa) Customer
 *          oluşturur hem Deal açar (bkz. spec §2, omurga kararı). Lead=nitelendirme
 *          biter, Deal=kapama başlar. Lead.status'e DOKUNULMAZ; dönüşüm ayrı bir
 *          eksen (convertedDeal).
 *
 *          Partial-failure güvenli sıra (transaction gerektirmez — projenin
 *          "gevşek tutarlılık" tercihi, bkz. createLead notu): önce Customer
 *          (email unique → idempotent, yarış güvenli), sonra Deal, sonra Lead
 *          güncelle. Deal hata verirse ortada yalnız (varsa yeni) bir Customer
 *          kalır — zararsız, çift kayıt yok.
 */
const convertLead = async (req, res, next) => {
  try {
    const { value, title, currency, expectedCloseDate, ownerId } = req.body;

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Talep bulunamadı.' });
    }
    if (lead.convertedDeal) {
      return res.status(409).json({ success: false, error: 'Bu talep zaten bir fırsata dönüştürülmüş.' });
    }

    // 1) Customer bul/oluştur — önce mevcut bağ, sonra email eşleşmesi, sonra yeni.
    let customer = null;
    if (lead.linkedCustomer) {
      customer = await Customer.findById(lead.linkedCustomer).select('_id');
    }
    if (!customer) {
      customer = await Customer.findOne({ email: lead.email }).select('_id');
    }
    if (!customer) {
      customer = await Customer.create({
        name: lead.name,
        email: lead.email,
        company: lead.company || '',
        // Lead.source bir Referer URL'i; Customer.source enum'una girmez → 'other'.
        source: 'other',
      });
    }

    // 2) Deal oluştur.
    const deal = await Deal.create({
      title: title || `${lead.company || lead.name} — Teklif`,
      customer: customer._id,
      lead: lead._id,
      value,
      currency: currency || 'TRY',
      stage: 'initial_contact',
      probability: DEAL_STAGE_PROBABILITY.initial_contact,
      expectedCloseDate: expectedCloseDate || null,
      owner: ownerId || req.user._id,
    });

    // 3) Lead'i bağla (çift dönüşüm kilidi + panel rozeti için).
    lead.convertedDeal = deal._id;
    lead.linkedCustomer = customer._id;
    await lead.save();

    // 4) Her iki timeline'a da iz düş (ikincil — hata verse ana kayıtlar durur).
    await LeadEvent.create({
      lead: lead._id,
      actor: req.user._id,
      actorName: req.user.name,
      action: 'converted',
    });
    await DealEvent.create({
      deal: deal._id,
      actor: req.user._id,
      actorName: req.user.name,
      action: 'created',
      toStage: 'initial_contact',
    });

    await deal.populate(DEAL_POPULATE);
    res.status(201).json({ success: true, data: withDealComputedFields(deal) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkHoneypot,
  createLead,
  getLeads,
  getLeadEvents,
  updateLeadStatus,
  addLeadNote,
  assignLead,
  convertLead,
};
