const Lead = require('../models/Lead');
const LeadEvent = require('../models/LeadEvent');
const Customer = require('../models/Customer');
const { scoreLead, isCorporateEmail } = require('../utils/leadScoring');

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
 * @route   PATCH /api/leads/:id/assign-to-me
 * @desc    Kısayol: mevcut kullanıcı kendine atar (basit "Bana ata" aksiyonu
 *          — spec'te modellenen assignedTo/LeadEvent 'assigned' alanları
 *          Faz 2'de kullanıma açılıyor, tam bir kişi-seçici UI'ı ileriye
 *          bırakıldı çünkü v1'de panel zaten sadece super_admin+staff'a açık,
 *          küçük bir ekip için "bana ata" pratik olarak yeterli).
 */
const assignLeadToMe = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Talep bulunamadı.' });
    }

    lead.assignedTo = req.user._id;
    await lead.save();
    await LeadEvent.create({
      lead: lead._id,
      actor: req.user._id,
      actorName: req.user.name,
      action: 'assigned',
    });
    await lead.populate(LEAD_POPULATE);

    res.json({ success: true, data: withComputedFields(lead) });
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
  assignLeadToMe,
};
