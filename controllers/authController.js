const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendSuccess, sendError, sendBadRequest } = require('../utils/responseHelper');

// Kullanıcı Kaydı
exports.registerUser = async (req, res) => {
  const { email, password, role, ad, soyad } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) {
      return sendBadRequest(res, 'Kullanıcı zaten mevcut.');
    }
    user = new User({ 
      email, 
      password, 
      role: role || 'Öğrenci',
      ad,
      soyad
    });
    await user.save();

    const payload = { user: { id: user.id } };
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        
        // Kullanıcı bilgilerini role göre döndür
        let userResponse = {
          id: user._id,
          email: user.email,
          role: user.role,
          ad: user.ad,
          soyad: user.soyad
        };

        // Role göre detay bilgilerini ekle
        if (user.role === 'Öğrenci' && user.ogrenciDetay) {
          userResponse.ogrenciDetay = user.ogrenciDetay;
        } else if (user.role === 'Rehber' && user.rehberDetay) {
          userResponse.rehberDetay = user.rehberDetay;
        }

        res.json({ 
          token,
          user: userResponse
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Kullanıcı Girişi
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (!user) {
      return sendBadRequest(res, 'Geçersiz kimlik bilgileri.');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendBadRequest(res, 'Geçersiz kimlik bilgileri.');
    }

    const payload = { user: { id: user.id } };
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        
        // Kullanıcı bilgilerini role göre döndür
        let userResponse = {
          id: user._id,
          email: user.email,
          role: user.role,
          ad: user.ad,
          soyad: user.soyad
        };

        // Role göre detay bilgilerini ekle
        if (user.role === 'Öğrenci' && user.ogrenciDetay) {
          userResponse.ogrenciDetay = user.ogrenciDetay;
        } else if (user.role === 'Rehber' && user.rehberDetay) {
          userResponse.rehberDetay = user.rehberDetay;
        }

        res.json({ 
          token,
          user: userResponse
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    sendError(res, 'Server Hatası');
  }
};

// Şifre Değiştir
exports.changePassword = async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  
  try {
    // Kullanıcıyı bul
    const user = await User.findById(userId);
    if (!user) {
      return sendBadRequest(res, 'Kullanıcı bulunamadı');
    }

    // Eski şifreyi kontrol et
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return sendBadRequest(res, 'Eski şifre yanlış');
    }

    // Yeni şifreyi hashle ve kaydet
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    sendSuccess(res, { message: 'Şifre başarıyla değiştirildi' });
  } catch (err) {
    console.error('Şifre değiştirme hatası:', err.message);
    sendError(res, 'Server Hatası');
  }
};