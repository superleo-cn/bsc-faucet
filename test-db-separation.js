#!/usr/bin/env node

// Test script to verify database chain separation

import { getLastSuccess, insertClaim } from '../src/db/index.js';

const testAddress = '0x1234567890123456789012345678901234567890';

console.log('Testing database chain separation...\n');

// Test BSC chain
console.log('1. Testing BSC chain:');
const bscLast = getLastSuccess(testAddress, 'bsc');
console.log('BSC last claim:', bscLast);

// Test SOCCHAIN  
console.log('\n2. Testing SOCCHAIN:');
const socchainLast = getLastSuccess(testAddress, 'socchain');
console.log('SOCCHAIN last claim:', socchainLast);

// Insert a test claim for BSC
console.log('\n3. Inserting test claim for BSC...');
try {
  const bscClaimId = insertClaim({
    address: testAddress,
    chain: 'bsc',
    tx_hash: '0xtest_bsc_tx',
    amount: '100000000000000000000',
    claimed_at: Date.now(),
    next_allowed_at: Date.now() + 86400000, // 24 hours
    status: 'SUCCESS',
    failure_reason: null,
    ip: '127.0.0.1'
  });
  console.log('BSC claim inserted with ID:', bscClaimId);
} catch (error) {
  console.error('Error inserting BSC claim:', error);
}

// Insert a test claim for SOCCHAIN
console.log('\n4. Inserting test claim for SOCCHAIN...');
try {
  const socchainClaimId = insertClaim({
    address: testAddress,
    chain: 'socchain', 
    tx_hash: '0xtest_socchain_tx',
    amount: '100000000000000000000',
    claimed_at: Date.now(),
    next_allowed_at: Date.now() + 86400000, // 24 hours
    status: 'SUCCESS',
    failure_reason: null,
    ip: '127.0.0.1'
  });
  console.log('SOCCHAIN claim inserted with ID:', socchainClaimId);
} catch (error) {
  console.error('Error inserting SOCCHAIN claim:', error);
}

// Verify separation
console.log('\n5. Verifying chain separation:');
const bscLastAfter = getLastSuccess(testAddress, 'bsc');
const socchainLastAfter = getLastSuccess(testAddress, 'socchain');

console.log('BSC last claim after insert:', bscLastAfter);
console.log('SOCCHAIN last claim after insert:', socchainLastAfter);

if (bscLastAfter && socchainLastAfter) {
  console.log('\n✅ Success: Each chain has independent claims!');
} else {
  console.log('\n❌ Error: Chain separation not working properly');
}