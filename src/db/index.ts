import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath);

export const db = new Database(path.join(dbPath, 'faucet.db'));

db.pragma('journal_mode = WAL');

db.exec(`CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  amount TEXT NOT NULL,
  claimed_at INTEGER NOT NULL,
  next_allowed_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  failure_reason TEXT,
  ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_claims_address ON claims(address);
CREATE INDEX IF NOT EXISTS idx_claims_next_allowed ON claims(next_allowed_at);
`);

export interface ClaimRow {
  id: number;
  address: string;
  tx_hash: string;
  amount: string;
  claimed_at: number;
  next_allowed_at: number;
  status: string;
  failure_reason?: string | null;
  ip?: string | null;
}

export function getLastSuccess(address: string): ClaimRow | undefined {
  const stmt = db.prepare(`SELECT * FROM claims WHERE address = ? AND status = 'SUCCESS' ORDER BY claimed_at DESC LIMIT 1`);
  return stmt.get(address) as ClaimRow | undefined;
}

export function insertClaim(record: Omit<ClaimRow, 'id'>): number {
  const stmt = db.prepare(`INSERT INTO claims(address, tx_hash, amount, claimed_at, next_allowed_at, status, failure_reason, ip) VALUES(@address,@tx_hash,@amount,@claimed_at,@next_allowed_at,@status,@failure_reason,@ip)`);
  const info = stmt.run(record);
  return info.lastInsertRowid as number;
}
