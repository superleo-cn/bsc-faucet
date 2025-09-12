import { createWalletClient, http, encodeFunctionData, createPublicClient, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bscTestnet, bsc } from 'viem/chains';
import { config } from '../config.js';

// Dynamic chain selection (simple switch for now)
const chain = config.chainId === 56 ? bsc : bscTestnet;

// Create a viem Account object from private key (strongly typed)
export const account = privateKeyToAccount(config.privateKey);

const walletClient = createWalletClient({
  chain,
  transport: http(config.rpcUrl),
  account
});

export const publicClient = createPublicClient({
  chain,
  transport: http(config.rpcUrl)
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

let tokenDecimalsCache: number | null = null;
let tokenSymbolCache: string | null = null;

async function ensureTokenMetadata(address: Address) {
  if (tokenDecimalsCache !== null) return { decimals: tokenDecimalsCache, symbol: tokenSymbolCache };
  const code = await publicClient.getCode({ address });
  if (code === '0x') {
    throw new Error('token_contract_not_found');
  }
  try {
    const [decimals, symbol] = await Promise.all([
      publicClient.readContract({ address, abi: erc20MetaAbi as any, functionName: 'decimals' }) as Promise<number>,
      publicClient.readContract({ address, abi: erc20MetaAbi as any, functionName: 'symbol' }) as Promise<string>
    ]);
    tokenDecimalsCache = decimals;
    tokenSymbolCache = symbol;
  } catch (e) {
    // fallback to config value
    tokenDecimalsCache = config.tokenDecimals;
  }
  return { decimals: tokenDecimalsCache!, symbol: tokenSymbolCache };
}

export async function sendTokens(to: Address, amount: bigint): Promise<string> {
  // Verify chain id matches expectation (helpful debug)
  try {
    const currentChainId = await publicClient.getChainId();
    if (currentChainId !== config.chainId) {
      console.warn(`ChainId mismatch: config=${config.chainId} node=${currentChainId}`);
    }
  } catch {/* ignore */}

  if (config.tokenContract) {
    const tokenAddr = config.tokenContract as Address;
    const { decimals } = await ensureTokenMetadata(tokenAddr);
    // If config.claimAmount was computed with a different decimals than on-chain, adjust.
    let onChainAmount = amount;
    if (decimals !== config.tokenDecimals) {
      // Recalculate using human tokens base.
      onChainAmount = BigInt(Math.trunc(config.claimAmountTokens * 10 ** decimals));
    }
    const data = encodeFunctionData({
      abi: erc20TransferAbi as any,
      functionName: 'transfer',
      args: [to, onChainAmount]
    });
    // Simulate for clearer revert reasons
    try {
      const gasPrice = await publicClient.getGasPrice();
      const gas = await publicClient.estimateGas({ account, to: tokenAddr, data });
      const hash = await walletClient.sendTransaction({
        account,
        to: tokenAddr,
        data,
        value: 0n,
        gas,
        gasPrice,
        type: 'legacy'
      });
      return hash;
    } catch (e: any) {
      console.error('erc20_send_failed', { error: e?.message });
      throw e;
    }
  } else {
    // Native transfer
    const gasPrice = await publicClient.getGasPrice();
    const hash = await walletClient.sendTransaction({
      account,
      to,
      value: amount,
      gasPrice,
      type: 'legacy'
    });
    return hash;
  }
}

export async function getChainId(): Promise<number> {
  return publicClient.getChainId();
}
