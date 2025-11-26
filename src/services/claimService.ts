import { getLastSuccess, insertClaim } from '../db/index.js';
import { normalizeAddress, normalizeSolanaAddress } from '../utils/address.js';
import { now, hours } from '../utils/time.js';
import { config, ChainConfig, SolanaConfig } from '../config.js';
import { sendTokens } from './txSender.js';
import { sendTokensEth } from './ethTxSender.js';
import { sendTokensSolana } from './solanaTxSender.js';
import type { ClaimRecord } from '../models/ClaimRecord.js';

interface ClaimResult {
  status: 'cooldown' | 'success';
  record?: ClaimRecord;
  remainingMs?: number;
}

const inFlightBsc = new Map<string, Promise<ClaimResult>>();
const inFlightEth = new Map<string, Promise<ClaimResult>>();
const inFlightSolana = new Map<string, Promise<ClaimResult>>();

export async function claim(addressRaw: string, ip?: string): Promise<ClaimResult> {
  const addr = normalizeAddress(addressRaw);
  if (inFlightBsc.has(addr)) return inFlightBsc.get(addr)!; // de-dupe concurrent
  const p = doClaim(addr, ip, config.bsc, 'bsc').finally(() => { inFlightBsc.delete(addr); });
  inFlightBsc.set(addr, p);
  return p;
}

export async function claimEth(addressRaw: string, ip?: string): Promise<ClaimResult> {
  const addr = normalizeAddress(addressRaw);
  if (inFlightEth.has(addr)) return inFlightEth.get(addr)!; // de-dupe concurrent
  const p = doClaim(addr, ip, config.eth, 'eth').finally(() => { inFlightEth.delete(addr); });
  inFlightEth.set(addr, p);
  return p;
}

export async function claimSolana(addressRaw: string, ip?: string): Promise<ClaimResult> {
  const addr = normalizeSolanaAddress(addressRaw);
  if (inFlightSolana.has(addr)) return inFlightSolana.get(addr)!;
  const p = doClaim(addr, ip, config.solana, 'solana').finally(() => { inFlightSolana.delete(addr); });
  inFlightSolana.set(addr, p);
  return p;
}

async function doClaim(address: string, ip: string | undefined, chainConfig: ChainConfig | SolanaConfig, chainType: 'bsc' | 'eth' | 'solana'): Promise<ClaimResult> {
  const last = getLastSuccess(address, chainType);
  const nowTs = now();
  if (last && last.next_allowed_at > nowTs) {
    return { status: 'cooldown', remainingMs: last.next_allowed_at - nowTs };
  }
  const nextAllowed = nowTs + hours(chainConfig.cooldownHours);
  try {
    let txHash: string;
    if (chainType === 'bsc') {
      txHash = await sendTokens(address as any, chainConfig.claimAmount);
    } else if (chainType === 'eth') {
      txHash = await sendTokensEth(address as any, chainConfig.claimAmount);
    } else {
      txHash = await sendTokensSolana(address, chainConfig.claimAmount);
    }
    insertClaim({
      address,
      chain: chainType,
      tx_hash: txHash,
      amount: chainConfig.claimAmount.toString(),
      claimed_at: nowTs,
      next_allowed_at: nextAllowed,
      status: 'SUCCESS',
      failure_reason: null,
      ip: ip || null
    });
    const record: ClaimRecord = {
      address,
      txHash,
      amount: chainConfig.claimAmount,
      claimedAt: new Date(nowTs),
      nextAllowedAt: new Date(nextAllowed),
      status: 'SUCCESS',
      ip
    };
    return { status: 'success', record };
  } catch (e: any) {
    insertClaim({
      address,
      chain: chainType,
      tx_hash: '0x0',
      amount: chainConfig.claimAmount.toString(),
      claimed_at: nowTs,
      next_allowed_at: nextAllowed,
      status: 'FAILED',
      failure_reason: e?.message?.slice(0, 200) || 'error',
      ip: ip || null
    });
    throw e;
  }
}
