import { Router, Request, Response, NextFunction } from 'express';
import { claimSolana } from '../services/claimService.js';
import { config } from '../config.js';
import { getSolanaTokenDecimals } from '../services/solanaTxSender.js';

export const solanaClaimRouter = Router();

solanaClaimRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.body || {};
    const result = await claimSolana(address, req.ip);
    if (result.status === 'cooldown') {
      return res.status(429).json({
        error: 'cooldown',
        remainingMs: result.remainingMs
      });
    }
    const decimals = await getSolanaTokenDecimals();
    return res.status(201).json({
      address: result.record!.address,
      amount: result.record!.amount.toString(),
      amountTokens: config.solana.claimAmountTokens,
      decimals: decimals ?? config.solana.tokenDecimals,
      txHash: result.record!.txHash
    });
  } catch (e) {
    next(e);
  }
});
