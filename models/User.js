const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['Admin', 'Rehber', 'Öğrenci'],
    required: true,
    default: 'Öğrenci'
  },
  ad: {
    type: String,
    required: true,
  },
  soyad: {
    type: String,
    required: true,
  },
  ogrenciDetay: {
    rehberID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    yas: {
      type: Number,
      default: null
    },
    sinif: {
      type: String,
      default: null
    }
  },
  rehberDetay: {
    siniflar: {
      type: [String],
      default: []
    },
    ogrenciler: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: []
    },
    anketler: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    anket_sonuclari: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    }
  }
});

// Şifreyi kaydetmeden önce hash'le
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Rol bazlı detay alanlarını otomatik olarak ekle
UserSchema.pre('save', function (next) {
  if (this.role === 'Öğrenci') {
    // Öğrenci için ogrenciDetay alanını oluştur
    if (!this.ogrenciDetay) {
      this.ogrenciDetay = {
        rehberID: null,
        yas: null,
        sinif: null
      };
    }
    // Rehber detayını temizle
    this.rehberDetay = undefined;
  } else if (this.role === 'Rehber') {
    // Rehber için rehberDetay alanını oluştur
    if (!this.rehberDetay) {
      this.rehberDetay = {
        siniflar: [],
        ogrenciler: [],
        anketler: [],
        anket_sonuclari: []
      };
    }
    // Öğrenci detayını temizle
    this.ogrenciDetay = undefined;
  } else if (this.role === 'Admin') {
    // Admin için her iki detay alanını da temizle
    this.ogrenciDetay = undefined;
    this.rehberDetay = undefined;
  }
  next();
});

module.exports = mongoose.model('User', UserSchema);