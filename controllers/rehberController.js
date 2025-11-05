const User = require('../models/User');
const { sendSuccess, sendError, sendNotFound, sendBadRequest } = require('../utils/responseHelper');

// Tüm Rehberleri getir
exports.getAllRehberler = async (req, res) => {
  try {
    const rehberler = await User.find({ role: 'Rehber' })
      .select('-password -__v');
    
    // Rehberleri detay bilgileriyle döndür
    const rehberlerWithDetails = rehberler.map(rehber => {
      const rehberObj = rehber.toObject();
      return {
        id: rehberObj._id,
        email: rehberObj.email,
        role: rehberObj.role,
        ad: rehberObj.ad,
        soyad: rehberObj.soyad,
        rehberDetay: rehberObj.rehberDetay || {
          siniflar: [],
          ogrenciler: [],
          anketler: [],
          anket_sonuclari: [],
          analizSonuclari: []
        }
      };
    });
    
    res.json({
      success: true,
      data: rehberlerWithDetails
    });
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// ID'ye göre Rehber getir
exports.getRehberById = async (req, res) => {
  try {
    const rehber = await User.findById(req.params.id)
      .select('-password -__v');
    
    if (!rehber || rehber.role !== 'Rehber') {
      return sendNotFound(res, 'Rehber bulunamadı');
    }
    
    const rehberObj = rehber.toObject();
    const response = {
      id: rehberObj._id,
      email: rehberObj.email,
      role: rehberObj.role,
      ad: rehberObj.ad,
      soyad: rehberObj.soyad,
      rehberDetay: rehberObj.rehberDetay || {
        siniflar: [],
        ogrenciler: [],
        anketler: [],
        anket_sonuclari: [],
        analizSonuclari: []
      }
    };
    
    res.json({
      success: true,
      data: response
    });
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Yeni Rehber oluştur
exports.createRehber = async (req, res) => {
  try {
    const { userId, siniflar } = req.body;
    
    // User'ın var olup olmadığını kontrol et
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }
    
    // Kullanıcının rolü Rehber olmalı
    if (user.role !== 'Rehber') {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcının rolü Rehber olmalıdır'
      });
    }
    
    // Zaten rehber detayı var mı kontrol et
    if (user.rehberDetay && user.rehberDetay.siniflar) {
      return res.status(400).json({
        success: false,
        message: 'Bu kullanıcı için zaten Rehber detayı mevcut'
      });
    }
    
    // Detay bilgilerini ekle
    user.rehberDetay = {
      siniflar: siniflar || [],
      ogrenciler: [],
      anketler: [],
      anket_sonuclari: [],
      analizSonuclari: []
    };
    
    await user.save();
    
    const userObj = user.toObject();
    const response = {
      id: userObj._id,
      email: userObj.email,
      role: userObj.role,
      ad: userObj.ad,
      soyad: userObj.soyad,
      rehberDetay: userObj.rehberDetay
    };
    
    res.status(201).json({
      success: true,
      message: 'Rehber başarıyla oluşturuldu',
      data: response
    });
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Rehber güncelle
exports.updateRehber = async (req, res) => {
  try {
    const { siniflar, ogrenciler, anketler, anket_sonuclari } = req.body;
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user || user.role !== 'Rehber') {
      return sendNotFound(res, 'Rehber bulunamadı');
    }
    
    // Detay bilgilerini güncelle
    if (siniflar !== undefined) {
      user.rehberDetay.siniflar = siniflar;
    }
    if (ogrenciler !== undefined) {
      user.rehberDetay.ogrenciler = ogrenciler;
    }
    if (anketler !== undefined) {
      user.rehberDetay.anketler = anketler;
    }
    if (anket_sonuclari !== undefined) {
      user.rehberDetay.anket_sonuclari = anket_sonuclari;
    }
    
    await user.save();
    
    const userObj = user.toObject();
    const response = {
      id: userObj._id,
      email: userObj.email,
      role: userObj.role,
      ad: userObj.ad,
      soyad: userObj.soyad,
      rehberDetay: userObj.rehberDetay
    };
    
    res.json({
      success: true,
      message: 'Rehber başarıyla güncellendi',
      data: response
    });
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Rehber sil
exports.deleteRehber = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user || user.role !== 'Rehber') {
      return sendNotFound(res, 'Rehber bulunamadı');
    }
    
    // Detay bilgilerini temizle
    user.rehberDetay = {
      siniflar: [],
      ogrenciler: [],
      anketler: [],
      anket_sonuclari: [],
      analizSonuclari: []
    };
    await user.save();
    
    sendSuccess(res, 'Rehber detayları başarıyla silindi');
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// User ID'ye göre Rehber getir
exports.getRehberByUserId = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password -__v');
    
    if (!user || user.role !== 'Rehber') {
      return sendNotFound(res, 'Rehber bulunamadı');
    }
    
    const userObj = user.toObject();
    const response = {
      id: userObj._id,
      email: userObj.email,
      role: userObj.role,
      ad: userObj.ad,
      soyad: userObj.soyad,
      rehberDetay: userObj.rehberDetay || {
        siniflar: [],
        ogrenciler: [],
        anketler: [],
        anket_sonuclari: [],
        analizSonuclari: []
      }
    };
    
    res.json({
      success: true,
      data: response
    });
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};