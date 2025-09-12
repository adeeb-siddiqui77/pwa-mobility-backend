import express from 'express';
import { calculateWorkCost } from '../controllers/rateCardController.js';


const router = express.Router();

// Route to find nearest users
router.post('/get-services-cost', calculateWorkCost);

export default router;
