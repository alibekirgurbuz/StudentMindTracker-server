const express = require('express');
const router = express.Router();
const {
  getAllSurveys,
  getSurveyById,
  createSurvey,
  updateSurvey,
  deleteSurvey,
  getSurveysByRehberId,
  saveSurveyResult,
  getSurveyResults
} = require('../controllers/surveyController');
const { auth, adminAuth } = require('../middleware/auth');

// Geliştirme aşaması - güvenlik kontrolleri kaldırıldı
// @route   GET /api/surveys
// @desc    Tüm anketleri getir
router.get('/', getAllSurveys);

// @route   GET /api/surveys/rehber/:rehberId
// @desc    Rehber ID'ye göre anketleri getir
router.get('/rehber/:rehberId', getSurveysByRehberId);

// @route   GET /api/surveys/:anketId/results
// @desc    Anket sonuçlarını getir
router.get('/:anketId/results', getSurveyResults);

// @route   GET /api/surveys/:id
// @desc    ID'ye göre anket getir
router.get('/:id', getSurveyById);

// @route   POST /api/surveys
// @desc    Yeni anket oluştur
router.post('/', createSurvey);

// @route   PUT /api/surveys/:id
// @desc    Anket güncelle
router.put('/:id', updateSurvey);

// @route   DELETE /api/surveys/:id
// @desc    Anket sil
router.delete('/:id', deleteSurvey);

// @route   POST /api/surveys/result
// @desc    Anket sonucu kaydet
router.post('/result', saveSurveyResult);



module.exports = router;
