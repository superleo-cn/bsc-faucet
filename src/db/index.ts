import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath);

export const db = new Database(path.join(dbPath, 'faucet.db'));

db.pragma('journal_mode = WAL');

// Migration: Add chain column if it doesn't exist
const checkChainColumn = db.prepare(`PRAGMA table_info(claims)`);
const columns = checkChainColumn.all() as Array<{name: string}>;
const hasChainColumn = columns.some(col => col.name === 'chain');

if (!hasChainColumn) {
  console.log('Migrating database: adding chain column...');
  db.exec(`ALTER TABLE claims ADD COLUMN chain TEXT NOT NULL DEFAULT 'bsc'`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_claims_address_chain ON claims(address, chain)`);
  console.log('Database migration completed');
}

db.exec(`CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'bsc',
  tx_hash TEXT NOT NULL,
  amount TEXT NOT NULL,
  claimed_at INTEGER NOT NULL,
  next_allowed_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  failure_reason TEXT,
  ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_claims_address_chain ON claims(address, chain);
CREATE INDEX IF NOT EXISTS idx_claims_next_allowed ON claims(next_allowed_at);
`);

export interface ClaimRow {
  id: number;
  address: string;
  chain: string;
  tx_hash: string;
  amount: string;
  claimed_at: number;
  next_allowed_at: number;
  status: string;
  failure_reason?: string | null;
  ip?: string | null;
}

export function getLastSuccess(address: string, chain: string = 'bsc'): ClaimRow | undefined {
  const stmt = db.prepare(`SELECT * FROM claims WHERE address = ? AND chain = ? AND status = 'SUCCESS' ORDER BY claimed_at DESC LIMIT 1`);
  return stmt.get(address, chain) as ClaimRow | undefined;
}

export function insertClaim(record: Omit<ClaimRow, 'id'>): number {
  const stmt = db.prepare(`INSERT INTO claims(address, chain, tx_hash, amount, claimed_at, next_allowed_at, status, failure_reason, ip) VALUES(@address, @chain, @tx_hash, @amount, @claimed_at, @next_allowed_at, @status, @failure_reason, @ip)`);
  const info = stmt.run(record);
  return info.lastInsertRowid as number;
}
