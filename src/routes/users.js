import express from 'express';
import { findNearestUsers } from '../controllers/userController.js';


const router = express.Router();

// Route to find nearest users
router.get('/nearest', findNearestUsers);

export default router;
