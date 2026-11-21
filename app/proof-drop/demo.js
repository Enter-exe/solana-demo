const $ = (id) => document.getElementById(id);
const original = 'Workshop submission\nProject: Solar Library\nVersion: 1.0';
const altered = original.replace('1.0', '1.1');
let digest;
let busy = false;
let selection = 0;

function syncButtons() {
  $('stamp').disabled = busy || !digest;
  $('verify').disabled = busy || !digest || !$('signature').value.trim();
  $('copy').disabled = !$('signature').value.trim();
}

function status(message, tone = '') {
  $('status').textContent = message;
  $('status').dataset.tone = tone;
}

async function sha256(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function requestProof(action, body) {
  const response = await fetch(`/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}

for (let index = 0; index < 32; index++) {
  const cell = document.createElement('span');
  cell.textContent = ((index * 73 + 167) % 256).toString(16).padStart(2, '0');
  if ([2, 3, 6, 9, 12, 13, 18, 23, 27, 30].includes(index)) cell.className = 'lit';
  $('art-grid').append(cell);
}

async function fingerprint(file, specimen) {
  const current = ++selection;
  digest = undefined;
  $('file-name').textContent = file.name;
  $('file-detail').textContent = `${file.size.toLocaleString()} bytes · hashed in this browser`;
  $('sample-preview').hidden = specimen === undefined;
  $('sample-preview').textContent = specimen ?? '';
  $('hash').textContent = 'Calculating…';
  status('Reading the file fingerprint.');
  syncButtons();

  try {
    if (file.size > 50 * 1024 * 1024) throw new Error('Choose a file up to 50 MB.');
    const hash = await sha256(await file.arrayBuffer());
    if (current !== selection) return;
    digest = hash;
    $('hash').textContent = digest;
    document.querySelectorAll('#art-grid span').forEach((cell, index) => {
      cell.textContent = digest.slice(index * 2, index * 2 + 2);
    });
    status($('signature').value.trim()
      ? 'Fingerprint ready. Verify it against the existing receipt.'
      : 'Fingerprint ready. Stamp it to execute a Solana Memo transaction.');
  } catch (error) {
    if (current !== selection) return;
    $('hash').textContent = 'Unavailable';
    status(error.message, 'error');
  } finally {
    if (current === selection) syncButtons();
  }
}

function sample(text) {
  $('file').value = '';
  void fingerprint(new File([text], 'workshop-submission.txt', { type: 'text/plain' }), text);
}

$('sample').addEventListener('click', () => sample(original));
$('altered').addEventListener('click', () => sample(altered));
$('file').addEventListener('change', ({ target }) => {
  if (target.files[0]) void fingerprint(target.files[0]);
});
$('drop-zone').addEventListener('dragover', (event) => {
  event.preventDefault();
  $('drop-zone').classList.add('dragging');
});
$('drop-zone').addEventListener('dragleave', () => $('drop-zone').classList.remove('dragging'));
$('drop-zone').addEventListener('drop', (event) => {
  event.preventDefault();
  $('drop-zone').classList.remove('dragging');
  const file = event.dataTransfer.files[0];
  if (file) {
    $('file').value = '';
    void fingerprint(file);
  }
});

function clearReceipt() {
  $('receipt-data').hidden = true;
  $('receipt-empty').hidden = false;
}

$('signature').addEventListener('input', () => {
  clearReceipt();
  status('Verify a file against the signature you entered.');
  syncButtons();
});
$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('signature').value.trim());
    status('Transaction signature copied.');
  } catch {
    $('signature').select();
    status('Signature selected. Copy it using your keyboard.');
  }
});

function showReceipt(receipt) {
  $('receipt-empty').hidden = true;
  $('receipt-data').hidden = false;
  $('signature').value = receipt.signature;
  $('timestamp').textContent = new Date(receipt.timestamp).toLocaleString();
  $('recorded').textContent = receipt.digest;
  $('compute').textContent = `${receipt.computeUnits.toLocaleString()} CU`;
  $('logs').textContent = receipt.logs.join('\n');
}

async function submit(action) {
  if (busy || !digest) return;
  busy = true;
  const request = { digest, signature: $('signature').value.trim() };
  const current = selection;
  $('signature').readOnly = true;
  syncButtons();
  status(action === 'stamp' ? 'Executing the Memo transaction…' : 'Looking up the transaction…');
  try {
    const result = await requestProof(action, request);
    showReceipt(result.receipt);
    if (current !== selection) {
      status('Receipt found. Verify the newly selected file to compare it.');
    } else if (action === 'stamp') {
      status('Stamped. Now verify this file, then change one character and verify again.', 'success');
    } else if (result.matches) {
      status('MATCH · This file has the exact fingerprint recorded in the transaction.', 'success');
    } else {
      status('MISMATCH · This file differs from the fingerprint recorded in the transaction.', 'error');
    }
  } catch (error) {
    if (action === 'verify') clearReceipt();
    status(error.message, 'error');
  } finally {
    busy = false;
    $('signature').readOnly = false;
    syncButtons();
  }
}

$('stamp').addEventListener('click', () => void submit('stamp'));
$('verify').addEventListener('click', () => void submit('verify'));

const cases = [
  {
    name: 'Campus budget',
    clue: 'The ledger lists two $30 kits and one $20 cable. The original submission matches the ledger.',
    prefix: 'Campus library pitch\nTeam: Solar Library\nMaterials budget: $',
    original: '8',
    edit: '9',
    suffix: '0',
    explanation: 'One digit changed the submitted budget from $80 to $90.',
  },
  {
    name: 'Approval note',
    clue: 'The submission log shows 57 bytes for the original file. Inspect each candidate to compare sizes.',
    prefix: 'Campus library pitch\nTeam: Solar Library\nStatus: Approved',
    original: '',
    edit: ' ',
    suffix: '',
    explanation: 'A single trailing space (UTF-8 byte 20) was added after “Approved”.',
  },
  {
    name: 'Venue announcement',
    clue: 'The submission form saved the venue name with a precomposed é. Inspect the bytes and look for C3 A9.',
    prefix: 'Campus library pitch\nVenue: Caf',
    original: '\u00e9',
    edit: 'e\u0301',
    suffix: ' Central\nDoors open: 10:00',
    explanation: 'The original uses one precomposed é (C3 A9). The edit uses e plus a combining accent (65 CC 81). They look alike but encode different bytes.',
  },
];

const sides = ['a', 'b'];
const encoder = new TextEncoder();
let nextCase = 0;
let round;

function arenaStatus(message, tone = '') {
  $('arena-status').textContent = message;
  $('arena-status').dataset.tone = tone;
}

function lockVotes(disabled) {
  for (const side of sides) $('guess-' + side).disabled = disabled;
}

function showCandidate(side, candidate, scenario) {
  const preview = $('preview-' + side);
  preview.textContent = candidate.text;
  const line = scenario.prefix.split('\n').at(-1) + candidate.fragment + scenario.suffix.split('\n')[0];
  const hex = Array.from(encoder.encode(line), (byte) => byte.toString(16).padStart(2, '0').toUpperCase());
  $('facts-' + side).textContent = `${encoder.encode(candidate.text).length} bytes total · UTF-8 bytes for the line in question`;
  $('bytes-' + side).textContent = hex.join(' ');
  $('candidate-' + side).querySelector('details').open = false;
}

async function startRound() {
  const start = $('round-start');
  start.disabled = true;
  round = undefined;
  lockVotes(true);
  $('round').hidden = true;
  arenaStatus('Hashing both files and stamping one fingerprint in Solana…');
  try {
    const scenario = cases[nextCase];
    const variants = [scenario.original, scenario.edit];
    // Randomize the cards without changing which version was originally submitted.
    if (crypto.getRandomValues(new Uint8Array(1))[0] & 1) variants.reverse();
    const candidates = await Promise.all(variants.map(async (fragment) => {
      const text = scenario.prefix + fragment + scenario.suffix;
      return { text, fragment, digest: await sha256(encoder.encode(text)) };
    }));
    const originalIndex = variants.indexOf(scenario.original);
    const { receipt } = await requestProof('stamp', { digest: candidates[originalIndex].digest });

    round = { scenario, candidates, signature: receipt.signature };
    $('reveal').hidden = true;
    $('challenge-evidence').open = false;
    $('round-label').textContent = `ROUND ${nextCase + 1} OF ${cases.length} · ${scenario.name}`;
    $('round-clue').textContent = scenario.clue;
    nextCase = (nextCase + 1) % cases.length;
    for (const [index, side] of sides.entries()) {
      $('candidate-' + side).removeAttribute('data-verdict');
      $('verdict-' + side).textContent = 'Candidate ' + side.toUpperCase();
      showCandidate(side, candidates[index], scenario);
    }
    $('round').hidden = false;
    lockVotes(false);
    $('guess-a').focus({ preventScroll: true });
    arenaStatus('Receipt signed and executed. Read the clue, inspect the files if needed, then take a room vote.', 'success');
  } catch (error) {
    start.disabled = false;
    arenaStatus(error.message, 'error');
  }
}

function showBitMap(originalDigest, alteredDigest) {
  const map = document.createDocumentFragment();
  let flipped = 0;
  for (let i = 0; i < originalDigest.length; i += 2) {
    const originalByte = parseInt(originalDigest.slice(i, i + 2), 16);
    const changedByte = parseInt(alteredDigest.slice(i, i + 2), 16);
    const byte = document.createElement('span');
    byte.className = 'bit-byte';
    byte.style.setProperty('--byte', i / 2);
    for (let bit = 7; bit >= 0; bit--) {
      const changed = ((originalByte ^ changedByte) & (1 << bit)) !== 0;
      const square = document.createElement('i');
      if (changed) {
        flipped++;
        square.className = 'flipped';
      }
      byte.append(square);
    }
    map.append(byte);
  }
  $('bit-map').replaceChildren(map);
  $('bit-count').textContent = `${flipped} of 256 hash bits flipped`;
}

function showEdit(preview, scenario, fragment) {
  const mark = document.createElement('mark');
  mark.textContent = fragment === '' ? '∅' : fragment === ' ' ? '␠' : fragment;
  preview.replaceChildren(scenario.prefix, mark, scenario.suffix);
}

async function vote(choice) {
  if (!round || $('guess-a').disabled) return;
  const start = $('round-start');
  start.disabled = true;
  lockVotes(true);
  arenaStatus('Checking both fingerprints against the same transaction…');
  try {
    const results = await Promise.all(round.candidates.map(({ digest }) =>
      requestProof('verify', { digest, signature: round.signature }),
    ));
    const winner = results.findIndex(({ matches }) => matches);
    if (winner < 0 || results.filter(({ matches }) => matches).length !== 1) {
      throw new Error('The receipt did not produce a unique match.');
    }
    const receipt = results[winner].receipt;
    for (const [index, side] of sides.entries()) {
      const isOriginal = index === winner;
      $('candidate-' + side).dataset.verdict = isOriginal ? 'match' : 'changed';
      $('verdict-' + side).textContent = isOriginal ? 'Original · matches receipt' : 'Edited · different hash';
      $('digest-' + side).textContent = round.candidates[index].digest;
      showEdit($('preview-' + side), round.scenario, round.candidates[index].fragment);
    }
    $('edit-explanation').textContent = round.scenario.explanation;
    $('challenge-signature').textContent = receipt.signature;
    $('challenge-logs').textContent = receipt.logs.join('\n');
    showBitMap(receipt.digest, round.candidates[1 - winner].digest);
    $('reveal').hidden = false;

    const letter = sides[winner].toUpperCase();
    arenaStatus(choice === winner
      ? `Correct. Candidate ${letter} matches the Solana receipt.`
      : `Candidate ${letter} was the original. Its fingerprint matches the Solana receipt.`, 'success');
    start.textContent = nextCase === 0 ? 'Play again ↻' : 'Next round →';
    start.disabled = false;
    start.focus({ preventScroll: true });
  } catch (error) {
    arenaStatus(error.message + ' Retry the vote or start a new round.', 'error');
    lockVotes(false);
    start.textContent = 'Start new round ↗';
    start.disabled = false;
  }
}

$('round-start').addEventListener('click', startRound);
for (const [index, side] of sides.entries()) {
  $('guess-' + side).addEventListener('click', () => vote(index));
}
