# Proof Drop · Solana Demo

Proof Drop records a file’s SHA-256 fingerprint in a signed Solana Memo transaction. The browser hashes the file locally and sends only the fingerprint to the demo server. The server executes the transaction in LiteSVM, a local Solana runtime, and verifies files against the resulting transaction logs.

With Node 22 or newer, run:

```sh
corepack pnpm install --frozen-lockfile
node app/proof-drop/server.mjs
```

Open [Proof Drop](http://127.0.0.1:4173) and click **Start round**. Read the case clue, give the room time to inspect the submissions, and ask for a vote A or B. Click the room's choice to check both fingerprints against the same Solana receipt and animate the SHA-256 bit differences. The clues involve reconciling a campus budget, comparing exact file sizes, and finding a UTF-8 byte sequence.

Open **Inspect both fingerprints and the Solana receipt** to show the transaction signature and execution logs. Use **Try your own file** to stamp a real submission and check it later against the same receipt.

After installing dependencies, the demo runs offline with an ephemeral signer and simulated SOL. Receipts live in memory and disappear on restart. The timestamp comes from the local server clock. A match shows byte-for-byte integrity against the recorded hash.
