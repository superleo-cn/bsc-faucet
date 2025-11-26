import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
  getMint,
  AccountLayout
} from '@solana/spl-token';
import bs58 from 'bs58';
import { config } from '../config.js';

function parseSecretKey(secretKey: string): Uint8Array {
  const trimmed = secretKey.trim();
  if (!trimmed) {
    throw new Error('SOLANA_SECRET_KEY is empty');
  }
  if (trimmed.startsWith('[')) {
    const arr = JSON.parse(trimmed) as number[];
    return Uint8Array.from(arr);
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(trimmed)) {
    throw new Error('SOLANA_SECRET_KEY must be a base58 string or JSON array');
  }
  return bs58.decode(trimmed);
}

export const solanaConnection = new Connection(config.solana.rpcUrl, 'confirmed');
export const solanaKeypair = Keypair.fromSecretKey(parseSecretKey(config.solana.secretKey));

let tokenMintDecimalsCache: number | null = null;

async function safeGetOrCreateAta(mint: PublicKey, owner: PublicKey) {
  const ataAddress = await getAssociatedTokenAddress(mint, owner);
  const accountInfo = await solanaConnection.getAccountInfo(ataAddress, 'confirmed');
  if (accountInfo) {
    return await getOrCreateAssociatedTokenAccount(solanaConnection, solanaKeypair, mint, owner);
  }

  const rentLamports = await solanaConnection.getMinimumBalanceForRentExemption(AccountLayout.span);
  const feeBufferLamports = 10_000; // cover tx fee buffer (~0.00001 SOL)
  const faucetBalance = await solanaConnection.getBalance(solanaKeypair.publicKey, 'confirmed');

  if (faucetBalance < rentLamports + feeBufferLamports) {
    const neededSol = (Number(rentLamports + feeBufferLamports) / 1e9).toFixed(6);
    throw new Error(`solana_faucet_insufficient_sol_for_token_account:${neededSol}`);
  }

  try {
    return await getOrCreateAssociatedTokenAccount(solanaConnection, solanaKeypair, mint, owner);
  } catch (err: any) {
    console.error('solana_ata_setup_failed', {
      owner: owner.toBase58(),
      mint: mint.toBase58(),
      message: err?.message
    });
    throw new Error('solana_associated_account_failed');
  }
}

async function ensureTokenDecimals(mint: PublicKey): Promise<number> {
  if (tokenMintDecimalsCache !== null) return tokenMintDecimalsCache;
  const mintInfo = await getMint(solanaConnection, mint);
  tokenMintDecimalsCache = mintInfo.decimals;
  return tokenMintDecimalsCache;
}

function toRawAmount(tokens: number, decimals: number): bigint {
  if (!Number.isFinite(tokens)) {
    throw new Error('invalid_claim_amount');
  }
  const [wholePartRaw, fracRaw = ''] = tokens.toString().split('.');
  const wholePart = wholePartRaw.replace(/^(-?)0+(?=\d)/, '$1');
  let fraction = fracRaw.replace(/[^0-9]/g, '');
  if (fraction.length > decimals) {
    fraction = fraction.slice(0, decimals);
  } else {
    fraction = fraction.padEnd(decimals, '0');
  }
  const combined = `${wholePart || '0'}${fraction}`;
  return BigInt(combined || '0');
}

export async function getSolanaTokenDecimals(): Promise<number | null> {
  if (!config.solana.tokenMint) return null;
  const mint = new PublicKey(config.solana.tokenMint);
  return ensureTokenDecimals(mint);
}

export async function sendTokensSolana(to: string, amount: bigint): Promise<string> {
  const recipient = new PublicKey(to);
  if (config.solana.tokenMint) {
    const mint = new PublicKey(config.solana.tokenMint);
    let onChainAmount = amount;
    try {
      const decimals = await ensureTokenDecimals(mint);
      if (decimals !== config.solana.tokenDecimals) {
        onChainAmount = toRawAmount(config.solana.claimAmountTokens, decimals);
        console.warn('solana_token_decimals_mismatch', {
          configured: config.solana.tokenDecimals,
          onChain: decimals,
          adjustedAmount: onChainAmount.toString()
        });
      }
    } catch (err) {
      console.warn('solana_token_decimal_fetch_failed', err);
    }
    const fromTokenAccount = await safeGetOrCreateAta(mint, solanaKeypair.publicKey);
    const toTokenAccount = await safeGetOrCreateAta(mint, recipient);
    const instruction = createTransferInstruction(
      fromTokenAccount.address,
      toTokenAccount.address,
      solanaKeypair.publicKey,
      onChainAmount
    );
    const tx = new Transaction().add(instruction);
    const signature = await sendAndConfirmTransaction(solanaConnection, tx, [solanaKeypair]);
    return signature;
  }

  const lamports = Number(amount);
  if (!Number.isSafeInteger(lamports)) {
    throw new Error('claim_amount_too_large');
  }
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: solanaKeypair.publicKey,
      toPubkey: recipient,
      lamports
    })
  );
  const signature = await sendAndConfirmTransaction(solanaConnection, tx, [solanaKeypair]);
  return signature;
}

export async function getSolanaNativeBalance(address?: string): Promise<bigint> {
  const target = address ? new PublicKey(address) : solanaKeypair.publicKey;
  const lamports = await solanaConnection.getBalance(target);
  return BigInt(lamports);
}

export async function getSolanaTokenBalance(mintAddress: string, holderAddress?: string): Promise<bigint> {
  const mint = new PublicKey(mintAddress);
  const holder = holderAddress ? new PublicKey(holderAddress) : solanaKeypair.publicKey;
  try {
    const ata = await getAssociatedTokenAddress(mint, holder);
    const balance = await solanaConnection.getTokenAccountBalance(ata);
    return BigInt(balance.value.amount);
  } catch (e) {
    return 0n;
  }
}
