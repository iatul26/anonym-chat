import { roomManager } from '../services/roomManager.js';

export const createRoomHandler = (req, res) => {
  const data = roomManager.createRoom();
  res.status(201).json(data);
};

export const verifyRoomHandler = (req, res) => {
  const { roomId } = req.params;
  if (!roomManager.hasRoom(roomId)) {
    return res.status(404).json({ error: 'Room does not exist or has expired.' });
  }
  res.status(200).json({ valid: true });
};