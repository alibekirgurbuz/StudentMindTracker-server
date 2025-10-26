const User = require('../models/User');
const { sendSuccess, sendError, sendNotFound, sendBadRequest } = require('../utils/responseHelper');

// Tüm Öğrencileri getir
exports.getAllOgrenciler = async (req, res) => {
  try {
    const ogrenciler = await User.find({ role: 'Öğrenci' })
      .select('-password -__v');
    
    // Öğrencileri detay bilgileriyle döndür
    const ogrencilerWithDetails = ogrenciler.map(ogrenci => {
      const ogrenciObj = ogrenci.toObject();
      return {
        id: ogrenciObj._id,
        email: ogrenciObj.email,
        role: ogrenciObj.role,
        ad: ogrenciObj.ad,
        soyad: ogrenciObj.soyad,
        ogrenciDetay: ogrenciObj.ogrenciDetay || {
          rehberID: null,
          yas: null,
          sinif: null
        }
      };
    });
    
    res.json({
      success: true,
      data: ogrencilerWithDetails
    });
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// ID'ye göre Öğrenci getir
exports.getOgrenciById = async (req, res) => {
  try {
    const ogrenci = await User.findById(req.params.id)
      .select('-password -__v');
    
    if (!ogrenci || ogrenci.role !== 'Öğrenci') {
      return sendNotFound(res, 'Öğrenci bulunamadı');
    }
    
    const ogrenciObj = ogrenci.toObject();
    const response = {
      id: ogrenciObj._id,
      email: ogrenciObj.email,
      role: ogrenciObj.role,
      ad: ogrenciObj.ad,
      soyad: ogrenciObj.soyad,
      ogrenciDetay: ogrenciObj.ogrenciDetay || {
        rehberID: null,
        yas: null,
        sinif: null
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

// Yeni Öğrenci oluştur
exports.createOgrenci = async (req, res) => {
  try {
    const { userId, rehberID, yas, sinif } = req.body;
    
    // User'ın var olup olmadığını kontrol et
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }
    
    // Kullanıcının rolü Öğrenci olmalı
    if (user.role !== 'Öğrenci') {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcının rolü Öğrenci olmalıdır'
      });
    }
    
    // Zaten öğrenci detayı var mı kontrol et
    if (user.ogrenciDetay && (user.ogrenciDetay.yas || user.ogrenciDetay.sinif)) {
      return res.status(400).json({
        success: false,
        message: 'Bu kullanıcı için zaten Öğrenci detayı mevcut'
      });
    }
    
    // Rehber kontrolü (eğer rehberID verilmişse)
    if (rehberID) {
      const rehber = await User.findById(rehberID);
      if (!rehber || rehber.role !== 'Rehber') {
        return res.status(404).json({
          success: false,
          message: 'Rehber bulunamadı'
        });
      }
    }
    
    // Detay bilgilerini ekle
    user.ogrenciDetay = {
      rehberID: rehberID || null,
      yas: yas || null,
      sinif: sinif || null
    };
    
    await user.save();
    
    const userObj = user.toObject();
    const response = {
      id: userObj._id,
      email: userObj.email,
      role: userObj.role,
      ad: userObj.ad,
      soyad: userObj.soyad,
      ogrenciDetay: userObj.ogrenciDetay
    };
    
    res.status(201).json({
      success: true,
      message: 'Öğrenci başarıyla oluşturuldu',
      data: response
    });
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Öğrenci güncelle
exports.updateOgrenci = async (req, res) => {
  try {
    const { rehberID, yas, sinif } = req.body;
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user || user.role !== 'Öğrenci') {
      return sendNotFound(res, 'Öğrenci bulunamadı');
    }
    
    // Rehber kontrolü (eğer rehberID verilmişse)
    if (rehberID) {
      const rehber = await User.findById(rehberID);
      if (!rehber || rehber.role !== 'Rehber') {
        return res.status(404).json({
          success: false,
          message: 'Rehber bulunamadı'
        });
      }
    }
    
    // Detay bilgilerini güncelle
    if (yas !== undefined) {
      user.ogrenciDetay.yas = yas;
    }
    if (sinif !== undefined) {
      user.ogrenciDetay.sinif = sinif;
    }
    if (rehberID !== undefined) {
      user.ogrenciDetay.rehberID = rehberID;
    }
    
    await user.save();
    
    const userObj = user.toObject();
    const response = {
      id: userObj._id,
      email: userObj.email,
      role: userObj.role,
      ad: userObj.ad,
      soyad: userObj.soyad,
      ogrenciDetay: userObj.ogrenciDetay
    };
    
    res.json({
      success: true,
      message: 'Öğrenci başarıyla güncellendi',
      data: response
    });
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Öğrenci sil
exports.deleteOgrenci = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user || user.role !== 'Öğrenci') {
      return sendNotFound(res, 'Öğrenci bulunamadı');
    }
    
    // Detay bilgilerini temizle
    user.ogrenciDetay = {
      rehberID: null,
      yas: null,
      sinif: null
    };
    await user.save();
    
    sendSuccess(res, 'Öğrenci detayları başarıyla silindi');
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// User ID'ye göre Öğrenci getir
exports.getOgrenciByUserId = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password -__v');
    
    if (!user || user.role !== 'Öğrenci') {
      return sendNotFound(res, 'Öğrenci bulunamadı');
    }
    
    const userObj = user.toObject();
    const response = {
      id: userObj._id,
      email: userObj.email,
      role: userObj.role,
      ad: userObj.ad,
      soyad: userObj.soyad,
      ogrenciDetay: userObj.ogrenciDetay || {
        rehberID: null,
        yas: null,
        sinif: null
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

// Rehber ID'ye göre Öğrencileri getir
exports.getOgrencilerByRehberId = async (req, res) => {
  try {
    const { rehberId } = req.params;
    
    const ogrenciler = await User.find({ 
      role: 'Öğrenci',
      'ogrenciDetay.rehberID': rehberId 
    }).select('-password -__v');
    
    // Öğrencileri detay bilgileriyle döndür
    const ogrencilerWithDetails = ogrenciler.map(ogrenci => {
      const ogrenciObj = ogrenci.toObject();
      return {
        id: ogrenciObj._id,
        email: ogrenciObj.email,
        role: ogrenciObj.role,
        ad: ogrenciObj.ad,
        soyad: ogrenciObj.soyad,
        ogrenciDetay: ogrenciObj.ogrenciDetay || {
          rehberID: null,
          yas: null,
          sinif: null
        }
      };
    });
    
    res.json({
      success: true,
      data: ogrencilerWithDetails
    });
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Sınıfa göre Öğrencileri getir
exports.getOgrencilerBySinif = async (req, res) => {
  try {
    const { sinif } = req.params;
    
    const ogrenciler = await User.find({ 
      role: 'Öğrenci',
      'ogrenciDetay.sinif': sinif 
    }).select('-password -__v');
    
    // Öğrencileri detay bilgileriyle döndür
    const ogrencilerWithDetails = ogrenciler.map(ogrenci => {
      const ogrenciObj = ogrenci.toObject();
      return {
        id: ogrenciObj._id,
        email: ogrenciObj.email,
        role: ogrenciObj.role,
        ad: ogrenciObj.ad,
        soyad: ogrenciObj.soyad,
        ogrenciDetay: ogrenciObj.ogrenciDetay || {
          rehberID: null,
          yas: null,
          sinif: null
        }
      };
    });
    
    res.json({
      success: true,
      data: ogrencilerWithDetails
    });
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Öğrenci detay bilgileri (ilişkili verilerle)
exports.getOgrenciDetay = async (req, res) => {
  try {
    const { id } = req.params;
    
    const ogrenci = await User.findById(id).select('-password -__v');
    if (!ogrenci || ogrenci.role !== 'Öğrenci') {
      return sendNotFound(res, 'Öğrenci bulunamadı');
    }
    
    let rehberBilgileri = null;
    if (ogrenci.ogrenciDetay && ogrenci.ogrenciDetay.rehberID) {
      const rehber = await User.findById(ogrenci.ogrenciDetay.rehberID).select('-password -__v');
      if (rehber) {
        rehberBilgileri = rehber;
      }
    }
    
    // Aynı sınıftaki diğer öğrenciler
    const sinifOgrencileri = await User.find({
      role: 'Öğrenci',
      'ogrenciDetay.sinif': ogrenci.ogrenciDetay?.sinif,
      _id: { $ne: id }
    }).select('-password -__v');
    
    res.json({
      success: true,
      data: {
        ogrenci: {
          id: ogrenci._id,
          yas: ogrenci.ogrenciDetay?.yas,
          sinif: ogrenci.ogrenciDetay?.sinif,
          userBilgileri: {
            id: ogrenci._id,
            ad: ogrenci.ad,
            soyad: ogrenci.soyad,
            email: ogrenci.email,
            role: ogrenci.role
          },
          rehberBilgileri: rehberBilgileri ? {
            id: rehberBilgileri._id,
            siniflar: rehberBilgileri.rehberDetay?.siniflar,
            rehberUser: {
              id: rehberBilgileri._id,
              ad: rehberBilgileri.ad,
              soyad: rehberBilgileri.soyad,
              email: rehberBilgileri.email,
              role: rehberBilgileri.role
            }
          } : null
        },
        sinifOgrencileri: sinifOgrencileri.map(ogr => ({
          id: ogr._id,
          ad: ogr.ad,
          soyad: ogr.soyad,
          email: ogr.email,
          yas: ogr.ogrenciDetay?.yas,
          sinif: ogr.ogrenciDetay?.sinif
        }))
      }
    });
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};