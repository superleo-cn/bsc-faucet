import initSqlJs, { Database } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath);

const dbFilePath = path.join(dbPath, 'faucet.db');

let db: Database;

// Initialize database
const SQL = await initSqlJs();
if (fs.existsSync(dbFilePath)) {
  const buffer = fs.readFileSync(dbFilePath);
  db = new SQL.Database(buffer);
} else {
  db = new SQL.Database();
}

// Auto-save database to file
function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbFilePath, buffer);
}

// Migration: Add chain column if it doesn't exist
const checkChainColumn = db.exec(`PRAGMA table_info(claims)`);
const hasChainColumn = checkChainColumn[0]?.values.some((row: any) => row[1] === 'chain');

if (checkChainColumn[0] && !hasChainColumn) {
  console.log('Migrating database: adding chain column...');
  db.run(`ALTER TABLE claims ADD COLUMN chain TEXT NOT NULL DEFAULT 'bsc'`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_claims_address_chain ON claims(address, chain)`);
  saveDatabase();
  console.log('Database migration completed');
}

db.run(`CREATE TABLE IF NOT EXISTS claims (
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
)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_claims_address_chain ON claims(address, chain)`);
db.run(`CREATE INDEX IF NOT EXISTS idx_claims_next_allowed ON claims(next_allowed_at)`);
saveDatabase();

export { db };

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
  stmt.bind([address, chain]);
  if (stmt.step()) {
    const row = stmt.getAsObject() as unknown as ClaimRow;
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

export function insertClaim(record: Omit<ClaimRow, 'id'>): number {
  const stmt = db.prepare(`INSERT INTO claims(address, chain, tx_hash, amount, claimed_at, next_allowed_at, status, failure_reason, ip) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  stmt.run([record.address, record.chain, record.tx_hash, record.amount, record.claimed_at, record.next_allowed_at, record.status, record.failure_reason ?? null, record.ip ?? null]);
  stmt.free();
  saveDatabase();
  
  // Get last insert rowid
  const lastIdStmt = db.prepare(`SELECT last_insert_rowid() as id`);
  lastIdStmt.step();
  const result = lastIdStmt.getAsObject() as { id: number };
  lastIdStmt.free();
  return result.id;
}
