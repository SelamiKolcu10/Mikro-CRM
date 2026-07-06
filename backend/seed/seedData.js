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
  { title: 'Login page crashes on mobile', description: 'The login page throws a white screen error on iOS Safari. Users cannot access their accounts. This is blocking our entire team.', type: 'bug', customerIndex: 0 },
  { title: 'Data export generates corrupt CSV files', description: 'When exporting more than 1000 rows, the CSV file is truncated and has encoding issues. We need this for our monthly reports.', type: 'bug', customerIndex: 1 },
  { title: 'API rate limiting is too aggressive', description: 'Our integration hits the rate limit after just 50 requests per minute. We need at least 200 for our workflow automation.', type: 'improvement', customerIndex: 2 },
  { title: 'Dashboard loading takes 15+ seconds', description: 'The main dashboard takes forever to load when we have more than 500 records. Performance is unacceptable for our team.', type: 'bug', customerIndex: 0 },

  // High priority (from Premium customers)
  { title: 'Need webhook support for integrations', description: 'We want to connect our CRM with Slack and get real-time notifications when new data comes in.', type: 'feature', customerIndex: 3 },
  { title: 'Bulk import fails silently', description: 'When importing a large CSV, some rows fail but there is no error log. We cannot tell which records were not imported.', type: 'bug', customerIndex: 4 },
  { title: 'Add team collaboration features', description: 'We need the ability to assign tasks to team members and leave comments on records.', type: 'feature', customerIndex: 5 },
  { title: 'Search functionality is too basic', description: 'Cannot search by date range or use advanced filters. We need more powerful search capabilities.', type: 'improvement', customerIndex: 6 },
  { title: 'Email notifications not arriving', description: 'We have not received any email notifications for the past 3 days. Checked spam folder too.', type: 'bug', customerIndex: 3 },

  // Medium priority (from Starter customers)
  { title: 'Add dark mode support', description: 'Would love to have a dark mode option. I work late at night and the bright interface is hard on the eyes.', type: 'feature', customerIndex: 7 },
  { title: 'Mobile app request', description: 'It would be great to have a mobile app to check things on the go.', type: 'feature', customerIndex: 8 },
  { title: 'Typo in settings page', description: 'There is a spelling mistake in the settings page header. Says "Settigns" instead of "Settings".', type: 'bug', customerIndex: 9 },

  // Low priority (from Free customers)
  { title: 'Change background color to pink', description: 'I think the app would look better with a pink background. Just a suggestion!', type: 'improvement', customerIndex: 10 },
  { title: 'Add emoji reactions to comments', description: 'Would be fun to react to things with emojis like on Discord.', type: 'feature', customerIndex: 11 },
  { title: 'Make logo bigger', description: 'The logo in the header is too small. Make it at least 2x bigger.', type: 'improvement', customerIndex: 12 },
  { title: 'Add gaming leaderboard', description: 'A gamification feature would make the app more engaging. Points for completing tasks!', type: 'feature', customerIndex: 13 },
  { title: 'Support for Turkish language', description: 'The app should support Turkish language. Many users in Turkey would appreciate it.', type: 'feature', customerIndex: 14 },
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
