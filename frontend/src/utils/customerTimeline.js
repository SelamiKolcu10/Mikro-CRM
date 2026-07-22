/**
 * Müşteri birleşik timeline'ının SAF sunum katmanı — DOM/window yok, RN'de
 * aynen kullanılabilir (mobil port hedefi; global mimari kuralı). Server
 * (backend/utils/customerTimeline.js) yalnız yapısal veri döndürür; kind→
 * etiket/nokta-rengi/chip eşlemesi burada kurulur. JSX/ikon seçimi bilerek
 * DIŞARIDA (components/customers/CustomerTimeline.jsx) — bu dosya sadece veri
 * üretir, react-icons gibi web-only bağımlılık taşımaz.
 */

// `${source}:${kind}` → { labelKey, dotClass, chipKind }
// chipKind: null | 'stage' | 'status' | 'plan' | 'value' | 'feedbackStatus'
const EVENT_META = {
  'customer:note': { labelKey: 'customers.timeline.noteLogged', dotClass: 'note', chipKind: null },
  'customer:call': { labelKey: 'customers.timeline.callLogged', dotClass: 'call', chipKind: null },
  'customer:meeting': { labelKey: 'customers.timeline.meetingLogged', dotClass: 'meeting', chipKind: null },
  'customer:email': { labelKey: 'customers.timeline.emailLogged', dotClass: 'email', chipKind: null },
  'customer:created': { labelKey: 'customers.timeline.customerCreated', dotClass: 'created', chipKind: null },
  'customer:plan_changed': { labelKey: 'customers.timeline.planChanged', dotClass: 'plan', chipKind: 'plan' },

  'deal:created': { labelKey: 'customers.timeline.dealCreated', dotClass: 'deal', chipKind: null },
  'deal:stage_changed': { labelKey: 'customers.timeline.dealStageChanged', dotClass: 'deal', chipKind: 'stage' },
  'deal:value_changed': { labelKey: 'customers.timeline.dealValueChanged', dotClass: 'deal', chipKind: 'value' },
  'deal:note_added': { labelKey: 'customers.timeline.dealNoteAdded', dotClass: 'deal', chipKind: null },
  'deal:won': { labelKey: 'customers.timeline.dealWon', dotClass: 'deal-won', chipKind: 'stage' },
  'deal:lost': { labelKey: 'customers.timeline.dealLost', dotClass: 'deal-lost', chipKind: 'stage' },
  'deal:assigned': { labelKey: 'customers.timeline.dealAssigned', dotClass: 'deal', chipKind: null },

  'lead:created': { labelKey: 'customers.timeline.leadCreated', dotClass: 'lead', chipKind: null },
  'lead:status_changed': { labelKey: 'customers.timeline.leadStatusChanged', dotClass: 'lead', chipKind: 'status' },
  'lead:assigned': { labelKey: 'customers.timeline.leadAssigned', dotClass: 'lead', chipKind: null },
  'lead:note_added': { labelKey: 'customers.timeline.leadNoteAdded', dotClass: 'lead', chipKind: null },
  'lead:converted': { labelKey: 'customers.timeline.leadConverted', dotClass: 'lead', chipKind: null },

  'feedback:feedback_created': { labelKey: 'customers.timeline.feedbackCreated', dotClass: 'feedback', chipKind: 'feedbackStatus' },

  'quote:quote_created': { labelKey: 'Teklif Oluşturuldu', dotClass: 'deal', chipKind: null },
  'quote:quote_sent': { labelKey: 'Teklif Gönderildi', dotClass: 'deal', chipKind: null },
  'quote:quote_viewed': { labelKey: 'Teklif Müşteri Tarafından İncelendi', dotClass: 'deal', chipKind: null },
  'quote:quote_accepted': { labelKey: 'Teklif Onaylandı', dotClass: 'deal-won', chipKind: null },
  'quote:quote_rejected': { labelKey: 'Teklif Reddedildi', dotClass: 'deal-lost', chipKind: null },
  'quote:quote_revised': { labelKey: 'Teklif Revize Edildi', dotClass: 'deal', chipKind: null },
  'quote:quote_invoiced': { labelKey: 'Teklif Faturaya Dönüştürüldü', dotClass: 'deal-won', chipKind: null },
};

const DEFAULT_META = { labelKey: 'customers.timeline.unknown', dotClass: 'note', chipKind: null };

/** `${source}:${kind}` → sunum meta'sı (label anahtarı, nokta rengi sınıfı, chip türü). */
export function describeEvent(item) {
  return EVENT_META[`${item.source}:${item.kind}`] || DEFAULT_META;
}

function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function isSameDay(a, b) {
  return dayKey(a) === dayKey(b);
}

/**
 * Öğeleri güne göre gruplar (zaten `at` desc sıralı geldiği varsayılır).
 * Her grup `isToday`/`isYesterday` bayrağı taşır — gösterim etiketi ("Bugün"/
 * "Dün"/tarih) bunlara bakarak component'te i18n ile kurulur; bu fonksiyon
 * kendi başına string üretmez (dil bağımsız kalması için).
 */
export function groupByDay(items, now = new Date()) {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = [];
  let current = null;

  for (const item of items) {
    const key = dayKey(item.at);
    if (!current || current.dateKey !== key) {
      current = {
        dateKey: key,
        date: new Date(item.at),
        isToday: isSameDay(item.at, now),
        isYesterday: isSameDay(item.at, yesterday),
        items: [],
      };
      groups.push(current);
    }
    current.items.push(item);
  }

  return groups;
}
