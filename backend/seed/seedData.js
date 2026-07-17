/**
 * Seed script — populates the database with realistic demo data.
 * Run with: npm run seed (from server directory)
 *
 * DESTRUCTIVE: wipes User/Customer/Feedback/Task/TaskActivity before
 * inserting the demo set. If the database already has more data than this
 * script's own fixed demo rows (e.g. real users added through the app), it
 * refuses to run unless you pass --force — a prior reseed silently wiped
 * manually-added users/departments, so this exists to make that a conscious
 * choice instead of an accident.
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Customer = require('../models/Customer');
const Feedback = require('../models/Feedback');
const Task = require('../models/Task');
const TaskActivity = require('../models/TaskActivity');
const { calculatePriority } = require('../utils/revenueImpact');

// hireDate — createdAt'tan (hesap kaydı zamanı) kasıtlı olarak ayrı: Çalışan
// Dizini/Profilim kıdemi buradan hesaplanır (bkz. utils/developerTree.js),
// böylece seed her çalıştığında herkes "0 ay" görünmez.
const seedUsers = [
  {
    name: 'Admin User',
    email: 'admin@microcrm.com',
    password: 'admin123',
    role: 'super_admin',
    status: 'approved',
    hireDate: new Date('2023-08-13'),
  },
  // Department leads
  {
    name: 'Apo Yılmaz',
    email: 'apo@microcrm.com',
    password: 'staff123',
    role: 'staff',
    status: 'approved',
    department: 'development',
    isDepartmentLead: true,
    hireDate: new Date('2023-02-14'),
  },
  {
    name: 'Elif Kara',
    email: 'elif@microcrm.com',
    password: 'staff123',
    role: 'staff',
    status: 'approved',
    department: 'design',
    isDepartmentLead: true,
    hireDate: new Date('2024-09-11'),
  },
  {
    name: 'Selami Kolcu',
    email: 'selami@microcrm.com',
    password: 'staff123',
    role: 'staff',
    status: 'approved',
    department: 'marketing',
    isDepartmentLead: true,
    hireDate: new Date('2024-06-17'),
  },
  // Regular staff
  {
    name: 'Berk Demir',
    email: 'berk@microcrm.com',
    password: 'staff123',
    role: 'staff',
    status: 'approved',
    department: 'development',
    hireDate: new Date('2024-02-15'),
  },
  {
    name: 'Zeynep Arslan',
    email: 'zeynep.staff@microcrm.com',
    password: 'staff123',
    role: 'staff',
    status: 'approved',
    department: 'design',
    hireDate: new Date('2025-01-10'),
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

const FORCE = process.argv.includes('--force') || process.env.SEED_FORCE === '1';

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('📦 Connected to MongoDB for seeding...');

    const [userCount, customerCount, feedbackCount, taskCount, activityCount] = await Promise.all([
      User.countDocuments(),
      Customer.countDocuments(),
      Feedback.countDocuments(),
      Task.countDocuments(),
      TaskActivity.countDocuments(),
    ]);
    const existingTotal = userCount + customerCount + feedbackCount + taskCount + activityCount;

    if (existingTotal > 0 && !FORCE) {
      console.error('\n⚠️  Refusing to seed: the database is not empty.');
      console.error(`   Found ${userCount} users, ${customerCount} customers, ${feedbackCount} feedbacks, ${taskCount} tasks, ${activityCount} task activities.`);
      console.error('   Running this script WILL DELETE all of them and replace them with fixed demo data.');
      console.error('   If that\'s really what you want, run again with --force (e.g. "npm run seed -- --force").\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Customer.deleteMany({}),
      Feedback.deleteMany({}),
      Task.deleteMany({}),
      TaskActivity.deleteMany({}),
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

    // ── Task & TaskActivity seed (heatmap demo data) ──────────────────
    const DEPARTMENTS_LIST = ['development', 'design', 'marketing'];
    const STATUSES = ['todo', 'in_progress', 'in_review', 'done'];
    const TASK_TITLES = [
      'API rate-limit ayarı', 'Login page fix', 'Dashboard redesign',
      'Mobile responsive', 'Dark mode bug', 'Onboarding flow',
      'Performance tuning', 'Export CSV fix', 'Webhook integration',
      'Search refactor', 'Notification system', 'Cache layer',
      'Unit test coverage', 'CI/CD pipeline', 'Landing page update',
      'Email template', 'Analytics dashboard', 'User settings page',
      'Payment flow', 'Error handling', 'SEO optimization',
      'Accessibility audit', 'Image upload', 'Bulk import',
    ];

    // Map department → users in that department
    const deptUserMap = {};
    for (const u of users) {
      if (u.department) {
        if (!deptUserMap[u.department]) deptUserMap[u.department] = [];
        deptUserMap[u.department].push(u);
      }
    }

    // Create tasks spread across departments
    const taskDocs = [];
    for (let i = 0; i < TASK_TITLES.length; i++) {
      const dept = DEPARTMENTS_LIST[i % DEPARTMENTS_LIST.length];
      const deptUsers = deptUserMap[dept] || [users[0]];
      const assignee = deptUsers[i % deptUsers.length];
      const lead = deptUsers.find((u) => u.isDepartmentLead) || users[0];
      taskDocs.push({
        title: TASK_TITLES[i],
        description: `Demo görev açıklaması: ${TASK_TITLES[i]}`,
        department: dept,
        priority: ['low', 'medium', 'high', 'critical'][i % 4],
        status: STATUSES[i % STATUSES.length],
        assignedTo: assignee._id,
        assignedBy: lead._id,
      });
    }
    const tasks = await Task.create(taskDocs);
    console.log(`✅ Created ${tasks.length} tasks`);

    // Generate ~180 days of realistic TaskActivity records
    const activities = [];
    const now = new Date();
    const seededRandom = (seed) => {
      // Simple seeded PRNG for reproducible density
      let x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    for (let daysAgo = 180; daysAgo >= 0; daysAgo--) {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

      // Natural density: weekdays heavier, weekends lighter, recent weeks denser
      const recencyBoost = Math.max(0, 1 - daysAgo / 200);
      const weekdayBoost = (dayOfWeek >= 1 && dayOfWeek <= 5) ? 1.5 : 0.4;
      const maxActivities = Math.floor(seededRandom(daysAgo * 7 + 3) * 6 * weekdayBoost * (0.5 + recencyBoost));

      for (let j = 0; j < maxActivities; j++) {
        const taskIdx = Math.floor(seededRandom(daysAgo * 100 + j * 13) * tasks.length);
        const task = tasks[taskIdx];
        const dept = task.department;
        const deptUsers = deptUserMap[dept] || [users[0]];
        const actor = deptUsers[Math.floor(seededRandom(daysAgo * 50 + j * 7) * deptUsers.length)];

        const isCreation = seededRandom(daysAgo * 31 + j * 17) < 0.2;
        const fromIdx = Math.floor(seededRandom(daysAgo * 41 + j * 23) * 3);
        const toIdx = fromIdx + 1;

        const activityDate = new Date(date);
        activityDate.setHours(
          8 + Math.floor(seededRandom(daysAgo * 61 + j * 29) * 10),
          Math.floor(seededRandom(daysAgo * 71 + j * 37) * 60),
          0, 0
        );

        activities.push({
          task: task._id,
          changedBy: actor._id,
          changedByName: actor.name,
          taskTitle: task.title,
          department: dept,
          action: isCreation ? 'created' : 'status_changed',
          fromStatus: isCreation ? null : STATUSES[fromIdx],
          toStatus: isCreation ? 'todo' : STATUSES[toIdx],
          createdAt: activityDate,
        });
      }
    }

    if (activities.length > 0) {
      await TaskActivity.insertMany(activities);
    }
    console.log(`📊 Created ${activities.length} task activities (heatmap data)`);

    console.log('\n✅ Database seeded successfully!');
    console.log('📧 Admin login: admin@microcrm.com / admin123');
    console.log('📧 Staff login: apo@microcrm.com / staff123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
};

seedDatabase();
