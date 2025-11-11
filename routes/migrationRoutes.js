const express = require('express');
const router = express.Router();
const { migrateRehberAnaliz, checkRehberDetail, syncRehberOgrenciler } = require('../controllers/migrationController');

// @route   GET /api/migration/check/:rehberId
// @desc    Rehber detayını kontrol et (debug)
// @access  Public
router.get('/check/:rehberId', checkRehberDetail);

// @route   POST /api/migration/rehber-analiz
// @desc    Tüm rehberlere analizSonuclari alanını ekle
// @access  Admin (production'da auth middleware eklenebilir)
router.post('/rehber-analiz', migrateRehberAnaliz);

// @route   POST /api/migration/sync-rehber-ogrenciler
// @desc    Rehberlerin öğrenci listelerini senkronize et
// @access  Admin (production'da auth middleware eklenebilir)
router.post('/sync-rehber-ogrenciler', syncRehberOgrenciler);

module.exports = router;
