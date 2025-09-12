import { getLastSuccess, insertClaim } from '../db/index.js';
import { normalizeAddress } from '../utils/address.js';
import { now, hours } from '../utils/time.js';
import { config } from '../config.js';
import { sendTokens } from './txSender.js';
import type { ClaimRecord } from '../models/ClaimRecord.js';

interface ClaimResult {
  status: 'cooldown' | 'success';
  record?: ClaimRecord;
  remainingMs?: number;
}

const inFlight = new Map<string, Promise<ClaimResult>>();

export async function claim(addressRaw: string, ip?: string): Promise<ClaimResult> {
  const addr = normalizeAddress(addressRaw);
  if (inFlight.has(addr)) return inFlight.get(addr)!; // de-dupe concurrent
  const p = doClaim(addr, ip).finally(() => { inFlight.delete(addr); });
  inFlight.set(addr, p);
  return p;
}

async function doClaim(address: string, ip?: string): Promise<ClaimResult> {
  const last = getLastSuccess(address);
  const nowTs = now();
  if (last && last.next_allowed_at > nowTs) {
    return { status: 'cooldown', remainingMs: last.next_allowed_at - nowTs };
  }
  const nextAllowed = nowTs + hours(config.cooldownHours);
  try {
    const txHash = await sendTokens(address as any, config.claimAmount);
    insertClaim({
      address,
      tx_hash: txHash,
      amount: config.claimAmount.toString(),
      claimed_at: nowTs,
      next_allowed_at: nextAllowed,
      status: 'SUCCESS',
      failure_reason: null,
      ip: ip || null
    });
    const record: ClaimRecord = {
      address,
      txHash,
      amount: config.claimAmount,
      claimedAt: new Date(nowTs),
      nextAllowedAt: new Date(nextAllowed),
      status: 'SUCCESS',
      ip
    };
    return { status: 'success', record };
  } catch (e: any) {
    insertClaim({
      address,
      tx_hash: '0x0',
      amount: config.claimAmount.toString(),
      claimed_at: nowTs,
      next_allowed_at: nextAllowed,
      status: 'FAILED',
      failure_reason: e?.message?.slice(0, 200) || 'error',
      ip: ip || null
    });
    throw e;
  }
}
