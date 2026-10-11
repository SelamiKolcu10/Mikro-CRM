const mongoose = require('mongoose');
const dns = require('dns');

// Bu makinenin yerel DNS çözümleyicisi mongodb.net için (SRV dahil) zaman
// aşımına uğruyor; genel ağ sorunu, Atlas'a özgü değil. Node'u doğrudan
// çalışan bir public resolver'a yönlendiriyoruz.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
