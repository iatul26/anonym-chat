import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import roomRoutes from './routes/roomRoutes.js';
import { handleSocketConnection } from './controllers/socketController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// API routes
app.use('/api', roomRoutes);

// Serve static frontend build from client/dist
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

// SPA fallback: Route all non-API requests to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => handleSocketConnection(ws, req));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Privacy-first chat server running on port ${PORT}`));