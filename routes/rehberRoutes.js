const express = require('express');
const router = express.Router();
const {
  getAllRehberler,
  getRehberById,
  createRehber,
  updateRehber,
  deleteRehber,
  getRehberByUserId
} = require('../controllers/rehberController');
const { auth, adminAuth } = require('../middleware/auth');

// Geliştirme aşaması - güvenlik kontrolleri kaldırıldı
// @route   GET /api/rehber
// @desc    Tüm Rehberleri getir
router.get('/', getAllRehberler);

// @route   GET /api/rehber/user/:userId
// @desc    User ID'ye göre Rehber getir
router.get('/user/:userId', getRehberByUserId);

// @route   GET /api/rehber/:id
// @desc    ID'ye göre Rehber getir
router.get('/:id', getRehberById);

// @route   POST /api/rehber
// @desc    Yeni Rehber oluştur
router.post('/', createRehber);

// @route   PUT /api/rehber/:id
// @desc    Rehber güncelle
router.put('/:id', updateRehber);

// @route   DELETE /api/rehber/:id
// @desc    Rehber sil
router.delete('/:id', deleteRehber);

module.exports = router;
