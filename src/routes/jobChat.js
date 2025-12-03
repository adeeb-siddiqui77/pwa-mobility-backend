import express from 'express';
import multer from 'multer';
import { getSession, postMessage, patchSession } from '../controllers/jobChatController.js';
const upload = multer({ dest: '/tmp/uploads' }); // or your multer S3 storage

const router = express.Router();
router.get('/:ticketId/', getSession);
router.post('/:ticketId/message', upload.single('file'), postMessage);
router.patch('/:ticketId', patchSession);

export default router;
