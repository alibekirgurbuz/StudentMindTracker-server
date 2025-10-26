const User = require('../models/User');
const { sendSuccess, sendError, sendNotFound, sendBadRequest } = require('../utils/responseHelper');

// Tüm anketleri getir
exports.getAllSurveys = async (req, res) => {
  try {
    // Şu an için anketler User modelinde rehberDetay içinde tutuluyor
    // Gelecekte ayrı bir Survey modeli oluşturulabilir
    const rehberler = await User.find({ role: 'Rehber' })
      .select('rehberDetay.anketler ad soyad email');
    
    let allSurveys = [];
    rehberler.forEach(rehber => {
      if (rehber.rehberDetay && rehber.rehberDetay.anketler) {
        // Her anket için rehber bilgilerini ekle
        const surveysWithRehberInfo = rehber.rehberDetay.anketler.map(survey => ({
          ...survey,
          rehberBilgisi: {
            id: rehber._id,
            ad: rehber.ad,
            soyad: rehber.soyad,
            email: rehber.email
          }
        }));
        allSurveys = allSurveys.concat(surveysWithRehberInfo);
      }
    });
    
    res.json({
      success: true,
      data: allSurveys
    });
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// ID'ye göre anket getir
exports.getSurveyById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Tüm rehberlerde anket ara
    const rehberler = await User.find({ role: 'Rehber' })
      .select('rehberDetay.anketler');
    
    let foundSurvey = null;
    let foundRehber = null;
    
    for (const rehber of rehberler) {
      if (rehber.rehberDetay && rehber.rehberDetay.anketler) {
        const survey = rehber.rehberDetay.anketler.find(s => s.id === id);
        if (survey) {
          foundSurvey = survey;
          foundRehber = rehber;
          break;
        }
      }
    }
    
    if (!foundSurvey) {
      return sendNotFound(res, 'Anket bulunamadı');
    }
    
    res.json({
      success: true,
      data: {
        survey: foundSurvey,
        rehberInfo: {
          id: foundRehber._id,
          ad: foundRehber.ad,
          soyad: foundRehber.soyad,
          email: foundRehber.email
        }
      }
    });
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Yeni anket oluştur
exports.createSurvey = async (req, res) => {
  try {
    const { rehberId, anketData } = req.body;
    
    // Rehber kontrolü
    const rehber = await User.findById(rehberId);
    if (!rehber || rehber.role !== 'Rehber') {
      return sendNotFound(res, 'Rehber bulunamadı');
    }
    
    // Anket ID'si oluştur (şimdilik basit bir yaklaşım)
    const anketId = new Date().getTime().toString();
    const newSurvey = {
      id: anketId,
      ...anketData,
      isActive: anketData.isActive !== undefined ? anketData.isActive : true, // Varsayılan olarak aktif
      createdAt: new Date(),
      createdBy: rehberId,
      rehberBilgisi: {
        id: rehber._id,
        ad: rehber.ad,
        soyad: rehber.soyad,
        email: rehber.email
      }
    };
    
    
    // Rehber'in anketler listesine ekle
    if (!rehber.rehberDetay) {
      rehber.rehberDetay = {
        siniflar: [],
        ogrenciler: [],
        anketler: [],
        anket_sonuclari: []
      };
    }
    
    rehber.rehberDetay.anketler.push(newSurvey);
    await rehber.save();
    
    res.status(201).json({
      success: true,
      message: 'Anket başarıyla oluşturuldu',
      data: newSurvey
    });
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Anket güncelle
exports.updateSurvey = async (req, res) => {
  try {
    const { id } = req.params;
    const { anketData } = req.body;
    
    // Tüm rehberlerde anket ara
    const rehberler = await User.find({ role: 'Rehber' });
    
    let foundRehber = null;
    let surveyIndex = -1;
    
    for (const rehber of rehberler) {
      if (rehber.rehberDetay && rehber.rehberDetay.anketler) {
        const index = rehber.rehberDetay.anketler.findIndex(s => s.id === id);
        if (index !== -1) {
          foundRehber = rehber;
          surveyIndex = index;
          break;
        }
      }
    }
    
    if (!foundRehber || surveyIndex === -1) {
      return sendNotFound(res, 'Anket bulunamadı');
    }
    
    // Anketi güncelle
    const updatedSurvey = {
      ...foundRehber.rehberDetay.anketler[surveyIndex],
      ...anketData,
      id: id, // ID'yi koru
      updatedAt: new Date()
    };
    
    foundRehber.rehberDetay.anketler[surveyIndex] = updatedSurvey;
    await foundRehber.save();
    
    res.json({
      success: true,
      message: 'Anket başarıyla güncellendi',
      data: updatedSurvey
    });
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Anket sil
exports.deleteSurvey = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Tüm rehberlerde anket ara
    const rehberler = await User.find({ role: 'Rehber' });
    
    let foundRehber = null;
    let surveyIndex = -1;
    
    for (const rehber of rehberler) {
      if (rehber.rehberDetay && rehber.rehberDetay.anketler) {
        const index = rehber.rehberDetay.anketler.findIndex(s => s.id === id);
        if (index !== -1) {
          foundRehber = rehber;
          surveyIndex = index;
          break;
        }
      }
    }
    
    if (!foundRehber || surveyIndex === -1) {
      return sendNotFound(res, 'Anket bulunamadı');
    }
    
    // Anketi sil
    const deletedSurvey = foundRehber.rehberDetay.anketler[surveyIndex];
    foundRehber.rehberDetay.anketler.splice(surveyIndex, 1);
    await foundRehber.save();
    
    res.json({
      success: true,
      message: 'Anket başarıyla silindi',
      data: deletedSurvey
    });
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Rehber ID'ye göre anketleri getir
exports.getSurveysByRehberId = async (req, res) => {
  try {
    const { rehberId } = req.params;
    
    const rehber = await User.findById(rehberId);
    if (!rehber || rehber.role !== 'Rehber') {
      return sendNotFound(res, 'Rehber bulunamadı');
    }
    
    const surveys = rehber.rehberDetay?.anketler || [];
    
    // Her anket için rehber bilgilerini ekle
    const surveysWithRehberInfo = surveys.map(survey => ({
      ...survey,
      rehberBilgisi: {
        id: rehber._id,
        ad: rehber.ad,
        soyad: rehber.soyad,
        email: rehber.email
      }
    }));
    
    res.json({
      success: true,
      anketler: surveysWithRehberInfo
    });
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Anket sonucu kaydet
exports.saveSurveyResult = async (req, res) => {
  try {
    const { ogrenciId, anketId, cevaplar, sonuc } = req.body;
    
    // Öğrenci kontrolü
    const ogrenci = await User.findById(ogrenciId);
    if (!ogrenci || ogrenci.role !== 'Öğrenci') {
      return sendNotFound(res, 'Öğrenci bulunamadı');
    }
    
    // Anketin var olup olmadığını kontrol et
    const rehberler = await User.find({ role: 'Rehber' });
    let foundSurvey = null;
    let foundRehber = null;
    
    for (const rehber of rehberler) {
      if (rehber.rehberDetay && rehber.rehberDetay.anketler) {
        const survey = rehber.rehberDetay.anketler.find(s => s.id === anketId);
        if (survey) {
          foundSurvey = survey;
          foundRehber = rehber;
          break;
        }
      }
    }
    
    if (!foundSurvey) {
      return sendNotFound(res, 'Anket bulunamadı');
    }
    
    // Anket sonucu oluştur (hem cevaplar hem sonuc destekle)
    const surveyResult = {
      id: new Date().getTime().toString(),
      anketId: anketId,
      ogrenciId: ogrenciId,
      ogrenciInfo: {
        id: ogrenci._id,
        ad: ogrenci.ad,
        soyad: ogrenci.soyad,
        email: ogrenci.email,
        sinif: ogrenci.ogrenciDetay?.sinif
      },
      cevaplar: cevaplar || sonuc, // Hem yeni hem eski formatı destekle
      sonuc: cevaplar || sonuc, // Geriye dönük uyumluluk için
      completedAt: new Date()
    };
    
    // Rehber'in anket sonuçları listesine ekle
    if (!foundRehber.rehberDetay.anket_sonuclari) {
      foundRehber.rehberDetay.anket_sonuclari = [];
    }
    
    // Aynı öğrenci aynı anketi tekrar doldurmuş mu kontrol et
    const existingResultIndex = foundRehber.rehberDetay.anket_sonuclari.findIndex(
      result => result.anketId === anketId && result.ogrenciId === ogrenciId
    );
    
    if (existingResultIndex !== -1) {
      // Mevcut sonucu güncelle
      foundRehber.rehberDetay.anket_sonuclari[existingResultIndex] = surveyResult;
    } else {
      // Yeni sonuç ekle
      foundRehber.rehberDetay.anket_sonuclari.push(surveyResult);
    }
    
    await foundRehber.save();
    
    res.status(201).json({
      success: true,
      message: 'Anket sonucu başarıyla kaydedildi',
      data: surveyResult
    });
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Anket sonuçlarını getir
exports.getSurveyResults = async (req, res) => {
  try {
    const { anketId } = req.params;
    
    // Tüm rehberlerde anket sonuçlarını ara
    const rehberler = await User.find({ role: 'Rehber' });
    
    let allResults = [];
    let surveyInfo = null;
    
    for (const rehber of rehberler) {
      if (rehber.rehberDetay && rehber.rehberDetay.anket_sonuclari) {
        const results = rehber.rehberDetay.anket_sonuclari.filter(
          result => result.anketId === anketId
        );
        allResults = allResults.concat(results);
      }
      
      // Anket bilgisini de al
      if (rehber.rehberDetay && rehber.rehberDetay.anketler && !surveyInfo) {
        const survey = rehber.rehberDetay.anketler.find(s => s.id === anketId);
        if (survey) {
          surveyInfo = {
            ...survey,
            rehberInfo: {
              id: rehber._id,
              ad: rehber.ad,
              soyad: rehber.soyad,
              email: rehber.email
            }
          };
        }
      }
    }
    
    if (!surveyInfo) {
      return sendNotFound(res, 'Anket bulunamadı');
    }
    
    // İstatistikler hesapla
    const totalResponses = allResults.length;
    const uniqueStudents = new Set(allResults.map(result => result.ogrenciId)).size;
    
    // Sınıf bazında istatistikler
    const classStats = {};
    allResults.forEach(result => {
      const sinif = result.ogrenciInfo?.sinif || 'Belirtilmemiş';
      if (!classStats[sinif]) {
        classStats[sinif] = 0;
      }
      classStats[sinif]++;
    });
    
    res.json({
      success: true,
      data: {
        survey: surveyInfo,
        results: allResults,
        statistics: {
          totalResponses,
          uniqueStudents,
          classStats
        }
      }
    });
  } catch (err) {
    console.error('surveyController - Hata:', err.message);
    sendError(res, 'Server Hatası');
  }
};