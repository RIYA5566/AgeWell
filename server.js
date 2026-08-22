const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();

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

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/family', require('./routes/familyRoutes'));
app.use('/api/volunteer', require('./routes/volunteerRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));

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

const server = app.listen(PORT, () => {
  console.log(
    `AgeWell running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
  );
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Unhandled Rejection Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
