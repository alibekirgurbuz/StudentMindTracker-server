const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Message = require('../models/Message');

// Öğrenci için sınıf arkadaşları ve rehberini getir
router.get('/classroom-users', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('ogrenciDetay.rehberID', 'ad soyad');
    
    if (user.role !== 'Öğrenci') {
      return res.status(403).json({ message: 'Bu işlem sadece öğrenciler için' });
    }
    
    // Aynı sınıftaki öğrenciler
    const classmates = await User.find({
      role: 'Öğrenci',
      'ogrenciDetay.sinif': user.ogrenciDetay.sinif,
      _id: { $ne: user._id }
    }).select('ad soyad ogrenciDetay.sinif').lean();
    
    // _id'yi id'ye dönüştür
    const normalizedClassmates = classmates.map(student => ({
      ...student,
      id: student._id.toString()
    }));
    
    // Rehber bilgisi
    const rehber = user.ogrenciDetay.rehberID;
    const normalizedRehber = rehber ? {
      ...rehber.toObject(),
      id: rehber._id.toString()
    } : null;
    
    res.json({
      classmates: normalizedClassmates,
      rehber: normalizedRehber,
      roomId: `class_${user.ogrenciDetay.sinif}`
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server hatası' });
  }
});

// Rehber için sınıf öğrencilerini getir
router.get('/students', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (user.role !== 'Rehber') {
      return res.status(403).json({ message: 'Bu işlem sadece rehberler için' });
    }
    
    const students = await User.find({
      role: 'Öğrenci',
      'ogrenciDetay.rehberID': user._id
    }).select('ad soyad ogrenciDetay.sinif').lean();
    
    // _id'yi id'ye dönüştür
    const normalizedStudents = students.map(student => ({
      ...student,
      id: student._id.toString()
    }));
    
    res.json({
      students: normalizedStudents,
      roomId: `rehber_${user._id}`
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server hatası' });
  }
});

// Mesaj geçmişi
router.get('/messages/:roomId', auth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const messages = await Message.find({ roomId })
      .populate('sender', 'ad soyad')
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    res.json(messages.reverse());
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server hatası' });
  }
});

module.exports = router;

