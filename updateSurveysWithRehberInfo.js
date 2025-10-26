const mongoose = require('mongoose');
const User = require('./models/User');

// MongoDB bağlantısı
mongoose.connect('mongodb://192.168.208.50:27017/studentmindtracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  
  try {
    // Tüm rehberleri bul
    const rehberler = await User.find({ role: 'Rehber' });
    
    let updatedCount = 0;
    
    for (const rehber of rehberler) {
      if (rehber.rehberDetay && rehber.rehberDetay.anketler) {
        
        // Her anket için rehber bilgilerini ekle
        rehber.rehberDetay.anketler = rehber.rehberDetay.anketler.map(anket => {
          if (!anket.rehberBilgisi) {
            anket.rehberBilgisi = {
              id: rehber._id,
              ad: rehber.ad,
              soyad: rehber.soyad,
              email: rehber.email
            };
            updatedCount++;
          }
          return anket;
        });
        
        // Rehber'i kaydet
        await rehber.save();
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Güncelleme hatası:', error);
    process.exit(1);
  }
}).catch(err => {
  console.error('MongoDB bağlantı hatası:', err);
  process.exit(1);
});
