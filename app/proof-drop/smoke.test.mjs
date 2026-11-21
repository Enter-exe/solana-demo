import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { LEGACY_MEMO_PROGRAM_ADDRESS_V3 } from '@solana-program/memo';
import { stampFingerprint, verifyFingerprint } from './server.mjs';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

test('a Solana Memo receipt verifies the original file and rejects a one-byte edit', { timeout: 10_000 }, async (t) => {
  const digest = sha256('Materials budget: $80\n');
  const editedDigest = sha256('Materials budget: $90\n');
  const receipt = await stampFingerprint(digest);
  assert.equal(receipt.digest, digest);
  assert.ok(receipt.computeUnits > 0);
  assert.ok(receipt.logs.includes(`Program ${LEGACY_MEMO_PROGRAM_ADDRESS_V3} success`));

  const signature = receipt.signature;
  const original = verifyFingerprint(digest, signature);
  const edited = verifyFingerprint(editedDigest, signature);
  assert.deepEqual(original, { receipt, matches: true });
  assert.deepEqual(edited, { receipt, matches: false });

  t.diagnostic(`SPL Memo executed (${receipt.computeUnits} CU). Original matched and one-byte edit was rejected against the same receipt.`);
});
