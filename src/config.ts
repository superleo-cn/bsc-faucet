import 'dotenv/config';

export interface ChainConfig {
  privateKey: `0x${string}`;
  rpcUrl: string;
  tokenContract?: `0x${string}` | '';
  claimAmount: bigint; // raw on-chain units
  claimAmountTokens: number; // human friendly amount
  tokenDecimals: number; // decimals for token or native (default 18)
  cooldownHours: number;
  chainId: number;
}

export interface AppConfig {
  port: number;
  rateLimitPerIp: number;
  enableMetrics: boolean;
  bsc: ChainConfig;
  socchain: ChainConfig;
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

// BSC Chain Configuration
const bscTokenDecimals = envInt('BSC_TOKEN_DECIMALS', 18);
const bscClaimAmountTokens = envNumber('BSC_CLAIM_AMOUNT_TOKENS', 100);

// SOCCHAIN Configuration  
const socchainTokenDecimals = envInt('SOCCHAIN_TOKEN_DECIMALS', 18);
const socchainClaimAmountTokens = envNumber('SOCCHAIN_CLAIM_AMOUNT_TOKENS', 100);

export const config: AppConfig = {
  port: envInt('PORT', 8080),
  rateLimitPerIp: envInt('RATE_LIMIT_IP', 30),
  enableMetrics: (process.env.ENABLE_METRICS || 'true') === 'true',
  bsc: {
    privateKey: process.env.BSC_PRIVATE_KEY as `0x${string}`,
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-testnet.bnbchain.org',
    tokenContract: process.env.BSC_TOKEN_CONTRACT as `0x${string}` | undefined,
    claimAmount: BigInt(Math.trunc(bscClaimAmountTokens * 10 ** bscTokenDecimals)),
    claimAmountTokens: bscClaimAmountTokens,
    tokenDecimals: bscTokenDecimals,
    cooldownHours: envInt('BSC_COOLDOWN_HOURS', 24),
    chainId: envInt('BSC_CHAIN_ID', 97)
  },
  socchain: {
    privateKey: process.env.SOCCHAIN_PRIVATE_KEY as `0x${string}`,
    rpcUrl: process.env.SOCCHAIN_RPC_URL || 'http://localhost:8545', // 需要用户提供SOCCHAIN的RPC地址
    tokenContract: process.env.SOCCHAIN_TOKEN_CONTRACT as `0x${string}` | undefined,
    claimAmount: BigInt(Math.trunc(socchainClaimAmountTokens * 10 ** socchainTokenDecimals)),
    claimAmountTokens: socchainClaimAmountTokens,
    tokenDecimals: socchainTokenDecimals,
    cooldownHours: envInt('SOCCHAIN_COOLDOWN_HOURS', 24),
    chainId: envInt('SOCCHAIN_CHAIN_ID', 1001) // 需要用户提供SOCCHAIN的链ID
  }
};

if (!config.bsc.privateKey) {
  throw new Error('BSC_PRIVATE_KEY required');
}

if (!config.socchain.privateKey) {
  throw new Error('SOCCHAIN_PRIVATE_KEY required');
}
