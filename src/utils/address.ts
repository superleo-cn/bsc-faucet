import { PublicKey } from '@solana/web3.js';

export function normalizeAddress(addr: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) throw new Error('invalid_address');
  return addr.toLowerCase();
}

export function normalizeSolanaAddress(addr: string): string {
  try {
    return new PublicKey(addr).toBase58();
  } catch {
    throw new Error('invalid_address');
  }
}
