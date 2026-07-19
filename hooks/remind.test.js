const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const REMIND_PATH = path.join(__dirname, 'remind.js');
const EXPECTED_MESSAGE =
  "This project uses the turnstile workflow; never skip a gate. Only /turnstile:review marks an item done; search turnstile/brain/ before starting new work. Never read env files (.env, .env.*, *.env, .envrc) -- no tool, no shell command, no exceptions; ask the user for config values. If this message concerns project work (an idea, a ticket, a bug, a review request, or board status), invoke the turnstile-conversate skill to classify and route it -- unless you just asked the user a follow-up question inside a gated turnstile skill (refine/breakdown/spec/sprint-plan/next/quick/drop/park/pickup/work/review). Answer messages unrelated to turnstile work normally, without routing.\n";

test('remind.js prints nothing when no turnstile/ directory exists', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'turnstile-remind-test-'));
  const output = execFileSync('node', [REMIND_PATH], { encoding: 'utf8', cwd: tmpDir });
  assert.equal(output, '');
});

test('remind.js prints the workflow + routing reminder when turnstile/ directory exists', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'turnstile-remind-test-'));
  fs.mkdirSync(path.join(tmpDir, 'turnstile'));
  const output = execFileSync('node', [REMIND_PATH], { encoding: 'utf8', cwd: tmpDir });
  assert.equal(output, EXPECTED_MESSAGE);
});

test('remind.js appends a stray-note line when a root file shadows an alias', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'turnstile-remind-test-'));
  const vault = path.join(tmpDir, 'turnstile');
  const epics = path.join(vault, 'epics');
  fs.mkdirSync(epics, { recursive: true });
  fs.writeFileSync(
    path.join(epics, 'EP-1.md'),
    '---\ntype: epic\naliases: ["C-1", "Payment flow"]\n---\n\n# C-1: Payment flow\n'
  );
  fs.writeFileSync(path.join(vault, 'C-1.md'), '');
  const output = execFileSync('node', [REMIND_PATH], { encoding: 'utf8', cwd: tmpDir });
  assert.ok(output.startsWith(EXPECTED_MESSAGE));
  assert.match(output, /1 stray note\(s\) hijacking wikilinks/);
  assert.match(output, /C-1\.md \(empty, shadows EP-1\)/);
});

test('remind.js appends an unresolved-link line for click-trap wikilinks', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'turnstile-remind-test-'));
  const brain = path.join(tmpDir, 'turnstile', 'brain');
  fs.mkdirSync(brain, { recursive: true });
  fs.writeFileSync(
    path.join(brain, 'api-auth.md'),
    '---\ntype: domain\nrelated: ["[[nonexistent-note]]"]\n---\n\n# API auth\n\nSee [[nonexistent-note]].\n'
  );
  const output = execFileSync('node', [REMIND_PATH], { encoding: 'utf8', cwd: tmpDir });
  assert.ok(output.startsWith(EXPECTED_MESSAGE));
  assert.match(output, /1 unresolved wikilink target\(s\)/);
  assert.match(output, /\[\[nonexistent-note\]\] \(in api-auth\)/);
});

function runRemind(cwd, sessionId) {
  return execFileSync('node', [REMIND_PATH], {
    encoding: 'utf8',
    cwd,
    input: JSON.stringify({ session_id: sessionId, hook_event_name: 'UserPromptSubmit', prompt: 'x' }),
  });
}

test('remind.js emits the full message on the first prompt of a session, a short anchor after', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'turnstile-remind-test-'));
  fs.mkdirSync(path.join(tmpDir, 'turnstile'));
  const first = runRemind(tmpDir, 'session-a');
  const second = runRemind(tmpDir, 'session-a');
  assert.equal(first, EXPECTED_MESSAGE);
  assert.notEqual(second, EXPECTED_MESSAGE);
  assert.ok(second.length < EXPECTED_MESSAGE.length / 4, `anchor too long: ${second.length} chars`);
  assert.match(second, /turnstile/i);
  assert.match(second, /conversate/);
});

test('remind.js emits the full message again for a different session id', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'turnstile-remind-test-'));
  fs.mkdirSync(path.join(tmpDir, 'turnstile'));
  runRemind(tmpDir, 'session-a');
  const otherSession = runRemind(tmpDir, 'session-b');
  assert.equal(otherSession, EXPECTED_MESSAGE);
});

test('remind.js re-emits the full message periodically within one session', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'turnstile-remind-test-'));
  fs.mkdirSync(path.join(tmpDir, 'turnstile'));
  let fullCount = 0;
  for (let i = 0; i < 61; i++) {
    if (runRemind(tmpDir, 'session-a') === EXPECTED_MESSAGE) fullCount++;
  }
  assert.ok(fullCount >= 2, `full message emitted ${fullCount} time(s) in 61 prompts; expected a periodic refresh`);
  assert.ok(fullCount <= 4, `full message emitted ${fullCount} time(s) in 61 prompts; refresh too frequent`);
});

test('remind.js still appends alert lines on anchor turns', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'turnstile-remind-test-'));
  const vault = path.join(tmpDir, 'turnstile');
  fs.mkdirSync(vault);
  runRemind(tmpDir, 'session-a');
  fs.writeFileSync(path.join(vault, 'stray.md'), '');
  const anchorTurn = runRemind(tmpDir, 'session-a');
  assert.notEqual(anchorTurn.slice(0, 30), EXPECTED_MESSAGE.slice(0, 30));
  assert.match(anchorTurn, /1 stray note\(s\) hijacking wikilinks/);
});

test('remind.js falls back to the full message when stdin has no session id', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'turnstile-remind-test-'));
  fs.mkdirSync(path.join(tmpDir, 'turnstile'));
  const output = execFileSync('node', [REMIND_PATH], { encoding: 'utf8', cwd: tmpDir, input: 'not json' });
  assert.equal(output, EXPECTED_MESSAGE);
});

test('remind.js appends a hand-edit line when tracked knowledge notes changed', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'turnstile-remind-test-'));
  const vault = path.join(tmpDir, 'turnstile');
  const brain = path.join(vault, 'brain');
  fs.mkdirSync(brain, { recursive: true });
  fs.writeFileSync(path.join(brain, 'known.md'), '# Known\n');
  const { listChangedNotes } = require('../scripts/brain-mcp.js');
  listChangedNotes(vault, { acknowledge: true });
  fs.writeFileSync(path.join(brain, 'hand-made.md'), '# Hand made\n');
  const output = execFileSync('node', [REMIND_PATH], { encoding: 'utf8', cwd: tmpDir });
  assert.ok(output.startsWith(EXPECTED_MESSAGE));
  assert.match(output, /1 knowledge note\(s\) changed outside turnstile/);
  assert.match(output, /hand-made/);
});
