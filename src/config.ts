import 'dotenv/config';

export interface AppConfig {
  privateKey: `0x${string}`;
  rpcUrl: string;
  tokenContract?: `0x${string}` | '';
  claimAmount: bigint; // raw on-chain units
  claimAmountTokens: number; // human friendly amount
  tokenDecimals: number; // decimals for token or native (default 18)
  cooldownHours: number;
  port: number;
  rateLimitPerIp: number;
  enableMetrics: boolean;
  chainId: number; // BSC Testnet = 97, Mainnet = 56
}

function envInt(name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`Env ${name} must be integer`);
  return n;
}

function envBigInt(name: string, def: bigint): bigint {
  const v = process.env[name];
  if (!v) return def;
  try { return BigInt(v); } catch { throw new Error(`Env ${name} must be bigint`); }
}

function envNumber(name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Env ${name} must be number`);
  return n;
}

const tokenDecimals = envInt('TOKEN_DECIMALS', 18);
const claimAmountTokens = envNumber('CLAIM_AMOUNT_TOKENS', 100);

export const config: AppConfig = {
  privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  rpcUrl: process.env.RPC_URL || 'https://bsc-testnet.bnbchain.org',
  tokenContract: process.env.TOKEN_CONTRACT as `0x${string}` | undefined,
  claimAmount: BigInt(Math.trunc(claimAmountTokens * 10 ** tokenDecimals)),
  claimAmountTokens,
  tokenDecimals,
  cooldownHours: envInt('COOLDOWN_HOURS', 24),
  port: envInt('PORT', 8080),
  rateLimitPerIp: envInt('RATE_LIMIT_IP', 30),
  enableMetrics: (process.env.ENABLE_METRICS || 'true') === 'true',
  chainId: envInt('CHAIN_ID', 97)
};

if (!config.privateKey) {
  throw new Error('PRIVATE_KEY required');
}
