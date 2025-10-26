const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { sendSuccess, sendError, sendNotFound, sendBadRequest } = require('../utils/responseHelper');

// Tüm kullanıcıları getir (GET /api/users)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password'); // Şifre bilgisini döndürme
    
    // Kullanıcıları role göre detay bilgileriyle döndür
    const usersWithDetails = users.map(user => {
      const userObj = user.toObject();
      let response = {
        id: userObj._id,
        email: userObj.email,
        role: userObj.role,
        ad: userObj.ad,
        soyad: userObj.soyad
      };

      // Role göre detay bilgilerini ekle
      if (userObj.role === 'Öğrenci' && userObj.ogrenciDetay) {
        response.ogrenciDetay = userObj.ogrenciDetay;
      } else if (userObj.role === 'Rehber' && userObj.rehberDetay) {
        response.rehberDetay = userObj.rehberDetay;
      }

      return response;
    });

    res.json(usersWithDetails);
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// ID'ye göre kullanıcı getir (GET /api/users/:id)
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return sendNotFound(res, 'Kullanıcı bulunamadı');
    }

    const userObj = user.toObject();
    let response = {
      id: userObj._id,
      email: userObj.email,
      role: userObj.role,
      ad: userObj.ad,
      soyad: userObj.soyad
    };

    // Role göre detay bilgilerini ekle
    if (userObj.role === 'Öğrenci' && userObj.ogrenciDetay) {
      response.ogrenciDetay = userObj.ogrenciDetay;
    } else if (userObj.role === 'Rehber' && userObj.rehberDetay) {
      response.rehberDetay = userObj.rehberDetay;
    }

    res.json(response);
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Kullanıcı bilgilerini getir (GET /api/users/me)
// Mevcut kullanıcıyı getir (GET /api/users/me)
exports.getCurrentUser = async (req, res) => {
  try {
    // Auth middleware'den gelen user bilgisini kullan
    const userId = req.user?.id;
    
    if (!userId) {
      return sendBadRequest(res, 'Kullanıcı kimlik bilgisi bulunamadı');
    }
    
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return sendNotFound(res, 'Kullanıcı bulunamadı');
    }

    const userObj = user.toObject();
    let response = {
      id: userObj._id,
      email: userObj.email,
      role: userObj.role,
      ad: userObj.ad,
      soyad: userObj.soyad
    };

    // Role göre detay bilgilerini ekle
    if (userObj.role === 'Öğrenci' && userObj.ogrenciDetay) {
      response.ogrenciDetay = userObj.ogrenciDetay;
    } else if (userObj.role === 'Rehber' && userObj.rehberDetay) {
      response.rehberDetay = userObj.rehberDetay;
    }

    res.json(response);
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Yeni kullanıcı oluştur (POST /api/users)
exports.createUser = async (req, res) => {
  const { email, password, role, ad, soyad } = req.body;
  
  try {
    // Email kontrolü
    let user = await User.findOne({ email });
    if (user) {
      return sendBadRequest(res, 'Bu email adresi zaten kullanılıyor');
    }

    // Yeni kullanıcı oluştur
    user = new User({
      email,
      password,
      role: role || 'Öğrenci',
      ad,
      soyad
    });

    await user.save();
    
    // Şifre olmadan kullanıcı bilgilerini döndür
    const userObj = user.toObject();
    let response = {
      id: userObj._id,
      email: userObj.email,
      role: userObj.role,
      ad: userObj.ad,
      soyad: userObj.soyad
    };

    // Role göre detay bilgilerini ekle
    if (userObj.role === 'Öğrenci' && userObj.ogrenciDetay) {
      response.ogrenciDetay = userObj.ogrenciDetay;
    } else if (userObj.role === 'Rehber' && userObj.rehberDetay) {
      response.rehberDetay = userObj.rehberDetay;
    }

    res.status(201).json(response);
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Kullanıcı güncelle (PUT /api/users/:id)
exports.updateUser = async (req, res) => {
  const { email, password, role, ad, soyad } = req.body;
  const updateData = {};

  try {
    let user = await User.findById(req.params.id);
    if (!user) {
      return sendNotFound(res, 'Kullanıcı bulunamadı');
    }

    // Güncellenecek alanları kontrol et
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (ad) updateData.ad = ad;
    if (soyad) updateData.soyad = soyad;
    if (password) updateData.password = password;

    // Email benzersizlik kontrolü (eğer email değiştiriliyorsa)
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return sendBadRequest(res, 'Bu email adresi zaten kullanılıyor');
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    const userObj = updatedUser.toObject();
    let response = {
      id: userObj._id,
      email: userObj.email,
      role: userObj.role,
      ad: userObj.ad,
      soyad: userObj.soyad
    };

    // Role göre detay bilgilerini ekle
    if (userObj.role === 'Öğrenci' && userObj.ogrenciDetay) {
      response.ogrenciDetay = userObj.ogrenciDetay;
    } else if (userObj.role === 'Rehber' && userObj.rehberDetay) {
      response.rehberDetay = userObj.rehberDetay;
    }

    res.json(response);
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Kullanıcı sil (DELETE /api/users/:id)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return sendNotFound(res, 'Kullanıcı bulunamadı');
    }

    await User.findByIdAndDelete(req.params.id);
    sendSuccess(res, 'Kullanıcı başarıyla silindi');
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Role göre kullanıcıları getir (GET /api/users/role/:role)
exports.getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const users = await User.find({ role }).select('-password');
    
    // Kullanıcıları role göre detay bilgileriyle döndür
    const usersWithDetails = users.map(user => {
      const userObj = user.toObject();
      let response = {
        id: userObj._id,
        email: userObj.email,
        role: userObj.role,
        ad: userObj.ad,
        soyad: userObj.soyad
      };

      // Role göre detay bilgilerini ekle
      if (userObj.role === 'Öğrenci' && userObj.ogrenciDetay) {
        response.ogrenciDetay = userObj.ogrenciDetay;
      } else if (userObj.role === 'Rehber' && userObj.rehberDetay) {
        response.rehberDetay = userObj.rehberDetay;
      }

      return response;
    });

    res.json(usersWithDetails);
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Öğrenci sayısını getir (GET /api/users/count/students)
exports.getStudentCount = async (req, res) => {
  try {
    const count = await User.countDocuments({ role: 'Öğrenci' });
    res.json({ count });
  } catch (err) {
    console.error('getStudentCount hatası:', err.message);
    res.status(500).json({ msg: 'Server Hatası' });
  }
};

// Admin istatistiklerini getir (GET /api/users/admin/statistics)
exports.getAdminStatistics = async (req, res) => {
  try {
    // Tüm kullanıcıları getir
    const allUsers = await User.find().select('-password');
    
    // Rol bazında sayıları hesapla
    const ogrenciler = allUsers.filter(u => u.role === 'Öğrenci');
    const rehberler = allUsers.filter(u => u.role === 'Rehber');
    const adminler = allUsers.filter(u => u.role === 'Admin');
    
    // Benzersiz sınıfları bul
    const uniqueClasses = new Set();
    ogrenciler.forEach(ogrenci => {
      if (ogrenci.ogrenciDetay && ogrenci.ogrenciDetay.sinif) {
        uniqueClasses.add(ogrenci.ogrenciDetay.sinif);
      }
    });
    
    // Toplam anket sayısını hesapla
    let totalSurveys = 0;
    rehberler.forEach(rehber => {
      if (rehber.rehberDetay && rehber.rehberDetay.anketler) {
        totalSurveys += rehber.rehberDetay.anketler.length;
      }
    });
    
    // Toplam anket sonuçlarını hesapla
    let totalResults = 0;
    rehberler.forEach(rehber => {
      if (rehber.rehberDetay && rehber.rehberDetay.anket_sonuclari) {
        totalResults += rehber.rehberDetay.anket_sonuclari.length;
      }
    });
    
    res.json({
      success: true,
      data: {
        rehberCount: rehberler.length,
        studentCount: ogrenciler.length,
        adminCount: adminler.length,
        totalUsers: allUsers.length,
        classCount: uniqueClasses.size,
        surveyCount: totalSurveys,
        resultCount: totalResults,
        classes: Array.from(uniqueClasses)
      }
    });
  } catch (err) {
    console.error('getAdminStatistics hatası:', err.message);
    sendError(res, 'Server Hatası');
  }
};