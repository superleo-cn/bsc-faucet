#!/usr/bin/env tsx
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const args = process.argv.slice(2).map((a) => a.toLowerCase());
const flagSet = new Set(args);

if (flagSet.has('--help') || flagSet.has('-h')) {
	console.log('Usage: npm run gen:account [--evm] [--solana] [--all]');
	console.log('Without flags this generates an EVM account; use --solana for Solana, --all for both.');
	process.exit(0);
}

const wantsAll = flagSet.has('--all') || flagSet.has('all');
const wantsEvm = wantsAll || flagSet.has('--evm') || flagSet.has('evm') || flagSet.size === 0;
const wantsSol =
	wantsAll ||
	flagSet.has('--solana') ||
	flagSet.has('solana') ||
	flagSet.has('--sol') ||
	flagSet.has('sol');

if (!wantsEvm && !wantsSol) {
	console.error('Nothing to do. Use --evm, --solana, or --all.');
	process.exit(1);
}

if (wantsEvm) {
	const pk = generatePrivateKey();
	const account = privateKeyToAccount(pk);
	console.log('--- EVM (BSC / ETH) ---');
	console.log('Address      :', account.address);
	console.log('Private Key  :', pk);
	console.log('\nAdd to .env -> PRIVATE_KEY=' + pk + '\n');
}

if (wantsSol) {
	const kp = Keypair.generate();
	const secret = bs58.encode(kp.secretKey);
	console.log('--- Solana ---');
	console.log('Public Key   :', kp.publicKey.toBase58());
	console.log('Secret Base58:', secret);
	console.log('Secret Array :', JSON.stringify(Array.from(kp.secretKey)));
	console.log('\nAdd to .env -> SOLANA_SECRET_KEY=' + secret + '\n');
}
