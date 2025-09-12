import { publicClient, account } from './txSender.js';
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
  if (config.tokenContract) {
    try {
      [tokenBalance, tokenDecimals] = await Promise.all([
        publicClient.readContract({ address: config.tokenContract as Address, abi: erc20BalanceOf as any, functionName: 'balanceOf', args: [account.address] }) as Promise<bigint>,
        publicClient.readContract({ address: config.tokenContract as Address, abi: erc20Decimals as any, functionName: 'decimals' }) as Promise<number>
      ]);
    } catch (e) {
      // ignore, maybe contract not found
    }
  }

  return {
    chainId,
    faucetAddress: account.address,
    nativeBalance: nativeBalance.toString(),
    token: config.tokenContract ? {
      address: config.tokenContract,
      balance: tokenBalance?.toString() || null,
      decimals: tokenDecimals ?? config.tokenDecimals
    } : null
  };
}
