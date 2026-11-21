# Proof Drop · Solana Demo

Proof Drop records a file’s SHA-256 fingerprint in a signed Solana Memo transaction. The browser hashes the file locally and sends only the fingerprint to the demo server. The server executes the transaction in LiteSVM, a local Solana runtime, and verifies files against the resulting transaction logs.

## Run the demo locally

You’ll need Git, Node.js 24 or newer with npm, and a Mac or Linux computer. On Windows, use WSL with Git and Node installed inside WSL. The first install needs internet access.

```sh
git clone https://github.com/Enter-exe/solana-demo.git
cd solana-demo
npm exec --yes --package=pnpm@12.21.0 -- pnpm install --frozen-lockfile
npm run demo
```

Wait for the terminal to print `Proof Drop is running at http://127.0.0.1:4173`. Keep that terminal open and [open the demo](http://127.0.0.1:4173) in a browser on the same computer. The link points to your own computer, so it works while your server is running. Press **Ctrl+C** in the terminal to stop it.

For later sessions, go back to the `solana-demo` folder and run `npm run demo` again. If port 4173 is busy, run `PORT=4174 npm run demo` and open [the demo on port 4174](http://127.0.0.1:4174).

## Play a round

Click **Start round**, read the case clue, and inspect the two submissions before voting A or B. The reveal checks both fingerprints against the same Solana receipt and animates the SHA-256 bit differences. The clues involve reconciling a campus budget, comparing exact file sizes, and finding a UTF-8 byte sequence.

Open **Inspect both fingerprints and the Solana receipt** to show the transaction signature and execution logs. Use **Try your own file** to stamp a real submission and check it later against the same receipt.

After installing dependencies, the demo runs offline with an ephemeral signer and simulated SOL. Receipts live in memory and disappear on restart. The timestamp comes from the local server clock. A match shows byte-for-byte integrity against the recorded hash.
