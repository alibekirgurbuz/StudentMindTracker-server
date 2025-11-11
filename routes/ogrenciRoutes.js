const express = require('express');
const router = express.Router();
const {
  getAllOgrenciler,
  getOgrenciById,
  createOgrenci,
  updateOgrenci,
  deleteOgrenci,
  getOgrenciByUserId,
  getOgrencilerByRehberId,
  getOgrencilerBySinif,
  getOgrenciDetay,
  getOgrenciAnketSonuclari
} = require('../controllers/ogrenciController');
const { auth, adminAuth } = require('../middleware/auth');

// Geliştirme aşaması - güvenlik kontrolleri kaldırıldı
// @route   GET /api/ogrenci
// @desc    Tüm Öğrencileri getir
router.get('/', getAllOgrenciler);

// @route   GET /api/ogrenci/user/:userId
// @desc    User ID'ye göre Öğrenci getir
router.get('/user/:userId', getOgrenciByUserId);

// @route   GET /api/ogrenci/rehber/:rehberId
// @desc    Rehber ID'ye göre Öğrencileri getir
router.get('/rehber/:rehberId', getOgrencilerByRehberId);

// @route   GET /api/ogrenci/sinif/:sinif
// @desc    Sınıfa göre Öğrencileri getir
router.get('/sinif/:sinif', getOgrencilerBySinif);

// @route   GET /api/ogrenci/detay/:id
// @desc    Öğrenci detay bilgilerini getir (tüm ilişkili verilerle)
router.get('/detay/:id', getOgrenciDetay);

// @route   GET /api/ogrenci/:id/anket-sonuclari
// @desc    Öğrencinin anket sonuçlarını getir
// NOT: Bu route /:id route'undan ÖNCE olmalı!
router.get('/:id/anket-sonuclari', getOgrenciAnketSonuclari);

// @route   GET /api/ogrenci/:id
// @desc    ID'ye göre Öğrenci getir
router.get('/:id', getOgrenciById);

// @route   POST /api/ogrenci
// @desc    Yeni Öğrenci oluştur
router.post('/', createOgrenci);

// @route   PUT /api/ogrenci/:id
// @desc    Öğrenci güncelle
router.put('/:id', updateOgrenci);

// @route   DELETE /api/ogrenci/:id
// @desc    Öğrenci sil
router.delete('/:id', deleteOgrenci);

module.exports = router;
