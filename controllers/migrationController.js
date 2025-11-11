const User = require('../models/User');

// Rehber detayını kontrol et (debug için)
exports.checkRehberDetail = async (req, res) => {
  try {
    const { rehberId } = req.params;
    const rehber = await User.findById(rehberId);
    
    if (!rehber) {
      return res.status(404).json({ success: false, message: 'Rehber bulunamadı' });
    }
    
    res.json({
      success: true,
      rehberDetay: rehber.rehberDetay,
      hasAnalizSonuclari: !!rehber.rehberDetay.analizSonuclari,
      analizSonuclariType: typeof rehber.rehberDetay.analizSonuclari,
      analizSonuclariValue: rehber.rehberDetay.analizSonuclari
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Tüm rehberlere analizSonuclari alanını ekle
exports.migrateRehberAnaliz = async (req, res) => {
  try {
    console.log('\n🔄 Migration başlatılıyor...\n');

    // Tüm rehberleri bul
    const rehberler = await User.find({ role: 'Rehber' });
    
    console.log(`📊 Toplam ${rehberler.length} rehber bulundu\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    const results = [];

    for (const rehber of rehberler) {
      const rehberInfo = `${rehber.ad} ${rehber.soyad} (${rehber._id})`;
      
      // Her zaman güncelle (force update)
      console.log(`🔧 Güncelleniyor: ${rehberInfo}`);
      console.log(`   Mevcut analizSonuclari:`, rehber.rehberDetay.analizSonuclari);
      
      // rehberDetay objesini tamamen yeniden oluştur
      const currentRehberDetay = rehber.rehberDetay.toObject();
      rehber.rehberDetay = {
        siniflar: currentRehberDetay.siniflar || [],
        ogrenciler: currentRehberDetay.ogrenciler || [],
        anketler: currentRehberDetay.anketler || [],
        anket_sonuclari: currentRehberDetay.anket_sonuclari || [],
        analizSonuclari: currentRehberDetay.analizSonuclari || []
      };
      
      rehber.markModified('rehberDetay');
      await rehber.save();
      
      // Tekrar oku ve doğrula
      const updatedRehber = await User.findById(rehber._id);
      const hasField = updatedRehber.rehberDetay.analizSonuclari !== undefined;
      
      updatedCount++;
      results.push({ 
        rehber: rehberInfo, 
        status: 'updated',
        verified: hasField,
        analizSonuclariType: typeof updatedRehber.rehberDetay.analizSonuclari
      });
      console.log(`   ✅ Güncellendi - Doğrulama: ${hasField ? 'BAŞARILI' : 'BAŞARISIZ'}\n`);
    }

    console.log('\n📈 Migration Özeti:');
    console.log(`   ✅ Güncellenen: ${updatedCount}`);
    console.log(`   ⏭️  Atlanan: ${skippedCount}`);
    console.log(`   📊 Toplam: ${rehberler.length}\n`);
    
    res.json({
      success: true,
      message: 'Migration başarıyla tamamlandı',
      summary: {
        total: rehberler.length,
        updated: updatedCount,
        skipped: skippedCount
      },
      details: results
    });
    
  } catch (err) {
    console.error('❌ Migration hatası:', err.message);
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Migration sırasında hata oluştu',
      error: err.message
    });
  }
};

// Rehberlerin öğrenci listelerini senkronize et
exports.syncRehberOgrenciler = async (req, res) => {
  try {
    console.log('\n🔄 Rehber-Öğrenci Senkronizasyonu Başlatılıyor...\n');

    // Tüm öğrencileri bul
    const ogrenciler = await User.find({ role: 'Öğrenci' });
    
    console.log(`📊 Toplam ${ogrenciler.length} öğrenci bulundu\n`);

    let addedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const ogrenci of ogrenciler) {
      const ogrenciInfo = `${ogrenci.ad} ${ogrenci.soyad} (${ogrenci._id})`;
      const rehberID = ogrenci.ogrenciDetay?.rehberID;
      
      if (!rehberID) {
        console.log(`⏭️  Atlanan: ${ogrenciInfo} - Rehber atanmamış`);
        skippedCount++;
        results.push({ 
          ogrenci: ogrenciInfo, 
          status: 'skipped',
          reason: 'Rehber atanmamış'
        });
        continue;
      }

      // Rehberi bul
      const rehber = await User.findById(rehberID);
      if (!rehber || rehber.role !== 'Rehber') {
        console.log(`❌ Hata: ${ogrenciInfo} - Rehber bulunamadı (${rehberID})`);
        errorCount++;
        results.push({ 
          ogrenci: ogrenciInfo, 
          status: 'error',
          reason: 'Rehber bulunamadı'
        });
        continue;
      }

      // Rehberin öğrenciler listesinde olup olmadığını kontrol et
      const ogrenciIdStr = ogrenci._id.toString();
      const isInList = rehber.rehberDetay.ogrenciler.some(
        id => id.toString() === ogrenciIdStr
      );

      if (isInList) {
        console.log(`✓ ${ogrenciInfo} - Zaten listede`);
        skippedCount++;
        results.push({ 
          ogrenci: ogrenciInfo, 
          status: 'skipped',
          reason: 'Zaten listede'
        });
      } else {
        console.log(`🔧 ${ogrenciInfo} - Rehber ${rehber.ad} ${rehber.soyad}'ın listesine ekleniyor`);
        rehber.rehberDetay.ogrenciler.push(ogrenci._id);
        rehber.markModified('rehberDetay');
        await rehber.save();
        addedCount++;
        results.push({ 
          ogrenci: ogrenciInfo, 
          rehber: `${rehber.ad} ${rehber.soyad}`,
          status: 'added'
        });
      }
    }

    console.log('\n📈 Senkronizasyon Özeti:');
    console.log(`   ➕ Eklenen: ${addedCount}`);
    console.log(`   ⏭️  Atlanan: ${skippedCount}`);
    console.log(`   ❌ Hata: ${errorCount}`);
    console.log(`   📊 Toplam: ${ogrenciler.length}\n`);
    
    res.json({
      success: true,
      message: 'Senkronizasyon başarıyla tamamlandı',
      summary: {
        total: ogrenciler.length,
        added: addedCount,
        skipped: skippedCount,
        errors: errorCount
      },
      details: results
    });
    
  } catch (err) {
    console.error('❌ Senkronizasyon hatası:', err.message);
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Senkronizasyon sırasında hata oluştu',
      error: err.message
    });
  }
};
