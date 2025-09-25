import { Router, Request, Response, NextFunction } from 'express';
import { claimSocchain } from '../services/claimService.js';
import { config } from '../config.js';

export const socchainClaimRouter = Router();

socchainClaimRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.body || {};
    const result = await claimSocchain(address, req.ip);
    if (result.status === 'cooldown') {
      return res.status(429).json({
        error: 'cooldown',
        remainingMs: result.remainingMs
      });
    }
    return res.status(201).json({
      address: result.record!.address,
      amount: result.record!.amount.toString(), // raw
      amountTokens: config.socchain.claimAmountTokens,
      decimals: config.socchain.tokenDecimals,
      txHash: result.record!.txHash
    });
  } catch (e) {
    next(e);
  }
});