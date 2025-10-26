const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/db');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Message = require('./models/Message');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const rehberRoutes = require('./routes/rehberRoutes');
const ogrenciRoutes = require('./routes/ogrenciRoutes');
const surveyRoutes = require('./routes/surveyRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Veritabanına bağlan
connectDB();

// Middleware'ler
app.use(express.json()); // body-parser'ın yerini aldı

// CORS ayarları (React Native için)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Test endpoint'i
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend çalışıyor!', timestamp: new Date().toISOString() });
});

// Socket.io bağlantı yönetimi
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id).select('-password');
    
    if (!user) {
      return next(new Error('User not found'));
    }
    
    socket.userId = user._id;
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Online kullanıcıları takip et
const onlineUsers = new Map();

io.on('connection', (socket) => {
  const userIdStr = socket.userId.toString();
  console.log(`✅ ${socket.user.ad} ${socket.user.soyad} connected (ID: ${userIdStr})`);
  
  // Kullanıcıyı online olarak işaretle
  socket.join(`user_${userIdStr}`);
  onlineUsers.set(userIdStr, socket.id);
  
  // Tüm bağlı kullanıcılara bu kullanıcının online olduğunu bildir
  io.emit('user_status', {
    userId: userIdStr,
    isOnline: true
  });
  
  // Oda oluşturma/katılma
  socket.on('join_room', async (roomId) => {
    try {
      socket.join(roomId);
      console.log(`Kullanıcı ${socket.user.ad} odaya katıldı: ${roomId} (Socket: ${socket.id})`);
      
      // Geçmiş mesajları gönder
      const messages = await Message.find({ roomId })
        .populate('sender', 'ad soyad')
        .sort({ timestamp: 1 })
        .limit(50);
      
      console.log(`${roomId} için ${messages.length} mesaj gönderiliyor`);
      socket.emit('previous_messages', messages);
    } catch (error) {
      console.error('Mesaj geçmişi yüklenirken hata:', error);
      socket.emit('message_error', { error: 'Mesaj geçmişi yüklenemedi' });
    }
  });
  
  // Mesaj gönderme
  socket.on('send_message', async (data) => {
    try {
      const { content, roomId, receiverId } = data;
      
      console.log(`Mesaj alındı - Gönderen: ${socket.user.ad}, Oda: ${roomId}`);
      
      if (!content || !roomId) {
        socket.emit('message_error', { error: 'Mesaj içeriği veya oda ID eksik' });
        return;
      }
      
      // Kullanıcının odada olup olmadığını kontrol et
      const rooms = Array.from(socket.rooms);
      if (!rooms.includes(roomId)) {
        console.error(`Kullanıcı ${socket.user.ad} odada değil: ${roomId}`);
        socket.emit('message_error', { error: 'Odaya katılmadınız' });
        return;
      }
      
      // Mesajı veritabanına kaydet
      const message = new Message({
        sender: socket.userId,
        receiver: receiverId,
        content,
        roomId
      });
      
      await message.save();
      console.log(`Mesaj veritabanına kaydedildi - ID: ${message._id}`);
      
      // Mesajı populate et
      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'ad soyad');
      
      console.log(`Mesaj populate edildi, odaya gönderiliyor: ${roomId}`);
      
      // Oda içindeki tüm kullanıcılara mesajı gönder
      io.to(roomId).emit('new_message', populatedMessage);
      
      console.log(`Mesaj başarıyla gönderildi - ID: ${message._id}`);
      
    } catch (error) {
      console.error('Mesaj gönderilirken hata:', error);
      socket.emit('message_error', { error: 'Mesaj gönderilemedi' });
    }
  });
  
  // Kullanıcı durumu kontrol et
  socket.on('check_user_status', (userId) => {
    const userIdStr = userId?.toString();
    const isOnline = onlineUsers.has(userIdStr);
    
    console.log(`Status check: ${userIdStr} is ${isOnline ? 'online' : 'offline'}`);
    
    socket.emit('user_status', {
      userId: userIdStr,
      isOnline: isOnline
    });
  });
  
  // Bağlantı kesildiğinde
  socket.on('disconnect', (reason) => {
    const userIdStr = socket.userId.toString();
    console.log(`❌ ${socket.user.ad} ${socket.user.soyad} disconnected (${reason})`);
    
    onlineUsers.delete(userIdStr);
    
    // Tüm bağlı kullanıcılara bu kullanıcının offline olduğunu bildir
    io.emit('user_status', {
      userId: userIdStr,
      isOnline: false
    });
  });
  
  // Hata yönetimi
  socket.on('error', (error) => {
    console.error(`Socket hatası - Kullanıcı: ${socket.user.ad}`, error);
  });
});

// Rotalar
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rehber', rehberRoutes);
app.use('/api/ogrenci', ogrenciRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/chat', chatRoutes);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
});