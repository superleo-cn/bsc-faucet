#!/usr/bin/env tsx
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const pk = generatePrivateKey();
const account = privateKeyToAccount(pk);
console.log('Address :', account.address);
console.log('PrivateKey :', pk);
console.log('\nAdd to .env -> PRIVATE_KEY=' + pk);
