import { Router, Request, Response, NextFunction } from 'express';
import { claim } from '../services/claimService.js';
import { config } from '../config.js';

export const claimRouter = Router();

claimRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
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
      amount: result.record!.amount.toString(), // raw
      amountTokens: config.claimAmountTokens,
      decimals: config.tokenDecimals,
      txHash: result.record!.txHash
    });
  } catch (e) {
    next(e);
  }
});
