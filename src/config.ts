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
  eth: ChainConfig;
}

function envInt(name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`Env ${name} must be integer`);
  return n;
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
const ethTokenDecimals = envInt('ETH_TOKEN_DECIMALS', 18);
const ethClaimAmountTokens = envNumber('ETH_CLAIM_AMOUNT_TOKENS', 0.01);

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
  eth: {
    privateKey: process.env.ETH_PRIVATE_KEY as `0x${string}`,
    rpcUrl: process.env.ETH_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_KEY',
    tokenContract: process.env.ETH_TOKEN_CONTRACT as `0x${string}` | undefined,
    claimAmount: BigInt(Math.trunc(ethClaimAmountTokens * 10 ** ethTokenDecimals)),
    claimAmountTokens: ethClaimAmountTokens,
    tokenDecimals: ethTokenDecimals,
    cooldownHours: envInt('ETH_COOLDOWN_HOURS', 24),
    chainId: envInt('ETH_CHAIN_ID', 1)
  }
};

if (!config.bsc.privateKey) {
  throw new Error('BSC_PRIVATE_KEY required');
}

if (!config.eth.privateKey) {
  throw new Error('ETH_PRIVATE_KEY required');
}

