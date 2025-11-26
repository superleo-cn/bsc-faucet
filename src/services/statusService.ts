import { publicClient, account } from './txSender.js';
import { ethPublicClient, ethAccount } from './ethTxSender.js';
import { getSolanaNativeBalance, getSolanaTokenBalance, solanaKeypair, getSolanaTokenDecimals } from './solanaTxSender.js';
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

export async function getEthStatus() {
  const [chainId, nativeBalance] = await Promise.all([
    ethPublicClient.getChainId(),
    ethPublicClient.getBalance({ address: ethAccount.address })
  ]);

  let tokenBalance: bigint | null = null;
  let tokenDecimals: number | null = null;
  if (config.eth.tokenContract) {
    try {
      [tokenBalance, tokenDecimals] = await Promise.all([
        ethPublicClient.readContract({ address: config.eth.tokenContract as Address, abi: erc20BalanceOf as any, functionName: 'balanceOf', args: [ethAccount.address] }) as Promise<bigint>,
        ethPublicClient.readContract({ address: config.eth.tokenContract as Address, abi: erc20Decimals as any, functionName: 'decimals', args: [] }) as Promise<number>
      ]);
    } catch (e) {
      // ignore, maybe contract not found
    }
  }

  return {
    chainId,
    faucetAddress: ethAccount.address,
    nativeBalance: nativeBalance.toString(),
    token: config.eth.tokenContract ? {
      address: config.eth.tokenContract,
      balance: tokenBalance?.toString() || null,
      decimals: tokenDecimals ?? config.eth.tokenDecimals
    } : null
  };
}

export async function getSolanaStatus() {
  const [nativeBalance] = await Promise.all([
    getSolanaNativeBalance()
  ]);

  let tokenBalance: bigint | null = null;
  let tokenDecimals: number | null = null;
  if (config.solana.tokenMint) {
    [tokenBalance, tokenDecimals] = await Promise.all([
      getSolanaTokenBalance(config.solana.tokenMint, solanaKeypair.publicKey.toBase58()),
      getSolanaTokenDecimals()
    ]);
  }

  return {
    faucetAddress: solanaKeypair.publicKey.toBase58(),
    nativeBalance: nativeBalance.toString(),
    token: config.solana.tokenMint ? {
      address: config.solana.tokenMint,
      balance: tokenBalance?.toString() || null,
      decimals: tokenDecimals ?? config.solana.tokenDecimals
    } : null
  };
}

