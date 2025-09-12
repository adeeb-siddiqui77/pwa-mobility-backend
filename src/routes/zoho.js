import express from 'express';
import { getTickets, getMechanicTickets, updateTicketinMongo, createTicket, updateTicket } from '../controllers/zohoController.js';
// import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Route to get tickets (protected by authentication)
router.get('/tickets', getTickets);

// Route to get tickets (protected by authentication)
router.get('/tickets/mechanic/:id', getMechanicTickets);

// Route to create a new ticket (protected by authentication)
router.post('/tickets', createTicket);

// Route to update an existing ticket (protected by authentication)
router.patch('/tickets/:ticketId', updateTicket);
router.patch('/tickets/update/:ticketId', updateTicketinMongo);



export default router;