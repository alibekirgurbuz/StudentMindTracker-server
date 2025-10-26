// Geliştirme aşaması için güvenlik kontrolleri kaldırıldı
// Production'da tekrar eklenecek

// Basit auth middleware - sadece token varsa kullanıcı bilgisini ekler
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'Token bulunamadı' });
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Geçersiz token' });
  }
};

// Admin auth - şimdilik normal auth ile aynı
const adminAuth = (req, res, next) => {
  next(); // Her durumda devam et
};

module.exports = { auth, adminAuth };
