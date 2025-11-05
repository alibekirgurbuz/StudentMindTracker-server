const express = require('express');
const router = express.Router();
const { migrateRehberAnaliz, checkRehberDetail } = require('../controllers/migrationController');

// @route   GET /api/migration/check/:rehberId
// @desc    Rehber detayını kontrol et (debug)
// @access  Public
router.get('/check/:rehberId', checkRehberDetail);

// @route   POST /api/migration/rehber-analiz
// @desc    Tüm rehberlere analizSonuclari alanını ekle
// @access  Admin (production'da auth middleware eklenebilir)
router.post('/rehber-analiz', migrateRehberAnaliz);

module.exports = router;
