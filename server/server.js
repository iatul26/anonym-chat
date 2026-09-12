import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import roomRoutes from './routes/roomRoutes.js';
import { handleSocketConnection } from './controllers/socketController.js';

const app = express();
app.use(express.json());

// API routes
app.use('/api', roomRoutes);

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', handleSocketConnection);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Privacy-first chat server running on port ${PORT}`));