import express from 'express';
import { getTickets, getMechanicTickets, updateTicketinMongo, createTicket, updateTicket , getTicketById } from '../controllers/zohoController.js';
import { handleFraudCheck } from '../controllers/fraudContoller.js';
// import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Route to get tickets (protected by authentication)
router.get('/tickets', getTickets);
router.get('/ticket/:ticketId', getTicketById);

// Route to get tickets (protected by authentication)
router.get('/tickets/mechanic/:id', getMechanicTickets);

// Route to create a new ticket (protected by authentication)
router.post('/tickets', createTicket);

// Route to update an existing ticket (protected by authentication)
router.patch('/tickets/:ticketId', updateTicket);
// router.patch('/tickets/update/:ticketId', updateTicketinMongo);




// Route to update and existing ticket via a fraud detection rule

router.patch('/ticket/updateViaFraud' , handleFraudCheck)

// router.patch('/ticket/uploadAttachment' ,)






export default router;