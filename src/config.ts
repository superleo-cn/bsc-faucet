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

export interface BridgeConfig {
  bsc: {
    chainId: number;
    rpcUrls: string[];
    bridge: `0x${string}`;
    usdt: `0x${string}`;
  };
  socchain: {
    chainId: number;
    rpcUrl: string;
    bridge: `0x${string}`;
  };
}

export interface AppConfig {
  port: number;
  rateLimitPerIp: number;
  enableMetrics: boolean;
  bsc: ChainConfig;
  socchain: ChainConfig;
  bridge: BridgeConfig;
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
    chainId: envInt('SOCCHAIN_CHAIN_ID', 1111111) // 需要用户提供SOCCHAIN的链ID
  },
  bridge: {
    bsc: {
      chainId: envInt('BRIDGE_BSC_CHAIN_ID', 56), // BSC 主网
      rpcUrls: [
        process.env.BRIDGE_BSC_RPC_URL || 'https://binance.llamarpc.com/',
        'https://rpc.ankr.com/bsc',
        'https://bsc.blockpi.network/v1/rpc/public',
        'https://bsc.rpc.blxrbdn.com'
      ],
      bridge: process.env.BRIDGE_BSC_CONTRACT as `0x${string}` || '0xd14313064e3f5D3ECAb79BB387c6F4cc66Ef4f86',
      usdt: process.env.BRIDGE_BSC_USDT_CONTRACT as `0x${string}` || '0xDDF4b7938B4379301690fc2C7DC898B9084a4826'
    },
    socchain: {
      chainId: envInt('BRIDGE_SOCCHAIN_CHAIN_ID', 1111111), // SOCCHAIN ID
      rpcUrl: process.env.BRIDGE_SOCCHAIN_RPC_URL || 'https://rpc-testnet.socrateschain.org',
      bridge: process.env.BRIDGE_SOCCHAIN_CONTRACT as `0x${string}` || '0xd14313064e3f5D3ECAb79BB387c6F4cc66Ef4f86'
    }
  }
};

if (!config.bsc.privateKey) {
  throw new Error('BSC_PRIVATE_KEY required');
}

if (!config.socchain.privateKey) {
  throw new Error('SOCCHAIN_PRIVATE_KEY required');
}
