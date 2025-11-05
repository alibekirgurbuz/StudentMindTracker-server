const express = require('express');
const router = express.Router();
const {
  analyzeStudentSurveys,
  getAnalysisHistory,
  getAnalysisById
} = require('../controllers/analysisController');
const { auth } = require('../middleware/auth');

// @route   POST /api/analysis/:rehberId
// @desc    Rehberin öğrencilerinin anket sonuçlarını OpenAI ile analiz et
// @access  Private (gelecekte auth middleware eklenebilir)
router.post('/:rehberId', analyzeStudentSurveys);

// @route   GET /api/analysis/:rehberId/history
// @desc    Rehberin geçmiş analizlerini getir
// @access  Private
router.get('/:rehberId/history', getAnalysisHistory);

// @route   GET /api/analysis/:rehberId/:analizId
// @desc    Belirli bir analizi getir
// @access  Private
router.get('/:rehberId/:analizId', getAnalysisById);

module.exports = router;
