import { NextFunction, Request, Response } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err?.message === 'invalid_address') {
    return res.status(400).json({ error: 'invalid_address' });
  }
  if (typeof err?.message === 'string') {
    if (err.message.startsWith('solana_faucet_insufficient_sol_for_token_account')) {
      const [, amount] = err.message.split(':');
      return res.status(400).json({ error: 'solana_faucet_insufficient_sol', neededSol: amount ? Number(amount) : undefined });
    }
    if (err.message === 'solana_associated_account_failed') {
      return res.status(500).json({ error: 'solana_associated_account_failed' });
    }
  }
  if (process.env.NODE_ENV !== 'production') {
    console.error(err);
  }
  res.status(500).json({ error: 'internal' });
}
