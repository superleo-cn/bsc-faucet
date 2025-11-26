import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, createTransferInstruction } from '@solana/spl-token';
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

export async function sendTokensSolana(to: string, amount: bigint): Promise<string> {
  const recipient = new PublicKey(to);
  if (config.solana.tokenMint) {
    const mint = new PublicKey(config.solana.tokenMint);
    const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
      solanaConnection,
      solanaKeypair,
      mint,
      solanaKeypair.publicKey
    );
    const toTokenAccount = await getOrCreateAssociatedTokenAccount(
      solanaConnection,
      solanaKeypair,
      mint,
      recipient
    );
    const instruction = createTransferInstruction(
      fromTokenAccount.address,
      toTokenAccount.address,
      solanaKeypair.publicKey,
      amount
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
