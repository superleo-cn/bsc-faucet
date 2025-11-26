import { createWalletClient, http, encodeFunctionData, createPublicClient, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia } from 'viem/chains';
import { defineChain } from 'viem/utils';
import { config } from '../config.js';

const baseChain = (() => {
  switch (config.eth.chainId) {
    case mainnet.id:
      return mainnet;
    case sepolia.id:
      return sepolia;
    default:
      return defineChain({
        id: config.eth.chainId,
        name: `Chain-${config.eth.chainId}`,
        nativeCurrency: {
          decimals: 18,
          name: 'ETH',
          symbol: 'ETH'
        },
        rpcUrls: {
          default: {
            http: [config.eth.rpcUrl]
          }
        }
      });
  }
})();

export const ethAccount = privateKeyToAccount(config.eth.privateKey);

const ethWalletClient = createWalletClient({
  chain: baseChain,
  transport: http(config.eth.rpcUrl),
  account: ethAccount
});

export const ethPublicClient = createPublicClient({
  chain: baseChain,
  transport: http(config.eth.rpcUrl)
});

const erc20TransferAbi = [{
  type: 'function',
  name: 'transfer',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' }
  ],
  outputs: [{ name: 'success', type: 'bool' }]
}];

const erc20MetaAbi = [
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] }
];

let ethTokenDecimalsCache: number | null = null;
let ethTokenSymbolCache: string | null = null;

async function ensureEthTokenMetadata(address: Address) {
  if (ethTokenDecimalsCache !== null) return { decimals: ethTokenDecimalsCache, symbol: ethTokenSymbolCache };
  const code = await ethPublicClient.getCode({ address });
  if (code === '0x') {
    throw new Error('token_contract_not_found');
  }
  try {
    const [decimals, symbol] = await Promise.all([
      ethPublicClient.readContract({ address, abi: erc20MetaAbi, functionName: 'decimals', args: [] }) as Promise<number>,
      ethPublicClient.readContract({ address, abi: erc20MetaAbi, functionName: 'symbol', args: [] }) as Promise<string>
    ]);
    ethTokenDecimalsCache = decimals;
    ethTokenSymbolCache = symbol;
  } catch (e) {
    ethTokenDecimalsCache = config.eth.tokenDecimals;
  }
  return { decimals: ethTokenDecimalsCache!, symbol: ethTokenSymbolCache };
}

export async function sendTokensEth(to: Address, amount: bigint): Promise<`0x${string}`> {
  if (config.eth.tokenContract) {
    const tokenAddr = config.eth.tokenContract as Address;
    const { decimals } = await ensureEthTokenMetadata(tokenAddr);
    let onChainAmount = amount;
    if (decimals !== config.eth.tokenDecimals) {
      onChainAmount = BigInt(Math.trunc(config.eth.claimAmountTokens * 10 ** decimals));
    }
    const data = encodeFunctionData({
      abi: erc20TransferAbi,
      functionName: 'transfer',
      args: [to, onChainAmount]
    });
    const gas = await ethPublicClient.estimateGas({ account: ethAccount, to: tokenAddr, data });
    const hash = await ethWalletClient.sendTransaction({
      account: ethAccount,
      to: tokenAddr,
      data,
      value: 0n,
      gas
    });
    return hash;
  }
  const hash = await ethWalletClient.sendTransaction({
    account: ethAccount,
    to,
    value: amount
  });
  return hash;
}

export async function getChainIdEth(): Promise<number> {
  return ethPublicClient.getChainId();
}

export async function getEthNativeBalance(address?: Address): Promise<bigint> {
  const target = address || ethAccount.address;
  return ethPublicClient.getBalance({ address: target });
}

export async function getEthTokenBalance(contractAddr: Address, holderAddr?: Address): Promise<bigint> {
  const target = holderAddr || ethAccount.address;
  return ethPublicClient.readContract({
    address: contractAddr,
    abi: erc20MetaAbi,
    functionName: 'balanceOf',
    args: [target]
  }) as Promise<bigint>;
}
