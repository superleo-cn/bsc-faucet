import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'node:buffer';

export function normalizeAddress(addr: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) throw new Error('invalid_address');
  return addr.toLowerCase();
}

export function normalizeSolanaAddress(addr: string): string {
  const trimmed = addr?.trim();
  if (!trimmed) {
    throw new Error('invalid_address');
  }
  try {
    return new PublicKey(trimmed).toBase58();
  } catch {
    try {
      const decoded = Buffer.from(trimmed, 'base64');
      if (decoded.length !== 32) throw new Error('invalid_length');
      return new PublicKey(decoded).toBase58();
    } catch {
      throw new Error('invalid_address');
    }
  }
}
