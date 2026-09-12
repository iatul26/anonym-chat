import { Router } from 'express';
import { createRoomHandler, verifyRoomHandler } from '../controllers/roomController.js';

const router = Router();

router.post('/rooms', createRoomHandler);
router.get('/rooms/:roomId/verify', verifyRoomHandler);

export default router;