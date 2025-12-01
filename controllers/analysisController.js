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

// Bulanık Mantık Fonksiyonları

// Triangular üyelik fonksiyonu
const triangular = (x, [a, b, c]) => {
  if (x <= a || x >= c) return 0;
  if (x === b) return 1;
  if (x > a && x < b) return (x - a) / (b - a);
  if (x > b && x < c) return (c - x) / (c - b);
  return 0;
};

// Dinamik fuzzy model oluşturma
const buildDynamicModel = (maxScore) => {
  const lowEnd = maxScore * 0.40;
  const midStart = maxScore * 0.25;
  const midPeak = maxScore * 0.50;
  const midEnd = maxScore * 0.75;
  const highStart = maxScore * 0.60;
  const highEnd = maxScore;
  
  return {
    inputMF: {
      low: [0, 0, lowEnd],
      mid: [midStart, midPeak, midEnd],
      high: [highStart, highEnd, highEnd]
    },
    outputMF: {
      low: [0, 0, 40],
      mid: [30, 50, 70],
      high: [60, 85, 100]
    }
  };
};

// Kuralları uygulayan fonksiyon
const applyRules = (score, model) => {
  return {
    low: triangular(score, model.inputMF.low),
    mid: triangular(score, model.inputMF.mid),
    high: triangular(score, model.inputMF.high)
  };
};

// Defuzzification (COG - Center of Gravity yöntemi)
const defuzzify = (ruleStrengths, model) => {
  const points = [];
  
  const pushPoint = (mf, strength) => {
    for (let x = 0; x <= 100; x++) {
      const mu = Math.min(strength, triangular(x, mf));
      points.push({
        x: x,
        mu: mu
      });
    }
  };
  
  pushPoint(model.outputMF.low, ruleStrengths.low);
  pushPoint(model.outputMF.mid, ruleStrengths.mid);
  pushPoint(model.outputMF.high, ruleStrengths.high);
  
  let num = 0, den = 0;
  points.forEach(p => {
    num += p.x * p.mu;
    den += p.mu;
  });
  
  return den === 0 ? 0 : num / den;
};

// Son analiz tarihini bul (Çözüm 1)
const getLastAnalysisDate = (analizSonuclari) => {
  if (!analizSonuclari || analizSonuclari.length === 0) {
    return null; // İlk analiz, tüm sonuçları al
  }
  // En son analizin tarihini döndür
  const tarihler = analizSonuclari
    .map(a => a.tarih ? new Date(a.tarih) : null)
    .filter(Boolean);
  
  if (tarihler.length === 0) {
    return null;
  }
  
  return new Date(Math.max(...tarihler));
};

// Kullanılan anket sonuç ID'lerini topla (Çözüm 2)
const getUsedSurveyResultIds = (analizSonuclari) => {
  if (!analizSonuclari || analizSonuclari.length === 0) {
    return new Set();
  }
  
  // Tüm analizlerde kullanılan anket sonuç ID'lerini topla
  const usedIds = new Set();
  analizSonuclari.forEach(analiz => {
    if (analiz.kullanilanAnketSonucIdleri && Array.isArray(analiz.kullanilanAnketSonucIdleri)) {
      analiz.kullanilanAnketSonucIdleri.forEach(id => {
        if (id) {
          usedIds.add(id.toString());
        }
      });
    }
  });
  
  return usedIds;
};

// Yeni anket sonuçlarını filtrele (Çözüm 1 + Çözüm 2 kombinasyonu)
const filterNewSurveyResults = (anketSonuclari, analizSonuclari) => {
  if (!anketSonuclari || anketSonuclari.length === 0) {
    return [];
  }
  
  // İlk analiz ise tüm sonuçları döndür
  if (!analizSonuclari || analizSonuclari.length === 0) {
    return anketSonuclari;
  }
  
  // Son analiz tarihini bul
  const lastAnalysisDate = getLastAnalysisDate(analizSonuclari);
  
  // Kullanılan anket sonuç ID'lerini bul
  const usedIds = getUsedSurveyResultIds(analizSonuclari);
  
  // Yeni sonuçları filtrele
  const yeniSonuclar = anketSonuclari.filter(sonuc => {
    // ID bazlı kontrol (Çözüm 2)
    const sonucId = sonuc.id?.toString();
    if (sonucId && usedIds.has(sonucId)) {
      return false; // Bu sonuç daha önce kullanılmış
    }
    
    // Tarih bazlı kontrol (Çözüm 1)
    if (lastAnalysisDate && sonuc.completedAt) {
      const sonucTarihi = new Date(sonuc.completedAt);
      if (sonucTarihi > lastAnalysisDate) {
        return true; // Son analizden sonra oluşturulmuş
      }
    }
    
    // Eğer tarih yoksa ama ID kullanılmamışsa yeni kabul et
    if (!sonuc.completedAt && sonucId && !usedIds.has(sonucId)) {
      return true;
    }
    
    // Diğer durumlar: eski sonuç
    return false;
  });
  
  return yeniSonuclar;
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
    const tumAnketSonuclari = rehber.rehberDetay.anket_sonuclari || [];
    
    if (tumAnketSonuclari.length === 0) {
      return sendBadRequest(res, 'Analiz edilecek anket sonucu bulunamadı');
    }
    
    // Yeni anket sonuçlarını filtrele (Çözüm 1 + Çözüm 2)
    const analizSonuclari = rehber.rehberDetay.analizSonuclari || [];
    const anketSonuclari = filterNewSurveyResults(tumAnketSonuclari, analizSonuclari);
    
    // Yeni sonuç kontrolü
    if (anketSonuclari.length === 0) {
      const lastAnalysisDate = getLastAnalysisDate(analizSonuclari);
      const lastAnalysisDateStr = lastAnalysisDate 
        ? new Date(lastAnalysisDate).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'henüz analiz yapılmamış';
      
      return res.status(400).json({
        success: false,
        message: 'Yeni analiz edilecek anket sonucu bulunamadı',
        info: `Son analiz: ${lastAnalysisDateStr}. Yeni anket sonuçları ekledikten sonra tekrar deneyin.`,
        lastAnalysisDate: lastAnalysisDate,
        totalSurveyResults: tumAnketSonuclari.length,
        usedSurveyResults: tumAnketSonuclari.length - anketSonuclari.length
      });
    }
    
    // Log: Yeni sonuç bilgisi
    console.log('\n=== YENİ ANALİZ FİLTRELEME ===');
    console.log(`Toplam anket sonucu: ${tumAnketSonuclari.length}`);
    console.log(`Yeni anket sonucu: ${anketSonuclari.length}`);
    console.log(`Daha önce analiz edilmiş: ${tumAnketSonuclari.length - anketSonuclari.length}`);
    if (analizSonuclari.length > 0) {
      const lastAnalysisDate = getLastAnalysisDate(analizSonuclari);
      console.log(`Son analiz tarihi: ${lastAnalysisDate ? new Date(lastAnalysisDate).toLocaleString('tr-TR') : 'Yok'}`);
    }
    console.log('================================\n');
    
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
    
    // Genel analiz için maksimum puanı hesapla (tüm anketlerin maksimum puanlarının toplamı)
    // Önce kullanılan anketleri bul
    const kullanilanAnketIdlerGenel = [...new Set(anketSonuclari.map(s => s.anketId).filter(Boolean))];
    let genelMaxPuan = 0;
    
    if (rehber.rehberDetay && rehber.rehberDetay.anketler) {
      kullanilanAnketIdlerGenel.forEach(anketId => {
        const anket = rehber.rehberDetay.anketler.find(a => a.id === anketId || a.id?.toString() === anketId?.toString());
        if (anket) {
          const soruSayisi = anket.sorular?.length || 0;
          const secenekSayisi = anket.sorular?.[0]?.secenekler?.length || 0;
          genelMaxPuan += soruSayisi * secenekSayisi;
        }
      });
    }
    
    // Genel analiz için fuzzy model oluştur
    const genelFuzzyModel = buildDynamicModel(genelMaxPuan || 100);
    
    // Genel fuzzy model bilgilerini logla
    console.log('\n=== GENEL ANALİZ - BULANIK MANTIK MODELİ ===');
    console.log(`Maksimum Puan: ${genelMaxPuan}`);
    console.log('Giriş Üyelik Fonksiyonları (Input MF):');
    console.log(`  - Low: [${genelFuzzyModel.inputMF.low.join(', ')}]`);
    console.log(`  - Mid: [${genelFuzzyModel.inputMF.mid.join(', ')}]`);
    console.log(`  - High: [${genelFuzzyModel.inputMF.high.join(', ')}]`);
    console.log('Çıkış Üyelik Fonksiyonları (Output MF):');
    console.log(`  - Low: [${genelFuzzyModel.outputMF.low.join(', ')}]`);
    console.log(`  - Mid: [${genelFuzzyModel.outputMF.mid.join(', ')}]`);
    console.log(`  - High: [${genelFuzzyModel.outputMF.high.join(', ')}]`);
    console.log('===========================================\n');
    
    const ogrenciCevaplari = anketSonuclari.map(sonuc => {
      const ogrenci = ogrenciler.find(o => o._id.toString() === sonuc.ogrenciId.toString());
      const cevaplar = sonuc.cevaplar || sonuc.sonuc;
      
      // Genel ölçek puanını hesapla (tüm anketlerin toplamı)
      const olcekPuani = hesaplaOlcekPuani(cevaplar);
      
      // Fuzzy skor hesapla
      const rules = applyRules(olcekPuani, genelFuzzyModel);
      const fuzzySkor = defuzzify(rules, genelFuzzyModel);
      
      return {
        ogrenciID: sonuc.ogrenciId,
        ad: ogrenci?.ad || 'Bilinmiyor',
        soyad: ogrenci?.soyad || 'Bilinmiyor',
        cevaplar: cevaplar,
        olcekPuani: olcekPuani,
        fuzzySkor: Math.round(fuzzySkor * 100) / 100, // İki ondalık basamağa yuvarla
        fuzzyRules: rules // Detaylı log için sakla
      };
    });
    
    // OpenAI'ye gönderilecek verilerden fuzzyRules'ı kaldır
    const ogrenciCevaplariOpenAI = ogrenciCevaplari.map(({ fuzzyRules, ...rest }) => rest);
    
    // OpenAI'ye gönderilecek prompt (geliştirilmiş, psikolojik danışman odaklı)
    const prompt = `Sen Türkiye’de bir ortaokulda çalışan, deneyimli bir psikolojik danışman ve rehber öğretmensin.

Aşağıda bir rehber öğretmenin öğrencilerine uyguladığı çeşitli psikolojik ölçek ve anketlerin sonuçları yer alıyor.
Veriler JSON formatında; her öğrenci için:
- "ogrenciID"
- "ad"
- "soyad"
- "cevaplar"
- "olcekPuani" (ham puan)
- "fuzzySkor" (0–100 arası risk düzeyi skoru; yüksek skor = daha yüksek risk)

Bu veriler, öğrencilerin duygusal durum, dikkat-dürtü kontrolü, kaygı ve stres belirtileri, sosyal uyum ve okul iklimine ilişkin algıları hakkında ipuçları içermektedir.

ÖNEMLİ İLKELER:
- Kesin psikiyatrik tanılar KOYMA. “Bu öğrenci depresyondur” gibi cümleler kurma.
- Onun yerine “belirti düzeyi”, “risk görünümü”, “dikkat gerektiren alanlar” gibi ifadeler kullan.
- Öğrenciyi asla suçlayıcı veya damgalayıcı bir dille tanımlama.
- Her zaman hem RİSKLERİ hem de GÜÇLÜ YÖNLERİ belirt.
- Sonuçları, öğretmenin ve rehberin sınıf içi gözlemleriyle birleştirilmesi gereken ön değerlendirme olarak düşün.
- Öğrenci mahremiyetine saygılı, özenli ve pedagojik bir dil kullan.

GÖREVİN:
1. Her öğrenci için:
   - Ölçek puanları ve fuzzySkor temelinde,
   - Aşağıdaki başlıklar çerçevesinde kısa ama anlamlı bir değerlendirme yap:
     - duygusal durum (duygu dalgalanmaları, kaygı, mutsuzluk vb.)
     - dikkat ve dürtü kontrolü (derse odaklanma, unutkanlık, acelecilik vb.)
     - sosyal uyum (arkadaş ilişkileri, yalnızlık, çatışma eğilimi vb.)
     - stres ve başa çıkma tarzı (sınav kaygısı, aile/sınıf kaynaklı zorlanmalar vb.)
   - Her değerlendirmede:
     - Gözlenen olası risk alanlarını,
     - Mevcut güçlü yönleri ve koruyucu faktörleri,
     - Kısa ve uygulanabilir önerileri (sınıf içi düzenleme, bireysel görüşme, veli ile işbirliği vb.) belirt.

2. Tüm öğrencileri birlikte ele alarak:
   - Sınıf genelinde öne çıkan ortak temaları (örneğin yaygın sınav kaygısı, iletişim sorunları, motivasyon düşüklüğü),
   - Güçlü yönleri (destekleyici arkadaşlık ilişkileri, işbirlikçi sınıf iklimi vb.),
   - Rehberlik servisi ve sınıf öğretmeni/branş öğretmenleri için somut önerileri içeren bir “genel sınıf değerlendirmesi” yaz.

ÇIKTI FORMATIN:
- Tam geçerli JSON döndür.
- Alan adları TÜRKÇE ve küçük harflerle olsun.
Biçim tam olarak şu şekilde olmalı:
{
  "ogrenciler": [
    {
      "ogrenciID": "",
      "ad": "",
      "soyad": "",
      "olcekPuani": 0,
      "fuzzySkor": 0,
      "risk_duzeyi": "düşük" | "orta" | "yüksek",
      "guclu_yonler": "",
      "risk_alanlari": "",
      "oneriler": "",
      "analiz": ""
    }
  ],
  "genel_degerlendirme": {
    "sinif_ozeti": "",
    "yaygin_tema_ve_riskler": "",
    "sinifin_guclu_yonleri": "",
    "onerilen_mudahale_ve_calismalar": ""
  }
}

DİKKAT:
- Ek açıklama, yorum ya da kod bloğu ekleme.
- Yalnızca yukarıdaki JSON formatında yanıt ver.
- Dilin sakin, destekleyici ve profesyonel olsun.
- Öğrencileri asla yargılayıcı bir dille tanımlama.

Öğrenci Verileri:
${JSON.stringify(ogrenciCevaplariOpenAI, null, 2)}`;
    
    console.log('\n=== OpenAI Analiz İsteği ===');
    console.log('Rehber:', rehber.ad, rehber.soyad);
    console.log('Öğrenci sayısı:', ogrenciler.length);
    console.log('Anket sonucu sayısı:', anketSonuclari.length);
    
    // Ölçek puanlarını ve detaylı fuzzy skorlarını logla
    console.log('\n=== GENEL ANALİZ - ÖĞRENCİ BULANIK MANTIK SKORLARI ===');
    ogrenciCevaplari.forEach(ogr => {
      console.log(`\n📊 ${ogr.ad} ${ogr.soyad}:`);
      console.log(`   Ölçek Puanı: ${ogr.olcekPuani}`);
      console.log(`   Üyelik Fonksiyon Değerleri:`);
      console.log(`     - Low (Düşük): ${Math.round(ogr.fuzzyRules.low * 1000) / 1000}`);
      console.log(`     - Mid (Orta): ${Math.round(ogr.fuzzyRules.mid * 1000) / 1000}`);
      console.log(`     - High (Yüksek): ${Math.round(ogr.fuzzyRules.high * 1000) / 1000}`);
      console.log(`   Fuzzy Skor (Defuzzification): ${ogr.fuzzySkor}`);
    });
    console.log('\n========================================================\n');
    
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
    
    console.log('✅ OpenAI genel analizi tamamlandı');
    
    // Kullanılan anket ID'lerini topla ve anket bilgilerini al
    const kullanilanAnketIdler = [...new Set(anketSonuclari.map(s => s.anketId).filter(Boolean))];
    const kullanilanAnketler = [];
    
    if (rehber.rehberDetay && rehber.rehberDetay.anketler) {
      kullanilanAnketIdler.forEach(anketId => {
        const anket = rehber.rehberDetay.anketler.find(a => a.id === anketId || a.id?.toString() === anketId?.toString());
        if (anket) {
          // Soru sayısını hesapla
          const soruSayisi = anket.sorular?.length || 0;
          
          // Seçenek sayısını hesapla (ilk sorudan al, tüm sorular aynı seçenek sayısına sahip olmalı)
          const secenekSayisi = anket.sorular?.[0]?.secenekler?.length || 0;
          
          kullanilanAnketler.push({
            id: anket.id,
            baslik: anket.baslik,
            aciklama: anket.aciklama || '',
            soruSayisi: soruSayisi,
            secenekSayisi: secenekSayisi
          });
        }
      });
    }
    
    // Her anket için ayrı analiz yap
    const anketBazliAnalizler = {};
    
    for (const anket of kullanilanAnketler) {
      // Bu anketi çözen öğrencileri ve cevaplarını bul
      const anketSonuclariBuAnket = anketSonuclari.filter(s => 
        s.anketId?.toString() === anket.id?.toString() || s.anketId === anket.id
      );
      
      if (anketSonuclariBuAnket.length === 0) continue;
      
      // Bu anket için maksimum puanı hesapla
      const anketMaxPuan = anket.soruSayisi * anket.secenekSayisi;
      
      // Bu anket için fuzzy model oluştur
      const anketFuzzyModel = buildDynamicModel(anketMaxPuan || 100);
      
      // Anket bazlı fuzzy model bilgilerini logla
      console.log(`\n=== ANKET BAZLI ANALİZ - ${anket.baslik.toUpperCase()} ===`);
      console.log(`Maksimum Puan: ${anketMaxPuan}`);
      console.log('Giriş Üyelik Fonksiyonları (Input MF):');
      console.log(`  - Low: [${anketFuzzyModel.inputMF.low.join(', ')}]`);
      console.log(`  - Mid: [${anketFuzzyModel.inputMF.mid.join(', ')}]`);
      console.log(`  - High: [${anketFuzzyModel.inputMF.high.join(', ')}]`);
      console.log('Çıkış Üyelik Fonksiyonları (Output MF):');
      console.log(`  - Low: [${anketFuzzyModel.outputMF.low.join(', ')}]`);
      console.log(`  - Mid: [${anketFuzzyModel.outputMF.mid.join(', ')}]`);
      console.log(`  - High: [${anketFuzzyModel.outputMF.high.join(', ')}]`);
      
      // Bu anket için öğrenci cevaplarını hazırla
      const anketOgrenciCevaplari = anketSonuclariBuAnket.map(sonuc => {
        const ogrenci = ogrenciler.find(o => o._id.toString() === sonuc.ogrenciId.toString());
        const cevaplar = sonuc.cevaplar || sonuc.sonuc;
        const anketPuani = hesaplaOlcekPuani(cevaplar);
        
        // Fuzzy skor hesapla (her ankette: puan arttıkça risk/artış)
        const rules = applyRules(anketPuani, anketFuzzyModel);
        const fuzzySkor = defuzzify(rules, anketFuzzyModel);
        
        return {
          ogrenciID: sonuc.ogrenciId,
          ad: ogrenci?.ad || 'Bilinmiyor',
          soyad: ogrenci?.soyad || 'Bilinmiyor',
          cevaplar: cevaplar,
          olcekPuani: anketPuani,
          fuzzySkor: Math.round(fuzzySkor * 100) / 100, // İki ondalık basamağa yuvarla
          fuzzyRules: rules // Detaylı log için sakla
        };
      });
      
      // Bu anket için öğrenci fuzzy skorlarını logla
      console.log('\nÖğrenci Bulanık Mantık Skorları:');
      anketOgrenciCevaplari.forEach(ogr => {
        console.log(`\n  📊 ${ogr.ad} ${ogr.soyad}:`);
        console.log(`     Ölçek Puanı: ${ogr.olcekPuani}`);
        console.log(`     Üyelik Fonksiyon Değerleri:`);
        console.log(`       - Low (Düşük): ${Math.round(ogr.fuzzyRules.low * 1000) / 1000}`);
        console.log(`       - Mid (Orta): ${Math.round(ogr.fuzzyRules.mid * 1000) / 1000}`);
        console.log(`       - High (Yüksek): ${Math.round(ogr.fuzzyRules.high * 1000) / 1000}`);
        console.log(`     Fuzzy Skor (Defuzzification): ${ogr.fuzzySkor}`);
      });
      console.log('===================================================\n');
      
      // OpenAI'ye gönderilecek verilerden fuzzyRules'ı kaldır
      const anketOgrenciCevaplariOpenAI = anketOgrenciCevaplari.map(({ fuzzyRules, ...rest }) => rest);
      
      // Bu anket için OpenAI analizi yap (geliştirilmiş, anket odaklı prompt)
      const anketPrompt = `Sen Türkiye’de bir ortaokulda çalışan, deneyimli bir psikolojik danışman ve rehber öğretmensin.

Aşağıda "${anket.baslik}" ölçeğini/anketini çözen öğrencilerin sonuçları yer alıyor.
Veriler JSON formatında; her öğrenci için:
- "ogrenciID"
- "ad"
- "soyad"
- "cevaplar"
- "olcekPuani" (sadece bu ankete ait ham puan)
- "fuzzySkor" (0–100 arası risk düzeyi skoru; yüksek skor = daha yüksek risk)

Anket Bilgileri:
- Anket Adı: ${anket.baslik}
- Soru Sayısı: ${anket.soruSayisi}
- Seçenek Sayısı: ${anket.secenekSayisi}
- Minimum Puan: ${anket.soruSayisi}
- Maksimum Puan: ${anket.soruSayisi * anket.secenekSayisi}

BU ANKET NEYİ ÖLÇÜYOR?
Bu anket; öğrencilerin özellikle ${anket.baslik} ile ilişkili alanlarda (örneğin stres belirtileri, kaygı düzeyi, psikolojik dayanıklılık, dikkat sorunları, sosyal uyum vb.) yaşadıkları güçlükler ve güçlü yönler hakkında ipuçları verir.

İLKELER:
- Psikiyatrik tanı koyma, etiketleyici ifadeler kullanma.
- “Belirti düzeyi”, “risk görünümü”, “dikkat gerektiren alanlar” gibi ifadeler kullan.
- Mutlaka güçlü yönlere de yer ver.
- Öğretmen, rehber ve veli için kısa ve uygulanabilir öneriler üret.

GÖREVİN:
1. Her öğrenci için:
   - Bu ankete ait olcekPuani ve fuzzySkor’a dayanarak,
   - Aşağıdaki başlıklara odaklanan kısa bir analiz yaz:
     - Bu anketin ölçtüğü alanda güçlü yönler
     - Belirti / risk düzeyi (düşük, orta, yüksek)
     - Sınıf içinde veya evde gözlenebilecek olası davranış örnekleri
     - Öğrenci için kısa, uygulanabilir öneriler
2. Her öğrencinin "risk_duzeyi" alanını:
   - fuzzySkor < 40 ise "düşük"
   - 40–60 arası ise "orta"
   - 60 üstü ise "yüksek"
   olarak değerlendir.

ÇIKTI FORMATIN:
Yalnızca şu JSON formatında yanıt ver:

{
  "ogrenciler": [
    {
      "ogrenciID": "",
      "ad": "",
      "soyad": "",
      "olcekPuani": 0,
      "fuzzySkor": 0,
      "risk_duzeyi": "düşük" | "orta" | "yüksek",
      "guclu_yonler": "",
      "risk_alanlari": "",
      "oneriler": "",
      "analiz": ""
    }
  ]
}

Ek açıklama, yorum veya kod bloğu ekleme.
Dilin, rehberlik servisi raporuna girebilecek kadar profesyonel ve dengeli olsun.

Öğrenci Verileri:
${JSON.stringify(anketOgrenciCevaplariOpenAI, null, 2)}`;
      
      try {
        const anketCompletion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Sen bir orta okul psikolojik danışmanısın. Öğrenci anket sonuçlarını analiz ediyorsun. Yanıtlarını her zaman geçerli JSON formatında ver.'
            },
            {
              role: 'user',
              content: anketPrompt
            }
          ],
          temperature: 0.7,
          response_format: { type: 'json_object' }
        });
        
        const anketAnalizSonucu = JSON.parse(anketCompletion.choices[0].message.content);
        anketBazliAnalizler[anket.id] = anketAnalizSonucu;
        
        console.log(`✅ ${anket.baslik} anketi için analiz tamamlandı`);
      } catch (err) {
        console.error(`❌ ${anket.baslik} anketi analiz hatası:`, err.message);
        // Hata durumunda boş analiz ekle
        anketBazliAnalizler[anket.id] = { ogrenciler: [] };
      }
    }
    
    console.log('✅ Tüm anket bazlı analizler tamamlandı');
    
    // Kullanılan anketleri console'a yazdır
    console.log('\n=== Kullanılan Anketler ===');
    kullanilanAnketler.forEach(anket => {
      console.log(`📋 ${anket.baslik}`);
      console.log(`   - Soru Sayısı: ${anket.soruSayisi}`);
      console.log(`   - Seçenek Sayısı: ${anket.secenekSayisi}`);
      console.log(`   - Min Puan: ${anket.soruSayisi}`);
      console.log(`   - Max Puan: ${anket.soruSayisi * anket.secenekSayisi}`);
    });
    console.log('===========================\n');
    
    // Her öğrenci için anket bazlı puanları ve analizleri hazırla
    const ogrenciAnketPuaniDetaylari = {};
    ogrenciAnketPuaniMap.forEach((anketPuaniMap, ogrenciId) => {
      const anketPuaniListesi = [];
      
      anketPuaniMap.forEach((puan, anketId) => {
        const anket = kullanilanAnketler.find(a => a.id?.toString() === anketId || a.id === anketId);
        if (anket) {
          // Bu öğrenci için bu anketin analizini bul
          const anketAnalizi = anketBazliAnalizler[anket.id];
          const ogrenciAnalizi = anketAnalizi?.ogrenciler?.find(
            o => o.ogrenciID?.toString() === ogrenciId || o.ogrenciID === ogrenciId
          );
          
          // Bu anket için fuzzy skor hesapla
          const anketMaxPuan = anket.soruSayisi * anket.secenekSayisi;
          const anketFuzzyModel = buildDynamicModel(anketMaxPuan || 100);
          const rules = applyRules(puan, anketFuzzyModel);
          const fuzzySkor = defuzzify(rules, anketFuzzyModel);
          
          anketPuaniListesi.push({
            anketId: anketId,
            anketBaslik: anket.baslik,
            puan: puan,
            soruSayisi: anket.soruSayisi,
            secenekSayisi: anket.secenekSayisi,
            fuzzySkor: Math.round(fuzzySkor * 100) / 100, // İki ondalık basamağa yuvarla
            analiz: ogrenciAnalizi?.analiz || ''
          });
        }
      });
      
      ogrenciAnketPuaniDetaylari[ogrenciId] = anketPuaniListesi;
    });
    
    // Öğrenci bazlı anket fuzzy skor özeti
    console.log('\n=== ÖĞRENCİ BAZLI ANKET FUZZY SKOR ÖZETİ ===');
    ogrenciAnketPuaniMap.forEach((anketPuaniMap, ogrenciId) => {
      const ogrenci = ogrenciler.find(o => o._id.toString() === ogrenciId);
      if (ogrenci) {
        console.log(`\n👤 ${ogrenci.ad} ${ogrenci.soyad}:`);
        const detaylar = ogrenciAnketPuaniDetaylari[ogrenciId] || [];
        detaylar.forEach(detay => {
          console.log(`   📋 ${detay.anketBaslik}:`);
          console.log(`      - Ölçek Puanı: ${detay.puan} / ${detay.soruSayisi * detay.secenekSayisi}`);
          console.log(`      - Fuzzy Skor: ${detay.fuzzySkor}`);
        });
      }
    });
    console.log('============================================\n');
    
    // Analiz sonucunu rehber koleksiyonuna kaydet
    // Kullanılan anket sonuç ID'lerini topla (Çözüm 2)
    const kullanilanAnketSonucIdleri = anketSonuclari
      .map(sonuc => sonuc.id?.toString())
      .filter(Boolean);
    
    const analizKaydi = {
      id: new Date().getTime().toString(),
      tarih: new Date(),
      analizSonucu: analizSonucu,
      ogrenciSayisi: ogrenciler.length,
      anketSayisi: anketSonuclari.length,
      kullanilanAnketler: kullanilanAnketler,
      ogrenciAnketPuaniDetaylari: ogrenciAnketPuaniDetaylari,
      kullanilanAnketSonucIdleri: kullanilanAnketSonucIdleri // Çözüm 2: Hangi sonuçlar kullanıldı
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
      analiz: analizSonucu,
      analizBilgisi: {
        yeniAnketSonucSayisi: anketSonuclari.length,
        toplamAnketSonucSayisi: tumAnketSonuclari.length,
        analizTarihi: new Date().toISOString()
      }
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
