import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

export const ipRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: config.rateLimitPerIp,
  standardHeaders: true,
  legacyHeaders: false
});
