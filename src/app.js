// src/app.js
import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import connectDB from './config/db.js';

// routes
import authRoutes from './routes/auth.js';
import zohoRoutes from './routes/zoho.js';
import userRoutes from './routes/users.js';
import driverRoutes from './routes/driver.js';
import rateCardRoutes from './routes/rateCard.js';
import wasenderWebhook from './routes/wasenderWebhook.js';
import jobsRoutes from './routes/jobs.js';


dotenv.config();
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(morgan('dev'));

// routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/zoho', zohoRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/rate-card', rateCardRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/webhooks/wasender', express.json({ type: '*/*' }), wasenderWebhook);


// ✅ Create HTTP server for Express
const apiServer = http.createServer(app);

connectDB()
  .then(() => {
    const PORT = process.env.PORT || 9897;

    apiServer.listen(PORT, () =>
      console.log(`✅ API running on port ${PORT}`)
    );

    // ✅ start socket on separate port
    import('./services/socketService.js').then(({ startSocketServer }) => {
      startSocketServer(); // runs socket on SOCKET_PORT (7989)
    });
  })
  .catch((err) => {
    console.error('❌ DB connect error', err);
  });
