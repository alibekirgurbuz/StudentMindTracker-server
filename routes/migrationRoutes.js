const express = require('express');
const router = express.Router();
const { migrateRehberAnaliz } = require('../controllers/migrationController');

// @route   POST /api/migration/rehber-analiz
// @desc    Tüm rehberlere analizSonuclari alanını ekle
// @access  Admin (production'da auth middleware eklenebilir)
router.post('/rehber-analiz', migrateRehberAnaliz);

module.exports = router;
