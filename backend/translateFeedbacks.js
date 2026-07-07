const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const translations = {
  'Login page crashes on mobile': 'Giriş sayfası mobilde çöküyor',
  'The login page throws a white screen error on iOS Safari. Users cannot access their accounts. This is blocking our entire team.': 'Giriş sayfası iOS Safari\'de beyaz ekran hatası veriyor. Kullanıcılar hesaplarına erişemiyor. Bu tüm ekibimizin işini engelliyor.',
  'Data export generates corrupt CSV files': 'Veri dışa aktarımı bozuk CSV dosyaları oluşturuyor',
  'When exporting more than 1000 rows, the CSV file is truncated and has encoding issues. We need this for our monthly reports.': '1000 satırdan fazla dışa aktarırken CSV dosyası kesiliyor ve kodlama sorunları yaşıyor. Aylık raporlarımız için buna ihtiyacımız var.',
  'API rate limiting is too aggressive': 'API istek limiti çok kısıtlayıcı',
  'Our integration hits the rate limit after just 50 requests per minute. We need at least 200 for our workflow automation.': 'Entegrasyonumuz dakikada sadece 50 istekten sonra limite takılıyor. İş akışı otomasyonumuz için en az 200\'e ihtiyacımız var.',
  'Dashboard loading takes 15+ seconds': 'Kontrol paneli 15+ saniyede yükleniyor',
  'The main dashboard takes forever to load when we have more than 500 records. Performance is unacceptable for our team.': '500\'den fazla kaydımız olduğunda ana kontrol paneli çok yavaş yükleniyor. Performans ekibimiz için kabul edilemez.',
  'Need webhook support for integrations': 'Entegrasyonlar için webhook desteği gerekiyor',
  'We want to connect our CRM with Slack and get real-time notifications when new data comes in.': 'CRM\'imizi Slack ile bağlamak ve yeni veri geldiğinde gerçek zamanlı bildirimler almak istiyoruz.',
  'Bulk import fails silently': 'Toplu içe aktarma sessizce başarısız oluyor',
  'When importing a large CSV, some rows fail but there is no error log. We cannot tell which records were not imported.': 'Büyük bir CSV içe aktarırken bazı satırlar başarısız oluyor ama hata günlüğü yok. Hangi kayıtların aktarılmadığını anlayamıyoruz.',
  'Add team collaboration features': 'Ekip işbirliği özellikleri ekleyin',
  'We need the ability to assign tasks to team members and leave comments on records.': 'Ekip üyelerine görev atama ve kayıtlar üzerinde yorum yapma yeteneğine ihtiyacımız var.',
  'Search functionality is too basic': 'Arama işlevi çok yetersiz',
  'Cannot search by date range or use advanced filters. We need more powerful search capabilities.': 'Tarih aralığına göre arama yapılamıyor veya gelişmiş filtreler kullanılamıyor. Daha güçlü arama yeteneklerine ihtiyacımız var.',
  'Email notifications not arriving': 'E-posta bildirimleri ulaşmıyor',
  'We have not received any email notifications for the past 3 days. Checked spam folder too.': 'Son 3 gündür hiçbir e-posta bildirimi almadık. Spam klasörünü de kontrol ettik.',
  'Add dark mode support': 'Karanlık mod desteği ekleyin',
  'Would love to have a dark mode option. I work late at night and the bright interface is hard on the eyes.': 'Karanlık mod seçeneği harika olurdu. Gece geç saatlere kadar çalışıyorum ve parlak arayüz gözleri yoruyor.',
  'Mobile app request': 'Mobil uygulama isteği',
  'It would be great to have a mobile app to check things on the go.': 'Hareket halindeyken bir şeyleri kontrol etmek için mobil bir uygulamanın olması harika olurdu.',
  'Typo in settings page': 'Ayarlar sayfasında yazım hatası',
  'There is a spelling mistake in the settings page header. Says "Settigns" instead of "Settings".': 'Ayarlar sayfası başlığında yazım hatası var. "Ayarlar" yerine yanlış yazılmış.',
  'Change background color to pink': 'Arka plan rengini pembe yap',
  'I think the app would look better with a pink background. Just a suggestion!': 'Bence uygulama pembe bir arka planla daha iyi görünürdü. Sadece bir öneri!',
  'Add emoji reactions to comments': 'Yorumlara emoji tepkileri ekleyin',
  'Would be fun to react to things with emojis like on Discord.': 'Discord\'daki gibi emoji tepkileri vermek eğlenceli olurdu.',
  'Make logo bigger': 'Logoyu büyütün',
  'The logo in the header is too small. Make it at least 2x bigger.': 'Üst kısımdaki logo çok küçük. En az 2 kat büyütün.',
  'Add gaming leaderboard': 'Oyunlaştırma lider tablosu ekleyin',
  'A gamification feature would make the app more engaging. Points for completing tasks!': 'Oyunlaştırma özelliği uygulamayı daha çekici hale getirirdi. Görevleri tamamlamak için puanlar!',
  'Support for Turkish language': 'Türkçe dil desteği',
  'The app should support Turkish language. Many users in Turkey would appreciate it.': 'Uygulama Türkçe dilini desteklemeli. Türkiye\'deki birçok kullanıcı bunu takdir eder.'
};

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const db = mongoose.connection.db;
  const feedbacks = await db.collection('feedbacks').find({}).toArray();
  let updatedCount = 0;
  for (const fb of feedbacks) {
    const newTitle = translations[fb.title] || fb.title;
    const newDesc = translations[fb.description] || fb.description;
    if (newTitle !== fb.title || newDesc !== fb.description) {
      await db.collection('feedbacks').updateOne({ _id: fb._id }, { $set: { title: newTitle, description: newDesc } });
      updatedCount++;
    }
  }
  console.log(`Translated successfully. Updated ${updatedCount} records.`);
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
