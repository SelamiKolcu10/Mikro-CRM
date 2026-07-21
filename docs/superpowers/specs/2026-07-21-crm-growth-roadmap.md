# Micro-CRM — Büyüme Yol Haritası (Gap Analizi)

**Tarih:** 2026-07-21
**Amaç:** "Profesyonel CRM" checklist'ini mevcut sistemle eşleştirip, neyi/hangi sırayla ekleyeceğimizi ve her adımın iş getirisini netleştirmek. Bu bir *yön* dokümanıdır — uygulama planı değildir. Bir modüle başlarken o modül için ayrı bir tasarım/plan spec'i çıkarılır.

---

## 1. Mevcut durum — zaten sende olanlar (yeniden yapma)

Checklist'in çoğu bu projede mevcut, bazıları çoğu ticari CRM'den olgun:

| Alan | Durum | Nerede |
|------|-------|--------|
| Lead ↔ Customer ayrımı | ✅ ~%80 | Ayrı `Lead`/`Customer` modelleri, public `/talep` formu → otomatik lead |
| Lead funnel + scoring | ✅ | `new→in_review→contacted→quoted→won/lost`, temperature (hot/warm/cold), `leadScoring.js` |
| Helpdesk & ticketing | ✅ | Portal ticket + canlı chat + **SLA geri sayımı + otomatik eskalasyon** (`slaEscalationService`) |
| KVKK temeli | ✅ Parçalı | Onay loglama, PII redaksiyonu (`redactPII`/`redactForIntern`), **hash-zincirli audit log** |
| Real-time bildirim (in-app) | ✅ | Socket tabanlı, eskalasyon banner'ları |
| Gelen fatura + OCR | ✅ | `InvoicesV2`, OCR upload |
| Task/Proje yönetimi | ✅ | Kanban task board, proje portföyü, RBAC |

**Sonuç:** Operasyon (task/proje), destek (ticket/chat), yönetişim (audit/RBAC/KVKK) katmanları güçlü. **Eksik olan tek tema: gelir/satış katmanı.** Satış hunisi lead'de bitiyor; "para" kısmı yok.

---

## 2. Gerçek boşluklar — ROI sırasıyla

### P1 — Deal / Fırsat Pipeline  ⭐ (en yüksek ROI)
- **Ne:** `Deal` modeli + Kanban board. Aşamalar: İlk Temas → Görüşme → Teklif → Pazarlık → Kazanıldı/Kaybedildi. Her deal: **değer, kazanma olasılığı %, tahmini kapanış tarihi.**
- **Neden eksik:** Task Kanban'ı var ama "deal" kavramı yok. Lead'de `budgetRange` var ama forecast'a çevrilemez.
- **Getirisi:** "Bu ay ne kadar ciro bekliyoruz?" sorusunu cevaplar. CRM'i *destek aracından* → *satış CRM'ine* çeviren omurga.
- **Bağ:** `Lead → Deal` dönüşümü. Mevcut `TaskBoard`/`TaskColumn` bileşenleri pattern olarak kullanılabilir.

### P2 — Müşteri Aktivite Timeline'ı  (ucuz kazanım)
- **Ne:** Müşteri kartında tek, kronolojik akış: arama/mail/not/toplantı/doküman.
- **Neden eksik:** `LeadEvent` ve `TaskActivity` var ama müşteri kartında birleşik değil.
- **Getirisi:** Kurumsal hafıza — çalışan ayrılınca müşteri geçmişi kaybolmaz. Görece **ucuz**; mevcut event verisini birleştirmek.

### P3 — Ürün Kataloğu + Teklif→Onay→Fatura zinciri  (birlikte yapılır)
- **Ne:** Standart ürün/fiyat kataloğu → teklif motoru → PDF teklif → onay → faturaya dönüşüm. Revizyon takibi, "müşteri teklifi açtı" bildirimi.
- **Neden birlikte:** Katalog, teklifin *yakıtı*; ayrı yapmak anlamsız.
- **Getirisi:** Prospect ilgisi ile faturayı bağlar; kapama oranını artırır. **P1'den sonra** gelir (deal verisi olmadan erken).

### P4 — Satış Analitiği
- **Ne:** Funnel conversion oranları, temsilci performansı, revenue forecast, CAC.
- **Neden sonra:** P1 pipeline verisi *geldikten sonra* değer üretir. Sende sadece harcama dashboard'u var.

### Sonraya bırakılanlar (yüksek maliyet / düşük erken-değer)
| Madde | Neden ertelendi |
|-------|-----------------|
| Email entegrasyonu (IMAP/SMTP/OAuth) | Yüksek değer ama OAuth + token + sync kırılgan ve pahalı |
| e-Fatura / GİB, banka mutabakatı | Türkiye'ye özgü, ağır muhasebe entegrasyonu; OCR temeli var ama en sona |
| Sözleşme/e-imza, workflow rule engine | SLA eskalasyonu temel var; genel kural motoru büyük iş, satış katmanından sonra |
| Global arama / tagging / segmentasyon | Faydalı ama satış omurgası önce |

---

## 3. Önerilen sıra

```
P1 Deal Pipeline  →  P2 Timeline  →  P3 Katalog+Teklif  →  P4 Analitik
   (omurga)          (ucuz)          (birlikte)             (veri sonrası)
```

Email / e-Fatura / banka şimdilik kapsam dışı — pipeline'dan değer alınmadan maliyet/kırılganlık oranları çok yüksek.

## 4. Mimari notlar (başlarken uyulacak)
- **Mobil taşınabilirlik:** İş mantığı/API çağrıları DOM'dan ayrı tutulacak (global kural). Deal state hesapları (forecast, weighted value) plain util/hook katmanında.
- **Progress/forecast türevleri:** `Project.progress` deseni gibi — saklamak yerine hesaplamak mantıklıysa hesapla; ama Lead `score` gibi statik tek-seferlik hesaplar saklanabilir.
- Her modül için koda geçmeden ayrı tasarım spec'i + Plan Mode.
