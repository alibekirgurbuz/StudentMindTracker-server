const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { auth, adminAuth } = require('../middleware/auth');

// Geliştirme aşaması - güvenlik kontrolleri kaldırıldı
// Tüm kullanıcıları getir
// GET /api/users
router.get('/', userController.getAllUsers);

// Mevcut kullanıcıyı getir
// GET /api/users/me
router.get('/me', auth, userController.getCurrentUser);

// Öğrenci sayısını getir
// GET /api/users/count/students
router.get('/count/students', userController.getStudentCount);

// Admin istatistiklerini getir
// GET /api/users/admin/statistics
router.get('/admin/statistics', userController.getAdminStatistics);

// Role göre kullanıcıları getir
// GET /api/users/role/:role
router.get('/role/:role', userController.getUsersByRole);

// ID'ye göre kullanıcı getir
// GET /api/users/:id
router.get('/:id', userController.getUserById);

// Yeni kullanıcı oluştur
// POST /api/users
router.post('/', userController.createUser);

// Kullanıcı güncelle
// PUT /api/users/:id
router.put('/:id', userController.updateUser);

// Kullanıcı sil
// DELETE /api/users/:id
router.delete('/:id', userController.deleteUser);

module.exports = router;
