/**
 * Seed script — populates the database with realistic demo data.
 * Run with: npm run seed (from server directory)
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Customer = require('../models/Customer');
const Feedback = require('../models/Feedback');
const { calculatePriority } = require('../utils/revenueImpact');

const seedUsers = [
  {
    name: 'Admin User',
    email: 'admin@microcrm.com',
    password: 'admin123',
    role: 'admin',
  },
];

const seedCustomers = [
  // VIP Customers ($200+/mo)
  { name: 'Ahmet Yılmaz', email: 'ahmet@techcorp.com', company: 'TechCorp', plan: 'vip', mrr: 499, source: 'email' },
  { name: 'Sarah Chen', email: 'sarah@dataflow.io', company: 'DataFlow', plan: 'vip', mrr: 350, source: 'in-app' },
  { name: 'Marcus Johnson', email: 'marcus@scalehq.com', company: 'ScaleHQ', plan: 'vip', mrr: 299, source: 'email' },
  
  // Premium Customers ($100-199/mo)
  { name: 'Elif Demir', email: 'elif@startup.co', company: 'StartupCo', plan: 'premium', mrr: 149, source: 'discord' },
  { name: 'James Wilson', email: 'james@devtools.com', company: 'DevTools Inc', plan: 'premium', mrr: 129, source: 'twitter' },
  { name: 'Ayşe Kaya', email: 'ayse@cloudnine.io', company: 'CloudNine', plan: 'premium', mrr: 99, source: 'email' },
  { name: 'David Kim', email: 'david@buildfast.dev', company: 'BuildFast', plan: 'premium', mrr: 149, source: 'in-app' },
  
  // Starter Customers ($1-99/mo)
  { name: 'Mehmet Öz', email: 'mehmet@freelance.com', company: '', plan: 'starter', mrr: 29, source: 'twitter' },
  { name: 'Lisa Park', email: 'lisa@smallbiz.com', company: 'SmallBiz', plan: 'starter', mrr: 49, source: 'discord' },
  { name: 'Can Aydın', email: 'can@indie.dev', company: '', plan: 'starter', mrr: 19, source: 'email' },
  
  // Free Customers ($0/mo)
  { name: 'Zeynep Arslan', email: 'zeynep@gmail.com', company: '', plan: 'free', mrr: 0, source: 'twitter' },
  { name: 'Tom Brown', email: 'tom@hotmail.com', company: '', plan: 'free', mrr: 0, source: 'discord' },
  { name: 'Fatma Şahin', email: 'fatma@outlook.com', company: '', plan: 'free', mrr: 0, source: 'email' },
  { name: 'Alex Rivera', email: 'alex@yahoo.com', company: '', plan: 'free', mrr: 0, source: 'twitter' },
  { name: 'Emre Çelik', email: 'emre@gmail.com', company: '', plan: 'free', mrr: 0, source: 'in-app' },
];

const feedbackTemplates = [
  // Critical bugs (from VIP customers)
  { title: 'Giriş sayfası mobilde çöküyor', description: 'Giriş sayfası iOS Safari\'de beyaz ekran hatası veriyor. Kullanıcılar hesaplarına erişemiyor. Bu tüm ekibimizin işini engelliyor.', type: 'bug', customerIndex: 0 },
  { title: 'Veri dışa aktarımı bozuk CSV dosyaları oluşturuyor', description: '1000 satırdan fazla dışa aktarırken CSV dosyası kesiliyor ve kodlama sorunları yaşıyor. Aylık raporlarımız için buna ihtiyacımız var.', type: 'bug', customerIndex: 1 },
  { title: 'API istek limiti çok kısıtlayıcı', description: 'Entegrasyonumuz dakikada sadece 50 istekten sonra limite takılıyor. İş akışı otomasyonumuz için en az 200\'e ihtiyacımız var.', type: 'improvement', customerIndex: 2 },
  { title: 'Kontrol paneli 15+ saniyede yükleniyor', description: '500\'den fazla kaydımız olduğunda ana kontrol paneli çok yavaş yükleniyor. Performans ekibimiz için kabul edilemez.', type: 'bug', customerIndex: 0 },

  // High priority (from Premium customers)
  { title: 'Entegrasyonlar için webhook desteği gerekiyor', description: 'CRM\'imizi Slack ile bağlamak ve yeni veri geldiğinde gerçek zamanlı bildirimler almak istiyoruz.', type: 'feature', customerIndex: 3 },
  { title: 'Toplu içe aktarma sessizce başarısız oluyor', description: 'Büyük bir CSV içe aktarırken bazı satırlar başarısız oluyor ama hata günlüğü yok. Hangi kayıtların aktarılmadığını anlayamıyoruz.', type: 'bug', customerIndex: 4 },
  { title: 'Ekip işbirliği özellikleri ekleyin', description: 'Ekip üyelerine görev atama ve kayıtlar üzerinde yorum yapma yeteneğine ihtiyacımız var.', type: 'feature', customerIndex: 5 },
  { title: 'Arama işlevi çok yetersiz', description: 'Tarih aralığına göre arama yapılamıyor veya gelişmiş filtreler kullanılamıyor. Daha güçlü arama yeteneklerine ihtiyacımız var.', type: 'improvement', customerIndex: 6 },
  { title: 'E-posta bildirimleri ulaşmıyor', description: 'Son 3 gündür hiçbir e-posta bildirimi almadık. Spam klasörünü de kontrol ettik.', type: 'bug', customerIndex: 3 },

  // Medium priority (from Starter customers)
  { title: 'Karanlık mod desteği ekleyin', description: 'Karanlık mod seçeneği harika olurdu. Gece geç saatlere kadar çalışıyorum ve parlak arayüz gözleri yoruyor.', type: 'feature', customerIndex: 7 },
  { title: 'Mobil uygulama isteği', description: 'Hareket halindeyken bir şeyleri kontrol etmek için mobil bir uygulamanın olması harika olurdu.', type: 'feature', customerIndex: 8 },
  { title: 'Ayarlar sayfasında yazım hatası', description: 'Ayarlar sayfası başlığında yazım hatası var. "Ayarlar" yerine yanlış yazılmış.', type: 'bug', customerIndex: 9 },

  // Low priority (from Free customers)
  { title: 'Arka plan rengini pembe yap', description: 'Bence uygulama pembe bir arka planla daha iyi görünürdü. Sadece bir öneri!', type: 'improvement', customerIndex: 10 },
  { title: 'Yorumlara emoji tepkileri ekleyin', description: 'Discord\'daki gibi emoji tepkileri vermek eğlenceli olurdu.', type: 'feature', customerIndex: 11 },
  { title: 'Logoyu büyütün', description: 'Üst kısımdaki logo çok küçük. En az 2 kat büyütün.', type: 'improvement', customerIndex: 12 },
  { title: 'Oyunlaştırma lider tablosu ekleyin', description: 'Oyunlaştırma özelliği uygulamayı daha çekici hale getirirdi. Görevleri tamamlamak için puanlar!', type: 'feature', customerIndex: 13 },
  { title: 'Türkçe dil desteği', description: 'Uygulama Türkçe dilini desteklemeli. Türkiye\'deki birçok kullanıcı bunu takdir eder.', type: 'feature', customerIndex: 14 },
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('📦 Connected to MongoDB for seeding...');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Customer.deleteMany({}),
      Feedback.deleteMany({}),
    ]);
    console.log('🗑️  Cleared existing data');

    // Seed users
    const users = await User.create(seedUsers);
    console.log(`👤 Created ${users.length} users`);

    // Seed customers
    const customers = await Customer.create(seedCustomers);
    console.log(`👥 Created ${customers.length} customers`);

    // Seed feedbacks with auto-calculated priority and revenue impact
    const feedbacks = feedbackTemplates.map((template) => {
      const customer = customers[template.customerIndex];
      return {
        title: template.title,
        description: template.description,
        type: template.type,
        customer: customer._id,
        revenueImpact: customer.mrr,
        priority: calculatePriority(customer.mrr),
        status: ['open', 'open', 'open', 'in-progress', 'resolved'][Math.floor(Math.random() * 5)],
        assignedTo: users[0]._id,
      };
    });

    await Feedback.create(feedbacks);
    console.log(`📋 Created ${feedbacks.length} feedbacks`);

    console.log('\n✅ Database seeded successfully!');
    console.log('📧 Admin login: admin@microcrm.com / admin123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
};

seedDatabase();
