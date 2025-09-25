import { createWalletClient, http, encodeFunctionData, createPublicClient, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem/utils';
import { config } from '../config.js';

// 定义SOCCHAIN
const socchain = defineChain({
  id: config.socchain.chainId,
  name: 'SOCCHAIN',
  nativeCurrency: {
    decimals: 18,
    name: 'SOC',
    symbol: 'SOC',
  },
  rpcUrls: {
    default: {
      http: [config.socchain.rpcUrl],
    },
  },
  blockExplorers: {
    default: { name: 'SOCCHAIN Explorer', url: 'https://explorer.socchain.com' },
  },
});

// Create a viem Account object from private key (strongly typed)
export const socchainAccount = privateKeyToAccount(config.socchain.privateKey);

const socchainWalletClient = createWalletClient({
  chain: socchain,
  transport: http(config.socchain.rpcUrl),
  account: socchainAccount
});

export const socchainPublicClient = createPublicClient({
  chain: socchain,
  transport: http(config.socchain.rpcUrl)
});

const erc20TransferAbi = [{
  "type": "function",
  "name": "transfer",
  "stateMutability": "nonpayable",
  "inputs": [
    {"name": "to", "type": "address"},
    {"name": "amount", "type": "uint256"}
  ],
  "outputs": [{"name": "success", "type": "bool"}]
}];

const erc20MetaAbi = [
  { "type": "function", "name": "decimals", "stateMutability": "view", "inputs": [], "outputs": [{"type": "uint8"}] },
  { "type": "function", "name": "symbol", "stateMutability": "view", "inputs": [], "outputs": [{"type": "string"}] },
  { "type": "function", "name": "balanceOf", "stateMutability": "view", "inputs": [{"name":"owner","type":"address"}], "outputs": [{"type":"uint256"}] }
];

let socchainTokenDecimalsCache: number | null = null;
let socchainTokenSymbolCache: string | null = null;

async function ensureSocchainTokenMetadata(address: Address) {
  if (socchainTokenDecimalsCache !== null) return { decimals: socchainTokenDecimalsCache, symbol: socchainTokenSymbolCache };
  const code = await socchainPublicClient.getCode({ address });
  if (code === '0x') {
    throw new Error('token_contract_not_found');
  }
  try {
    const [decimals, symbol] = await Promise.all([
      socchainPublicClient.readContract({
        address,
        abi: erc20MetaAbi,
        functionName: 'decimals',
        args: []
      }),
      socchainPublicClient.readContract({
        address,
        abi: erc20MetaAbi,
        functionName: 'symbol',
        args: []
      })
    ]);
    socchainTokenDecimalsCache = decimals as number;
    socchainTokenSymbolCache = symbol as string;
    return { decimals, symbol };
  } catch (e) {
    console.warn('Failed to read token metadata, assuming defaults:', e);
    return { decimals: 18, symbol: 'SOCTOKEN' };
  }
}

export async function sendTokensSocchain(to: Address, amount: bigint): Promise<`0x${string}`> {
  if (config.socchain.tokenContract) {
    // ERC20 token transfer
    await ensureSocchainTokenMetadata(config.socchain.tokenContract);
    const data = encodeFunctionData({
      abi: erc20TransferAbi,
      functionName: 'transfer',
      args: [to, amount]
    });
    const txHash = await socchainWalletClient.sendTransaction({
      to: config.socchain.tokenContract,
      data
    });
    return txHash;
  } else {
    // Native token transfer
    const txHash = await socchainWalletClient.sendTransaction({
      to,
      value: amount
    });
    return txHash;
  }
}

export async function getChainIdSocchain(): Promise<number> {
  return socchainPublicClient.getChainId();
}

export async function getSocchainNativeBalance(address?: Address): Promise<bigint> {
  const addr = address || socchainAccount.address;
  return socchainPublicClient.getBalance({ address: addr });
}

export async function getSocchainTokenBalance(contractAddr: Address, holderAddr?: Address): Promise<bigint> {
  const addr = holderAddr || socchainAccount.address;
  return socchainPublicClient.readContract({
    address: contractAddr,
    abi: erc20MetaAbi,
    functionName: 'balanceOf',
    args: [addr]
  }) as Promise<bigint>;
}