const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'CareNest API', timestamp: new Date() });
});

// Real-time SOS & Notification Socket Events
io.on('connection', (socket) => {
  console.log(`Socket Connected: ${socket.id}`);

  // Join User Room
  socket.on('join_room', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their personal room`);
  });

  // Emergency SOS Event Broadcast
  socket.on('send_sos_alert', (data) => {
    console.log('🚨 SOS Alert Triggered:', data);
    // Broadcast to emergency contacts & caregivers
    io.emit('receive_sos_alert', data);
  });

  socket.on('disconnect', () => {
    console.log(`Socket Disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 CareNest Server running on port ${PORT}`);
});
