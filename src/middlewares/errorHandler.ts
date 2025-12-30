import { NextFunction, Request, Response } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const errorMsg = err?.message || '';
  
  // Invalid address
  if (errorMsg === 'invalid_address') {
    return res.status(400).json({ error: 'invalid_address' });
  }
  
  // Solana-specific errors
  if (errorMsg.startsWith('solana_faucet_insufficient_sol_for_token_account')) {
    const [, amount] = errorMsg.split(':');
    return res.status(400).json({ 
      error: 'solana_faucet_insufficient_sol', 
      neededSol: amount ? Number(amount) : undefined 
    });
  }
  
  if (errorMsg === 'solana_associated_account_failed') {
    return res.status(500).json({ error: 'solana_associated_account_failed' });
  }
  
  // Insufficient gas/balance errors - detect from viem/RPC errors
  if (typeof errorMsg === 'string') {
    const lowerMsg = errorMsg.toLowerCase();
    
    // Common insufficient balance/gas patterns
    if (lowerMsg.includes('insufficient balance') || 
        lowerMsg.includes('insufficient funds') ||
        lowerMsg.includes('insufficient gas') ||
        lowerMsg.includes('out of gas') ||
        lowerMsg.includes('intrinsic gas too low')) {
      return res.status(400).json({ error: 'insufficient_gas' });
    }
    
    // ERC20 specific errors
    if (lowerMsg.includes('exceeds balance') ||
        lowerMsg.includes('transfer amount exceeds balance')) {
      return res.status(400).json({ error: 'insufficient_balance' });
    }
  }
  
  if (process.env.NODE_ENV !== 'production') {
    console.error('Unhandled error:', err);
  }
  
  res.status(500).json({ error: 'internal' });
}

