import express, { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';
import { config } from './config.js';
import { claimRouter } from './routes/claim.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { ipRateLimit } from './middlewares/rateLimit.js';
import { register, collectDefaultMetrics, Gauge } from 'prom-client';
import { getChainId } from './services/txSender.js';
import { getStatus } from './services/statusService.js';

const logger = pino();

if (config.enableMetrics) {
  collectDefaultMetrics();
}

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});
app.use(express.json());
app.use(ipRateLimit);

app.use('/claim', claimRouter);

app.get('/healthz', async (_req: Request, res: Response) => {
  try {
    const chainId = await getChainId();
    res.json({ status: 'ok', chainId });
  } catch (e: any) {
    res.status(500).json({ status: 'error', error: e?.message });
  }
});

app.get('/api/status', async (_req: Request, res: Response) => {
  try {
    const status = await getStatus();
    res.json(status);
  } catch (e: any) {
    res.status(500).json({ error: e?.message });
  }
});

if (config.enableMetrics) {
  app.get('/metrics', async (_req: Request, res: Response) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
}

app.use(errorHandler);

app.listen(config.port, () => {
  logger.info({ port: config.port }, 'faucet server started');
});
