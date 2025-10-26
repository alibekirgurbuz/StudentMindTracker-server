const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = async () => {
  console.log('MongoDB bağlantısı başlatılıyor');
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB bağlantısı başarılı');
  } catch (err) {
    console.error('MongoDB bağlantı hatası:', err.message);
    process.exit(1); // Uygulamayı sonlandır
  }
};

module.exports = connectDB;