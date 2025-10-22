// src/app.js (showing relevant parts only)
import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import connectDB from './config/db.js';

// your existing routes
import authRoutes from './routes/auth.js';
import zohoRoutes from './routes/zoho.js';
import userRoutes from './routes/users.js';
import driverRoutes from './routes/driver.js';
import rateCardRoutes from './routes/rateCard.js';
import wasenderWebhook from './routes/wasenderWebhook.js';


import jobsRoutes from './routes/jobs.js';
import { initSocket, attachTestRoutes } from './services/socketService.js';

dotenv.config();
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(morgan('dev'));

// ... your existing app.use routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/zoho', zohoRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/rate-card', rateCardRoutes);

// new jobs route
app.use('/api/jobs', jobsRoutes);

app.use('/webhooks/wasender', express.json({ type: '*/*' }), wasenderWebhook);


// attach test routes (optional)
attachTestRoutes(app);

// create http server and attach socket
const server = http.createServer(app);
initSocket(server);

// connect DB and listen (your existing start logic)
connectDB().then(() => {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('DB connect error', err);
});
