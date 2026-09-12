import { roomManager } from '../services/roomManager.js';

export const createRoomHandler = (req, res) => {
  const { userId, username } = req.body;
  if (!userId || !username) {
    return res.status(400).json({ error: 'User identifier and name required.' });
  }
  const data = roomManager.createRoom(userId, username);
  res.status(201).json(data);
};

export const verifyRoomHandler = (req, res) => {
  const { roomId } = req.params;
  if (!roomManager.hasRoom(roomId)) {
    return res.status(404).json({ error: 'Room does not exist or has expired.' });
  }
  res.status(200).json({ valid: true });
};