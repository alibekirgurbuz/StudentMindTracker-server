require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

// MongoDB'ye bağlan
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB bağlantısı başarılı');
  } catch (err) {
    console.error('❌ MongoDB bağlantı hatası:', err.message);
    process.exit(1);
  }
};

// Tüm rehberlere analizSonuclari alanını ekle
const migrateRehberler = async () => {
  try {
    console.log('\n🔄 Migration başlatılıyor...\n');

    // Tüm rehberleri bul
    const rehberler = await User.find({ role: 'Rehber' });
    
    console.log(`📊 Toplam ${rehberler.length} rehber bulundu\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const rehber of rehberler) {
      // Eğer analizSonuclari alanı yoksa veya undefined ise ekle
      if (!rehber.rehberDetay.analizSonuclari) {
        console.log(`🔧 Güncelleniyor: ${rehber.ad} ${rehber.soyad} (${rehber._id})`);
        
        // rehberDetay objesini yeniden oluştur
        rehber.rehberDetay = {
          ...rehber.rehberDetay.toObject(),
          analizSonuclari: []
        };
        
        rehber.markModified('rehberDetay');
        await rehber.save();
        
        updatedCount++;
        console.log(`   ✅ Güncellendi\n`);
      } else {
        console.log(`⏭️  Atlanıyor: ${rehber.ad} ${rehber.soyad} (zaten mevcut)\n`);
        skippedCount++;
      }
    }

    console.log('\n📈 Migration Özeti:');
    console.log(`   ✅ Güncellenen: ${updatedCount}`);
    console.log(`   ⏭️  Atlanan: ${skippedCount}`);
    console.log(`   📊 Toplam: ${rehberler.length}\n`);
    
    console.log('✅ Migration tamamlandı!\n');
    
  } catch (err) {
    console.error('❌ Migration hatası:', err.message);
    console.error(err);
  } finally {
    // Bağlantıyı kapat
    await mongoose.connection.close();
    console.log('🔌 MongoDB bağlantısı kapatıldı');
    process.exit(0);
  }
};

// Script'i çalıştır
const run = async () => {
  await connectDB();
  await migrateRehberler();
};

run();
