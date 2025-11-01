import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

const app = express();
app.use(cors({ origin: ['http://localhost:3000'], credentials: true }));
app.use(express.json());

let isReady = false;

app.get('/health', (req, res) => {
  const uptime = process.uptime();
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    version: 'lite-1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: { database: { connected: false, error: 'lite-mode: no DB' } },
    system: {
      platform: process.platform,
      nodeVersion: process.version,
    },
    responseTime: 0,
  });
});

app.get('/ready', (req, res) => {
  const deferDbInit = process.env.DEFER_DB_INIT === 'true';
  const status = {
    status: isReady ? 'READY' : 'STARTING',
    initialized: true,
    ready: isReady,
    deferredDbInit: deferDbInit,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  };
  res.status(isReady ? 200 : 503).json(status);
});

app.get('/', (req, res) => {
  res.json({ success: true, message: 'CLMS Lite API running', version: 'lite-1.0.0' });
});

const port = parseInt(process.env.PORT || '3001', 10);
const server = createServer(app);
server.listen(port, () => {
  isReady = true;
  console.log(`CLMS Lite backend listening on http://localhost:${port}`);
});