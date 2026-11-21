import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

import {
  createClient, generateKeyPairSigner, getSignatureFromTransaction, lamports, signature,
  signTransactionMessageWithSigners,
} from '@solana/kit';
import { getAddMemoInstruction, LEGACY_MEMO_PROGRAM_ADDRESS_V3 } from '@solana-program/memo';
import { litesvm } from '@solana/kit-plugin-litesvm';
import { signer } from '@solana/kit-plugin-signer';
import { FailedTransactionMetadata, TransactionMetadata } from 'litesvm';

const payer = await generateKeyPairSigner();
const client = createClient()
  .use(signer(payer))
  .use(litesvm({ transactionConfig: { version: 1 } }));
client.svm.withTransactionHistory(1_000n);
client.svm.airdrop(payer.address, lamports(1_000_000_000n));

const digestPattern = /^[0-9a-f]{64}$/;
const memoPattern = /^Program log: proof-drop:v1:([0-9a-f]{64}):(\d{13}):[0-9a-f]{16}$/;
const memoProgram = LEGACY_MEMO_PROGRAM_ADDRESS_V3; // Bundled with LiteSVM.

function receiptFor(txSignature) {
  const tx = client.svm.getTransaction(txSignature);
  if (!(tx instanceof TransactionMetadata)) return null;
  const logs = tx.logs();
  // The service submits only Memo transactions. Verify the actual VM log and program ID.
  if (!logs.includes(`Program ${memoProgram} success`)) return null;
  for (const line of logs) {
    const memo = memoPattern.exec(line);
    if (memo) {
      return {
        signature: txSignature,
        digest: memo[1],
        timestamp: Number(memo[2]),
        computeUnits: Number(tx.computeUnitsConsumed()),
        logs,
      };
    }
  }
  return null;
}

const assets = new Map(await Promise.all([
  ['/', 'index.html', 'text/html'],
  ['/style.css', 'style.css', 'text/css'],
  ['/demo.js', 'demo.js', 'text/javascript'],
].map(async ([path, file, type]) => [
  path, { body: await readFile(new URL(file, import.meta.url)), type },
])));

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      if (body.length > 2048) return;
      body += chunk;
      if (body.length > 2048) reject(new Error('Request too large.'));
    });
    req.on('error', reject);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Expected a JSON object.'));
      }
    });
  });
}

const server = createServer(async (req, res) => {
  const path = (req.url ?? '').split('?')[0];
  if (req.method === 'GET' && assets.has(path)) {
    const { body, type } = assets.get(path);
    res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff' });
    return res.end(body);
  }
  if (req.method !== 'POST' || !['/stamp', '/verify'].includes(path)) {
    return json(res, 404, { error: 'Route not found.' });
  }
  if (req.headers['content-type'] !== 'application/json') {
    return json(res, 415, { error: 'Expected application/json.' });
  }

  let input;
  try {
    input = await readBody(req);
    if (typeof input?.digest !== 'string' || !digestPattern.test(input.digest)) {
      throw new Error('Expected a 64-character SHA-256 hash.');
    }
    if (path === '/verify') signature(input.signature);
  } catch (error) {
    return json(res, 400, { error: path === '/verify' ? 'Enter a valid file hash and Solana transaction signature.' : error.message });
  }

  try {
    if (path === '/verify') {
      const receipt = receiptFor(input.signature);
      if (!receipt) return json(res, 404, { error: 'Receipt not found in this local session.' });
      return json(res, 200, { receipt, matches: receipt.digest === input.digest });
    }
    const memo = getAddMemoInstruction({
      memo: `proof-drop:v1:${input.digest}:${Date.now()}:${randomBytes(8).toString('hex')}`,
    }, { programAddress: memoProgram });
    const message = await client.planTransaction([memo]);
    const transaction = await signTransactionMessageWithSigners(
      client.svm.setTransactionMessageLifetimeUsingLatestBlockhash(message),
    );
    const simulation = client.svm.simulateTransaction(transaction);
    if (simulation instanceof FailedTransactionMetadata) throw new Error(simulation.toString());
    const result = client.svm.sendTransaction(transaction);
    if (result instanceof FailedTransactionMetadata) throw new Error(result.toString());
    const txSignature = getSignatureFromTransaction(transaction);
    const receipt = receiptFor(txSignature);
    if (!receipt) throw new Error('Memo execution could not be verified.');
    return json(res, 201, { receipt });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Local Solana transaction failed. See the server console.' });
  }
});

server.listen(Number(process.env.PORT ?? 4173), '127.0.0.1', () => {
  console.log(`Proof Drop is running at http://127.0.0.1:${server.address().port}`);
});
