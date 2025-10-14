// src/app.js
import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.js';
import zohoRoutes from './routes/zoho.js';
import userRoutes from './routes/users.js';
import driverRoutes from './routes/driver.js';
import rateCardRoutes from './routes/rateCard.js';
import morgan from 'morgan';

import { initSocket, attachTestRoutes } from './services/socketService.js';

dotenv.config();

const app = express();

// simple request logger
app.use((req, res, next) => {
  console.log('Request received:', req.method, req.path);
  next();
});

// Middleware
app.use(cors({
  origin: "*",
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/zoho', zohoRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/rate-card', rateCardRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});

// Create HTTP server and attach socket.io
const server = http.createServer(app);

// Initialize Socket.IO (attach to same HTTP server)
initSocket(server);

// Attach test routes which use socket service for emitting (dev only)
attachTestRoutes(app);

// Start DB and server
const PORT = process.env.PORT || 5000;
const start = async () => {
  try {
    await connectDB(); // your connectDB should return a promise
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error', err);
    // continue - if DB is essential you may want to exit
  }

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start();
