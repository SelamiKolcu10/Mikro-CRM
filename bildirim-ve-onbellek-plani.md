# Bildirim Motoru & Önbellekleme — Analiz ve Yol Haritası

Bu belge iki mimari önerinin **kod tabanına karşı doğrulanmış** analizini ve
uygulama sırasını içerir. Buradaki bulgular tahmin değil; her biri ilgili
dosyada kontrol edildi (2026-07-28).

---

## Karar: Önce bildirim motoru

**Sıra:**

1. ~~Socket rol kapısını düzelt~~ ✅ **BİTTİ (2026-07-28)** — aşağıdaki
   "Yapılanlar" bölümüne bakın
2. Mobil ekranları emülatörde doğrula
3. ~~**Bildirim motoru**~~ ✅ **BİTTİ (2026-07-28)** — backend + mobil + web
4. ~~Lookup cache~~ ✅ **BİTTİ (2026-07-28)** — web + mobil
5. ~~Mail~~ ✅ **MOCK MODDA BİTTİ (2026-07-28)** — gerçek gönderim için tek
   yapılacak `.env`'de `MAIL_PROVIDER=smtp` + SMTP bilgileri

3 ve 4 birbirinden bağımsız, sıraları değişebilir. Ama 1 mutlaka 3'ten önce.

**Neden önce bildirim:**

- **Ekleyici (additive), refactor değil.** Yeni model + yeni servis + yeni socket
  olayı + çan arayüzü. Mevcut hiçbir ekranın veri akışını bozmaz. Caching ise 16
  hook'u ve ~20 mobil ekranı elden geçirmek demek — geniş yıkım yarıçapı.
- **Mobilde 14 ekran henüz test edilmedi.** Bunların altındaki veri çekme
  katmanını değiştirirsek, bir şey bozulduğunda "önbellek mi bozdu, ekran zaten
  mi bozuktu" ayrımını yapamayız. Refactor, çalıştığı doğrulanmış kodun üzerine
  yapılır.
- **Caching'in asıl kazancı sunucu maliyeti değil, UX.** Tek sunucuda çalışan,
  birkaç düzine kullanıcılı bir CRM'de o yük ihmal edilebilir. Gerçek kazanç
  spinner görmemek ve akıcılık — bu onu değerli kılar ama "acil" yapmaz.
- Caching'e geçerken sıra **önce web + React Query** olmalı; React Native'de
  `useFocusEffect` ve navigasyon yaşam döngüsüyle etkileşimi ayrı bir konu,
  deseni webde oturttuktan sonra taşımak daha güvenli.

---

## Yapılanlar

### ✅ Socket rol kapısı (2026-07-28) — `backend/socket/index.js`

"Bağlanabilir" ile "sohbeti okuyabilir" ayrıldı:

- `authenticateSocket` artık rolü sohbet yetkisinde olmayan personeli
  **reddetmiyor**; yetkiyi `socket.data.canChat` olarak taşıyor. Canlı DB
  kontrolleri (status, tokenVersion) aynen duruyor.
- Bağlanan her personel kendi bildirim odasına giriyor: `userRoom(userId)` →
  `user:<id>`. Yeni dışa aktarım: `userRoom`.
- `canChat` false ise bağlantı handler'ı **erken çıkıyor** — STAFF_ROOM'a ve
  konuşma odalarına girmiyor, `join-conversation` dinleyicisi hiç kurulmuyor.

Önce şu doğrulandı: 5 yayın noktasının tamamı odaya yönelik
(`conversationRoom` / `STAFF_ROOM`), hiçbir yerde global `io.emit` yok — bu
olmadan bağlantıyı açmak sohbeti sızdırırdı.

**Ölçüm sonuçları:**

| Test | Sonuç |
|---|---|
| `accountant` bağlantısı | ✅ Bağlandı (önce reddediliyordu) |
| `accountant`'a sızan sohbet olayı | ✅ 0 |
| `support` / `staff` / `intern` bağlantısı | ✅ Bağlandı, `join-conversation` sorunsuz |

Sistemde **4 onaylı muhasebeci** var — bu teorik bir kenar durum değildi.

**Doğrulanmadı:** sohbet yetkili rollere STAFF_ROOM yayınlarının hâlâ ULAŞTIĞI
uçtan uca test edilmedi (bir portal müşterisinin mesaj göndermesi gerekiyordu).
Bağlantı ve oda katılımı çalışıyor; sohbeti elle denerken bu göz önünde olsun.

### ✅ Bildirim motoru — backend + mobil (2026-07-28)

**Backend:** `models/Notification.js` · `services/notificationService.js` ·
`controllers/notificationController.js` · `routes/notificationRoutes.js` ·
`server.js` kaydı · `taskController.createTask` içine tek satır tetikleyici.

Tasarım kararları:
- İki kanal: MongoDB kaydı (kalıcı, çevrimdışı için) + `user:<id>` odasına
  socket yayını (anlık). Yayın DB kaydından SONRA yapılıyor, yoksa istemci
  olayı alıp listeyi tazelediğinde kayıt henüz orada olmaz.
- `title`/`message` yazıldığı anda sabitlenir (denormalize) — kaynak kayıt
  sonradan değişse/silinse bile bildirim o günkü gerçeği anlatır.
- Bildirim **asla ana işlemi bozmaz**: servis hiçbir hatayı yukarı fırlatmaz,
  bildirim gitmezse görev yine oluşur.
- Kişinin kendi eylemi kendisine bildirilmez (`isSelf` kontrolü).
- Uçlarda rol kapısı YOK, tamamen self-servis: `recipient` daima
  `req.user._id`'den kurulur, istemciden alınmaz. Sahiplik kontrolü ayrı sorgu
  yerine filtrenin içinde (`{_id, recipient}` → yoksa 404).

**Ölçüm (gerçek görev atanarak):**

| Test | Sonuç |
|---|---|
| Socket olayı ulaştı | ✅ "Admin User size ... görevini atadı." |
| DB kaydı oluştu | ✅ |
| `unreadCount` | ✅ 0 → 1 |
| Okundu işaretleme | ✅ unread 1 → 0 |
| Başkasının bildirimini okumaya çalışma | ✅ 404 |

> Test dev veritabanında **gerçek bir görev bıraktı** ("Bildirim testi
> 1785365145807"). Silinmedi — temizlik istenirse ayrıca yapılacak.

**Mobil:** `context/NotificationContext.jsx` (REST ilk yükleme + socket ile
canlı ekleme) · `components/NotificationBell.jsx` (rozetli çan) ·
`screens/NotificationsScreen.jsx` · `config/notifications.js` ·
`services/notificationService.js` · çan tüm başlıklara bağlandı (HomeTabs
kökleri + çekmece ekranları + Projects/Users stack'leri).

Backend `link` alanı WEB yolu tutuyor; mobil onu ayrıştırmıyor, türden
navigasyon hedefine eşliyor (`config/notifications.js`).

**Mobil doğrulama durumu:** yalnız sözdizimi denetimi yapıldı (Metro kullanıcının
terminalinde olduğu için bundle log'u izlenemedi). Çanın çizildiği ve rozetin
arttığı emülatörde görülmedi.

**Web:** `context/NotificationContext.jsx` · `components/layout/NotificationBell.jsx`
(çan + açılır panel, dışa tıklama/Esc ile kapanır) · `services/notificationService.js` ·
Navbar'a bağlandı (yalnız `isInternal` — portal oturumları bildirim uçlarına
erişemez) · `App.jsx` provider · `i18n/tr.json` + `en.json` `notifications`
bölümü · `index.css` stilleri.

Web'de backend `link` alanı DOĞRUDAN kullanılıyor (`navigate(item.link)`) —
zaten web yolu olarak üretiliyor. Mobil bunu ayrıştırmıyor, türden hedefe
eşliyor. Sözleşme tek, tüketim platforma göre.

**Web ölçümü (puppeteer, gerçek tarayıcı):**

| Test | Sonuç |
|---|---|
| Çan render oldu | ✅ |
| Başlangıçta rozet yok | ✅ |
| Görev atanınca rozet **sayfa yenilenmeden** belirdi | ✅ socket zinciri çalışıyor |
| Bildirim panelde göründü | ✅ |
| "Tümünü okundu yap" → rozet kalktı | ✅ |
| Konsol/sayfa hatası | ✅ yok |

### ✅ Mail hattı — mock modda (2026-07-28)

`nodemailer` kuruldu. Yapı e-Fatura adaptörünün aynısı:
`services/mail/` → `MailProvider` (sözleşme) · `MockMailProvider` (hiçbir şey
göndermez) · `SmtpMailProvider` (nodemailer) · `index.js` (env'e göre DI
seçici) · `templates.js` (inline stilli şablonlar).

`services/mailService.js` **üç kapı** uyguluyor, sırayla: `EMAIL_NOTIFICATIONS_ENABLED`
→ kullanıcının `emailPreferences` tercihi → sağlayıcı. Her denemede
`models/MailLog.js`'e satır yazılır: `mocked` / `sent` / `failed` / `skipped`.
Gövde (html) saklanır, çünkü şablon değişikliğinin sonucu ancak gönderilen
gövdeye bakılarak görülür.

**Şu anki ayar:** `EMAIL_NOTIFICATIONS_ENABLED=true` + `MAIL_PROVIDER=mock`
= "gönderildi gibi". Hat baştan sona çalışır, gövde üretilir, kaydedilir,
**hiçbir şey sunucudan çıkmaz.**

**GERÇEK GÖNDERİME GEÇİŞ:** `backend/.env` içinde `MAIL_PROVIDER=smtp` yap,
`SMTP_USER` / `SMTP_PASS` doldur, backend'i yeniden başlat. Kod değişikliği
YOK. Gmail'de normal hesap şifresi çalışmaz — "uygulama şifresi" gerekir
(hesapta iki adımlı doğrulama açık olmalı).

`User.emailPreferences` alanı eklendi, hepsi varsayılan `true` → mevcut
kullanıcılar için migration gerekmiyor. Sistem içi bildirimi etkilemez,
yalnız e-postayı.

**Arayüz — her iki platformda (yalnız super_admin):**

- Web: `pages/MailLogs.jsx`. Satıra basınca gövde **HTML olarak** önizlenir
  (sandbox'lı iframe).
- Mobil: `screens/MailLogsScreen.jsx` + `config/mailLogs.js` + servis, çekmece
  menüsünde "Mail Gönderimleri". Detayda gövde **düz metin** gösteriliyor:
  HTML render etmek `react-native-webview` bağımlılığı isterdi ve bu bir teşhis
  ekranı — kayıtta `text` alternatifi zaten saklanıyor.

İkisinde de en üstte hattın o anki modu açıkça yazıyor; deneme modunda
kayıtlar "Taslak" olarak işaretlenir ki kimse gitmiş sanmasın.

**Mobil doğrulama (emülatör görüntüleriyle):** menü öğesi göründü, ekran
açıldı, mod bandı ve durum çipleri (Taslak (3)) doğru, kartlar alıcı/tür/tarih
ile listelendi, detay modalı tüm alanları ve gövdeyi gösterdi.

Düz metin sürümünde `&quot;` gibi HTML varlıkları kalıyordu (gövde önce
kaçırılıp sonra etiketleri temizlendiği için) — `stripHtml` artık varlıkları
geri çözüyor. Yeni bir kayıtla doğrulandı; ondan ÖNCE oluşmuş kayıtlarda
kalıntı hâlâ görünür.

### ✅ Lookup cache (2026-07-28)

`frontend/src/utils/lookupCache.js` + `mobile/src/utils/lookupCache.js`
(paylaşılan paket olmadığı için kopya, davranış birebir).

İki kazanç birlikte:
- **TTL** — süre dolmadıysa ağa çıkılmaz (katalog 10dk, projeler/atanabilir/
  uygun üyeler 5dk, kullanıcılar 3dk).
- **Eşzamanlı istek birleştirme** — aynı anahtar için istek uçuyorsa ikincisi
  yeni istek açmaz, aynı sözü bekler. Üç bileşenin aynı anda mount olduğu
  durumu tek isteğe indiren şey budur; TTL tek başına çözmez çünkü ilk yanıt
  henüz dönmemiştir.

Sarılan uçlar: `catalog`, `projects` (all/mine/eligible-members),
`users`, `tasks/assignable-users`. Yazma işlemleri `invalidate()` çağırıyor;
departman değişimi ve kullanıcı silme "atanabilir kişiler" + "uygun ekip
üyeleri" anahtarlarını da düşürüyor.

**Bilerek DIŞARIDA:** onay kuyruğu, canlı sohbet, denetim kaydı, görev
listesi/pano durumları, iş yükü skoru, ısı haritası, satış özeti, onay
bekleyen kullanıcılar rozeti.

Oturum kapanışında ve 401'de önbellek **zorunlu** boşaltılıyor (her iki
platformda) — farklı kullanıcı farklı yetki demek.

**Ölçüm (tarayıcıda gerçek ağ istekleri, CORS preflight'ları hariç):**

| Test | Sonuç |
|---|---|
| `getAll` × 8 (5 eşzamanlı + 3 ardışık) | **1 GET** |
| Farklı departman = farklı anahtar (dev×3 + design×1) | 2 GET (doğru) |
| get, get, invalidate, get | 2 GET (doğru) |
| Katalog sayfası → Teklifler sayfası | ikincide **yeni istek yok** |

> Ölçüm tuzağı: puppeteer'ın `request` olayı CORS **preflight (OPTIONS)**
> isteklerini de sayıyor. İlk denememde 8 çağrı için "2 istek" gördüm ve
> kusur sandım; ikincisi 4ms'de 204 dönen preflight'tı. `r.method() !== 'OPTIONS'`
> filtresi şart.

### ✅ Teklif olayları bildirim kanalına taşındı (2026-07-28)

`utils/quoteNotify.js` artık İKİ kanal işletiyor: kalıcı bildirim (teklifin
`owner`'ına) + eski STAFF_ROOM canlı yayını.

Neden gerekti: STAFF_ROOM sohbet kapsamlı, `accountant` o odaya hiç girmiyor —
teklif/fatura onun işi olduğu halde hiçbir şey alamıyordu. Üstelik **o
olayları dinleyen bir istemci kodu ne webde ne mobilde vardı**, yani yayın
tamamen boşa gidiyordu.

STAFF_ROOM yayını silinmedi: maliyeti yok ve ileride bir "canlı akış" ekranı
isteyebilir. Ama artık tek başına yeterli değil, kalıcı kayıt bildirim
kanalında üretiliyor.

`notificationService.quoteEvent()` eklendi; `publicQuoteController`'daki üç
çağrı `await` edildi ki bildirim HTTP yanıtından önce yazılsın. E-posta
şablonu bilerek YOK — müşterinin her görüntülemesinde mail atmak gürültü
olurdu; kabul/red için istenirse `templates.js`'e `QUOTE_EVENT` eklenip
`emailData` verilmesi yeterli.

**Ölçüm:** `sent` durumundaki, henüz görüntülenmemiş bir teklif public
bağlantıdan (giriş yapmadan) açıldı → sahibine bildirim düştü:
*"Marcus Johnson, TKF-2026-0002 numaralı teklifinizi görüntüledi."*

> Kabul/red yolları AYNI fonksiyondan geçtiği için aynı mekanizmayı kullanıyor,
> ama ayrıca test EDİLMEDİ: bir teklifi gerçekten kabul etmek dev
> veritabanında iş durumunu kalıcı değiştirir, onay almadan yapılmadı.
>
> Ayrıca dikkat: 'viewed' olayı yalnız `status === 'sent'` VE
> `publicViewedAt` boşken tetiklenir — tasarım böyle. İlk denememde
> `accepted` durumunda bir teklif seçtiğim için bildirim gelmedi ve bir an
> kusur sandım.

### Bu iş sırasında çıkan ayrı bulgu: STAFF_ROOM çift görevde

`utils/quoteNotify.js` teklif olaylarını (`quote:viewed/accepted/rejected`)
STAFF_ROOM'a yayınlıyor. Ama STAFF_ROOM sohbet kapsamlı — yani **muhasebeci
teklif bildirimlerini de alamıyor**, üstelik teklif/fatura onun işi.

Bunu bilinçli olarak DEĞİŞTİRMEDİM: teklif olaylarını STAFF_ROOM'da bırakmak
yanlış, ama oraya muhasebeciyi eklemek sohbeti sızdırır. Doğru çözüm, bildirim
motoru kurulurken teklif olaylarını da yeni bildirim kanalına taşımak.

---

## 1. Bildirim motoru

### Bugünkü durum

`createTask` görevi kaydediyor, ısı haritası için bir `TaskActivity` yazıyor ve
dönüyor. **Atanan kişiye hiçbir haber gitmiyor** — kişi görevi ancak Görevler
ekranını kendisi açtığında görüyor.

### İşi kolaylaştıran bulgular

- **Tek tetikleme noktası.** `assignedTo` yalnızca görev oluşturulurken yazılıyor;
  kodda yeniden atama ucu yok (rotalar: create, status, deadline, comments).
  Bu yüzden EventEmitter mimarisi bu ölçekte gereksiz — doğrudan bir
  `notificationService.taskAssigned(...)` çağrısı yeter. Olay yayıcıya
  3-4 farklı tetikleyici olduğunda geçilir.
- **Zamanlanmış iş + socket yayın deseni kurulu.** `services/slaEscalationService.js`
  node-cron ile çalışıp `getIO()` üzerinden odaya yayın yapıyor — kopyalanacak
  hazır emsal.
- Oda adlandırma konvansiyonu mevcut: `conversation:<id>`, `STAFF_ROOM`.
  Yeni oda `user:<id>` olmalı (`user_123` değil).

### Eksikler

| Parça | Durum |
|---|---|
| `Notification` modeli | ❌ Yok — recipient, title, message, link, isRead, createdAt |
| Mail altyapısı | ❌ Tamamen yok — nodemailer bile kurulu değil |
| `emailPreferences` (User) | ❌ Yok |
| Bildirim çanı arayüzü | ❌ Yok (web + mobil) |

### İki gerçek engel

**1. Socket rol kapısı.** `socket/index.js` bağlanan kişinin rolü
`PERMISSIONS.chat.read` içinde değilse bağlantıyı reddediyor — `accountant` o
listede yok. Ve `getAssignableUsers` **role bakmıyor**, o departmandaki onaylı
herkesi döndürüyor. Yani pazarlama departmanına atanmış bir muhasebeciye görev
verilebilir ve o kişi anlık bildirimi asla alamaz.

> Düzeltme: socket kimlik doğrulaması "bağlanabilir" ile "sohbet odalarına
> girebilir" ayrımını yapmalı. Bağlantı herkese açık olmalı, sohbet odasına
> katılım ayrıca kontrol edilmeli.

**2. Mail dışa bağımlı.** SMTP sağlayıcısı (Gmail uygulama şifresi, SendGrid,
Resend...) hesabı ve kimlik bilgileri gerekiyor — bu kod işi değil, ürün kararı.
`EMAIL_NOTIFICATIONS_ENABLED=false` ile sistem içi bildirim tek başına çalışır,
mail sonra açılır. Kullanıcı tercihi için doğal yer hazır: Profil ekranındaki
"Tercihler" bölümü (şu an yok, çünkü arkasında bir şey yoktu — bu iş onu gerçek
yapar).

**BullMQ'ya gerek yok.** Redis yeni bir servis demek; bu hacimde nodemailer'ı
doğrudan çağırmak yeterli. Tek şart: mail gönderimi görev oluşturmayı
bloklamamalı, mail patlarsa görev yine de oluşmalı.

---

## 2. Önbellekleme

### Tekrar eden istekler (doğrulandı)

| Yer | Ne zaman | Ne çekiyor |
|---|---|---|
| Görev Oluştur modalı | Her açılışta | `/tasks/assignable-users` + `/projects` |
| `useCatalog` (web) | 3 bileşen ayrı ayrı | `/catalog` |
| Kullanıcı listesi | Users + Erişim Kontrolü | `/users` |
| Mobil Projeler/Kullanıcılar | Her ekran odağında | `/projects`, `/users` |

Web'de state kütüphanesi yok; `hooks/` altındaki 16 hook'un her biri kendi
`useState` + `useEffect`'iyle mount'ta istek atıyor. Bunlar **context değil düz
hook** olduğu için aynı hook'u çağıran her bileşen kendi kopyasını üretiyor
(`useTasks` 4, `useCatalog` 3, `useProjects` 3 bileşende).

### Neden güvenli: sunucu her yazmada yeniden doğruluyor

Bu uygulamada bayat veri **hatalı kayıt üretemiyor**. Görev oluştururken
`taskController` atanan kişinin gerçekten o departmanda ve onaylı olduğunu
tekrar kontrol edip değilse 400 dönüyor. Yani liste 10 dakika bayat kalırsa en
kötü senaryo: dün departman değiştirmiş birini listede görürsün, seçersin,
sunucu reddeder. Veri bozulmaz.

**Önbelleğe alınabilir (referans verisi):**
`/tasks/assignable-users` · `/projects` · `/catalog` · `/users` ·
`/projects/eligible-members`

**Asla alınmamalı (durumu anlık önemli):**
Onay Kuyruğu · Canlı Sohbet · Denetim Kaydı · görev panosu durumları ·
fırsat aşamaları · fatura durumları

### Önerilen kapsam: küçük lookup cache, büyük göç değil

Yukarıdaki 5 uçla sınırlı tutulursa React Query/Zustand/Redux'a gerek yok.
~50 satırlık bir modül yeter:

```
getCached(key, fetcher, ttlMs)
  → hafızada var ve TTL dolmamışsa: doğrudan döndür, ağ yok
  → yoksa/bayatsa: çek, sakla, döndür
invalidate(key)  → yazma işleminden sonra çağrılır
```

Yazma sonrası geçersiz kılma şart: yeni kullanıcı eklendiğinde `users` anahtarı
düşer, yeni proje açıldığında `projects` düşer. Olmazsa "yeni eklediğim kişi
listede yok" şikâyeti gelir.

---

## Orijinal öneriye itirazlar

Bu bölüm, dışarıdan gelen ilk öneri metnindeki hatalı/eksik noktaları kayda
geçirir — aynı tuzağa tekrar düşülmesin diye.

1. **"Zustand, Redux Toolkit veya React Query" bunlar alternatif değil.**
   React Query bir *sunucu önbelleği*; Zustand/Redux *istemci state*'i.
   İkincileri seçersen stale kontrolü ve rollback'i elle yazarsın. Bu
   uygulamadaki verinin tamamı sunucu verisi — doğru araç React Query.

2. **Tek tip 5 dakika tehlikeli.** Onay kuyruğunu 5 dk önbellekte tutarsan
   yönetici az önce onayladığı talebi hâlâ "Bekliyor" görür. Kaynak bazlı
   `staleTime` şart.

3. **"Lokal doğrulama" güvenlik açısından yanlış ifade edilmiş.** Önbellekten
   bakılan şey yalnızca *butonu gizlemek* olabilir, *izin vermek* asla. Bu kod
   tabanında yetki kararı her zaman sunucuda: `requireProjectManager`,
   `canViewProject`, `authorizeOrQueue`.

4. **Optimistic UI ile onay mekanizması çakışıyor — en kritik nokta.**
   Kullanıcı kendi rolüyle değil, verilmiş geçici yetkiyle yazma yaptığında
   `authorizeOrQueue` isteği controller'a ulaştırmıyor; `PendingApproval` olarak
   kuyruğa alıyor ve süper admin onaylayana kadar **hiçbir şey yazılmıyor**.
   Naif optimistic UI'da kullanıcı değişikliği ekranda görür, sunucu 2xx döner
   (istek geçerli, sadece kuyruğa alındı), rollback tetiklenmez — ve değişiklik
   hiç olmaz. Bu durumun ayrı ele alınması gerekir.

   İyi haber: rollback'in sunucu tarafı hazır. `expectedVersion`/`__v` çakışma
   kontrolü `dealController` ve `taskController`'da var, 409 dönüyor.
