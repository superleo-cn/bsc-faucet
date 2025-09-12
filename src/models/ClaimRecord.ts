export interface ClaimRecord {
  address: string;
  txHash: string;
  amount: bigint;
  claimedAt: Date;
  nextAllowedAt: Date;
  status: 'SUCCESS' | 'FAILED';
  failureReason?: string;
  ip?: string;
}
