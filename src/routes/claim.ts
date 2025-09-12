import { Router } from 'express';
import { claim } from '../services/claimService.js';

export const claimRouter = Router();

claimRouter.post('/', async (req, res, next) => {
  try {
    const { address } = req.body || {};
    const result = await claim(address, req.ip);
    if (result.status === 'cooldown') {
      return res.status(429).json({
        error: 'cooldown',
        remainingMs: result.remainingMs
      });
    }
    return res.status(201).json({
      address: result.record!.address,
      amount: result.record!.amount.toString(),
      txHash: result.record!.txHash
    });
  } catch (e) {
    next(e);
  }
});
