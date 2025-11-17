const OpenAI = require('openai');
const User = require('../models/User');
const { sendSuccess, sendError, sendNotFound, sendBadRequest } = require('../utils/responseHelper');

// OpenAI istemcisini yapılandır
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Ölçek puanı hesaplama fonksiyonu
const hesaplaOlcekPuani = (cevaplar) => {
  if (!cevaplar || !Array.isArray(cevaplar) || cevaplar.length === 0) {
    return 0;
  }
  
  let toplamPuan = 0;
  
  // Her bir cevap için puanı hesapla
  cevaplar.forEach(cevapItem => {
    // cevapItem: { soru: "...", secenekler: [...], cevap: "..." }
    const { secenekler, cevap } = cevapItem;
    
    if (secenekler && Array.isArray(secenekler) && cevap) {
      // Cevabın seçenekler dizisindeki indeksini bul
      const cevapIndex = secenekler.indexOf(cevap);
      
      // İndeks bulunduysa (0 veya pozitif bir sayı), indeksin bir fazlasını ekle
      if (cevapIndex >= 0) {
        toplamPuan += (cevapIndex + 1);
      }
    }
  });
  
  return toplamPuan;
};

// Rehberin öğrencilerinin anket sonuçlarını analiz et
exports.analyzeStudentSurveys = async (req, res) => {
  try {
    const { rehberId } = req.params;
    
    // Rehber kontrolü
    const rehber = await User.findById(rehberId);
    if (!rehber || rehber.role !== 'Rehber') {
      return sendNotFound(res, 'Rehber bulunamadı');
    }
    
    // Rehberin öğrencilerini bul (ogrenciDetay.rehberID'ye göre filtrele - daha güvenli)
    const ogrenciler = await User.find({
      role: 'Öğrenci',
      'ogrenciDetay.rehberID': rehberId
    }).select('_id ad soyad');
    
    if (ogrenciler.length === 0) {
      return sendBadRequest(res, 'Bu rehbere ait öğrenci bulunamadı');
    }
    
    // Anket sonuçlarını topla
    const anketSonuclari = rehber.rehberDetay.anket_sonuclari || [];
    
    if (anketSonuclari.length === 0) {
      return sendBadRequest(res, 'Analiz edilecek anket sonucu bulunamadı');
    }
    
    // Öğrenci bilgileriyle anket sonuçlarını birleştir ve ölçek puanı hesapla
    // Her öğrenci için anket bazlı puanları da hesapla
    const ogrenciAnketPuaniMap = new Map(); // ogrenciID -> anketId -> puan
    
    anketSonuclari.forEach(sonuc => {
      const ogrenciId = sonuc.ogrenciId?.toString();
      const anketId = sonuc.anketId?.toString();
      const cevaplar = sonuc.cevaplar || sonuc.sonuc;
      
      if (ogrenciId && anketId && cevaplar) {
        const anketPuani = hesaplaOlcekPuani(cevaplar);
        
        if (!ogrenciAnketPuaniMap.has(ogrenciId)) {
          ogrenciAnketPuaniMap.set(ogrenciId, new Map());
        }
        ogrenciAnketPuaniMap.get(ogrenciId).set(anketId, anketPuani);
      }
    });
    
    const ogrenciCevaplari = anketSonuclari.map(sonuc => {
      const ogrenci = ogrenciler.find(o => o._id.toString() === sonuc.ogrenciId.toString());
      const cevaplar = sonuc.cevaplar || sonuc.sonuc;
      
      // Genel ölçek puanını hesapla (tüm anketlerin toplamı)
      const olcekPuani = hesaplaOlcekPuani(cevaplar);
      
      return {
        ogrenciID: sonuc.ogrenciId,
        ad: ogrenci?.ad || 'Bilinmiyor',
        soyad: ogrenci?.soyad || 'Bilinmiyor',
        cevaplar: cevaplar,
        olcekPuani: olcekPuani
      };
    });
    
    // OpenAI'ye gönderilecek prompt
    const prompt = `Sen bir orta okul psikolojik danışmanısın.
Aşağıda öğrencilerin anket cevapları ve ölçek puanları yer alıyor.
Veriler JSON formatında, her öğrencinin cevapları "ogrenciID", "ad", "soyad", "cevaplar" ve "olcekPuani" alanlarını içeriyor.

**Ölçek Puanı Hesaplama:** Her sorunun cevabı için, seçeneğin indis değerinin bir fazlası (indis 0 → puan 1, indis 1 → puan 2, vb.) toplanarak öğrencinin genel ölçek puanı hesaplanmıştır.

Görevin:
1. Her öğrencinin anket cevaplarını ve ölçek puanını analiz et.
2. Ölçek puanını dikkate alarak duygusal durum, dikkat düzeyi, sosyal uyum ve stres belirtilerine dair kısa ama profesyonel bir psikolojik değerlendirme yaz.
3. Ardından tüm öğrencileri dikkate alarak genel bir sınıf analizi oluştur.

Çıktıyı tam geçerli JSON formatında döndür.
Alan adları Türkçe ve küçük harflerle olmalı.
Biçim tam olarak şu şekilde olmalı:
{
  "ogrenciler": [
    {
      "ogrenciID": "",
      "ad": "",
      "soyad": "",
      "olcekPuani": 0,
      "analiz": "..."
    }
  ],
  "genel_degerlendirme": "..."
}

Analizi bilimsel ve sade bir dille yap. Ek açıklama, yorum ya da kod bloğu ekleme.
Yalnızca yukarıdaki JSON formatında yanıt ver.

Öğrenci Verileri:
${JSON.stringify(ogrenciCevaplari, null, 2)}`;
    
    console.log('\n=== OpenAI Analiz İsteği ===');
    console.log('Rehber:', rehber.ad, rehber.soyad);
    console.log('Öğrenci sayısı:', ogrenciler.length);
    console.log('Anket sonucu sayısı:', anketSonuclari.length);
    
    // Ölçek puanlarını logla
    ogrenciCevaplari.forEach(ogr => {
      console.log(`- ${ogr.ad} ${ogr.soyad}: Ölçek Puanı = ${ogr.olcekPuani}`);
    });
    
    // OpenAI API'ye istek gönder
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Sen bir orta okul psikolojik danışmanısın. Öğrenci anket sonuçlarını analiz ediyorsun. Yanıtlarını her zaman geçerli JSON formatında ver.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });
    
    // OpenAI yanıtını al
    const analizSonucu = JSON.parse(completion.choices[0].message.content);
    
    console.log('✅ OpenAI analizi tamamlandı');
    
    // Kullanılan anket ID'lerini topla ve anket bilgilerini al
    const kullanilanAnketIdler = [...new Set(anketSonuclari.map(s => s.anketId).filter(Boolean))];
    const kullanilanAnketler = [];
    
    if (rehber.rehberDetay && rehber.rehberDetay.anketler) {
      kullanilanAnketIdler.forEach(anketId => {
        const anket = rehber.rehberDetay.anketler.find(a => a.id === anketId || a.id?.toString() === anketId?.toString());
        if (anket) {
          kullanilanAnketler.push({
            id: anket.id,
            baslik: anket.baslik,
            aciklama: anket.aciklama || ''
          });
        }
      });
    }
    
    // Her öğrenci için anket bazlı puanları hazırla
    const ogrenciAnketPuaniDetaylari = {};
    ogrenciAnketPuaniMap.forEach((anketPuaniMap, ogrenciId) => {
      const anketPuaniListesi = [];
      
      anketPuaniMap.forEach((puan, anketId) => {
        const anket = kullanilanAnketler.find(a => a.id?.toString() === anketId || a.id === anketId);
        if (anket) {
          anketPuaniListesi.push({
            anketId: anketId,
            anketBaslik: anket.baslik,
            puan: puan
          });
        }
      });
      
      ogrenciAnketPuaniDetaylari[ogrenciId] = anketPuaniListesi;
    });
    
    // Analiz sonucunu rehber koleksiyonuna kaydet
    const analizKaydi = {
      id: new Date().getTime().toString(),
      tarih: new Date(),
      analizSonucu: analizSonucu,
      ogrenciSayisi: ogrenciler.length,
      anketSayisi: anketSonuclari.length,
      kullanilanAnketler: kullanilanAnketler,
      ogrenciAnketPuaniDetaylari: ogrenciAnketPuaniDetaylari
    };
    
    // rehberDetay objesini yeniden oluştur (Mongoose Mixed type için)
    const updatedRehberDetay = {
      ...rehber.rehberDetay.toObject(),
      analizSonuclari: [...(rehber.rehberDetay.analizSonuclari || []), analizKaydi]
    };
    
    rehber.rehberDetay = updatedRehberDetay;
    rehber.markModified('rehberDetay');
    await rehber.save();
    
    console.log('✅ Analiz sonucu veritabanına kaydedildi');
    console.log('Kaydedilen analiz ID:', analizKaydi.id);
    console.log('===========================\n');
    
    // Frontend'e yanıt döndür
    res.json({
      success: true,
      message: 'Analiz başarıyla tamamlandı',
      analiz: analizSonucu
    });
    
  } catch (err) {
    console.error('❌ Analiz hatası:', err.message);
    console.error('Hata detayı:', err);
    
    if (err.code === 'insufficient_quota') {
      return res.status(429).json({
        success: false,
        message: 'OpenAI API kotası doldu. Lütfen daha sonra tekrar deneyin.'
      });
    }
    
    if (err.status === 401) {
      return res.status(401).json({
        success: false,
        message: 'OpenAI API anahtarı geçersiz. Lütfen .env dosyasını kontrol edin.'
      });
    }
    
    sendError(res, 'Analiz sırasında bir hata oluştu: ' + err.message);
  }
};

// Rehberin geçmiş analizlerini getir
exports.getAnalysisHistory = async (req, res) => {
  try {
    const { rehberId } = req.params;
    
    const rehber = await User.findById(rehberId);
    if (!rehber || rehber.role !== 'Rehber') {
      return sendNotFound(res, 'Rehber bulunamadı');
    }
    
    const analizler = rehber.rehberDetay.analizSonuclari || [];
    
    res.json({
      success: true,
      data: analizler
    });
  } catch (err) {
    console.error('❌ Analiz geçmişi getirme hatası:', err.message);
    sendError(res, 'Server Hatası');
  }
};

// Belirli bir analizi getir
exports.getAnalysisById = async (req, res) => {
  try {
    const { rehberId, analizId } = req.params;
    
    const rehber = await User.findById(rehberId);
    if (!rehber || rehber.role !== 'Rehber') {
      return sendNotFound(res, 'Rehber bulunamadı');
    }
    
    const analizler = rehber.rehberDetay.analizSonuclari || [];
    const analiz = analizler.find(a => a.id === analizId);
    
    if (!analiz) {
      return sendNotFound(res, 'Analiz bulunamadı');
    }
    
    res.json({
      success: true,
      data: analiz
    });
  } catch (err) {
    console.error('❌ Analiz getirme hatası:', err.message);
    sendError(res, 'Server Hatası');
  }
};

// Module exports zaten yukarıda exports.functionName ile yapılmış
// Bu satırları kaldırıyoruz
