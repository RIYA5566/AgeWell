const express = require('express');
const http = require('http');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();
const httpServer = http.createServer(app);

// Middlewares
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static assets from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files (audio recordings, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Socket.IO Real-Time Engine ──────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.IO authentication middleware (extracts JWT token from auth handshake or query)
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'agewell_secret_key_2026_xyz');
      socket.userId = decoded.id;
      return next();
    } catch (err) {
      console.warn('Socket token verify error:', err.message);
    }
  }
  // Allow connection even without token, user will join user room on authentication
  next();
});

// Track online users: userId -> Set of socketIds
const onlineUsersMap = new Map();

io.on('connection', (socket) => {
  const userId = socket.userId || socket.handshake.query?.userId;

  if (userId) {
    if (!onlineUsersMap.has(userId)) {
      onlineUsersMap.set(userId, new Set());
    }
    onlineUsersMap.get(userId).add(socket.id);

    // Join personal user room for direct alerts & unread badges
    socket.join(`user_${userId}`);
    io.emit('userPresenceChanged', { userId, isOnline: true });
  }

  // Join a specific conversation room
  socket.on('joinConversation', (conversationId) => {
    if (conversationId) {
      socket.join(conversationId.toString());
    }
  });

  // Leave a specific conversation room
  socket.on('leaveConversation', (conversationId) => {
    if (conversationId) {
      socket.leave(conversationId.toString());
    }
  });

  // User typing indicators
  socket.on('typing', (data) => {
    if (data && data.conversationId) {
      socket.to(data.conversationId.toString()).emit('userTyping', {
        conversationId: data.conversationId,
        userId: data.userId,
        userName: data.userName
      });
    }
  });

  socket.on('stopTyping', (data) => {
    if (data && data.conversationId) {
      socket.to(data.conversationId.toString()).emit('userStoppedTyping', {
        conversationId: data.conversationId,
        userId: data.userId
      });
    }
  });

  // Check online status of user list
  socket.on('checkOnlineUsers', (userIds, callback) => {
    if (Array.isArray(userIds) && typeof callback === 'function') {
      const statusMap = {};
      userIds.forEach(id => {
        statusMap[id] = onlineUsersMap.has(id) && onlineUsersMap.get(id).size > 0;
      });
      callback(statusMap);
    }
  });

  socket.on('disconnect', () => {
    if (userId && onlineUsersMap.has(userId)) {
      const sockets = onlineUsersMap.get(userId);
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        onlineUsersMap.delete(userId);
        io.emit('userPresenceChanged', { userId, isOnline: false });
      }
    }
  });
});

// Expose io instance to Express routes & controllers via req.app.get('io')
app.set('io', io);

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/family', require('./routes/familyRoutes'));
app.use('/api/volunteer', require('./routes/volunteerRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));

// Clean URL Route for Messaging / Chat System
app.get(['/messages', '/chat', '/inbox'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'messages.html'));
});

// Clean URL Route for Caregiver Wallet
app.get(['/caregiver/wallet', '/wallet'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'caregiver-wallet.html'));
});

// Fallback: Send static frontend HTML for any non-API routes (SPA routing style if users manually type links)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Express Error Handler:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An internal server error occurred'
  });
});

const PORT = process.env.PORT || 5000;

const server = httpServer.listen(PORT, () => {
  console.log(
    `AgeWell running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT} with Socket.IO enabled`
  );
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Unhandled Rejection Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
