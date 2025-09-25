import { publicClient, account } from './txSender.js';
import { socchainPublicClient, socchainAccount } from './socchainTxSender.js';
import { config } from '../config.js';
import { type Address } from 'viem';

const erc20BalanceOf = [{
  type: 'function',
  name: 'balanceOf',
  stateMutability: 'view',
  inputs: [{ name: 'owner', type: 'address' }],
  outputs: [{ type: 'uint256' }]
}];

const erc20Decimals = [{
  type: 'function',
  name: 'decimals',
  stateMutability: 'view',
  inputs: [],
  outputs: [{ type: 'uint8' }]
}];

export async function getStatus() {
  const [chainId, nativeBalance] = await Promise.all([
    publicClient.getChainId(),
    publicClient.getBalance({ address: account.address })
  ]);

  let tokenBalance: bigint | null = null;
  let tokenDecimals: number | null = null;
  if (config.bsc.tokenContract) {
    try {
      [tokenBalance, tokenDecimals] = await Promise.all([
        publicClient.readContract({ address: config.bsc.tokenContract as Address, abi: erc20BalanceOf as any, functionName: 'balanceOf', args: [account.address] }) as Promise<bigint>,
        publicClient.readContract({ address: config.bsc.tokenContract as Address, abi: erc20Decimals as any, functionName: 'decimals', args: [] }) as Promise<number>
      ]);
    } catch (e) {
      // ignore, maybe contract not found
    }
  }

  return {
    chainId,
    faucetAddress: account.address,
    nativeBalance: nativeBalance.toString(),
    token: config.bsc.tokenContract ? {
      address: config.bsc.tokenContract,
      balance: tokenBalance?.toString() || null,
      decimals: tokenDecimals ?? config.bsc.tokenDecimals
    } : null
  };
}

export async function getSocchainStatus() {
  const [chainId, nativeBalance] = await Promise.all([
    socchainPublicClient.getChainId(),
    socchainPublicClient.getBalance({ address: socchainAccount.address })
  ]);

  let tokenBalance: bigint | null = null;
  let tokenDecimals: number | null = null;
  if (config.socchain.tokenContract) {
    try {
      [tokenBalance, tokenDecimals] = await Promise.all([
        socchainPublicClient.readContract({ address: config.socchain.tokenContract as Address, abi: erc20BalanceOf as any, functionName: 'balanceOf', args: [socchainAccount.address] }) as Promise<bigint>,
        socchainPublicClient.readContract({ address: config.socchain.tokenContract as Address, abi: erc20Decimals as any, functionName: 'decimals', args: [] }) as Promise<number>
      ]);
    } catch (e) {
      // ignore, maybe contract not found
    }
  }

  return {
    chainId,
    faucetAddress: socchainAccount.address,
    nativeBalance: nativeBalance.toString(),
    token: config.socchain.tokenContract ? {
      address: config.socchain.tokenContract,
      balance: tokenBalance?.toString() || null,
      decimals: tokenDecimals ?? config.socchain.tokenDecimals
    } : null
  };
}
